// Teste do adapter mock (src/api/mock/). Fica dentro da própria pasta: apagar
// src/api/mock/ remove este teste junto, sem deixar referência órfã.
import axios from 'axios';

import type { ApartamentoPainel, ConsumoApartamento, LeituraBruta, LoginResponse } from '@/api/types';

import { mockAdapter } from '../adapter';

const cliente = axios.create({ baseURL: 'http://mock.local', adapter: mockAdapter });

async function login(email: string, senha: string) {
  const { data } = await cliente.post<LoginResponse>('/api/auth/login', { email, senha });
  return data;
}

function autenticado(token: string) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

describe('mock adapter', () => {
  it('rejeita login com senha errada (401)', async () => {
    await expect(login('sindico.mock@tcc.com', 'senha-errada')).rejects.toMatchObject({
      response: { status: 401 },
    });
  });

  it('aceita login do síndico e devolve o papel correto', async () => {
    const resposta = await login('sindico.mock@tcc.com', 'senha12345');
    expect(resposta.role).toBe('SINDICO');
    expect(resposta.token).toBeTruthy();
  });

  it('rejeita chamada autenticada sem token (401)', async () => {
    await expect(cliente.get('/api/me')).rejects.toMatchObject({ response: { status: 401 } });
  });

  it('síndico vê os 3 apartamentos; proprietário só o seu', async () => {
    const { token: tokenSindico } = await login('sindico.mock@tcc.com', 'senha12345');
    const { token: tokenDono } = await login('proprietario.mock@tcc.com', 'senha12345');

    const { data: doSindico } = await cliente.get<ApartamentoPainel[]>(
      '/api/me/apartamentos',
      autenticado(tokenSindico),
    );
    const { data: doProprietario } = await cliente.get<ApartamentoPainel[]>(
      '/api/me/apartamentos',
      autenticado(tokenDono),
    );

    expect(doSindico.map((a) => a.numero).sort()).toEqual(['101', '102', '103']);
    expect(doProprietario.map((a) => a.numero)).toEqual(['101']);
    // todo apartamento mock é marcado como simulado (reaproveita o selo SIMULADO já existente na UI)
    expect(doSindico.every((a) => a.simulado)).toBe(true);
  });

  it('bloqueia proprietário tentando ver apartamento de outro dono (403)', async () => {
    const { token } = await login('proprietario.mock@tcc.com', 'senha12345');
    await expect(
      cliente.get('/api/apartamentos/mock-apto-102/consumo', {
        ...autenticado(token),
        params: { inicio: '2026-01-01T00:00:00.000Z', fim: '2026-01-02T00:00:00.000Z', granularidade: 'HORA' },
      }),
    ).rejects.toMatchObject({ response: { status: 403 } });
  });

  it('gera consumo com um ponto por hora dentro do intervalo pedido', async () => {
    const { token } = await login('sindico.mock@tcc.com', 'senha12345');
    const inicio = '2026-01-01T00:00:00.000Z';
    const fim = '2026-01-02T00:00:00.000Z'; // 24 h
    const { data } = await cliente.get<ConsumoApartamento>('/api/apartamentos/mock-apto-101/consumo', {
      ...autenticado(token),
      params: { inicio, fim, granularidade: 'HORA' },
    });
    expect(data.pontos).toHaveLength(24);
    expect(data.pontos.every((p) => p.volumeTotalMl > 0)).toBe(true);
  });

  it('apartamento com vazamento tem fluxo contínuo e alerta ativo; apartamento normal não', async () => {
    const { token } = await login('sindico.mock@tcc.com', 'senha12345');

    const { data: leiturasVazamento } = await cliente.get<LeituraBruta[]>(
      '/api/sensores/mock-sensor-103/leituras',
      { ...autenticado(token), params: { minutos: 30 } },
    );
    expect(leiturasVazamento.every((l) => l.volumeMlEstimado > 0)).toBe(true);

    const { data: leiturasNormais } = await cliente.get<LeituraBruta[]>('/api/sensores/mock-sensor-101/leituras', {
      ...autenticado(token),
      params: { minutos: 30 },
    });
    expect(leiturasNormais.some((l) => l.volumeMlEstimado === 0)).toBe(true);

    const { data: alertasVazamento } = await cliente.get('/api/apartamentos/mock-apto-103/alertas', autenticado(token));
    expect(alertasVazamento).toHaveLength(1);
    expect(alertasVazamento[0]).toMatchObject({ tipo: 'VAZAMENTO_PROVAVEL' });

    const { data: alertasNormais } = await cliente.get('/api/apartamentos/mock-apto-101/alertas', autenticado(token));
    expect(alertasNormais).toEqual([]);
  });
});
