import type { ConsumoPonto, Granularidade } from '@/api/types';

const PASSO_MS: Record<Granularidade, number> = {
  MINUTO: 60_000,
  HORA: 3_600_000,
  DIA: 86_400_000,
};

// Teto de barras: um intervalo absurdo (ex.: datas erradas) não pode travar a tela.
const MAXIMO_DE_PONTOS = 1000;

// O backend só devolve os intervalos que TÊM leitura. Para o gráfico ficar contínuo (uma barra
// por hora/dia, com zero onde não houve consumo) preenche a grade entre `inicio` (já alinhado
// pelo backend ao começo do intervalo) e `fim`.
//
// O passo de 24 h para DIA vale em America/Sao_Paulo (sem horário de verão desde 2019). Se algum
// ponto real não cair na grade (fuso diferente, horário de verão), NÃO descarta dado: devolve os
// pontos originais, só sem o preenchimento.
export function preencherSerie(
  pontos: ConsumoPonto[],
  inicio: string,
  fim: string,
  granularidade: Granularidade,
): ConsumoPonto[] {
  const passo = PASSO_MS[granularidade];
  const porInstante = new Map(pontos.map((p) => [Date.parse(p.periodo), p]));

  const serie: ConsumoPonto[] = [];
  const limite = Date.parse(fim);
  let usados = 0;
  for (let t = Date.parse(inicio); t <= limite && serie.length < MAXIMO_DE_PONTOS; t += passo) {
    const existente = porInstante.get(t);
    if (existente) {
      usados++;
    }
    serie.push(existente ?? { periodo: new Date(t).toISOString(), volumeTotalMl: 0 });
  }

  return usados === pontos.length ? serie : pontos;
}

// Com muitas barras os rótulos do eixo X se sobrepõem: mostra ~8 no máximo, sempre o primeiro.
export function rotuloVisivel(indice: number, total: number): boolean {
  if (total <= 8) {
    return true;
  }
  return indice % Math.ceil(total / 8) === 0;
}
