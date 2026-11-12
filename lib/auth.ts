import type { SupabaseSession } from '@/lib/supabase';

const sessionStorageKey = 'stock-auth-session';
const userStorageKey = 'stock-auth-user';

export type AuthUser = {
  id: number;
  nome: string;
  email: string;
  cargo: string;
};

export const ROLE_OPTIONS = [
  { value: 'TRABALHADOR', label: 'Trabalhador' },
  { value: 'FILIAL', label: 'Filial' },
  { value: 'GERENTE', label: 'Gerente' },
  { value: 'CONFERENTE', label: 'Conferente' },
  { value: 'CEO', label: 'CEO' },
] as const;

export function normalizeRole(cargo?: string | null) {
  return (cargo ?? '').trim().toUpperCase();
}

export function hasAnyRole(cargo: string | null | undefined, roles: string[]) {
  const normalized = normalizeRole(cargo);
  return roles.some((role) => normalized.includes(role));
}

export function getSupabaseSession(): SupabaseSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = sessionStorage.getItem(sessionStorageKey);
  if (!raw) return null;

  try {
    const session = JSON.parse(raw) as SupabaseSession;
    if (!session.accessToken || !session.refreshToken || !session.expiresAt) {
      throw new Error('Invalid Supabase session');
    }

    return session;
  } catch {
    clearCurrentUser();
    return null;
  }
}

export function saveSupabaseSession(session: SupabaseSession) {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(sessionStorageKey, JSON.stringify(session));
  }
}

export function clearLegacyAuthData() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('stock-users');
    localStorage.removeItem(userStorageKey);
  }
}

export function getCurrentUser(): AuthUser | null {
  if (typeof window === 'undefined' || !getSupabaseSession()) {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(userStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (!parsed?.email || !parsed.id || !parsed.cargo) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCurrentUser(user: AuthUser) {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(userStorageKey, JSON.stringify(user));
  }
}

export function clearCurrentUser() {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(userStorageKey);
    sessionStorage.removeItem(sessionStorageKey);
    clearLegacyAuthData();
  }
}
