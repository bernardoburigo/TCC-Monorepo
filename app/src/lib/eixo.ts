// Escala "redonda" para o eixo Y dos gráficos: 0, 10, 20, 30, 40 em vez de 0, 8,25, 16,5…

// Menor passo da forma 1, 2 ou 5 × 10^n que é >= `valor` (0,3 -> 0,5; 8,25 -> 10; 33 -> 50).
export function passoRedondo(valor: number): number {
  if (!(valor > 0)) {
    return 1;
  }
  const potencia = 10 ** Math.floor(Math.log10(valor));
  for (const fator of [1, 2, 5, 10]) {
    if (fator * potencia >= valor - 1e-12) {
      return fator * potencia;
    }
  }
  return 10 * potencia;
}

// Rótulo do eixo Y em pt-BR: 1 casa abaixo de 10, inteiro a partir daí.
export function formatarEixo(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: valor < 10 ? 1 : 0 }).format(valor);
}
