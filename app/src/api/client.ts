import axios, { AxiosError } from 'axios';

import { API_URL } from '@/lib/config';
import type { ErroApi } from './types';
// Mock de dados desacoplado do resto do app (ver src/api/mock/README ou o README do app,
// seção "Visualizar sem backend"); só é usado quando EXPO_PUBLIC_USE_MOCK_DATA=true.
import { MOCK_ATIVO, mockAdapter } from './mock';

// O cliente NÃO importa o store de autenticação (o store importa a API; importar de volta
// criaria um ciclo). Em vez disso o store injeta estes ganchos ao ser carregado.
let obterToken: () => string | null = () => null;
let aoNaoAutorizado: () => void = () => {};

export function configurarClienteApi(opcoes: { obterToken: () => string | null; aoNaoAutorizado: () => void }) {
  obterToken = opcoes.obterToken;
  aoNaoAutorizado = opcoes.aoNaoAutorizado;
}

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10_000,
  adapter: MOCK_ATIVO ? mockAdapter : undefined,
});

api.interceptors.request.use((config) => {
  const token = obterToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (resposta) => resposta,
  (erro: AxiosError) => {
    // 401 = sessão inválida/expirada (o backend devolve 403 só para "sem permissão").
    // O login em si também devolve 401 quando a senha está errada: isso NÃO é sessão expirada.
    const ehLogin = erro.config?.url?.includes('/api/auth/login');
    if (erro.response?.status === 401 && !ehLogin) {
      aoNaoAutorizado();
    }
    return Promise.reject(erro);
  },
);

// Mensagem legível para o usuário a partir de qualquer erro de chamada à API.
export function mensagemDeErro(erro: unknown, padrao = 'Algo deu errado. Tente novamente.'): string {
  if (axios.isAxiosError<ErroApi>(erro)) {
    if (!erro.response) {
      return 'Não foi possível conectar ao servidor. Verifique sua conexão.';
    }
    if (erro.response.status === 401 && erro.config?.url?.includes('/api/auth/login')) {
      return 'E-mail ou senha inválidos.';
    }
    if (erro.response.status === 403) {
      return 'Você não tem permissão para ver isto.';
    }
    if (erro.response.status === 404) {
      return 'Não encontrado.';
    }
    return erro.response.data?.mensagem ?? padrao;
  }
  return padrao;
}
