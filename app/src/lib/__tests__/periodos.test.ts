import { PERIODOS, intervaloDoPeriodo, periodoPorId } from '../periodos';

describe('periodos', () => {
  it('oferece 24 horas (por hora), 7 dias e 30 dias (por dia)', () => {
    expect(PERIODOS.map((p) => [p.id, p.granularidade])).toEqual([
      ['24h', 'HORA'],
      ['7d', 'DIA'],
      ['30d', 'DIA'],
    ]);
  });

  it('o intervalo termina em "agora" e começa duracao antes', () => {
    const agora = new Date('2026-09-25T12:00:00.000Z');
    expect(intervaloDoPeriodo(periodoPorId('24h'), agora)).toEqual({
      inicio: '2026-09-24T12:00:00.000Z',
      fim: '2026-09-25T12:00:00.000Z',
    });
    expect(intervaloDoPeriodo(periodoPorId('7d'), agora).inicio).toBe('2026-09-18T12:00:00.000Z');
    expect(intervaloDoPeriodo(periodoPorId('30d'), agora).inicio).toBe('2026-08-26T12:00:00.000Z');
  });

  it('id desconhecido cai no primeiro período', () => {
    expect(periodoPorId('xyz').id).toBe('24h');
  });
});
