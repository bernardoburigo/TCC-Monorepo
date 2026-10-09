import { calcularVazoes } from '../vazao';

function leitura(iso: string, volumeMlEstimado: number) {
  return { timestampLeitura: iso, volumeMlEstimado };
}

describe('calcularVazoes', () => {
  it('sem leituras suficientes não há vazão', () => {
    expect(calcularVazoes([])).toEqual([]);
    expect(calcularVazoes([leitura('2026-09-25T12:00:05.000Z', 100)])).toEqual([]);
  });

  it('vazão = volume da janela / duração da janela (entre timestamps consecutivos)', () => {
    // 100 mL em 5 s = 0,1 L em 1/12 min = 1,2 L/min
    const pontos = calcularVazoes([
      leitura('2026-09-25T12:00:00.000Z', 0),
      leitura('2026-09-25T12:00:05.000Z', 100),
    ]);
    expect(pontos).toHaveLength(1);
    expect(pontos[0].litrosPorMinuto).toBeCloseTo(1.2, 6);
    expect(pontos[0].instante).toBe(Date.parse('2026-09-25T12:00:05.000Z'));
  });

  it('janela sem consumo tem vazão zero (não é ignorada)', () => {
    const pontos = calcularVazoes([
      leitura('2026-09-25T12:00:00.000Z', 0),
      leitura('2026-09-25T12:00:05.000Z', 0),
    ]);
    expect(pontos).toEqual([{ instante: Date.parse('2026-09-25T12:00:05.000Z'), litrosPorMinuto: 0 }]);
  });

  it('usa a duração real entre as leituras, não uma janela fixa', () => {
    // 60 s de janela: 1000 mL = 1 L/min
    const pontos = calcularVazoes(
      [leitura('2026-09-25T12:00:00.000Z', 0), leitura('2026-09-25T12:01:00.000Z', 1000)],
      { lacunaMaximaS: 60 },
    );
    expect(pontos[0].litrosPorMinuto).toBeCloseTo(1, 6);
  });

  it('lacuna maior que o limite (sensor ficou sem enviar) não gera ponto: a janela é desconhecida', () => {
    const pontos = calcularVazoes([
      leitura('2026-09-25T12:00:00.000Z', 0),
      leitura('2026-09-25T12:00:05.000Z', 50),
      leitura('2026-09-25T12:05:00.000Z', 900), // 295 s depois
      leitura('2026-09-25T12:05:05.000Z', 50),
    ]);
    expect(pontos.map((p) => p.instante)).toEqual([
      Date.parse('2026-09-25T12:00:05.000Z'),
      Date.parse('2026-09-25T12:05:05.000Z'),
    ]);
  });

  it('timestamps repetidos ou fora de ordem são ignorados (sem divisão por zero)', () => {
    const pontos = calcularVazoes([
      leitura('2026-09-25T12:00:05.000Z', 50),
      leitura('2026-09-25T12:00:05.000Z', 50),
      leitura('2026-09-25T12:00:00.000Z', 50),
    ]);
    expect(pontos).toEqual([]);
  });
});
