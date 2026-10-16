import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

import type { ConsumoApartamento } from '@/api/types';
import { formatarEixo, passoRedondo } from '@/lib/eixo';
import { formatarVolume, rotuloCompletoDoPonto, rotuloDoPonto } from '@/lib/format';
import { preencherSerie, rotuloVisivel } from '@/lib/serie';

const LARGURA_EIXO_Y = 44;
const ALTURA = 200;
const LARGURA_ROTULO = 32; // "dd/MM" em 10 px cabe sem quebrar nem cortar
const MARGEM_ROTULO = 2;

// Barras de consumo por hora/dia. Uma barra por intervalo (zero onde não houve consumo);
// tocar numa barra mostra o valor exato acima do gráfico.
export function ConsumoChart({ consumo }: { consumo: ConsumoApartamento }) {
  const [largura, setLargura] = useState(0);
  const [selecionado, setSelecionado] = useState<number | null>(null);

  const serie = useMemo(
    () => preencherSerie(consumo.pontos, consumo.inicio, consumo.fim, consumo.granularidade),
    [consumo],
  );

  const litros = serie.map((p) => p.volumeTotalMl / 1000);
  const passo = passoRedondo(Math.max(...litros, 0) / 4);
  const eixoY = passo * 4;

  const areaUtil = Math.max(largura - LARGURA_EIXO_Y - 16, 0);
  const faixa = serie.length > 0 ? areaUtil / serie.length : 0; // largura reservada a cada barra
  const larguraBarra = Math.min(Math.max(faixa * 0.62, 3), 34);

  const maxRotulos = Math.floor(areaUtil / (LARGURA_ROTULO + MARGEM_ROTULO));

  // Rótulos do eixo X desenhados à parte (o contêiner do rótulo do gifted-charts tem a largura da
  // faixa da barra, poucos px em 24 h, e cortava/quebrava o texto): um Text de largura fixa
  // centrado em cada barra.
  const dados = serie.map((ponto, i) => ({
    value: litros[i],
    frontColor: i === selecionado ? '#075985' : '#0ea5e9',
    onPress: () => setSelecionado((atual) => (atual === i ? null : i)),
  }));

  const ponto = selecionado !== null ? serie[selecionado] : null;

  return (
    <View onLayout={(e) => setLargura(e.nativeEvent.layout.width)} className="gap-2">
      <Text testID="detalhe-barra" className="min-h-5 text-sm text-slate-600">
        {ponto
          ? `${rotuloCompletoDoPonto(ponto.periodo, consumo.granularidade)} · ${formatarVolume(ponto.volumeTotalMl)}`
          : 'Toque numa barra para ver o valor'}
      </Text>

      {areaUtil > 0 ? (
        <View testID="grafico-consumo" className="overflow-hidden">
          <BarChart
            data={dados}
            width={areaUtil}
            height={ALTURA}
            barWidth={larguraBarra}
            spacing={Math.max(faixa - larguraBarra, 0)}
            initialSpacing={Math.max((faixa - larguraBarra) / 2, 0)}
            endSpacing={0}
            maxValue={eixoY}
            noOfSections={4}
            stepValue={passo}
            yAxisLabelWidth={LARGURA_EIXO_Y}
            formatYLabel={(rotulo: string) => formatarEixo(Number(rotulo))}
            yAxisLabelSuffix=" L"
            yAxisThickness={0}
            xAxisThickness={1}
            xAxisColor="#cbd5e1"
            rulesColor="#e2e8f0"
            yAxisTextStyle={{ color: '#64748b', fontSize: 11 }}
            xAxisLabelTextStyle={{ color: '#64748b', fontSize: 11 }}
            barBorderTopLeftRadius={4}
            barBorderTopRightRadius={4}
            disableScroll
            isAnimated={false}
          />
          <View style={{ height: 18, marginTop: -4 }}>
            {serie.map((p, i) =>
              rotuloVisivel(i, serie.length, maxRotulos) ? (
                <Text
                  key={p.periodo}
                  numberOfLines={1}
                  style={{
                    position: 'absolute',
                    left: LARGURA_EIXO_Y + faixa * (i + 0.5) - LARGURA_ROTULO / 2,
                    width: LARGURA_ROTULO,
                    textAlign: 'center',
                    color: '#64748b',
                    fontSize: 10,
                  }}>
                  {rotuloDoPonto(p.periodo, consumo.granularidade)}
                </Text>
              ) : null,
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}
