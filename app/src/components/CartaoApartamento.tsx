import { Pressable, Text, View } from 'react-native';

import type { ApartamentoPainel } from '@/api/types';
import { SeloSimulado, StatusSelo } from '@/components/ui';
import { formatarVolume, tempoDesde } from '@/lib/format';

// Uma linha da lista. A barra mostra o consumo de hoje relativo ao maior do condomínio
// (ranking visual: quem mais consome aparece primeiro e com a barra mais cheia).
export function CartaoApartamento({
  apartamento,
  maiorConsumoMl,
  agora,
  onPress,
}: {
  apartamento: ApartamentoPainel;
  maiorConsumoMl: number;
  agora: Date;
  onPress: () => void;
}) {
  const proporcao = maiorConsumoMl > 0 ? Math.min(apartamento.consumoHojeMl / maiorConsumoMl, 1) : 0;

  return (
    <Pressable
      testID={`cartao-apartamento-${apartamento.numero}`}
      accessibilityRole="button"
      onPress={onPress}
      className={`gap-3 rounded-2xl border p-4 active:bg-slate-50 ${apartamento.alertaVazamento ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}>
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-row items-center gap-2">
          <Text className="text-lg font-bold text-slate-900">Apto {apartamento.numero}</Text>
          {apartamento.simulado ? <SeloSimulado /> : null}
          {apartamento.alertaVazamento ? (
            <View testID={`alerta-cartao-${apartamento.numero}`} className="rounded-md bg-red-100 px-2 py-0.5">
              <Text className="text-xs font-bold text-red-800">⚠ POSSÍVEL VAZAMENTO</Text>
            </View>
          ) : null}
        </View>
        <StatusSelo status={apartamento.status} />
      </View>

      <View className="flex-row items-end justify-between gap-3">
        <View>
          <Text className="text-xs uppercase tracking-wide text-slate-500">Consumo hoje</Text>
          <Text testID={`consumo-hoje-${apartamento.numero}`} className="text-2xl font-bold text-sky-800">
            {formatarVolume(apartamento.consumoHojeMl)}
          </Text>
        </View>
        <Text className="text-right text-xs text-slate-500">
          {apartamento.qtdSensores === 0
            ? 'Sem sensor instalado'
            : `Última leitura ${tempoDesde(apartamento.ultimaLeituraEm, agora)}`}
        </Text>
      </View>

      <View className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <View className="h-full rounded-full bg-sky-500" style={{ width: `${Math.round(proporcao * 100)}%` }} />
      </View>
    </Pressable>
  );
}
