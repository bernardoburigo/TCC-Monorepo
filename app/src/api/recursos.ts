import { api } from './client';
import type {
  Alerta,
  ApartamentoPainel,
  ConsumoApartamento,
  Granularidade,
  LeituraBruta,
  SensorStatus,
} from './types';

export async function listarMeusApartamentos(): Promise<ApartamentoPainel[]> {
  const { data } = await api.get<ApartamentoPainel[]>('/api/me/apartamentos');
  return data;
}

export async function listarSensoresDoApartamento(apartamentoId: string): Promise<SensorStatus[]> {
  const { data } = await api.get<SensorStatus[]>(`/api/apartamentos/${apartamentoId}/sensores`);
  return data;
}

export async function buscarConsumo(
  apartamentoId: string,
  inicio: string,
  fim: string,
  granularidade: Granularidade,
): Promise<ConsumoApartamento> {
  const { data } = await api.get<ConsumoApartamento>(`/api/apartamentos/${apartamentoId}/consumo`, {
    params: { inicio, fim, granularidade },
  });
  return data;
}

export async function buscarStatusDoSensor(sensorId: string): Promise<SensorStatus> {
  const { data } = await api.get<SensorStatus>(`/api/sensores/${sensorId}/status`);
  return data;
}

export async function listarLeiturasRecentes(sensorId: string, minutos: number): Promise<LeituraBruta[]> {
  const { data } = await api.get<LeituraBruta[]>(`/api/sensores/${sensorId}/leituras`, { params: { minutos } });
  return data;
}

export async function listarAlertas(apartamentoId: string): Promise<Alerta[]> {
  const { data } = await api.get<Alerta[]>(`/api/apartamentos/${apartamentoId}/alertas`);
  return data;
}
