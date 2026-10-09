import { differenceInSeconds, format, parseISO } from 'date-fns';

import type { Granularidade } from '@/api/types';

const numeroPtBr1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const numeroPtBr0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const vazaoPtBr = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Até 999 mL em mL; a partir de 1 L em litros, com 1 casa até 100 L e inteiro acima
// (786 L é mais legível que 786,4 L num painel).
export function formatarVolume(ml: number): string {
  if (!Number.isFinite(ml) || ml < 0) {
    return '0 mL';
  }
  if (Math.round(ml) < 1000) {
    return `${Math.round(ml)} mL`;
  }
  const litros = ml / 1000;
  return `${(litros < 100 ? numeroPtBr1 : numeroPtBr0).format(litros)} L`;
}

export function formatarVazao(litrosPorMinuto: number): string {
  return `${vazaoPtBr.format(Math.max(litrosPorMinuto, 0))} L/min`;
}

// "há 5 s", "há 3 min", "há 2 h", "há 4 d". Instante no futuro (relógios levemente
// diferentes entre backend e aparelho) conta como "agora".
export function tempoDesde(iso: string | null, agora: Date): string {
  if (!iso) {
    return 'sem leituras';
  }
  const segundos = differenceInSeconds(agora, parseISO(iso));
  if (segundos < 0) {
    return 'agora';
  }
  if (segundos < 60) {
    return `há ${segundos} s`;
  }
  if (segundos < 3600) {
    return `há ${Math.floor(segundos / 60)} min`;
  }
  if (segundos < 86_400) {
    return `há ${Math.floor(segundos / 3600)} h`;
  }
  return `há ${Math.floor(segundos / 86_400)} d`;
}

export function formatarHora(iso: string): string {
  return format(parseISO(iso), 'HH:mm:ss');
}

// Rótulo do eixo X do gráfico de consumo, no fuso do aparelho.
export function rotuloDoPonto(periodoIso: string, granularidade: Granularidade): string {
  const data = parseISO(periodoIso);
  switch (granularidade) {
    case 'DIA':
      return format(data, 'dd/MM');
    case 'HORA':
      return format(data, "HH'h'");
    case 'MINUTO':
      return format(data, 'HH:mm');
  }
}

// Rótulo completo do ponto (para o detalhe ao tocar numa barra): inclui o dia quando é por hora.
export function rotuloCompletoDoPonto(periodoIso: string, granularidade: Granularidade): string {
  const data = parseISO(periodoIso);
  switch (granularidade) {
    case 'DIA':
      return format(data, 'dd/MM');
    case 'HORA':
      return format(data, "dd/MM HH'h'");
    case 'MINUTO':
      return format(data, 'dd/MM HH:mm');
  }
}

// "45 s", "12 min", "1 h 05 min", "2 h": duração legível (alerta de fluxo contínuo).
export function formatarDuracao(segundos: number): string {
  const total = Math.max(Math.round(segundos), 0);
  if (total < 60) {
    return `${total} s`;
  }
  const minutos = Math.floor(total / 60);
  if (minutos < 60) {
    return `${minutos} min`;
  }
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas} h` : `${horas} h ${String(resto).padStart(2, '0')} min`;
}
