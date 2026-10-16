import { Stack, useRouter } from 'expo-router';

import { Cabecalho } from '@/components/Cabecalho';
import { useStatusDoSensor } from '@/hooks/queries';

// Telas autenticadas. O cabeçalho é próprio (Cabecalho) para ficar igual na Web e no
// celular. O "voltar" aparece em toda tela que não seja a inicial: após recarregar a página
// (F5) a pilha perde o histórico e `back` fica indefinido, então sem histórico o botão leva à
// pai da tela: o apartamento do sensor (vem da API) ou a lista de apartamentos.
function CabecalhoDaPilha({
  titulo,
  rota,
  sensorId,
  back,
  voltar,
}: {
  titulo: string;
  rota: string;
  sensorId?: string;
  back: boolean;
  voltar: () => void;
}) {
  const router = useRouter();
  const sensor = useStatusDoSensor(rota === 'sensor/[id]' ? sensorId : undefined);
  const apartamentoId = sensor.data?.apartamentoId;

  let onVoltar: (() => void) | undefined;
  if (back) {
    onVoltar = voltar;
  } else if (rota !== 'index') {
    onVoltar = () => router.replace(apartamentoId ? `/apartamento/${apartamentoId}` : '/');
  }
  return <Cabecalho titulo={titulo} onVoltar={onVoltar} />;
}

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        header: ({ options, route, back, navigation }) => (
          <CabecalhoDaPilha
            titulo={options.title ?? 'Consumo de água'}
            rota={route.name}
            sensorId={(route.params as { id?: string } | undefined)?.id}
            back={!!back}
            voltar={navigation.goBack}
          />
        ),
      }}>
      <Stack.Screen name="index" options={{ title: 'Apartamentos' }} />
      <Stack.Screen name="apartamento/[id]" options={{ title: 'Apartamento' }} />
      <Stack.Screen name="sensor/[id]" options={{ title: 'Sensor' }} />
    </Stack>
  );
}
