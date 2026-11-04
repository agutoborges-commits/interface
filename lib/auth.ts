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

export function getCurrentUser(): AuthUser | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = localStorage.getItem('stock-auth-user');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (!parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCurrentUser(user: AuthUser) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('stock-auth-user', JSON.stringify(user));
  }
}

export function clearCurrentUser() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('stock-auth-user');
  }
}
