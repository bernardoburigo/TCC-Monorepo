import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { mensagemDeErro } from '@/api/client';
import { AlertaBanner } from '@/components/AlertaBanner';
import { VazaoChart } from '@/components/VazaoChart';
import { Cartao, EstadoCarregando, EstadoErro, EstadoVazio, SeloReal, SeloSimulado, StatusSelo, Tela, Titulo } from '@/components/ui';
import { useAgora } from '@/hooks/useAgora';
import { JANELA_AO_VIVO_MIN, useAlertas, useLeiturasRecentes, useStatusDoSensor } from '@/hooks/queries';
import { formatarHora, formatarVazao, tempoDesde } from '@/lib/format';
import { calcularVazoes } from '@/lib/vazao';

function Linha({ rotulo, valor, testID }: { rotulo: string; valor: string; testID?: string }) {
  return (
    <View className="flex-row items-baseline justify-between gap-4 border-b border-slate-100 py-2">
      <Text className="text-sm text-slate-500">{rotulo}</Text>
      <Text testID={testID} className="flex-1 text-right text-sm font-medium text-slate-900">
        {valor}
      </Text>
    </View>
  );
}

export default function DetalheDoSensor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const agora = useAgora(1000);
  const status = useStatusDoSensor(id);
  const leituras = useLeiturasRecentes(id);
  const alertas = useAlertas(status.data?.apartamentoId);

  const pontos = useMemo(() => (leituras.data ? calcularVazoes(leituras.data) : []), [leituras.data]);
  const ultimaLeitura = leituras.data && leituras.data.length > 0 ? leituras.data[leituras.data.length - 1] : null;

  if (status.isPending) {
    return (
      <Tela>
        <EstadoCarregando texto="Carregando sensor…" />
      </Tela>
    );
  }

  if (status.isError && !status.data) {
    return (
      <Tela>
        <EstadoErro mensagem={mensagemDeErro(status.error)} onTentarNovamente={() => void status.refetch()} />
      </Tela>
    );
  }

  const sensor = status.data;
  if (!sensor) {
    return null;
  }

  // A vazão "atual" é a da última janela; só vale com o sensor online (offline = último valor é velho).
  const ultimoPonto = pontos.length > 0 ? pontos[pontos.length - 1] : null;
  const vazaoAtual = sensor.status === 'ONLINE' && ultimoPonto ? ultimoPonto.litrosPorMinuto : null;

  // Latência de entrega da última leitura: do fim da janela medida no ESP32 até o backend receber.
  const atrasoMs =
    ultimaLeitura ? Date.parse(ultimaLeitura.recebidoEm) - Date.parse(ultimaLeitura.timestampLeitura) : null;

  return (
    <Tela>
      <Stack.Screen options={{ title: sensor.identificador }} />

      {alertas.data
        ?.filter((alerta) => alerta.sensorId === sensor.id)
        .map((alerta) => <AlertaBanner key={alerta.sensorId} alerta={alerta} mostrarSensor={false} />)}

      <Cartao className="gap-4">
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <View className="flex-row items-center gap-2">
            <Text className="text-xs uppercase tracking-wide text-slate-500">Vazão atual</Text>
            {sensor.simulado ? <SeloSimulado /> : <SeloReal />}
          </View>
          <StatusSelo status={sensor.status} />
        </View>

        <View>
          <Text testID="vazao-atual" className="text-4xl font-bold text-sky-800">
            {vazaoAtual === null ? '—' : formatarVazao(vazaoAtual)}
          </Text>
          <Text testID="vazao-legenda" className="text-sm text-slate-500">
            {vazaoAtual === null
              ? sensor.status === 'SEM_DADOS'
                ? 'Este sensor ainda não enviou leituras.'
                : 'Sensor sem comunicação: não há vazão atual.'
              : vazaoAtual === 0
                ? 'Sem fluxo no momento.'
                : 'Média da última janela de leitura.'}
          </Text>
        </View>

        <View className="flex-row flex-wrap gap-x-8 gap-y-1">
          <View>
            <Text className="text-xs uppercase tracking-wide text-slate-500">Medida às</Text>
            <Text testID="medida-as" className="text-base font-semibold text-slate-900">
              {sensor.ultimoTimestampLeitura ? formatarHora(sensor.ultimoTimestampLeitura) : '—'}
            </Text>
          </View>
          <View>
            <Text className="text-xs uppercase tracking-wide text-slate-500">Recebida</Text>
            <Text testID="recebida-ha" className="text-base font-semibold text-slate-900">
              {tempoDesde(sensor.ultimaLeituraEm, agora)}
            </Text>
          </View>
        </View>
      </Cartao>

      <Cartao className="gap-3">
        <View className="flex-row flex-wrap items-baseline justify-between gap-2">
          <Titulo>Vazão nos últimos {JANELA_AO_VIVO_MIN} min</Titulo>
          <Text className="text-xs text-slate-500">Ao vivo · atualiza a cada 5 s</Text>
        </View>

        {leituras.isPending ? (
          <EstadoCarregando texto="Carregando leituras…" />
        ) : leituras.isError && !leituras.data ? (
          <EstadoErro mensagem={mensagemDeErro(leituras.error)} onTentarNovamente={() => void leituras.refetch()} />
        ) : pontos.length > 1 ? (
          <VazaoChart pontos={pontos} />
        ) : (
          <EstadoVazio texto={`Sem leituras nos últimos ${JANELA_AO_VIVO_MIN} minutos.`} />
        )}
      </Cartao>

      <Cartao>
        <Titulo>Detalhes</Titulo>
        <Linha rotulo="Identificador" valor={sensor.identificador} />
        <Linha rotulo="Apartamento" valor={sensor.apartamentoNumero} />
        <Linha
          rotulo="Origem dos dados"
          testID="origem-dados"
          valor={sensor.simulado ? 'Simulado (script de simulação)' : 'Sensor real (ESP32 + YF-S201)'}
        />
        <Linha rotulo="Última sequência" valor={ultimaLeitura ? String(ultimaLeitura.sequencia) : '—'} />
        <Linha
          rotulo="Atraso medida → servidor"
          testID="atraso-entrega"
          valor={atrasoMs === null ? '—' : atrasoMs >= 1000 ? `${(atrasoMs / 1000).toFixed(1).replace('.', ',')} s` : `${Math.max(atrasoMs, 0)} ms`}
        />
        <Linha rotulo="Leituras na janela" valor={leituras.data ? String(leituras.data.length) : '—'} />
      </Cartao>
    </Tela>
  );
}
