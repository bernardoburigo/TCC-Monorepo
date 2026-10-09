import {
  formatarDuracao,
  formatarVazao,
  formatarVolume,
  rotuloCompletoDoPonto,
  rotuloDoPonto,
  tempoDesde,
} from '../format';

describe('formatarVolume', () => {
  it('abaixo de 1 L mostra mL inteiros', () => {
    expect(formatarVolume(0)).toBe('0 mL');
    expect(formatarVolume(350.4)).toBe('350 mL');
    expect(formatarVolume(999.4)).toBe('999 mL');
  });

  it('a partir de 1 L mostra litros em pt-BR (1 casa até 100 L, inteiro depois)', () => {
    expect(formatarVolume(1000)).toBe('1 L');
    expect(formatarVolume(1234)).toBe('1,2 L');
    expect(formatarVolume(786_400)).toBe('786 L');
    expect(formatarVolume(1_234_500)).toBe('1.235 L');
  });

  it('valores negativos ou inválidos viram zero', () => {
    expect(formatarVolume(-5)).toBe('0 mL');
    expect(formatarVolume(Number.NaN)).toBe('0 mL');
  });
});

describe('formatarVazao', () => {
  it('usa vírgula e uma casa decimal', () => {
    expect(formatarVazao(0)).toBe('0,0 L/min');
    expect(formatarVazao(1.24)).toBe('1,2 L/min');
    expect(formatarVazao(8)).toBe('8,0 L/min');
  });
});

describe('tempoDesde', () => {
  const agora = new Date('2026-09-25T12:00:00Z');

  it('sem instante informa que não há leituras', () => {
    expect(tempoDesde(null, agora)).toBe('sem leituras');
  });

  it('escolhe a unidade pela ordem de grandeza', () => {
    expect(tempoDesde('2026-09-25T11:59:55Z', agora)).toBe('há 5 s');
    expect(tempoDesde('2026-09-25T11:57:00Z', agora)).toBe('há 3 min');
    expect(tempoDesde('2026-09-25T09:00:00Z', agora)).toBe('há 3 h');
    expect(tempoDesde('2026-09-21T12:00:00Z', agora)).toBe('há 4 d');
  });

  it('instante no futuro (relógios levemente diferentes) conta como agora', () => {
    expect(tempoDesde('2026-09-25T12:00:02Z', agora)).toBe('agora');
  });
});

// Os testes rodam com TZ=America/Sao_Paulo (jest.global-setup.js).
describe('rotuloDoPonto', () => {
  it('HORA: hora local', () => {
    expect(rotuloDoPonto('2026-09-25T17:00:00Z', 'HORA')).toBe('14h');
  });

  it('DIA: dia/mês local (00:00 de São Paulo = 03:00Z)', () => {
    expect(rotuloDoPonto('2026-09-25T03:00:00Z', 'DIA')).toBe('25/09');
  });

  it('MINUTO: hora e minuto locais', () => {
    expect(rotuloDoPonto('2026-09-25T17:05:00Z', 'MINUTO')).toBe('14:05');
  });
});

describe('rotuloCompletoDoPonto', () => {
  it('por hora inclui o dia; por dia só dia/mês', () => {
    expect(rotuloCompletoDoPonto('2026-09-25T17:00:00Z', 'HORA')).toBe('25/09 14h');
    expect(rotuloCompletoDoPonto('2026-09-25T03:00:00Z', 'DIA')).toBe('25/09');
    expect(rotuloCompletoDoPonto('2026-09-25T17:05:00Z', 'MINUTO')).toBe('25/09 14:05');
  });
});

describe('formatarDuracao', () => {
  it('escolhe segundos, minutos ou horas', () => {
    expect(formatarDuracao(45)).toBe('45 s');
    expect(formatarDuracao(60)).toBe('1 min');
    expect(formatarDuracao(12 * 60 + 20)).toBe('12 min');
    expect(formatarDuracao(65 * 60)).toBe('1 h 05 min');
    expect(formatarDuracao(2 * 3600)).toBe('2 h');
  });

  it('valores negativos viram zero', () => {
    expect(formatarDuracao(-5)).toBe('0 s');
  });
});
