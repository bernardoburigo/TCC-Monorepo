// Utilitários dos testes e2e (Playwright-core + Chromium já baixado em ~/.cache/ms-playwright,
// executados com o test runner nativo do Node: `node --test e2e/`).
//
// Pré-requisitos: backend no ar (docker compose up), dados criados por
// `python3 docs/scripts/simulador.py provisionar` e o app em APP_URL (e2e/run.sh sobe o dev
// server). Os dados vêm do SIMULADOR — nenhum destes testes mede hardware real.
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright-core';

export const APP_URL = process.env.APP_URL ?? 'http://localhost:8081';
export const API_URL = process.env.API_URL ?? 'http://localhost:8080';

// Contas criadas por docs/scripts/simulador.py (dados SIMULADOS).
export const SINDICO = { email: 'sindico.simulado@tcc.com', senha: 'senha12345', nome: 'Síndico Simulado' };
export const PROPRIETARIO = {
  email: 'proprietario.simulado@tcc.com',
  senha: 'senha12345',
  nome: 'Proprietário Simulado',
};

function localizarChromium() {
  if (process.env.CHROMIUM_PATH) {
    return process.env.CHROMIUM_PATH;
  }
  const raiz = join(homedir(), '.cache', 'ms-playwright');
  const pastas = existsSync(raiz)
    ? readdirSync(raiz)
        .filter((p) => /^chromium-\d+$/.test(p))
        .sort()
        .reverse()
    : [];
  for (const pasta of pastas) {
    const exe = join(raiz, pasta, 'chrome-linux64', 'chrome');
    if (existsSync(exe)) {
      return exe;
    }
  }
  throw new Error('Chromium do Playwright não encontrado em ~/.cache/ms-playwright. Defina CHROMIUM_PATH.');
}

export function abrirNavegador() {
  return chromium.launch({ executablePath: localizarChromium(), args: ['--no-sandbox'] });
}

// Contexto novo = sessão limpa (localStorage vazio). `errosDaPagina` junta exceções não
// tratadas do JavaScript da página: qualquer uma é bug do app.
export async function novaPagina(browser, opcoes = {}) {
  const context = await browser.newContext({
    viewport: { width: 1000, height: 900 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    ...opcoes,
  });
  const page = await context.newPage();
  page.errosDaPagina = [];
  page.on('pageerror', (erro) => page.errosDaPagina.push(erro.message));
  return page;
}

export async function entrar(page, { email, senha }) {
  await page.goto(APP_URL);
  await page.getByTestId('campo-email').fill(email);
  await page.getByTestId('campo-senha').fill(senha);
  await page.getByTestId('botao-entrar').click();
  await page.getByTestId('botao-sair').waitFor({ timeout: 15_000 });
}

export function lerTokenGuardado(page) {
  return page.evaluate(() => window.localStorage.getItem('tcc.token'));
}

// Chamada direta à API (para preparar/consultar dados fora da interface).
export async function chamarApi(caminho, { token, metodo = 'GET', corpo, cabecalhos = {} } = {}) {
  const resposta = await fetch(`${API_URL}${caminho}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...cabecalhos,
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await resposta.text();
  return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null };
}

export async function tokenDaApi({ email, senha }) {
  const { status, corpo } = await chamarApi('/api/auth/login', { metodo: 'POST', corpo: { email, senha } });
  if (status !== 200) {
    throw new Error(`login na API falhou (${status}); rode o simulador (provisionar)`);
  }
  return corpo.token;
}

const RAIZ_DO_REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Estado do simulador (tokens dos sensores SIMULADOS): permite injetar leituras durante o teste.
export function lerEstadoDoSimulador() {
  const caminho = join(RAIZ_DO_REPO, 'docs', 'scripts', '.simulador-estado.json');
  if (!existsSync(caminho)) {
    throw new Error('estado do simulador não encontrado; rode `python3 docs/scripts/simulador.py provisionar`');
  }
  return JSON.parse(readFileSync(caminho, 'utf8'));
}

// Envia uma leitura SIMULADA no formato do firmware (delta da janela, fim da janela em UTC com ms).
export async function enviarLeituraSimulada(sensor, { pulsos, volumeMl }) {
  const estado = lerEstadoDoSimulador();
  const alvo = estado.sensores.find((s) => s.numero === sensor);
  const sequencia = Date.now() % 1_000_000_000; // único o bastante: a constraint inclui o timestamp
  return chamarApi('/api/leituras', {
    metodo: 'POST',
    corpo: { sensorId: alvo.sensorId, timestampLeitura: new Date().toISOString(), pulsos, volumeMlEstimado: volumeMl, sequencia },
    cabecalhos: { 'X-Sensor-Token': alvo.token },
  });
}

// Screenshot em docs/screenshots/ (evidência para o capítulo de resultados do TCC).
export async function capturar(page, nome) {
  const pasta = join(RAIZ_DO_REPO, 'docs', 'screenshots');
  mkdirSync(pasta, { recursive: true });
  await page.screenshot({ path: join(pasta, `${nome}.png`), fullPage: true });
}

// "786 L" / "1,2 L" / "1.235 L" / "350 mL" (formato pt-BR do app) -> mL.
export function parseVolumeMl(texto) {
  const partes = texto.trim().match(/^([\d.]+(?:,\d+)?)\s*(mL|L)$/);
  if (!partes) {
    throw new Error(`volume em formato inesperado: "${texto}"`);
  }
  const numero = Number(partes[1].replace(/\./g, '').replace(',', '.'));
  return partes[2] === 'L' ? numero * 1000 : numero;
}
