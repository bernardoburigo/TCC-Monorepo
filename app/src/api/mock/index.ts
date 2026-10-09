// Liga/desliga o modo mock (ver README "Visualizar sem backend (dados mock)").
// Para remover o recurso: apague esta pasta `src/api/mock/` e reverta o uso de
// MOCK_ATIVO/mockAdapter em `../client.ts` — é o único arquivo fora daqui que a importa.
export { mockAdapter } from './adapter';

export const MOCK_ATIVO = process.env.EXPO_PUBLIC_USE_MOCK_DATA === 'true';
