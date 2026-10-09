import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import type { StatusSensor } from '@/api/types';

// Blocos visuais reutilizados pelas telas. Estilo via NativeWind (Tailwind).

// Container de tela: centraliza numa coluna de largura limitada (legível no desktop/Web,
// ocupa tudo no celular) e rola quando o conteúdo passa da altura.
export function Tela({ children }: { children: ReactNode }) {
  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerClassName="pb-10">
      <View className="w-full max-w-3xl gap-4 self-center p-4">{children}</View>
    </ScrollView>
  );
}

// `destaque` troca o fundo por completo. Não dá para sobrescrever `bg-white` só concatenando
// outra classe de fundo: as duas entram no CSS e a que vence é a definida por último na
// folha do Tailwind, não a última da string (o texto claro do resumo ficava invisível).
export function Cartao({
  children,
  className = '',
  destaque = false,
}: {
  children: ReactNode;
  className?: string;
  destaque?: boolean;
}) {
  const cores = destaque ? 'border-sky-800 bg-sky-800' : 'border-slate-200 bg-white';
  return <View className={`rounded-2xl border p-4 ${cores} ${className}`}>{children}</View>;
}

export function Titulo({ children }: { children: ReactNode }) {
  return <Text className="text-lg font-bold text-slate-900">{children}</Text>;
}

export function Botao({
  titulo,
  onPress,
  desabilitado = false,
  carregando = false,
  variante = 'primario',
  testID,
}: {
  titulo: string;
  onPress: () => void;
  desabilitado?: boolean;
  carregando?: boolean;
  variante?: 'primario' | 'secundario';
  testID?: string;
}) {
  const inativo = desabilitado || carregando;
  const fundo =
    variante === 'primario' ? (inativo ? 'bg-sky-300' : 'bg-sky-700 active:bg-sky-800') : 'bg-white border border-slate-300';
  const texto = variante === 'primario' ? 'text-white' : 'text-slate-700';

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      disabled={inativo}
      className={`min-h-11 flex-row items-center justify-center gap-2 rounded-xl px-4 py-2.5 ${fundo}`}>
      {carregando ? <ActivityIndicator color={variante === 'primario' ? '#fff' : '#334155'} /> : null}
      <Text className={`text-base font-semibold ${texto}`}>{titulo}</Text>
    </Pressable>
  );
}

const ESTILO_STATUS: Record<StatusSensor, { ponto: string; texto: string; rotulo: string }> = {
  ONLINE: { ponto: 'bg-emerald-500', texto: 'text-emerald-700', rotulo: 'Online' },
  OFFLINE: { ponto: 'bg-red-500', texto: 'text-red-700', rotulo: 'Offline' },
  SEM_DADOS: { ponto: 'bg-slate-400', texto: 'text-slate-500', rotulo: 'Sem dados' },
};

export function StatusSelo({ status }: { status: StatusSensor }) {
  const estilo = ESTILO_STATUS[status];
  return (
    <View testID={`status-${status}`} className="flex-row items-center gap-1.5">
      <View className={`h-2.5 w-2.5 rounded-full ${estilo.ponto}`} />
      <Text className={`text-sm font-medium ${estilo.texto}`}>{estilo.rotulo}</Text>
    </View>
  );
}

// Dado simulado nunca pode passar por real (CLAUDE.md, seção 6): o selo é sempre visível.
export function SeloSimulado() {
  return (
    <View testID="selo-simulado" className="rounded-md bg-amber-100 px-2 py-0.5">
      <Text className="text-xs font-bold tracking-wide text-amber-800">SIMULADO</Text>
    </View>
  );
}

export function SeloReal() {
  return (
    <View testID="selo-real" className="rounded-md bg-emerald-100 px-2 py-0.5">
      <Text className="text-xs font-bold tracking-wide text-emerald-800">REAL</Text>
    </View>
  );
}

export function EstadoCarregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <View testID="carregando" className="items-center gap-3 py-12">
      <ActivityIndicator size="large" color="#0369a1" />
      <Text className="text-slate-500">{texto}</Text>
    </View>
  );
}

export function EstadoErro({ mensagem, onTentarNovamente }: { mensagem: string; onTentarNovamente?: () => void }) {
  return (
    <View testID="estado-erro" className="items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-6">
      <Text className="text-center text-red-800">{mensagem}</Text>
      {onTentarNovamente ? <Botao titulo="Tentar novamente" variante="secundario" onPress={onTentarNovamente} /> : null}
    </View>
  );
}

export function EstadoVazio({ texto }: { texto: string }) {
  return (
    <View testID="estado-vazio" className="items-center rounded-2xl border border-dashed border-slate-300 p-8">
      <Text className="text-center text-slate-500">{texto}</Text>
    </View>
  );
}
