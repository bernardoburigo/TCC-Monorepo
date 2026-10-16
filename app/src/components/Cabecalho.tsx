import { useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { useAuthStore } from '@/store/auth';

const ROTULO_PAPEL = { SINDICO: 'Síndico', PROPRIETARIO: 'Proprietário' } as const;

const LARGURA_MINIMA_DESKTOP = 640;

// Ícone de usuário (silhueta) ou "X" quando o popup está aberto.
function IconeUsuario({ fechar }: { fechar: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth={2} strokeLinecap="round">
      {fechar ? (
        <Path d="M6 6l12 12M18 6L6 18" />
      ) : (
        <>
          <Circle cx={12} cy={8} r={4} />
          <Path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
        </>
      )}
    </Svg>
  );
}

// Cabeçalho único das telas autenticadas (mesmo visual na Web e no celular):
// voltar (quando há para onde), título e o usuário com "Sair".
export function Cabecalho({ titulo, onVoltar }: { titulo: string; onVoltar?: () => void }) {
  const insets = useSafeAreaInsets();
  const usuario = useAuthStore((s) => s.usuario);
  const sair = useAuthStore((s) => s.sair);
  const { width } = useWindowDimensions();
  const [aberto, setAberto] = useState(false);
  const mobile = width < LARGURA_MINIMA_DESKTOP;

  return (
    <View style={{ paddingTop: insets.top, zIndex: 50 }} className="border-b border-slate-200 bg-white">
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

        {mobile ? (
          <Pressable
            testID="botao-usuario"
            accessibilityRole="button"
            accessibilityLabel={aberto ? 'Fechar perfil' : 'Abrir perfil'}
            onPress={() => setAberto((a) => !a)}
            className="h-9 w-9 items-center justify-center rounded-full border border-slate-300 active:bg-slate-100">
            <IconeUsuario fechar={aberto} />
          </Pressable>
        ) : (
          <>
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
          </>
        )}
      </View>

      {mobile && aberto ? (
        <>
          <Pressable
            accessibilityLabel="Fechar perfil"
            onPress={() => setAberto(false)}
            style={{ position: 'absolute', top: '100%', left: 0, right: 0, height: 2000 }}
          />
          <View
            testID="popup-usuario"
            className="absolute right-4 top-full mt-2 w-64 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
            {usuario ? (
              <View>
                <Text testID="usuario-nome" className="text-base font-semibold text-slate-900">
                  {usuario.nome}
                </Text>
                <Text className="text-sm text-slate-500">{ROTULO_PAPEL[usuario.role]}</Text>
              </View>
            ) : null}
            <Pressable
              testID="botao-sair"
              accessibilityRole="button"
              onPress={() => {
                setAberto(false);
                void sair();
              }}
              className="items-center rounded-lg border border-slate-300 px-3 py-2 active:bg-slate-100">
              <Text className="text-sm font-medium text-slate-700">Sair</Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
  );
}
