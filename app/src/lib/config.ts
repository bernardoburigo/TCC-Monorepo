// URL base da API (ver .env.example). EXPO_PUBLIC_* é embutido no bundle em tempo de build.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080').replace(/\/+$/, '');

// Intervalos de polling (CLAUDE.md, seção 3: MVP de tempo real = polling de 5–10 s).
export const POLLING_AO_VIVO_MS = 5_000; // detalhe do sensor: o firmware envia a cada 5 s
export const POLLING_LISTAS_MS = 10_000; // lista de apartamentos e gráficos de consumo

// true = a tela do sensor registra o instante de exibição de cada leitura nova e oferece
// exportar o CSV de latência (Web), para a Sprint 6. Ver src/lib/latencia.ts.
export const REGISTRAR_LATENCIA = process.env.EXPO_PUBLIC_REGISTRAR_LATENCIA === 'true';
