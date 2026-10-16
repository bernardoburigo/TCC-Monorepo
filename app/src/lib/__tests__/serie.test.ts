import { preencherSerie, rotuloVisivel } from '../serie';


describe('preencherSerie', () => {
  it('completa com zero os intervalos sem leitura entre início e fim', () => {
    const inicio = '2026-09-25T10:00:00.000Z';
    const serie = preencherSerie(
      [
        { periodo: '2026-09-25T10:00:00.000Z', volumeTotalMl: 500 },
        { periodo: '2026-09-25T13:00:00.000Z', volumeTotalMl: 200 },
      ],
      inicio,
      '2026-09-25T13:30:00.000Z',
      'HORA',
    );

    expect(serie.map((p) => [p.periodo, p.volumeTotalMl])).toEqual([
      ['2026-09-25T10:00:00.000Z', 500],
      ['2026-09-25T11:00:00.000Z', 0],
      ['2026-09-25T12:00:00.000Z', 0],
      ['2026-09-25T13:00:00.000Z', 200],
    ]);
  });

  it('sem pontos devolve a série toda zerada (o gráfico não some)', () => {
    const serie = preencherSerie([], '2026-09-25T10:00:00.000Z', '2026-09-25T12:30:00.000Z', 'HORA');
    expect(serie.map((p) => p.volumeTotalMl)).toEqual([0, 0, 0]);
  });

  it('DIA avança de 24 em 24 h a partir do início alinhado (00:00 de São Paulo = 03:00Z)', () => {
    const serie = preencherSerie(
      [{ periodo: '2026-09-24T03:00:00.000Z', volumeTotalMl: 9000 }],
      '2026-09-23T03:00:00.000Z',
      '2026-09-25T15:00:00.000Z',
      'DIA',
    );
    expect(serie.map((p) => p.periodo)).toEqual([
      '2026-09-23T03:00:00.000Z',
      '2026-09-24T03:00:00.000Z',
      '2026-09-25T03:00:00.000Z',
    ]);
    expect(serie[1].volumeTotalMl).toBe(9000);
  });

  it('se algum ponto não cabe na grade (fuso/horário de verão), não descarta dado: devolve os pontos originais', () => {
    const pontos = [
      { periodo: '2026-09-25T10:30:00.000Z', volumeTotalMl: 100 }, // fora da grade de hora cheia
      { periodo: '2026-09-25T11:00:00.000Z', volumeTotalMl: 200 },
    ];
    const serie = preencherSerie(pontos, '2026-09-25T10:00:00.000Z', '2026-09-25T12:00:00.000Z', 'HORA');
    expect(serie).toEqual(pontos);
  });

  it('não gera séries gigantes por engano (limite de segurança)', () => {
    const serie = preencherSerie([], '2020-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'MINUTO');
    expect(serie.length).toBeLessThanOrEqual(1000);
  });
});

describe('rotuloVisivel', () => {
  it('até 8 barras mostra todos os rótulos', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].every((i) => rotuloVisivel(i, 8))).toBe(true);
  });

  it('com muitas barras mostra só alguns, incluindo o primeiro', () => {
    const visiveis = Array.from({ length: 25 }, (_, i) => i).filter((i) => rotuloVisivel(i, 25));
    expect(visiveis[0]).toBe(0);
    expect(visiveis.length).toBeLessThanOrEqual(9);
    expect(visiveis.length).toBeGreaterThan(3);
  });

  it('respeita o máximo que cabe na largura', () => {
    const visiveis = Array.from({ length: 7 }, (_, i) => i).filter((i) => rotuloVisivel(i, 7, 4));
    expect(visiveis.length).toBeLessThanOrEqual(4);
    expect(visiveis[0]).toBe(0);
  });
});
