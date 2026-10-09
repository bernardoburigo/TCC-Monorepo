// Vazão (L/min) a partir das leituras brutas do sensor.
//
// Cada leitura do firmware traz o volume da JANELA que termina no seu timestamp
// (`volumeMlEstimado` é delta, não acumulado). A duração da janela não vem no payload:
// deduz-se pela diferença até a leitura anterior. Assim o cálculo vale tanto para as
// janelas de 5 s do firmware quanto para as de 60 s do histórico simulado.

export interface JanelaLeitura {
  timestampLeitura: string;
  volumeMlEstimado: number;
}

export interface PontoVazao {
  instante: number; // epoch em ms (fim da janela)
  litrosPorMinuto: number;
}

interface Opcoes {
  // Diferença máxima entre leituras consecutivas para confiar na duração da janela.
  // Acima disso o sensor ficou sem enviar (queda de rede/reinício) e a janela é desconhecida.
  lacunaMaximaS?: number;
}

export function calcularVazoes(leituras: JanelaLeitura[], { lacunaMaximaS = 15 }: Opcoes = {}): PontoVazao[] {
  const pontos: PontoVazao[] = [];

  for (let i = 1; i < leituras.length; i++) {
    const inicio = Date.parse(leituras[i - 1].timestampLeitura);
    const fim = Date.parse(leituras[i].timestampLeitura);
    const duracaoS = (fim - inicio) / 1000;

    // timestamps repetidos ou fora de ordem (duração <= 0) ou lacuna grande: sem ponto
    if (!Number.isFinite(duracaoS) || duracaoS <= 0 || duracaoS > lacunaMaximaS) {
      continue;
    }

    const litros = leituras[i].volumeMlEstimado / 1000;
    pontos.push({ instante: fim, litrosPorMinuto: litros / (duracaoS / 60) });
  }

  return pontos;
}
