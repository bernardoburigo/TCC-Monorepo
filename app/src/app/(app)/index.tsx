import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { mensagemDeErro } from '@/api/client';
import type { ApartamentoPainel } from '@/api/types';
import { CartaoApartamento } from '@/components/CartaoApartamento';
import { Cartao, EstadoCarregando, EstadoErro, EstadoVazio, Tela } from '@/components/ui';
import { useAgora } from '@/hooks/useAgora';
import { useApartamentos } from '@/hooks/queries';
import { formatarVolume, tempoDesde } from '@/lib/format';
import { useAuthStore } from '@/store/auth';

interface GrupoCondominio {
  id: string;
  nome: string;
  totalHojeMl: number;
  maiorConsumoMl: number;
  apartamentos: ApartamentoPainel[];
}

// Agrupa por condomínio e ordena cada grupo por consumo de hoje (maior primeiro).
function agrupar(apartamentos: ApartamentoPainel[]): GrupoCondominio[] {
  const grupos = new Map<string, GrupoCondominio>();
  for (const apartamento of apartamentos) {
    let grupo = grupos.get(apartamento.condominioId);
    if (!grupo) {
      grupo = { id: apartamento.condominioId, nome: apartamento.condominioNome, totalHojeMl: 0, maiorConsumoMl: 0, apartamentos: [] };
      grupos.set(apartamento.condominioId, grupo);
    }
    grupo.apartamentos.push(apartamento);
    grupo.totalHojeMl += apartamento.consumoHojeMl;
    grupo.maiorConsumoMl = Math.max(grupo.maiorConsumoMl, apartamento.consumoHojeMl);
  }
  for (const grupo of grupos.values()) {
    grupo.apartamentos.sort(
      (a, b) => b.consumoHojeMl - a.consumoHojeMl || a.numero.localeCompare(b.numero, 'pt-BR', { numeric: true }),
    );
  }
  return [...grupos.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export default function ListaDeApartamentos() {
  const router = useRouter();
  const papel = useAuthStore((s) => s.usuario?.role);
  const agora = useAgora(1000);
  const { data, isPending, isError, error, refetch, dataUpdatedAt } = useApartamentos();

  const grupos = useMemo(() => (data ? agrupar(data) : []), [data]);
  const sensoresOnline = data?.filter((a) => a.status === 'ONLINE').length ?? 0;
  const sensoresOffline = data?.filter((a) => a.status === 'OFFLINE').length ?? 0;
  const comAlerta = data?.filter((a) => a.alertaVazamento).length ?? 0;
  const totalHojeMl = data?.reduce((soma, a) => soma + a.consumoHojeMl, 0) ?? 0;

  if (isPending) {
    return (
      <Tela>
        <EstadoCarregando texto="Carregando apartamentos…" />
      </Tela>
    );
  }

  if (isError && !data) {
    return (
      <Tela>
        <EstadoErro mensagem={mensagemDeErro(error)} onTentarNovamente={() => void refetch()} />
      </Tela>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Tela>
        <EstadoVazio
          texto={
            papel === 'PROPRIETARIO'
              ? 'Nenhum apartamento vinculado à sua conta.'
              : 'Nenhum apartamento cadastrado no seu condomínio ainda.'
          }
        />
      </Tela>
    );
  }

  return (
    <Tela>
      <Cartao destaque className="gap-3">
        <Text className="text-xs uppercase tracking-wide text-sky-200">
          {papel === 'PROPRIETARIO' ? 'Meu consumo hoje' : 'Consumo total hoje'}
        </Text>
        <Text testID="total-hoje" className="text-4xl font-bold text-white">
          {formatarVolume(totalHojeMl)}
        </Text>
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <Text className="text-sm text-sky-100">
            {data.length} {data.length === 1 ? 'apartamento' : 'apartamentos'} · {sensoresOnline} online
            {sensoresOffline > 0 ? ` · ${sensoresOffline} offline` : ''}
          </Text>
          <Text testID="atualizado-em" className="text-xs text-sky-200">
            Atualizado {tempoDesde(new Date(dataUpdatedAt).toISOString(), agora)}
          </Text>
        </View>
      </Cartao>

      {comAlerta > 0 ? (
        <View testID="resumo-alertas" accessibilityRole="alert" className="rounded-xl border border-red-300 bg-red-50 p-3">
          <Text className="text-sm font-semibold text-red-800">
            ⚠ {comAlerta} {comAlerta === 1 ? 'apartamento com possível vazamento' : 'apartamentos com possível vazamento'}
          </Text>
        </View>
      ) : null}

      {isError ? (
        <View testID="aviso-falha-atualizacao" className="rounded-xl bg-amber-50 p-3">
          <Text className="text-sm text-amber-900">Não consegui atualizar agora; mostrando os últimos dados. Tentando de novo…</Text>
        </View>
      ) : null}

      {grupos.map((grupo) => (
        <View key={grupo.id} className="gap-3">
          <View className="flex-row items-baseline justify-between gap-3 px-1">
            <Text className="text-base font-bold text-slate-800">{grupo.nome}</Text>
            {papel === 'SINDICO' ? (
              <Text testID={`total-condominio-${grupo.nome}`} className="text-sm text-slate-500">
                {formatarVolume(grupo.totalHojeMl)} hoje
              </Text>
            ) : null}
          </View>

          {grupo.apartamentos.map((apartamento) => (
            <CartaoApartamento
              key={apartamento.id}
              apartamento={apartamento}
              maiorConsumoMl={grupo.maiorConsumoMl}
              agora={agora}
              onPress={() => router.push(`/apartamento/${apartamento.id}`)}
            />
          ))}
        </View>
      ))}
    </Tela>
  );
}
