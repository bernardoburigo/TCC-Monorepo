import { format } from 'date-fns';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import { formatarEixo, passoRedondo } from '@/lib/eixo';
import type { PontoVazao } from '@/lib/vazao';

const LARGURA_EIXO_Y = 52;
const ALTURA = 180;
const CINCO_MIN_MS = 5 * 60_000;

// Cada ponto ocupa poucos pixels (360 leituras em ~600 px), mas o contêiner do rótulo do
// gifted-charts tem largura `spacing + labelsExtraHeight`: sem folga o "21:15" quebra em
// caracteres soltos. A folga é dada e o texto é deslocado metade dela para ficar centrado no ponto.
const FOLGA_ROTULO = 36;

// Vazão (L/min) ao longo do tempo, uma amostra por janela de leitura. O eixo X mostra um
// rótulo a cada 5 minutos (no primeiro ponto depois de cada múltiplo de 5 min).
export function VazaoChart({ pontos }: { pontos: PontoVazao[] }) {
  const [largura, setLargura] = useState(0);

  const dados = useMemo(() => {
    // O 1º ponto nunca ganha rótulo: ele quase nunca cai num múltiplo de 5 min e o texto
    // (ex.: "20:54") colidiria com o rótulo do próximo balde (20:55).
    let baldeAnterior = pontos.length > 0 ? Math.floor(pontos[0].instante / CINCO_MIN_MS) : -1;
    return pontos.map((ponto) => {
      const balde = Math.floor(ponto.instante / CINCO_MIN_MS);
      const novoBalde = balde !== baldeAnterior;
      baldeAnterior = balde;
      return {
        value: ponto.litrosPorMinuto,
        label: novoBalde ? format(new Date(ponto.instante), 'HH:mm') : '',
      };
    });
  }, [pontos]);

  const maximo = Math.max(...pontos.map((p) => p.litrosPorMinuto), 0);
  const passo = passoRedondo(maximo / 4);
  const areaUtil = Math.max(largura - LARGURA_EIXO_Y - 16, 0);

  return (
    <View onLayout={(e) => setLargura(e.nativeEvent.layout.width)}>
      {areaUtil > 0 && dados.length > 1 ? (
        <View testID="grafico-vazao" className="overflow-hidden">
          <LineChart
            data={dados}
            width={areaUtil}
            height={ALTURA}
            spacing={areaUtil / Math.max(dados.length - 1, 1)}
            initialSpacing={0}
            endSpacing={0}
            maxValue={passo * 4}
            noOfSections={4}
            stepValue={passo}
            yAxisLabelWidth={LARGURA_EIXO_Y}
            formatYLabel={(rotulo: string) => formatarEixo(Number(rotulo))}
            yAxisLabelSuffix=" L/min"
            yAxisThickness={0}
            xAxisThickness={1}
            xAxisColor="#cbd5e1"
            rulesColor="#e2e8f0"
            yAxisTextStyle={{ color: '#64748b', fontSize: 11 }}
            xAxisLabelTextStyle={{ color: '#64748b', fontSize: 11, marginLeft: -FOLGA_ROTULO / 2 }}
            labelsExtraHeight={FOLGA_ROTULO}
            color="#0284c7"
            thickness={2}
            hideDataPoints
            areaChart
            startFillColor="#0ea5e9"
            endFillColor="#e0f2fe"
            startOpacity={0.35}
            endOpacity={0.05}
            disableScroll
            isAnimated={false}
          />
        </View>
      ) : null}
    </View>
  );
}
