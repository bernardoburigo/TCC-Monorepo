import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { APP_URL, SINDICO, abrirNavegador, entrar, lerTokenGuardado, novaPagina } from './helpers.mjs';

describe('login e guarda de rotas', () => {
  let browser;

  before(async () => {
    browser = await abrirNavegador();
  });
  after(async () => {
    await browser.close();
  });

  it('visitante é levado ao login ao abrir o app', async () => {
    const page = await novaPagina(browser);
    await page.goto(APP_URL);
    await page.getByTestId('campo-email').waitFor();
    assert.match(page.url(), /\/login$/);
    assert.deepEqual(page.errosDaPagina, []);
  });

  it('campos vazios mostram aviso sem chamar a API', async () => {
    const page = await novaPagina(browser);
    let chamouLogin = false;
    page.on('request', (req) => {
      if (req.url().includes('/api/auth/login')) chamouLogin = true;
    });
    await page.goto(APP_URL);
    await page.getByTestId('botao-entrar').click();
    assert.equal(await page.getByTestId('erro-login').innerText(), 'Informe e-mail e senha.');
    assert.equal(chamouLogin, false);
  });

  it('senha errada mostra o erro e continua no login', async () => {
    const page = await novaPagina(browser);
    await page.goto(APP_URL);
    await page.getByTestId('campo-email').fill(SINDICO.email);
    await page.getByTestId('campo-senha').fill('senha-errada');
    await page.getByTestId('botao-entrar').click();

    await page.getByTestId('erro-login').waitFor();
    assert.equal(await page.getByTestId('erro-login').innerText(), 'E-mail ou senha inválidos.');
    assert.equal(await lerTokenGuardado(page), null);
    assert.match(page.url(), /\/login$/);
    assert.deepEqual(page.errosDaPagina, []);
  });

  it('login correto abre a lista, mostra o usuário e guarda o token', async () => {
    const page = await novaPagina(browser);
    await entrar(page, SINDICO);

    assert.equal(await page.getByTestId('titulo-tela').innerText(), 'Apartamentos');
    assert.equal(await page.getByTestId('usuario-nome').innerText(), SINDICO.nome);
    assert.ok(await lerTokenGuardado(page), 'token deveria estar guardado');
    assert.doesNotMatch(page.url(), /login/);
    assert.deepEqual(page.errosDaPagina, []);
  });

  it('recarregar a página mantém a sessão (restaura pelo token guardado)', async () => {
    const page = await novaPagina(browser);
    await entrar(page, SINDICO);

    await page.reload();
    await page.getByTestId('botao-sair').waitFor({ timeout: 15_000 });
    assert.equal(await page.getByTestId('usuario-nome').innerText(), SINDICO.nome);
    assert.deepEqual(page.errosDaPagina, []);
  });

  it('sair volta ao login e apaga o token', async () => {
    const page = await novaPagina(browser);
    await entrar(page, SINDICO);

    await page.getByTestId('botao-sair').click();
    await page.getByTestId('campo-email').waitFor();
    assert.equal(await lerTokenGuardado(page), null);
    assert.match(page.url(), /\/login$/);
  });

  it('token guardado inválido/expirado leva ao login e é descartado', async () => {
    const page = await novaPagina(browser);
    await page.addInitScript(() => window.localStorage.setItem('tcc.token', 'token.expirado.qualquer'));
    await page.goto(APP_URL);

    await page.getByTestId('campo-email').waitFor({ timeout: 15_000 });
    assert.equal(await lerTokenGuardado(page), null);
    assert.deepEqual(page.errosDaPagina, []);
  });
});
