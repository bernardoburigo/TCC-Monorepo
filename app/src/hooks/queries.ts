import { keepPreviousData, useQuery } from '@tanstack/react-query';

import {
  buscarConsumo,
  listarAlertas,
  buscarStatusDoSensor,
  listarLeiturasRecentes,
  listarMeusApartamentos,
  listarSensoresDoApartamento,
} from '@/api/recursos';
import type { ConsumoDoPeriodo } from '@/api/types';
import { POLLING_AO_VIVO_MS, POLLING_LISTAS_MS } from '@/lib/config';
import { intervaloDoPeriodo, periodoPorId } from '@/lib/periodos';

// Tempo real = polling (CLAUDE.md, seção 3). Sem `refetchIntervalInBackground`: aba/app em
// segundo plano não fica martelando o backend.

export const JANELA_AO_VIVO_MIN = 30;

export function useApartamentos() {
  return useQuery({
    queryKey: ['painel', 'apartamentos'],
    queryFn: listarMeusApartamentos,
    refetchInterval: POLLING_LISTAS_MS,
  });
}

export function useSensoresDoApartamento(apartamentoId: string) {
  return useQuery({
    queryKey: ['apartamento', apartamentoId, 'sensores'],
    queryFn: () => listarSensoresDoApartamento(apartamentoId),
    refetchInterval: POLLING_LISTAS_MS,
  });
}

export function useConsumo(apartamentoId: string, periodoId: string) {
  return useQuery({
    // A chave só depende do período escolhido; o intervalo (relativo a "agora") é calculado
    // na hora da requisição, senão cada renderização geraria uma chave nova.
    queryKey: ['apartamento', apartamentoId, 'consumo', periodoId],
    queryFn: async (): Promise<ConsumoDoPeriodo> => {
      const periodo = periodoPorId(periodoId);
      const { inicio, fim } = intervaloDoPeriodo(periodo, new Date());
      const consumo = await buscarConsumo(apartamentoId, inicio, fim, periodo.granularidade);
      return { ...consumo, periodoId: periodo.id };
    },
    refetchInterval: POLLING_LISTAS_MS,
    // ao trocar de período mantém o gráfico anterior na tela até o novo chegar (sem piscar)
    placeholderData: keepPreviousData,
  });
}

export function useStatusDoSensor(sensorId: string) {
  return useQuery({
    queryKey: ['sensor', sensorId, 'status'],
    queryFn: () => buscarStatusDoSensor(sensorId),
    refetchInterval: POLLING_AO_VIVO_MS,
  });
}

export function useLeiturasRecentes(sensorId: string) {
  return useQuery({
    queryKey: ['sensor', sensorId, 'leituras', JANELA_AO_VIVO_MIN],
    queryFn: () => listarLeiturasRecentes(sensorId, JANELA_AO_VIVO_MIN),
    refetchInterval: POLLING_AO_VIVO_MS,
  });
}

// Alertas ativos do apartamento (regra no backend). `apartamentoId` pode ainda não ser
// conhecido (ex.: tela do sensor antes do status chegar): a consulta só roda quando existe.
export function useAlertas(apartamentoId: string | undefined) {
  return useQuery({
    queryKey: ['apartamento', apartamentoId, 'alertas'],
    queryFn: () => listarAlertas(apartamentoId as string),
    enabled: !!apartamentoId,
    refetchInterval: POLLING_AO_VIVO_MS,
  });
}
