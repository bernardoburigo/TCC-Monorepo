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
  novaPagina,
  tokenDaApi,
} from './helpers.mjs';

// Todos os dados vêm do SIMULADOR (docs/scripts/simulador.py) — o simulador precisa estar rodando
// (`python3 docs/scripts/simulador.py rodar`) para os sensores ficarem ONLINE. Nada aqui mede hardware real.
describe('detalhe do sensor (ao vivo)', () => {
  let browser;
  let sensores; // por número do apartamento

  before(async () => {
    browser = await abrirNavegador();
    const token = await tokenDaApi(SINDICO);
    const { corpo: aptos } = await chamarApi('/api/me/apartamentos', { token });
    sensores = {};
    for (const apto of aptos) {
      const { corpo } = await chamarApi(`/api/apartamentos/${apto.id}/sensores`, { token });
      sensores[apto.numero] = corpo[0];
    }
  });
  after(async () => {
    await browser.close();
  });

  const tituloVisivel = (page) => page.locator('[data-testid="titulo-tela"]:visible').innerText();

  async function abrirSensorPelaLista(page, numeroDoApto) {
    await page.getByTestId(`cartao-apartamento-${numeroDoApto}`).click();
    await page.getByTestId(`sensor-Sensor simulado ${numeroDoApto}`).click();
    await page.getByTestId('vazao-atual').waitFor({ timeout: 20_000 });
  }

  it('mostra sensor online, selo SIMULADO (nunca REAL), vazão atual e o gráfico dos últimos 30 min', async () => {
    const page = await novaPagina(browser);
    await entrar(page, SINDICO);
    await abrirSensorPelaLista(page, '103'); // perfil "vazamento": fluxo contínuo -> vazão > 0

    assert.equal(await tituloVisivel(page), 'Sensor simulado 103');
    assert.equal(await page.getByTestId('status-ONLINE').count() >= 1, true);
    assert.equal(await page.getByTestId('selo-simulado').count() >= 1, true);
    assert.equal(await page.getByTestId('selo-real').count(), 0, 'sensor simulado nunca pode aparecer como REAL');
    assert.match(await page.getByTestId('origem-dados').innerText(), /Simulado/);
    assert.match(await page.getByTestId('vazao-atual').innerText(), /^\d+,\d L\/min$/);
    assert.match(await page.getByTestId('medida-as').innerText(), /^\d\d:\d\d:\d\d$/);
    await page.getByTestId('grafico-vazao').waitFor({ timeout: 20_000 });
    assert.deepEqual(page.errosDaPagina, []);

    await capturar(page, 'app-sensor-ao-vivo');
  });

  it('POLLING: a "última leitura" avança sozinha (5 s), sem recarregar a página', async () => {
    const page = await novaPagina(browser);
    await entrar(page, SINDICO);
    await abrirSensorPelaLista(page, '103');

    const antes = await page.getByTestId('medida-as').innerText();
    // o firmware/simulador envia a cada 5 s e o app consulta a cada 5 s: em ~12 s tem que mudar
    await page.waitForFunction(
      (anterior) => document.querySelector('[data-testid="medida-as"]')?.textContent !== anterior,
      antes,
      { timeout: 20_000 },
    );
    const depois = await page.getByTestId('medida-as').innerText();
    assert.notEqual(depois, antes);
    assert.deepEqual(page.errosDaPagina, []);
  });

  it('mostra o atraso entre a medida no sensor e o recebimento no servidor (insumo da métrica de latência)', async () => {
    const page = await novaPagina(browser);
    await entrar(page, SINDICO);
    await abrirSensorPelaLista(page, '101');

    await page.getByTestId('grafico-vazao').waitFor({ timeout: 20_000 }).catch(() => {});
    assert.match(await page.getByTestId('atraso-entrega').innerText(), /^\d+ ms$|^\d+,\d s$/);
    assert.deepEqual(page.errosDaPagina, []);
  });

  it('sensor sem comunicação (OFFLINE) não mostra vazão atual e avisa', async () => {
    const page = await novaPagina(browser);
    await entrar(page, SINDICO);

    // a API passa a responder "offline, última leitura há 10 min" e sem leituras recentes
    const dezMinAtras = new Date(Date.now() - 10 * 60_000).toISOString();
    await page.route('**/api/sensores/*/status', async (route) => {
      const real = await (await route.fetch()).json();
      await route.fulfill({
        json: { ...real, status: 'OFFLINE', ultimaLeituraEm: dezMinAtras, ultimoTimestampLeitura: dezMinAtras },
      });
    });
    await page.route('**/api/sensores/*/leituras*', (route) => route.fulfill({ json: [] }));

    await abrirSensorPelaLista(page, '103');
    await page.getByTestId('status-OFFLINE').first().waitFor();
    assert.equal(await page.getByTestId('vazao-atual').innerText(), '—');
    assert.match(await page.getByTestId('vazao-legenda').innerText(), /sem comunica/i);
    assert.match(await page.getByTestId('recebida-ha').innerText(), /há 10 min/);
    await page.getByTestId('estado-vazio').waitFor(); // "Sem leituras nos últimos 30 minutos"
    assert.equal(await page.getByTestId('grafico-vazao').count(), 0);
    assert.deepEqual(page.errosDaPagina, []);

    await capturar(page, 'app-sensor-offline');
  });

  it('link direto e recarregar a página no sensor mantém a sessão', async () => {
    const page = await novaPagina(browser);
    await entrar(page, SINDICO);
    await page.goto(`${APP_URL}/sensor/${sensores['102'].id}`);

    await page.getByTestId('vazao-atual').waitFor({ timeout: 25_000 });
    assert.equal(await tituloVisivel(page), 'Sensor simulado 102');
    assert.deepEqual(page.errosDaPagina, []);
  });

  it('proprietário vê o sensor do seu apartamento, mas não o de outro (403)', async () => {
    const page = await novaPagina(browser);
    await entrar(page, PROPRIETARIO);

    await page.goto(`${APP_URL}/sensor/${sensores['101'].id}`);
    await page.getByTestId('vazao-atual').waitFor({ timeout: 25_000 });

    await page.goto(`${APP_URL}/sensor/${sensores['102'].id}`);
    await page.getByTestId('estado-erro').first().waitFor({ timeout: 25_000 });
    assert.match(await page.getByTestId('estado-erro').first().innerText(), /permissão/i);
    assert.equal(await page.getByTestId('vazao-atual').count(), 0);
    assert.deepEqual(page.errosDaPagina, []);
  });
});
