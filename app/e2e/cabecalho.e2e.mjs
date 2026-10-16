import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { SINDICO, abrirNavegador, capturar, entrar, novaPagina } from './helpers.mjs';

// Dados do SIMULADOR (docs/scripts/simulador.py).
describe('cabeçalho: botão voltar e popup de usuário', () => {
  let browser;
  before(async () => {
    browser = await abrirNavegador();
  });
  after(async () => {
    await browser.close();
  });

  it('o botão voltar continua visível após recarregar (F5) e leva à lista', async () => {
    const page = await novaPagina(browser);
    await entrar(page, SINDICO);
    await page.locator('[data-testid^="cartao-apartamento-"]').first().click();
    await page.getByTestId('grafico-consumo').waitFor({ timeout: 20_000 });

    await page.reload();
    await page.getByTestId('grafico-consumo').waitFor({ timeout: 20_000 });
    await page.getByTestId('botao-voltar').waitFor({ timeout: 5_000 });
    await page.getByTestId('botao-voltar').click();
    await page.getByTestId('titulo-tela').filter({ hasText: 'Apartamentos' }).waitFor({ timeout: 10_000 });
    assert.equal(await page.locator('[data-testid="botao-voltar"]:visible').count(), 0);
  });

  it('mobile: usuário e "Sair" ficam num popup aberto/fechado pelo botão de usuário', async () => {
    const page = await novaPagina(browser, { viewport: { width: 390, height: 800 } });
    await entrar(page, SINDICO);
    await page.locator('[data-testid^="cartao-apartamento-"]').first().click();
    await page.getByTestId('grafico-consumo').waitFor({ timeout: 20_000 });

    assert.equal(await page.locator('[data-testid="popup-usuario"]:visible').count(), 0);
    await page.getByTestId('botao-usuario').click();
    const popup = page.getByTestId('popup-usuario');
    await popup.waitFor({ timeout: 5_000 });
    assert.match(await popup.innerText(), new RegExp(SINDICO.nome));
    assert.match(await popup.innerText(), /Síndico/);
    await capturar(page, 'app-popup-usuario').catch(() => {});

    await page.getByTestId('botao-usuario').click();
    await popup.waitFor({ state: 'hidden', timeout: 5_000 });
    assert.deepEqual(page.errosDaPagina, []);
  });
});
