import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';

import { mensagemDeErro } from '@/api/client';
import { Botao } from '@/components/ui';
import { useAuthStore } from '@/store/auth';

export default function Login() {
  const entrar = useAuthStore((s) => s.entrar);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (enviando) {
      return;
    }
    if (!email.trim() || !senha) {
      setErro('Informe e-mail e senha.');
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      // sucesso: o estado vira 'autenticado' e o roteador troca de tela sozinho
      await entrar(email.trim(), senha);
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-sky-50" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerClassName="flex-grow items-center justify-center p-6" keyboardShouldPersistTaps="handled">
        <View className="w-full max-w-sm gap-5 rounded-3xl border border-sky-100 bg-white p-6">
          <View className="gap-1">
            <Text className="text-sm font-semibold uppercase tracking-widest text-sky-700">Telemetria de água</Text>
            <Text className="text-2xl font-bold text-slate-900">Entrar</Text>
            <Text className="text-slate-500">Acompanhe o consumo do seu condomínio em tempo real.</Text>
          </View>

          <View className="gap-3">
            <View className="gap-1">
              <Text className="text-sm font-medium text-slate-700">E-mail</Text>
              <TextInput
                testID="campo-email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="voce@exemplo.com"
                placeholderTextColor="#94a3b8"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900"
              />
            </View>

            <View className="gap-1">
              <Text className="text-sm font-medium text-slate-700">Senha</Text>
              <TextInput
                testID="campo-senha"
                value={senha}
                onChangeText={setSenha}
                secureTextEntry
                autoComplete="current-password"
                placeholder="••••••••"
                placeholderTextColor="#94a3b8"
                onSubmitEditing={enviar}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900"
              />
            </View>
          </View>

          {erro ? (
            <View testID="erro-login" accessibilityRole="alert" className="rounded-xl bg-red-50 p-3">
              <Text className="text-sm text-red-800">{erro}</Text>
            </View>
          ) : null}

          <Botao testID="botao-entrar" titulo="Entrar" onPress={enviar} carregando={enviando} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
