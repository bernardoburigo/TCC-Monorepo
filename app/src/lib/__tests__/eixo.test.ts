import { casasDoPasso, formatarEixo, passoRedondo } from '../eixo';

describe('passoRedondo', () => {
  it('sem valor positivo usa 1 (o eixo não colapsa)', () => {
    expect(passoRedondo(0)).toBe(1);
    expect(passoRedondo(-3)).toBe(1);
    expect(passoRedondo(Number.NaN)).toBe(1);
  });

  it('arredonda para cima para 1, 2 ou 5 × 10^n', () => {
    expect(passoRedondo(8.25)).toBe(10);
    expect(passoRedondo(11)).toBe(20);
    expect(passoRedondo(33)).toBe(50);
    expect(passoRedondo(0.3)).toBeCloseTo(0.5, 10);
    expect(passoRedondo(0.04)).toBeCloseTo(0.05, 10);
  });

  it('valor que já é redondo fica como está', () => {
    expect(passoRedondo(10)).toBe(10);
    expect(passoRedondo(5)).toBe(5);
    expect(passoRedondo(0.2)).toBeCloseTo(0.2, 10);
  });
});

describe('casasDoPasso', () => {
  it('casas decimais suficientes para o passo não ser cortado', () => {
    expect(casasDoPasso(0.5)).toBe(1);
    expect(casasDoPasso(0.2)).toBe(1);
    expect(casasDoPasso(passoRedondo(0.04))).toBe(2);
    expect(casasDoPasso(1)).toBe(0);
    expect(casasDoPasso(50)).toBe(0);
  });
});

describe('formatarEixo', () => {
  it('1 casa decimal abaixo de 10, inteiro depois, vírgula decimal', () => {
    expect(formatarEixo(0.5)).toBe('0,5');
    expect(formatarEixo(2.5)).toBe('2,5');
    expect(formatarEixo(40)).toBe('40');
    expect(formatarEixo(1250)).toBe('1.250');
  });
});
