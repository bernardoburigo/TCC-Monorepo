import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  APP_URL,
  PROPRIETARIO,
  SINDICO,
  abrirNavegador,
  capturar,
  chamarApi,
  entrar,
  enviarLeituraSimulada,
  novaPagina,
  parseVolumeMl,
  tokenDaApi,
} from './helpers.mjs';

// Todos os dados vêm do SIMULADOR (docs/scripts/simulador.py). Nada aqui mede hardware real.
describe('detalhe do apartamento e gráfico de consumo', () => {
  let browser;
  let apartamentos; // por número, como a API devolve

  before(async () => {
    browser = await abrirNavegador();
    const token = await tokenDaApi(SINDICO);
    const { corpo } = await chamarApi('/api/me/apartamentos', { token });
    apartamentos = Object.fromEntries(corpo.map((a) => [a.numero, a]));
  });
  after(async () => {
    await browser.close();
  });

  const ehConsumo = (granularidade) => (req) =>
    req.url().includes('/consumo') && req.url().includes(`granularidade=${granularidade}`);

  // Soma do consumo na API com os MESMOS parâmetros que o app enviou (tolerância: arredondamento
  // do texto na tela + o que o simulador possa ter enviado entre uma leitura e outra).
  async function totalDaApiComOsParametrosDoApp(requisicao) {
    const url = new URL(requisicao.url());
    const token = await tokenDaApi(SINDICO);
    const { corpo } = await chamarApi(`${url.pathname}${url.search}`, { token });
    return corpo.pontos.reduce((soma, p) => soma + p.volumeTotalMl, 0);
  }

  // Na Web o React Navigation mantém as telas anteriores montadas (ocultas): só o cabeçalho visível conta.
  const tituloVisivel = (page) => page.locator('[data-testid="titulo-tela"]:visible').innerText();

  async function abrirDetalhe(page, numero, granularidade = 'HORA') {
    const consumo = page.waitForRequest(ehConsumo(granularidade));
    await page.getByTestId(`cartao-apartamento-${numero}`).click();
    await page.getByTestId('grafico-consumo').waitFor({ timeout: 20_000 });
    return consumo;
  }

  it('mostra o apartamento, o consumo de hoje e o gráfico das últimas 24 horas coerentes com a API', async () => {
    const page = await novaPagina(browser);
    await entrar(page, SINDICO);
    const requisicao = await abrirDetalhe(page, '101');

    assert.equal(await tituloVisivel(page), 'Apto 101');
    assert.equal((await page.getByTestId('selo-simulado').count()) >= 1, true);
    assert.match(await page.getByTestId('consumo-hoje').innerText(), /\d/);
    assert.match(await page.getByText('Total (24 horas)').innerText(), /24 horas/i);

    const totalTela = parseVolumeMl(await page.getByTestId('total-periodo').innerText());
    const totalApi = await totalDaApiComOsParametrosDoApp(requisicao);
    assert.ok(Math.abs(totalTela - totalApi) <= 1500, `tela ${totalTela} mL x API ${totalApi} mL`);
    assert.deepEqual(page.errosDaPagina, []);

    await capturar(page, 'app-apartamento-24h');
  });

  it('trocar o período refaz a consulta com a granularidade certa e mantém o total coerente', async () => {
    const page = await novaPagina(browser);
    await entrar(page, SINDICO);
    await abrirDetalhe(page, '101');

    for (const [id, rotulo] of [
      ['7d', 'Total (7 dias)'],
      ['30d', 'Total (30 dias)'],
    ]) {
      const req = page.waitForRequest(ehConsumo('DIA'));
      await page.getByTestId(`periodo-${id}`).click();
      const requisicao = await req;
      await page.getByText(rotulo).waitFor({ timeout: 15_000 });
      await page.getByTestId('consumo-atual').waitFor(); // dado novo na tela (não o do período anterior)

      const totalTela = parseVolumeMl(await page.getByTestId('total-periodo').innerText());
      const totalApi = await totalDaApiComOsParametrosDoApp(requisicao);
      assert.ok(Math.abs(totalTela - totalApi) <= 1500, `${id}: tela ${totalTela} mL x API ${totalApi} mL`);
      if (id === '7d') await capturar(page, 'app-apartamento-7d');
    }

    // volta para 24 h: consulta por hora de novo
    const req = page.waitForRequest(ehConsumo('HORA'));
    await page.getByTestId('periodo-24h').click();
    await req;
    assert.deepEqual(page.errosDaPagina, []);
  });

  it('tocar numa barra mostra o valor exato; tocar de novo limpa', async () => {
    const page = await novaPagina(browser);
    await entrar(page, SINDICO);
    await abrirDetalhe(page, '103');

    assert.equal(await page.getByTestId('detalhe-barra').innerText(), 'Toque numa barra para ver o valor');

    // a barra mais alta do gráfico (elementos clicáveis dentro do gráfico)
    const alvo = await page.evaluate(() => {
      const grafico = document.querySelector('[data-testid="grafico-consumo"]');
      const barras = [...grafico.querySelectorAll('*')]
        .filter((e) => getComputedStyle(e).cursor === 'pointer')
        .map((e) => e.getBoundingClientRect())
        .filter((r) => r.width < 60 && r.height > 20);
      barras.sort((a, b) => b.height - a.height);
      const r = barras[0];
      return r ? { x: r.left + r.width / 2, y: r.top + r.height - 2 } : null;
    });
    assert.ok(alvo, 'nenhuma barra clicável encontrada no gráfico');

    await page.mouse.click(alvo.x, alvo.y);
    await page.waitForFunction(() => /·/.test(document.querySelector('[data-testid="detalhe-barra"]')?.textContent ?? ''));
    assert.match(await page.getByTestId('detalhe-barra').innerText(), /^\d\d\/\d\d \d\dh · [\d.,]+ (mL|L)$/);

    await page.mouse.click(alvo.x, alvo.y);
    await page.waitForFunction(() => /Toque numa barra/.test(document.querySelector('[data-testid="detalhe-barra"]')?.textContent ?? ''));
    assert.deepEqual(page.errosDaPagina, []);
  });

  it('lista os sensores do apartamento (SIMULADO, status) e abre o detalhe do sensor', async () => {
    const page = await novaPagina(browser);
    await entrar(page, SINDICO);
    await abrirDetalhe(page, '102');

    const cartao = page.getByTestId('sensor-Sensor simulado 102');
    await cartao.waitFor();
    assert.equal(await cartao.getByTestId('selo-simulado').count(), 1);
    assert.equal(await cartao.getByTestId('selo-real').count(), 0, 'sensor simulado nunca pode aparecer como REAL');

    const token = await tokenDaApi(SINDICO);
    const { corpo: sensores } = await chamarApi(`/api/apartamentos/${apartamentos['102'].id}/sensores`, { token });
    await cartao.click();
    await page.waitForURL(new RegExp(`/sensor/${sensores[0].id}$`));
    assert.deepEqual(page.errosDaPagina, []);
  });

  it('POLLING: o consumo de hoje e o total do período sobem sozinhos quando chega leitura nova', async () => {
    const page = await novaPagina(browser);
    await entrar(page, SINDICO);
    await abrirDetalhe(page, '102');

    const hojeAntes = parseVolumeMl(await page.getByTestId('consumo-hoje').innerText());
    const resposta = await enviarLeituraSimulada('102', { pulsos: 2250, volumeMl: 5000 }); // +5 L SIMULADOS
    assert.equal(resposta.status, 201);

    await page.waitForFunction(
      (antes) => {
        const texto = document.querySelector('[data-testid="consumo-hoje"]')?.textContent ?? '';
        const m = texto.trim().match(/^([\d.]+(?:,\d+)?)\s*(mL|L)$/);
        if (!m) return false;
        const ml = Number(m[1].replace(/\./g, '').replace(',', '.')) * (m[2] === 'L' ? 1000 : 1);
        return ml >= antes + 4000; // +5 L enviados (folga para o arredondamento do texto)
      },
      hojeAntes,
      { timeout: 25_000 },
    );
    assert.deepEqual(page.errosDaPagina, []);
  });

  it('recarregar a página no detalhe (link direto) mantém a sessão e abre o mesmo apartamento', async () => {
    const page = await novaPagina(browser);
    await entrar(page, SINDICO);
    await abrirDetalhe(page, '101');

    await page.reload();
    await page.getByTestId('grafico-consumo').waitFor({ timeout: 25_000 });
    assert.equal(await tituloVisivel(page), 'Apto 101');
    assert.match(page.url(), new RegExp(`/apartamento/${apartamentos['101'].id}$`));
    assert.deepEqual(page.errosDaPagina, []);
  });

  it('proprietário que abre por link o apartamento de outro recebe aviso de permissão (403), não dados', async () => {
    const page = await novaPagina(browser);
    await entrar(page, PROPRIETARIO);
    await page.goto(`${APP_URL}/apartamento/${apartamentos['102'].id}`);

    await page.getByTestId('estado-erro').first().waitFor({ timeout: 25_000 });
    assert.match(await page.getByTestId('estado-erro').first().innerText(), /permissão/i);
    assert.equal(await page.getByTestId('grafico-consumo').count(), 0);
    assert.deepEqual(page.errosDaPagina, []);
  });
});
