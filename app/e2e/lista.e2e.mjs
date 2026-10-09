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
  lerTokenGuardado,
  novaPagina,
  tokenDaApi,
} from './helpers.mjs';

// Todos os dados vêm do SIMULADOR (docs/scripts/simulador.py). Nada aqui mede hardware real.
describe('lista de apartamentos', () => {
  let browser;

  before(async () => {
    browser = await abrirNavegador();
  });
  after(async () => {
    await browser.close();
  });

  const numerosNaTela = (page) =>
    page.$$eval('[data-testid^="cartao-apartamento-"]', (els) =>
      els.map((e) => e.getAttribute('data-testid').replace('cartao-apartamento-', '')),
    );

  it('síndico vê todos os apartamentos, ordenados pelo consumo de hoje, com selo SIMULADO', async () => {
    const page = await novaPagina(browser);
    await entrar(page, SINDICO);
    await page.getByTestId('cartao-apartamento-101').waitFor();

    // ordem esperada = a da API por consumo de hoje (maior primeiro)
    const token = await tokenDaApi(SINDICO);
    const { corpo: daApi } = await chamarApi('/api/me/apartamentos', { token });
    const esperada = [...daApi].sort((a, b) => b.consumoHojeMl - a.consumoHojeMl).map((a) => a.numero);
    assert.deepEqual(await numerosNaTela(page), esperada);
    assert.equal(daApi.length, 3);

    assert.equal(await page.getByTestId('selo-simulado').count(), 3, 'todo apartamento simulado precisa do selo');
    assert.match(await page.getByText('Consumo total hoje').innerText(), /Consumo total hoje/i);
    assert.match(await page.getByTestId('total-hoje').innerText(), /\d/);
    assert.match(await page.getByTestId('atualizado-em').innerText(), /Atualizado/);
    assert.deepEqual(page.errosDaPagina, []);

    await capturar(page, 'app-lista-sindico');
  });

  it('proprietário vê só o seu apartamento e não vê total do condomínio', async () => {
    const page = await novaPagina(browser);
    await entrar(page, PROPRIETARIO);
    await page.getByTestId('cartao-apartamento-101').waitFor();

    assert.deepEqual(await numerosNaTela(page), ['101']);
    assert.equal(await page.locator('[data-testid^="total-condominio-"]').count(), 0);
    await page.getByText('Meu consumo hoje').waitFor();
    assert.equal(await page.getByTestId('usuario-nome').innerText(), PROPRIETARIO.nome);
    assert.deepEqual(page.errosDaPagina, []);

    await capturar(page, 'app-lista-proprietario');
  });

  it('tocar num apartamento abre o detalhe dele', async () => {
    const page = await novaPagina(browser);
    await entrar(page, SINDICO);
    const token = await tokenDaApi(SINDICO);
    const { corpo: daApi } = await chamarApi('/api/me/apartamentos', { token });
    const apto102 = daApi.find((a) => a.numero === '102');

    await page.getByTestId('cartao-apartamento-102').click();
    await page.waitForURL(new RegExp(`/apartamento/${apto102.id}$`));
    assert.deepEqual(page.errosDaPagina, []);
  });

  it('POLLING: uma leitura nova aparece sozinha na lista, sem recarregar a página', async () => {
    const page = await novaPagina(browser);
    await entrar(page, SINDICO);
    await page.getByTestId('cartao-apartamento-102').waitFor();

    const antes = await page.getByTestId('consumo-hoje-102').innerText();
    const resposta = await enviarLeituraSimulada('102', { pulsos: 450, volumeMl: 10_000 }); // +10 L SIMULADOS
    assert.equal(resposta.status, 201);

    // o polling da lista é de 10 s: dentro de ~15 s o texto precisa mudar
    await page.waitForFunction(
      (anterior) => document.querySelector('[data-testid="consumo-hoje-102"]')?.textContent !== anterior,
      antes,
      { timeout: 20_000 },
    );
    const depois = await page.getByTestId('consumo-hoje-102').innerText();
    assert.notEqual(depois, antes);
    assert.deepEqual(page.errosDaPagina, []);
  });

  it('sessão que expira durante o uso (401 no polling) leva ao login e limpa o token', async () => {
    const page = await novaPagina(browser);
    await entrar(page, SINDICO);
    await page.getByTestId('cartao-apartamento-101').waitFor();

    // simula o token expirado no backend: as próximas chamadas voltam 401
    await page.route('**/api/me/apartamentos', (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: '{"mensagem":"Credenciais inválidas","detalhes":[]}' }),
    );

    await page.getByTestId('campo-email').waitFor({ timeout: 20_000 });
    assert.equal(await lerTokenGuardado(page), null);
    assert.match(page.url(), /\/login$/);
    assert.deepEqual(page.errosDaPagina, []);
  });

  it('servidor fora na primeira carga mostra erro com "tentar novamente", que recupera quando ele volta', async () => {
    const page = await novaPagina(browser);
    await page.route('**/api/me/apartamentos', (route) => route.abort('connectionrefused'));
    await entrar(page, SINDICO); // login e /api/me passam; só a lista de apartamentos está bloqueada
    await page.getByTestId('estado-erro').waitFor({ timeout: 20_000 });
    assert.match(await page.getByTestId('estado-erro').innerText(), /conectar ao servidor/i);

    await page.unroute('**/api/me/apartamentos');
    await page.getByText('Tentar novamente').click();
    await page.getByTestId('cartao-apartamento-101').waitFor({ timeout: 15_000 });
    assert.deepEqual(page.errosDaPagina, []);
  });

  it('falha depois de já ter dados mantém a lista e avisa, em vez de apagar a tela', async () => {
    const page = await novaPagina(browser);
    await entrar(page, SINDICO);
    await page.getByTestId('cartao-apartamento-101').waitFor();

    await page.route('**/api/me/apartamentos', (route) => route.abort('connectionrefused'));
    await page.getByTestId('aviso-falha-atualizacao').waitFor({ timeout: 30_000 });
    assert.equal(await page.getByTestId('cartao-apartamento-101').count(), 1, 'os dados antigos devem continuar visíveis');
    assert.deepEqual(page.errosDaPagina, []);
  });
});
