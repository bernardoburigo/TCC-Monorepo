// Dataset e geradores usados só pelo adapter mock (ver ./adapter.ts). Nada fora de
// `src/api/mock/` importa este arquivo — ele não existe para o resto do app.
import type {
  Alerta,
  ApartamentoPainel,
  ConsumoApartamento,
  ConsumoPonto,
  Granularidade,
  LeituraBruta,
  SensorStatus,
  Usuario,
} from '@/api/types';

export const CONDOMINIO_MOCK_ID = 'mock-condominio-1';
export const CONDOMINIO_MOCK_NOME = 'Condomínio Mock (dados locais)';

export interface UsuarioMock extends Usuario {
  token: string;
  senha: string;
}

// senha igual à do simulador Python (docs/scripts/simulador.py) para manter o padrão.
export const USUARIOS_MOCK: UsuarioMock[] = [
  {
    id: 'mock-usuario-sindico',
    nome: 'Síndico Mock',
    email: 'sindico.mock@tcc.com',
    role: 'SINDICO',
    token: 'mock-token-sindico',
    senha: 'senha12345',
  },
  {
    id: 'mock-usuario-proprietario',
    nome: 'Proprietário Mock',
    email: 'proprietario.mock@tcc.com',
    role: 'PROPRIETARIO',
    token: 'mock-token-proprietario',
    senha: 'senha12345',
  },
];

export interface ApartamentoMock {
  id: string;
  numero: string;
  donoId: string; // id de um USUARIOS_MOCK com role PROPRIETARIO
  sensorId: string;
  mediaLPorHora: number; // curva de consumo base, varia por hora do dia
  vazamento: boolean; // fluxo contínuo nos últimos 30 min, para demonstrar o alerta
}

export const APARTAMENTOS_MOCK: ApartamentoMock[] = [
  {
    id: 'mock-apto-101',
    numero: '101',
    donoId: 'mock-usuario-proprietario',
    sensorId: 'mock-sensor-101',
    mediaLPorHora: 4,
    vazamento: false,
  },
  {
    id: 'mock-apto-102',
    numero: '102',
    donoId: '',
    sensorId: 'mock-sensor-102',
    mediaLPorHora: 7,
    vazamento: false,
  },
  {
    id: 'mock-apto-103',
    numero: '103',
    donoId: '',
    sensorId: 'mock-sensor-103',
    mediaLPorHora: 3,
    vazamento: true,
  },
];

export function apartamentosVisiveisPara(usuario: UsuarioMock): ApartamentoMock[] {
  if (usuario.role === 'SINDICO') return APARTAMENTOS_MOCK;
  return APARTAMENTOS_MOCK.filter((apartamento) => apartamento.donoId === usuario.id);
}

export function temAcesso(usuario: UsuarioMock, apartamento: ApartamentoMock): boolean {
  return usuario.role === 'SINDICO' || apartamento.donoId === usuario.id;
}

function variacaoHoraria(hora: number): number {
  if (hora >= 6 && hora <= 9) return 1.6; // pico da manhã
  if (hora >= 18 && hora <= 22) return 1.8; // pico da noite
  if (hora >= 0 && hora <= 5) return 0.2; // madrugada
  return 1;
}

export function gerarConsumo(
  apartamento: ApartamentoMock,
  inicio: string,
  fim: string,
  granularidade: Granularidade,
): ConsumoApartamento {
  const passoMs = granularidade === 'DIA' ? 86_400_000 : 3_600_000;
  const horasNoPonto = passoMs / 3_600_000;
  const inicioMs = new Date(inicio).getTime();
  const fimMs = new Date(fim).getTime();

  const pontos: ConsumoPonto[] = [];
  for (let t = inicioMs; t < fimMs; t += passoMs) {
    const data = new Date(t);
    const fator = granularidade === 'DIA' ? 1 : variacaoHoraria(data.getHours());
    const ruido = 0.85 + Math.random() * 0.3;
    const litros = apartamento.mediaLPorHora * horasNoPonto * fator * ruido;
    pontos.push({ periodo: data.toISOString(), volumeTotalMl: Math.round(litros * 1000) });
  }

  return { apartamentoId: apartamento.id, numero: apartamento.numero, granularidade, inicio, fim, pontos };
}

export function gerarConsumoHojeMl(apartamento: ApartamentoMock): number {
  const agora = new Date();
  const horasDecorridas = agora.getHours() + agora.getMinutes() / 60;
  const ruido = 0.9 + Math.random() * 0.2;
  const base = apartamento.mediaLPorHora * horasDecorridas * 1000 * ruido;
  const extraDoVazamento = apartamento.vazamento ? horasDecorridas * 10_000 : 0; // ~10 L/h a mais
  return Math.round(base + extraDoVazamento);
}

export function gerarApartamentoPainel(apartamento: ApartamentoMock): ApartamentoPainel {
  return {
    id: apartamento.id,
    numero: apartamento.numero,
    condominioId: CONDOMINIO_MOCK_ID,
    condominioNome: CONDOMINIO_MOCK_NOME,
    consumoHojeMl: gerarConsumoHojeMl(apartamento),
    qtdSensores: 1,
    status: 'ONLINE',
    ultimaLeituraEm: new Date().toISOString(),
    simulado: true,
    alertaVazamento: apartamento.vazamento,
  };
}

export function gerarStatusSensor(apartamento: ApartamentoMock): SensorStatus {
  const agora = new Date();
  return {
    id: apartamento.sensorId,
    apartamentoId: apartamento.id,
    apartamentoNumero: apartamento.numero,
    identificador: `ESP32-MOCK-${apartamento.numero}`,
    ativo: true,
    simulado: true,
    status: 'ONLINE',
    ultimaLeituraEm: agora.toISOString(),
    ultimoTimestampLeitura: new Date(agora.getTime() - 300).toISOString(),
  };
}

// Pulsos/mL a partir do K teórico do datasheet (7,5 Hz por L/min = 450 pulsos/L, CLAUDE.md §3).
const PULSOS_POR_ML = 450 / 1000;

export function gerarLeituras(apartamento: ApartamentoMock, sensorId: string, minutos: number): LeituraBruta[] {
  const agora = Date.now();
  const janelaMs = 5_000; // mesma janela de envio do firmware real
  const totalJanelas = Math.max(1, Math.floor((minutos * 60_000) / janelaMs));

  const leituras: LeituraBruta[] = [];
  for (let i = totalJanelas; i >= 0; i--) {
    const timestamp = new Date(agora - i * janelaMs);
    const fluxoAtivo = apartamento.vazamento || Math.random() < 0.3;
    const volumeMl = fluxoAtivo ? 50 + Math.random() * 150 : 0;
    const recebidoEm = new Date(timestamp.getTime() + 200 + Math.random() * 300);
    const sequencia = totalJanelas - i;
    leituras.push({
      id: `${sensorId}-leitura-${sequencia}`,
      sensorId,
      timestampLeitura: timestamp.toISOString(),
      pulsos: Math.round(volumeMl * PULSOS_POR_ML),
      volumeMlEstimado: Math.round(volumeMl * 100) / 100,
      sequencia,
      recebidoEm: recebidoEm.toISOString(),
    });
  }
  return leituras;
}

export function gerarAlertas(apartamento: ApartamentoMock): Alerta[] {
  if (!apartamento.vazamento) return [];
  const duracaoSegundos = 35 * 60; // acima do limiar padrão de 30 min (APP_ALERTA_FLUXO_CONTINUO_MINUTOS)
  return [
    {
      sensorId: apartamento.sensorId,
      apartamentoId: apartamento.id,
      sensorIdentificador: `ESP32-MOCK-${apartamento.numero}`,
      tipo: 'VAZAMENTO_PROVAVEL',
      desde: new Date(Date.now() - duracaoSegundos * 1000).toISOString(),
      duracaoSegundos,
      volumeMl: Math.round(duracaoSegundos * (100 / 5)),
      simulado: true,
    },
  ];
}
