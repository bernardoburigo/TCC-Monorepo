import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '@/store/auth';

const ROTULO_PAPEL = { SINDICO: 'Síndico', PROPRIETARIO: 'Proprietário' } as const;

// Cabeçalho único das telas autenticadas (mesmo visual na Web e no celular):
// voltar (quando há para onde), título e o usuário com "Sair".
export function Cabecalho({ titulo, onVoltar }: { titulo: string; onVoltar?: () => void }) {
  const insets = useSafeAreaInsets();
  const usuario = useAuthStore((s) => s.usuario);
  const sair = useAuthStore((s) => s.sair);

  return (
    <View style={{ paddingTop: insets.top }} className="border-b border-slate-200 bg-white">
      <View className="w-full max-w-3xl flex-row items-center gap-3 self-center px-4 py-3">
        {onVoltar ? (
          <Pressable
            testID="botao-voltar"
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            onPress={onVoltar}
            className="h-9 w-9 items-center justify-center rounded-full active:bg-slate-100">
            <Text className="text-2xl text-slate-700">‹</Text>
          </Pressable>
        ) : null}

        <Text testID="titulo-tela" className="flex-1 text-xl font-bold text-slate-900" numberOfLines={1}>
          {titulo}
        </Text>

        {usuario ? (
          <View className="items-end">
            <Text testID="usuario-nome" className="text-sm font-medium text-slate-800" numberOfLines={1}>
              {usuario.nome}
            </Text>
            <Text className="text-xs text-slate-500">{ROTULO_PAPEL[usuario.role]}</Text>
          </View>
        ) : null}

        <Pressable
          testID="botao-sair"
          accessibilityRole="button"
          onPress={() => void sair()}
          className="rounded-lg border border-slate-300 px-3 py-1.5 active:bg-slate-100">
          <Text className="text-sm font-medium text-slate-700">Sair</Text>
        </Pressable>
      </View>
    </View>
  );
}
