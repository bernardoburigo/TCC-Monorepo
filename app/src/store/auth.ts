import { create } from 'zustand';

import { buscarUsuarioAtual, login } from '@/api/auth';
import { configurarClienteApi } from '@/api/client';
import type { Usuario } from '@/api/types';
import { apagarToken, lerToken, salvarToken } from '@/lib/storage';

// 'carregando' só existe até restaurarSessao() terminar (evita piscar a tela de login).
type EstadoSessao = 'carregando' | 'autenticado' | 'anonimo';

interface AuthState {
  estado: EstadoSessao;
  token: string | null;
  usuario: Usuario | null;
  restaurarSessao: () => Promise<void>;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  estado: 'carregando',
  token: null,
  usuario: null,

  restaurarSessao: async () => {
    const token = await lerToken();
    if (!token) {
      set({ estado: 'anonimo', token: null, usuario: null });
      return;
    }
    // valida o token guardado no backend (pode ter expirado: 24 h)
    set({ token });
    try {
      const usuario = await buscarUsuarioAtual();
      set({ estado: 'autenticado', usuario });
    } catch {
      // 401 já limpou a sessão pelo interceptor; falha de rede cai aqui também e
      // mantém o token guardado (o usuário só volta ao login e tenta de novo depois)
      set({ estado: 'anonimo', token: null, usuario: null });
    }
  },

  entrar: async (email, senha) => {
    const resposta = await login(email, senha);
    await salvarToken(resposta.token);
    set({ token: resposta.token });
    const usuario = await buscarUsuarioAtual();
    set({ estado: 'autenticado', usuario });
  },

  sair: async () => {
    await apagarToken();
    set({ estado: 'anonimo', token: null, usuario: null });
  },
}));

configurarClienteApi({
  obterToken: () => useAuthStore.getState().token,
  aoNaoAutorizado: () => {
    // idempotente: várias requisições em voo podem receber 401 ao mesmo tempo
    if (useAuthStore.getState().estado !== 'anonimo') {
      void useAuthStore.getState().sair();
    }
  },
});
