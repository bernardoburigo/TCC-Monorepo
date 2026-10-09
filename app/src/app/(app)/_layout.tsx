import { Stack } from 'expo-router';

import { Cabecalho } from '@/components/Cabecalho';

// Telas autenticadas. O cabeçalho é próprio (Cabecalho) para ficar igual na Web e no
// celular; o "voltar" só aparece quando há para onde voltar.
export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        header: ({ options, back, navigation }) => (
          <Cabecalho titulo={options.title ?? 'Consumo de água'} onVoltar={back ? navigation.goBack : undefined} />
        ),
      }}>
      <Stack.Screen name="index" options={{ title: 'Apartamentos' }} />
      <Stack.Screen name="apartamento/[id]" options={{ title: 'Apartamento' }} />
      <Stack.Screen name="sensor/[id]" options={{ title: 'Sensor' }} />
    </Stack>
  );
}
