import {
  clearCurrentUser,
  getSupabaseSession,
  saveSupabaseSession,
} from '@/lib/auth';
import { refreshSupabaseSession } from '@/lib/supabase';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://controle-de-estoque-jmyx.onrender.com';
let refreshInProgress: Promise<ReturnType<typeof getSupabaseSession>> | null = null;

async function refreshSession() {
  const session = getSupabaseSession();
  if (!session) {
    throw new Error('Sua sessão expirou. Entre novamente.');
  }

  if (!refreshInProgress) {
    refreshInProgress = refreshSupabaseSession(session.refreshToken)
      .then((refreshedSession) => {
        saveSupabaseSession(refreshedSession);
        return refreshedSession;
      })
      .catch((error: unknown) => {
        clearCurrentUser();
        throw error;
      })
      .finally(() => {
        refreshInProgress = null;
      });
  }

  const refreshedSession = await refreshInProgress;
  if (!refreshedSession) {
    throw new Error('Sua sessão expirou. Entre novamente.');
  }
  return refreshedSession;
}

async function sendRequest(path: string, init: RequestInit, accessToken?: string) {
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    cache: 'no-store',
  });
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const requestInit = init ?? {};
  let session = getSupabaseSession();
  if (session && session.expiresAt <= Math.floor(Date.now() / 1000) + 30) {
    session = await refreshSession();
  }

  let response = await sendRequest(path, requestInit, session?.accessToken);
  if (response.status === 401 && session) {
    session = await refreshSession();
    response = await sendRequest(path, requestInit, session?.accessToken);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Erro ao consultar a API');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
