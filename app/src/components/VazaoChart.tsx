import { format } from 'date-fns';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import { formatarEixo, passoRedondo } from '@/lib/eixo';
import type { PontoVazao } from '@/lib/vazao';

const LARGURA_EIXO_Y = 52;
const ALTURA = 180;
const LARGURA_ROTULO = 40;
// Rótulos do eixo X em posições FIXAS (frações da largura); só o texto acompanha o horário.
const FRACOES = [0, 0.2, 0.4, 0.6, 0.8, 1];

// Vazão (L/min) ao longo do tempo, uma amostra por janela de leitura.
export function VazaoChart({ pontos }: { pontos: PontoVazao[] }) {
  const [largura, setLargura] = useState(0);

  const dados = useMemo(() => pontos.map((ponto) => ({ value: ponto.litrosPorMinuto })), [pontos]);

  const inicio = pontos.length > 0 ? pontos[0].instante : 0;
  const fim = pontos.length > 0 ? pontos[pontos.length - 1].instante : 0;

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
          <View style={{ height: 20, marginLeft: LARGURA_EIXO_Y }}>
            {FRACOES.map((fracao) => (
              <Text
                key={fracao}
                numberOfLines={1}
                style={{
                  position: 'absolute',
                  left: areaUtil * fracao - LARGURA_ROTULO / 2,
                  width: LARGURA_ROTULO,
                  textAlign: 'center',
                  color: '#64748b',
                  fontSize: 11,
                }}>
                {format(new Date(inicio + (fim - inicio) * fracao), 'HH:mm')}
              </Text>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
