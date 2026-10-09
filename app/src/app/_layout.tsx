import '../global.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { EstadoCarregando } from '@/components/ui';
import { useAuthStore } from '@/store/auth';

export default function RootLayout() {
  const estado = useAuthStore((s) => s.estado);
  const restaurarSessao = useAuthStore((s) => s.restaurarSessao);

  // Um QueryClient por instância do app. Sem retry agressivo: o polling já refaz a chamada.
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } } }),
  );

  useEffect(() => {
    void restaurarSessao();
  }, [restaurarSessao]);

  // Ao sair (ou 401), descarta o cache: dados de um usuário não podem aparecer para o próximo.
  useEffect(() => {
    if (estado === 'anonimo') {
      queryClient.clear();
    }
  }, [estado, queryClient]);

  // Enquanto valida o token guardado, não mostra o login (evita piscar a tela errada).
  if (estado === 'carregando') {
    return <EstadoCarregando texto="Entrando…" />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      {/* Stack.Protected: rota inacessível some e o roteador redireciona sozinho quando a sessão muda */}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={estado === 'autenticado'}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={estado === 'anonimo'}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
    </QueryClientProvider>
  );
}
