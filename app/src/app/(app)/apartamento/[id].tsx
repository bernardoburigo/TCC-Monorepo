import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { mensagemDeErro } from '@/api/client';
import { AlertaBanner } from '@/components/AlertaBanner';
import { ConsumoChart } from '@/components/ConsumoChart';
import { SeletorPeriodo } from '@/components/SeletorPeriodo';
import { Cartao, EstadoCarregando, EstadoErro, EstadoVazio, SeloReal, SeloSimulado, StatusSelo, Tela, Titulo } from '@/components/ui';
import { useAgora } from '@/hooks/useAgora';
import { useAlertas, useApartamentos, useConsumo, useSensoresDoApartamento } from '@/hooks/queries';
import { formatarVolume, rotuloCompletoDoPonto, tempoDesde } from '@/lib/format';
import { PERIODOS, type PeriodoId } from '@/lib/periodos';

export default function DetalheDoApartamento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const agora = useAgora(1000);
  const [periodoId, setPeriodoId] = useState<PeriodoId>('24h');

  // A lista já está em cache (e é atualizada pelo polling): dá número, consumo de hoje e status.
  const painel = useApartamentos();
  const apartamento = painel.data?.find((a) => a.id === id);

  const consumo = useConsumo(id, periodoId);
  const sensores = useSensoresDoApartamento(id);
  const alertas = useAlertas(id);

  // Rótulos vêm do período do DADO exibido (não do seletor): ao trocar de período o gráfico
  // anterior fica na tela até o novo chegar, e o título não pode prometer 7 dias sobre dados de 24 h.
  const periodo = PERIODOS.find((p) => p.id === (consumo.data?.periodoId ?? periodoId)) ?? PERIODOS[0];
  const totalPeriodoMl = useMemo(
    () => consumo.data?.pontos.reduce((soma, p) => soma + p.volumeTotalMl, 0) ?? 0,
    [consumo.data],
  );
  const pico = useMemo(
    () =>
      consumo.data?.pontos.reduce<{ periodo: string; volumeTotalMl: number } | null>(
        (maior, p) => (maior === null || p.volumeTotalMl > maior.volumeTotalMl ? p : maior),
        null,
      ) ?? null,
    [consumo.data],
  );

  return (
    <Tela>
      <Stack.Screen options={{ title: apartamento ? `Apto ${apartamento.numero}` : 'Apartamento' }} />

      {alertas.data?.map((alerta) => <AlertaBanner key={alerta.sensorId} alerta={alerta} />)}

      {apartamento ? (
        <Cartao destaque className="gap-3">
          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-xs uppercase tracking-wide text-sky-200">Consumo hoje</Text>
            {apartamento.simulado ? <SeloSimulado /> : null}
          </View>
          <Text testID="consumo-hoje" className="text-4xl font-bold text-white">
            {formatarVolume(apartamento.consumoHojeMl)}
          </Text>
          <Text testID="atualizado-em" className="text-xs text-sky-200">
            {apartamento.qtdSensores === 0
              ? 'Sem sensor instalado'
              : `Última leitura ${tempoDesde(apartamento.ultimaLeituraEm, agora)}`}
          </Text>
        </Cartao>
      ) : painel.isError ? (
        <EstadoErro mensagem={mensagemDeErro(painel.error)} onTentarNovamente={() => void painel.refetch()} />
      ) : null}

      <Cartao className="gap-4">
        <View className="flex-row flex-wrap items-center justify-between gap-3">
          <Titulo>Consumo no período</Titulo>
          <SeletorPeriodo valor={periodoId} onChange={setPeriodoId} />
        </View>

        {consumo.isPending ? (
          <EstadoCarregando texto="Carregando consumo…" />
        ) : consumo.isError && !consumo.data ? (
          <EstadoErro mensagem={mensagemDeErro(consumo.error)} onTentarNovamente={() => void consumo.refetch()} />
        ) : consumo.data ? (
          <View testID={consumo.isPlaceholderData ? 'consumo-atualizando' : 'consumo-atual'} className={consumo.isPlaceholderData ? 'gap-4 opacity-40' : 'gap-4'}>
            <View className="flex-row flex-wrap gap-x-8 gap-y-2">
              <View>
                <Text className="text-xs uppercase tracking-wide text-slate-500">Total ({periodo.rotulo})</Text>
                <Text testID="total-periodo" className="text-2xl font-bold text-slate-900">
                  {formatarVolume(totalPeriodoMl)}
                </Text>
              </View>
              {pico && pico.volumeTotalMl > 0 ? (
                <View>
                  <Text className="text-xs uppercase tracking-wide text-slate-500">
                    Maior {periodo.granularidade === 'HORA' ? 'hora' : 'dia'}
                  </Text>
                  <Text testID="pico-periodo" className="text-2xl font-bold text-slate-900">
                    {formatarVolume(pico.volumeTotalMl)}
                    <Text className="text-sm font-normal text-slate-500">
                      {'  '}
                      {rotuloCompletoDoPonto(pico.periodo, periodo.granularidade)}
                    </Text>
                  </Text>
                </View>
              ) : null}
            </View>
            <ConsumoChart consumo={consumo.data} />
          </View>
        ) : null}
      </Cartao>

      <Cartao className="gap-3">
        <Titulo>Sensores</Titulo>
        {sensores.isPending ? (
          <EstadoCarregando texto="Carregando sensores…" />
        ) : sensores.isError && !sensores.data ? (
          <EstadoErro mensagem={mensagemDeErro(sensores.error)} onTentarNovamente={() => void sensores.refetch()} />
        ) : sensores.data && sensores.data.length > 0 ? (
          sensores.data.map((sensor) => (
            <Pressable
              key={sensor.id}
              testID={`sensor-${sensor.identificador}`}
              accessibilityRole="button"
              onPress={() => router.push(`/sensor/${sensor.id}`)}
              className="gap-1.5 rounded-xl border border-slate-200 p-3 active:bg-slate-50">
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-row items-center gap-2">
                  <Text className="text-base font-semibold text-slate-900">{sensor.identificador}</Text>
                  {sensor.simulado ? <SeloSimulado /> : <SeloReal />}
                </View>
                <StatusSelo status={sensor.status} />
              </View>
              <Text className="text-xs text-slate-500">
                Última leitura {tempoDesde(sensor.ultimaLeituraEm, agora)} · toque para ver ao vivo
              </Text>
            </Pressable>
          ))
        ) : (
          <EstadoVazio texto="Nenhum sensor instalado neste apartamento." />
        )}
      </Cartao>
    </Tela>
  );
}
