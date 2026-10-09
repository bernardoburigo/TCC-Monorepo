import { api } from './client';
import type { LoginResponse, Usuario } from './types';

export async function login(email: string, senha: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/api/auth/login', { email, senha });
  return data;
}

export async function buscarUsuarioAtual(): Promise<Usuario> {
  const { data } = await api.get<Usuario>('/api/me');
  return data;
}
