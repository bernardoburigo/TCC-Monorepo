import { Pressable, Text, View } from 'react-native';

import { PERIODOS, type PeriodoId } from '@/lib/periodos';

// Controle segmentado 24 horas | 7 dias | 30 dias.
export function SeletorPeriodo({ valor, onChange }: { valor: PeriodoId; onChange: (id: PeriodoId) => void }) {
  return (
    <View accessibilityRole="tablist" className="flex-row rounded-xl bg-slate-100 p-1">
      {PERIODOS.map((periodo) => {
        const ativo = periodo.id === valor;
        return (
          <Pressable
            key={periodo.id}
            testID={`periodo-${periodo.id}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: ativo }}
            onPress={() => onChange(periodo.id)}
            className={`rounded-lg px-3 py-1.5 ${ativo ? 'bg-white' : ''}`}>
            <Text className={`text-sm ${ativo ? 'font-bold text-sky-800' : 'font-medium text-slate-500'}`}>
              {periodo.rotulo}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
