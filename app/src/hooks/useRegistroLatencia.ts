import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import type { LeituraBruta } from '@/api/types';
import { REGISTRAR_LATENCIA } from '@/lib/config';
import { novoRegistro, paraCsv, registrarExibicao } from '@/lib/latencia';

// Um buffer por execução do app (sobrevive à navegação entre telas, some ao recarregar).
const registro = novoRegistro();

// Registra o t_exib das leituras novas do sensor exibido (ver src/lib/latencia.ts). Desligado
// por padrão: só faz algo com EXPO_PUBLIC_REGISTRAR_LATENCIA=true.
export function useRegistroLatencia(sensorId: string, leituras: LeituraBruta[] | undefined) {
  const [total, setTotal] = useState(registro.linhas.length);

  useEffect(() => {
    if (!REGISTRAR_LATENCIA || !leituras) {
      return;
    }
    // efeito roda depois do commit da renderização que já mostra estas leituras
    registrarExibicao(registro, sensorId, leituras, new Date());
    setTotal(registro.linhas.length);
  }, [sensorId, leituras]);

  return {
    ativo: REGISTRAR_LATENCIA,
    total,
    podeExportar: REGISTRAR_LATENCIA && Platform.OS === 'web',
    exportar: () => baixarCsv(paraCsv(registro.linhas)),
  };
}

function baixarCsv(conteudo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `latencia-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
