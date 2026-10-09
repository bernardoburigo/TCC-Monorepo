// Espelho dos DTOs do backend (backend/src/main/java/br/unesc/tcc/backend/**/dto).
// Instantes chegam como string ISO-8601 em UTC.

export type Papel = 'SINDICO' | 'PROPRIETARIO';
export type StatusSensor = 'ONLINE' | 'OFFLINE' | 'SEM_DADOS';
export type Granularidade = 'MINUTO' | 'HORA' | 'DIA';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  role: Papel;
}

export interface LoginResponse {
  token: string;
  tipo: string;
  nome: string;
  role: Papel;
}

// GET /api/me/apartamentos
export interface ApartamentoPainel {
  id: string;
  numero: string;
  condominioId: string;
  condominioNome: string;
  consumoHojeMl: number;
  qtdSensores: number;
  status: StatusSensor;
  ultimaLeituraEm: string | null;
  simulado: boolean;
  alertaVazamento: boolean;
}

// GET /api/apartamentos/{id}/sensores e /api/sensores/{id}/status
export interface SensorStatus {
  id: string;
  apartamentoId: string;
  apartamentoNumero: string;
  identificador: string;
  ativo: boolean;
  simulado: boolean;
  status: StatusSensor;
  ultimaLeituraEm: string | null; // quando o backend RECEBEU
  ultimoTimestampLeitura: string | null; // quando o ESP32 mediu (fim da janela)
}

// GET /api/apartamentos/{id}/alertas (calculado sob demanda; não há histórico de alertas)
export interface Alerta {
  sensorId: string;
  apartamentoId: string;
  sensorIdentificador: string;
  tipo: 'VAZAMENTO_PROVAVEL';
  desde: string;
  duracaoSegundos: number;
  volumeMl: number;
  simulado: boolean;
}

// GET /api/sensores/{id}/leituras
export interface LeituraBruta {
  id: string;
  sensorId: string;
  timestampLeitura: string;
  pulsos: number;
  volumeMlEstimado: number;
  sequencia: number;
  recebidoEm: string;
}

// GET /api/apartamentos/{id}/consumo
export interface ConsumoPonto {
  periodo: string;
  volumeTotalMl: number;
}

export interface ConsumoApartamento {
  apartamentoId: string;
  numero: string;
  granularidade: Granularidade;
  inicio: string;
  fim: string;
  pontos: ConsumoPonto[];
}

// Consumo + o período do app (24h/7d/30d) a que ESTE dado se refere. O período escolhido no
// seletor pode já ter mudado enquanto o dado anterior ainda está na tela (keepPreviousData);
// os rótulos ("Total (7 dias)") precisam vir do dado exibido, não do seletor.
export type PeriodoDoApp = '24h' | '7d' | '30d';
export interface ConsumoDoPeriodo extends ConsumoApartamento {
  periodoId: PeriodoDoApp;
}

export interface ErroApi {
  mensagem: string;
  detalhes: string[];
}
