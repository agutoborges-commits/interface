import type { SupabaseSession } from '@/lib/supabase';

const sessionStorageKey = 'stock-auth-session';
const userStorageKey = 'stock-auth-user';
const registeredUsersStorageKey = 'stock-registered-users';
const activeAccountsStorageKey = 'stock-active-accounts';

export type AuthUser = {
  id: number;
  nome: string;
  email: string;
  cargo: string;
};

export type RegisteredUser = AuthUser & {
  senha: string;
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

export function getLoggedInAccounts(): AuthUser[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = localStorage.getItem(activeAccountsStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AuthUser[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((user) => !!user?.email)
      .map((user) => ({
        ...user,
        cargo: normalizeRole(user.cargo || 'TRABALHADOR'),
      }));
  } catch {
    return [];
  }
}

export function saveLoggedInAccounts(users: AuthUser[]) {
  if (typeof window !== 'undefined') {
    const normalized = users.map((user) => ({
      ...user,
      cargo: normalizeRole(user.cargo || 'TRABALHADOR'),
    }));
    localStorage.setItem(activeAccountsStorageKey, JSON.stringify(normalized));
  }
}

export function addLoggedInAccount(user: AuthUser) {
  const current = getLoggedInAccounts();
  const normalizedUser = {
    ...user,
    cargo: normalizeRole(user.cargo || 'TRABALHADOR'),
  };

  const next = current.filter((account) => account.email.toLowerCase() !== normalizedUser.email.toLowerCase());
  saveLoggedInAccounts([...next, normalizedUser]);
}

export function removeLoggedInAccount(email?: string) {
  if (!email || typeof window === 'undefined') {
    return;
  }

  const current = getLoggedInAccounts();
  const next = current.filter((user) => user.email.toLowerCase() !== email.toLowerCase());
  saveLoggedInAccounts(next);

  const activeUser = getCurrentUser();
  if (activeUser && activeUser.email.toLowerCase() === email.toLowerCase()) {
    clearCurrentUser();
  }
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

export function getRegisteredUsers(): RegisteredUser[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = localStorage.getItem(registeredUsersStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RegisteredUser[];
    if (!Array.isArray(parsed)) return [];

    return parsed.map((user) => ({
      ...user,
      cargo: normalizeRole(user.cargo || 'TRABALHADOR'),
    }));
  } catch {
    return [];
  }
}

export function saveRegisteredUsers(users: RegisteredUser[]) {
  if (typeof window !== 'undefined') {
    const normalized = users.map((user) => ({
      ...user,
      cargo: normalizeRole(user.cargo || 'TRABALHADOR'),
    }));
    localStorage.setItem(registeredUsersStorageKey, JSON.stringify(normalized));
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
    const normalizedUser = {
      ...user,
      cargo: normalizeRole(user.cargo || 'TRABALHADOR'),
    };

    sessionStorage.setItem(userStorageKey, JSON.stringify(normalizedUser));
    addLoggedInAccount(normalizedUser);
  }
}

export function clearCurrentUser() {
  if (typeof window !== 'undefined') {
    const current = getCurrentUser();
    sessionStorage.removeItem(userStorageKey);
    sessionStorage.removeItem(sessionStorageKey);

    if (current?.email) {
      const remaining = getLoggedInAccounts().filter(
        (user) => user.email.toLowerCase() !== current.email.toLowerCase(),
      );
      saveLoggedInAccounts(remaining);
    }

    clearLegacyAuthData();
  }
}
