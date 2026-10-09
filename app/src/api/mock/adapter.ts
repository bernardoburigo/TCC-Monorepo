// Adapter Axios que responde às rotas do backend com dados de ./dados.ts, sem bater na
// rede. Único ponto de integração com o resto do app: ../client.ts troca o adapter
// padrão por este quando EXPO_PUBLIC_USE_MOCK_DATA=true (ver ./index.ts).
import { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

import type { ErroApi, Granularidade, LoginResponse, Usuario } from '@/api/types';

import {
  APARTAMENTOS_MOCK,
  USUARIOS_MOCK,
  apartamentosVisiveisPara,
  gerarAlertas,
  gerarApartamentoPainel,
  gerarConsumo,
  gerarLeituras,
  gerarStatusSensor,
  temAcesso,
  type UsuarioMock,
} from './dados';

function corpoDaRequisicao(config: InternalAxiosRequestConfig): Record<string, string> {
  if (typeof config.data === 'string') {
    try {
      return JSON.parse(config.data);
    } catch {
      return {};
    }
  }
  return (config.data as Record<string, string>) ?? {};
}

function usuarioDoToken(config: InternalAxiosRequestConfig): UsuarioMock | undefined {
  const headers = config.headers as Record<string, unknown> | undefined;
  const bruto =
    (headers?.Authorization as string | undefined) ??
    (headers?.authorization as string | undefined) ??
    (typeof (headers as { get?: (nome: string) => string | undefined })?.get === 'function'
      ? (headers as { get: (nome: string) => string | undefined }).get('Authorization')
      : undefined);
  const token = (bruto ?? '').replace(/^Bearer\s+/i, '');
  return USUARIOS_MOCK.find((usuario) => usuario.token === token);
}

function responder<T>(config: InternalAxiosRequestConfig, status: number, data: T): AxiosResponse<T> {
  return {
    data,
    status,
    statusText: status < 300 ? 'OK' : '',
    headers: {},
    config,
    request: {},
  } as AxiosResponse<T>;
}

function erro(config: InternalAxiosRequestConfig, status: number, mensagem: string): never {
  const data: ErroApi = { mensagem, detalhes: [] };
  throw new AxiosError(mensagem, String(status), config, {}, responder(config, status, data));
}

// atraso pequeno e aleatório só para a UI sentir uma chamada de rede de verdade.
function atraso(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 150 + Math.random() * 150));
}

export const mockAdapter: AxiosAdapter = async (config) => {
  await atraso();

  const metodo = (config.method ?? 'get').toLowerCase();
  const url = (config.url ?? '').split('?')[0];
  const params = (config.params ?? {}) as Record<string, string>;

  if (metodo === 'post' && url === '/api/auth/login') {
    const { email, senha } = corpoDaRequisicao(config);
    const usuario = USUARIOS_MOCK.find((u) => u.email === email && u.senha === senha);
    if (!usuario) erro(config, 401, 'E-mail ou senha inválidos.');
    const resposta: LoginResponse = { token: usuario.token, tipo: 'Bearer', nome: usuario.nome, role: usuario.role };
    return responder(config, 200, resposta);
  }

  const usuario = usuarioDoToken(config);
  if (!usuario) erro(config, 401, 'Sessão inválida.');

  if (metodo === 'get' && url === '/api/me') {
    const resposta: Usuario = { id: usuario.id, nome: usuario.nome, email: usuario.email, role: usuario.role };
    return responder(config, 200, resposta);
  }

  if (metodo === 'get' && url === '/api/me/apartamentos') {
    return responder(config, 200, apartamentosVisiveisPara(usuario).map(gerarApartamentoPainel));
  }

  const rotaApartamento = url.match(/^\/api\/apartamentos\/([^/]+)\/(sensores|consumo|alertas)$/);
  if (metodo === 'get' && rotaApartamento) {
    const [, apartamentoId, recurso] = rotaApartamento;
    const apartamento = APARTAMENTOS_MOCK.find((a) => a.id === apartamentoId);
    if (!apartamento) erro(config, 404, 'Apartamento não encontrado.');
    if (!temAcesso(usuario, apartamento)) erro(config, 403, 'Você não tem permissão para ver isto.');

    if (recurso === 'sensores') return responder(config, 200, [gerarStatusSensor(apartamento)]);
    if (recurso === 'alertas') return responder(config, 200, gerarAlertas(apartamento));

    const granularidade = (params.granularidade ?? 'HORA') as Granularidade;
    return responder(config, 200, gerarConsumo(apartamento, params.inicio, params.fim, granularidade));
  }

  const rotaSensor = url.match(/^\/api\/sensores\/([^/]+)\/(status|leituras)$/);
  if (metodo === 'get' && rotaSensor) {
    const [, sensorId, recurso] = rotaSensor;
    const apartamento = APARTAMENTOS_MOCK.find((a) => a.sensorId === sensorId);
    if (!apartamento) erro(config, 404, 'Sensor não encontrado.');
    if (!temAcesso(usuario, apartamento)) erro(config, 403, 'Você não tem permissão para ver isto.');

    if (recurso === 'status') return responder(config, 200, gerarStatusSensor(apartamento));

    const minutos = Number(params.minutos ?? 30);
    return responder(config, 200, gerarLeituras(apartamento, sensorId, minutos));
  }

  erro(config, 404, `Rota mock não implementada: ${metodo.toUpperCase()} ${url}`);
};
