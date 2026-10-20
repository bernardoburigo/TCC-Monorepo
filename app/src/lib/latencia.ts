// Registro do instante de exibição (t_exib) das leituras, para a medição de latência da
// Sprint 6 (artigo, Seção 2.6.3, Equação 5): L_ing = t_pers − t_cap, L_exib = t_exib − t_pers,
// L_tot = t_exib − t_cap. t_cap = timestampLeitura (ESP32/NTP), t_pers = recebidoEm (backend),
// t_exib = relógio deste dispositivo quando a leitura chegou à tela. O CSV gerado aqui é lido
// por docs/scripts/analise/latencia.py.
//
// Só entra no registro leitura que APARECEU durante o acompanhamento: a primeira carga da
// tela traz ~10 min de histórico de uma vez, e o t_exib dessas não mede nada.

export interface LeituraExibivel {
  id: string;
  sensorId: string;
  sequencia: number;
  timestampLeitura: string;
  recebidoEm: string;
}

export interface LinhaLatencia {
  sensorId: string;
  sequencia: number;
  timestampLeitura: string;
  recebidoEm: string;
  exibidoEm: string;
}

export interface RegistroLatencia {
  // ids já vistos por sensor; sensor ausente = ainda não houve a primeira carga
  vistos: Map<string, Set<string>>;
  linhas: LinhaLatencia[];
}

export function novoRegistro(): RegistroLatencia {
  return { vistos: new Map(), linhas: [] };
}

// Muta `registro` (o buffer vive enquanto o app estiver aberto) e devolve quantas linhas entraram.
export function registrarExibicao(
  registro: RegistroLatencia,
  sensorId: string,
  leituras: LeituraExibivel[],
  exibidoEm: Date,
): number {
  const vistos = registro.vistos.get(sensorId);
  if (!vistos) {
    registro.vistos.set(sensorId, new Set(leituras.map((l) => l.id)));
    return 0;
  }

  let novas = 0;
  for (const leitura of leituras) {
    if (vistos.has(leitura.id)) {
      continue;
    }
    vistos.add(leitura.id);
    registro.linhas.push({
      sensorId: leitura.sensorId,
      sequencia: leitura.sequencia,
      timestampLeitura: leitura.timestampLeitura,
      recebidoEm: leitura.recebidoEm,
      exibidoEm: exibidoEm.toISOString(),
    });
    novas++;
  }
  return novas;
}

export function paraCsv(linhas: LinhaLatencia[]): string {
  const cabecalho = 'sensor_id,sequencia,timestamp_leitura,recebido_em,exibido_em';
  const corpo = linhas.map((l) => [l.sensorId, l.sequencia, l.timestampLeitura, l.recebidoEm, l.exibidoEm].join(','));
  return [cabecalho, ...corpo].join('\n') + '\n';
}
