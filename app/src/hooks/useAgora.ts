import { useEffect, useState } from 'react';

// Relógio de tela: re-renderiza a cada `intervaloMs` para textos como "há 5 s" andarem
// sozinhos entre um polling e outro.
export function useAgora(intervaloMs = 1000): Date {
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs]);

  return agora;
}
