import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Persistência do token de sessão: Keychain/Keystore (expo-secure-store) no celular e
// localStorage na Web (o SecureStore não existe no navegador). Toda operação é tolerante
// a falha: localStorage pode lançar exceção (modo privado, dados bloqueados) e o app
// precisa continuar funcionando, só sem lembrar a sessão.
const CHAVE_TOKEN = 'tcc.token';

export async function lerToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return window.localStorage.getItem(CHAVE_TOKEN);
    }
    return await SecureStore.getItemAsync(CHAVE_TOKEN);
  } catch {
    return null;
  }
}

export async function salvarToken(token: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      window.localStorage.setItem(CHAVE_TOKEN, token);
    } else {
      await SecureStore.setItemAsync(CHAVE_TOKEN, token);
    }
  } catch {
    // sem persistência: a sessão vale só até fechar o app
  }
}

export async function apagarToken(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      window.localStorage.removeItem(CHAVE_TOKEN);
    } else {
      await SecureStore.deleteItemAsync(CHAVE_TOKEN);
    }
  } catch {
    // nada a fazer
  }
}
