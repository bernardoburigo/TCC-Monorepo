import { novoRegistro, paraCsv, registrarExibicao } from '../latencia';

function leitura(id: string, sequencia: number) {
  return {
    id,
    sensorId: 's1',
    sequencia,
    timestampLeitura: `2026-10-19T12:00:0${sequencia}.000Z`,
    recebidoEm: `2026-10-19T12:00:0${sequencia}.400Z`,
  };
}

const T1 = new Date('2026-10-19T12:00:10.000Z');
const T2 = new Date('2026-10-19T12:00:15.000Z');

describe('registrarExibicao', () => {
  it('a primeira carga só marca as leituras como vistas (histórico não mede exibição)', () => {
    const registro = novoRegistro();
    expect(registrarExibicao(registro, 's1', [leitura('a', 1), leitura('b', 2)], T1)).toBe(0);
    expect(registro.linhas).toEqual([]);
  });

  it('leitura nova depois da primeira carga entra com o instante em que apareceu', () => {
    const registro = novoRegistro();
    registrarExibicao(registro, 's1', [leitura('a', 1)], T1);
    expect(registrarExibicao(registro, 's1', [leitura('a', 1), leitura('b', 2)], T2)).toBe(1);
    expect(registro.linhas).toEqual([
      {
        sensorId: 's1',
        sequencia: 2,
        timestampLeitura: '2026-10-19T12:00:02.000Z',
        recebidoEm: '2026-10-19T12:00:02.400Z',
        exibidoEm: '2026-10-19T12:00:15.000Z',
      },
    ]);
  });

  it('a mesma leitura em vários pollings é registrada uma vez só', () => {
    const registro = novoRegistro();
    registrarExibicao(registro, 's1', [], T1);
    registrarExibicao(registro, 's1', [leitura('a', 1)], T1);
    registrarExibicao(registro, 's1', [leitura('a', 1)], T2);
    expect(registro.linhas).toHaveLength(1);
    expect(registro.linhas[0].exibidoEm).toBe(T1.toISOString());
  });

  it('cada sensor tem a sua primeira carga', () => {
    const registro = novoRegistro();
    registrarExibicao(registro, 's1', [leitura('a', 1)], T1);
    expect(registrarExibicao(registro, 's2', [leitura('x', 1)], T1)).toBe(0);
  });
});

describe('paraCsv', () => {
  it('gera cabeçalho e uma linha por leitura, no formato lido por latencia.py', () => {
    const registro = novoRegistro();
    registrarExibicao(registro, 's1', [], T1);
    registrarExibicao(registro, 's1', [leitura('a', 1)], T2);
    expect(paraCsv(registro.linhas)).toBe(
      'sensor_id,sequencia,timestamp_leitura,recebido_em,exibido_em\n' +
        's1,1,2026-10-19T12:00:01.000Z,2026-10-19T12:00:01.400Z,2026-10-19T12:00:15.000Z\n',
    );
  });
});
