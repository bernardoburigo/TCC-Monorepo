import type { Granularidade } from '@/api/types';

// Períodos do gráfico de consumo. São sempre RELATIVOS a "agora": o app não faz conta
// de fuso; o backend agrupa em America/Sao_Paulo e alinha o início ao começo do
// intervalo (hora/dia) para o primeiro ponto não vir parcial.
export type PeriodoId = '24h' | '7d' | '30d';

export interface Periodo {
  id: PeriodoId;
  rotulo: string;
  granularidade: Granularidade;
  duracaoMs: number;
}

const HORA_MS = 3_600_000;

export const PERIODOS: Periodo[] = [
  { id: '24h', rotulo: '24 horas', granularidade: 'HORA', duracaoMs: 24 * HORA_MS },
  { id: '7d', rotulo: '7 dias', granularidade: 'DIA', duracaoMs: 7 * 24 * HORA_MS },
  { id: '30d', rotulo: '30 dias', granularidade: 'DIA', duracaoMs: 30 * 24 * HORA_MS },
];

export function periodoPorId(id: string): Periodo {
  return PERIODOS.find((p) => p.id === id) ?? PERIODOS[0];
}

// Calculado no momento da requisição (dentro do queryFn), não na renderização: assim a
// chave da query só depende do período escolhido e o polling não vira um loop de chaves novas.
export function intervaloDoPeriodo(periodo: Periodo, agora: Date): { inicio: string; fim: string } {
  return {
    inicio: new Date(agora.getTime() - periodo.duracaoMs).toISOString(),
    fim: agora.toISOString(),
  };
}
