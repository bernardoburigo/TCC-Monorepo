import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { APP_URL, SINDICO, abrirNavegador, capturar, chamarApi, entrar, novaPagina, tokenDaApi } from './helpers.mjs';

// Todos os dados vêm do SIMULADOR (docs/scripts/simulador.py). Nada aqui mede hardware real.
describe('alerta de vazamento provável', () => {
  let browser;
  let aptos; // por número
  let sensor102;

  before(async () => {
    browser = await abrirNavegador();
    const token = await tokenDaApi(SINDICO);
    const { corpo } = await chamarApi('/api/me/apartamentos', { token });
    aptos = Object.fromEntries(corpo.map((a) => [a.numero, a]));
    const { corpo: sensores } = await chamarApi(`/api/apartamentos/${aptos['102'].id}/sensores`, { token });
    sensor102 = sensores[0];
  });
  after(async () => {
    await browser.close();
  });

  // A API "passa a acusar" vazamento no apto 102 (fluxo contínuo há 42 min): testa a interface
  // sem depender do relógio nem do limite configurado no backend.
  async function acusarVazamentoNoApto102(page) {
    await page.route('**/api/me/apartamentos', async (route) => {
      const real = await (await route.fetch()).json();
      // só o 102 acusa vazamento (os demais forçados a false: o 103 pode estar vazando DE VERDADE
      // se o backend estiver com limite baixo e o simulador em perfil vazamento)
      await route.fulfill({ json: real.map((a) => ({ ...a, alertaVazamento: a.numero === '102' })) });
    });
    await page.route('**/api/apartamentos/*/alertas', (route) => {
      const alerta = {
        sensorId: sensor102.id,
        apartamentoId: aptos['102'].id,
        sensorIdentificador: sensor102.identificador,
        tipo: 'VAZAMENTO_PROVAVEL',
        desde: new Date(Date.now() - 42 * 60_000).toISOString(),
        duracaoSegundos: 42 * 60,
        volumeMl: 18_000,
        simulado: true,
      };
      const ehDo102 = route.request().url().includes(aptos['102'].id);
      return route.fulfill({ json: ehDo102 ? [alerta] : [] });
    });
  }

  it('lista: o apartamento com alerta é destacado e o resumo conta quantos são', async () => {
    const page = await novaPagina(browser);
    await acusarVazamentoNoApto102(page);
    await entrar(page, SINDICO);

    await page.getByTestId('alerta-cartao-102').waitFor();
    assert.equal(await page.getByTestId('alerta-cartao-101').count(), 0, 'só o 102 tem alerta');
    assert.match(await page.getByTestId('resumo-alertas').innerText(), /1 apartamento com possível vazamento/);
    assert.deepEqual(page.errosDaPagina, []);

    await capturar(page, 'app-lista-com-alerta');
  });

  it('apartamento: faixa de alerta com a duração e o volume, e some nos que não têm', async () => {
    const page = await novaPagina(browser);
    await acusarVazamentoNoApto102(page);
    await entrar(page, SINDICO);

    await page.getByTestId('cartao-apartamento-102').click();
    const faixa = page.getByTestId('alerta-vazamento');
    await faixa.waitFor({ timeout: 20_000 });
    assert.match(await faixa.innerText(), /Possível vazamento/);
    assert.match(await faixa.innerText(), /há 42 min/);
    assert.match(await faixa.innerText(), /18 L/);
    assert.match(await faixa.innerText(), /SIMULADO/);

    await page.getByTestId('botao-voltar').click();
    await page.getByTestId('cartao-apartamento-101').click();
    await page.getByTestId('grafico-consumo').waitFor({ timeout: 20_000 });
    assert.equal(await page.locator('[data-testid="alerta-vazamento"]:visible').count(), 0);
    assert.deepEqual(page.errosDaPagina, []);

    await capturar(page, 'app-apartamento-com-alerta').catch(() => {});
  });

  it('sensor: a faixa aparece na tela do sensor que está vazando', async () => {
    const page = await novaPagina(browser);
    await acusarVazamentoNoApto102(page);
    await entrar(page, SINDICO);

    await page.goto(`${APP_URL}/sensor/${sensor102.id}`);
    await page.getByTestId('alerta-vazamento').waitFor({ timeout: 25_000 });
    assert.match(await page.getByTestId('alerta-vazamento').innerText(), /há 42 min/);
    assert.deepEqual(page.errosDaPagina, []);
  });

  it('sem alerta na API, nenhuma tela mostra faixa nem destaque', async () => {
    const page = await novaPagina(browser);
    await page.route('**/api/apartamentos/*/alertas', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/me/apartamentos', async (route) => {
      const real = await (await route.fetch()).json();
      await route.fulfill({ json: real.map((a) => ({ ...a, alertaVazamento: false })) });
    });
    await entrar(page, SINDICO);

    await page.getByTestId('cartao-apartamento-101').waitFor();
    assert.equal(await page.getByTestId('resumo-alertas').count(), 0);
    assert.equal(await page.locator('[data-testid^="alerta-cartao-"]').count(), 0);
  });

  // Ponta a ponta REAL (sem interceptar nada): exige o backend com limite baixo e o simulador com
  // um sensor em vazamento:
  //   APP_ALERTA_FLUXO_CONTINUO_MINUTOS=2 docker compose up -d backend
  //   python3 docs/scripts/simulador.py rodar --perfil 103=vazamento
  //   E2E_ALERTA_REAL=1 ./e2e/run.sh e2e/alerta.e2e.mjs
  it(
    'REAL: o sensor simulado em vazamento (apto 103) aciona o alerta e os normais não',
    { skip: process.env.E2E_ALERTA_REAL !== '1' && 'defina E2E_ALERTA_REAL=1 (ver comentário acima)' },
    async () => {
      const page = await novaPagina(browser);
      await entrar(page, SINDICO);

      await page.getByTestId('alerta-cartao-103').waitFor({ timeout: 25_000 });
      assert.equal(await page.getByTestId('alerta-cartao-101').count(), 0);
      assert.equal(await page.getByTestId('alerta-cartao-102').count(), 0);

      await page.getByTestId('cartao-apartamento-103').click();
      await page.getByTestId('alerta-vazamento').waitFor({ timeout: 20_000 });
      assert.match(await page.getByTestId('alerta-vazamento').innerText(), /Sensor simulado 103/);
      assert.deepEqual(page.errosDaPagina, []);

      await capturar(page, 'app-alerta-real');
    },
  );
});
