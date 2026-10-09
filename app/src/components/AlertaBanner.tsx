import { Text, View } from 'react-native';

import type { Alerta } from '@/api/types';
import { formatarDuracao, formatarVolume } from '@/lib/format';

// Faixa de alerta de vazamento provável (fluxo ininterrupto além do limite). Aparece no
// topo das telas; só existe enquanto o backend calcular o alerta como ATIVO.
export function AlertaBanner({ alerta, mostrarSensor = true }: { alerta: Alerta; mostrarSensor?: boolean }) {
  return (
    <View
      testID="alerta-vazamento"
      accessibilityRole="alert"
      className="gap-1 rounded-2xl border border-red-300 bg-red-50 p-4">
      <Text className="text-base font-bold text-red-800">⚠ Possível vazamento</Text>
      <Text className="text-sm text-red-900">
        {mostrarSensor ? `${alerta.sensorIdentificador}: ` : ''}
        água escoando sem parar há {formatarDuracao(alerta.duracaoSegundos)} (
        {formatarVolume(alerta.volumeMl)} no período). Uso normal tem pausas; verifique torneiras, boia da caixa e descarga.
      </Text>
      {alerta.simulado ? <Text className="text-xs font-semibold text-red-700">Dado SIMULADO</Text> : null}
    </View>
  );
}
