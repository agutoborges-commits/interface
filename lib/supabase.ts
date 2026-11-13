export type SupabaseSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

type SupabaseAuthResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '');
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }

  return { url, anonKey };
}

async function requestSession(
  grant: 'password' | 'refresh_token',
  body: Record<string, string>,
): Promise<SupabaseSession> {
  const { url, anonKey } = getSupabaseConfig();
  const response = await fetch(`${url}/auth/v1/token?grant_type=${grant}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null) as SupabaseAuthResponse & {
    msg?: string;
    message?: string;
    error_description?: string;
  } | null;

  if (!response.ok || !payload?.access_token || !payload.refresh_token) {
    throw new Error(
      payload?.msg
      || payload?.message
      || payload?.error_description
      || `Falha na autenticação Supabase (HTTP ${response.status}).`,
    );
  }

  if (!Number.isFinite(payload.expires_in) || payload.expires_in <= 0) {
    throw new Error('O Supabase retornou uma duração de sessão inválida.');
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Math.floor(Date.now() / 1000) + payload.expires_in,
  };
}

export function signInWithPassword(email: string, password: string) {
  return requestSession('password', { email, password });
}

export function refreshSupabaseSession(refreshToken: string) {
  return requestSession('refresh_token', { refresh_token: refreshToken });
}

export function saveSupabaseSession(session: SupabaseSession) {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('stock-auth-session', JSON.stringify(session));
  }
}

export async function signOutSupabase(session?: SupabaseSession) {
  if (!session) {
    return;
  }

  try {
    const { url, anonKey } = getSupabaseConfig();
    const response = await fetch(`${url}/auth/v1/logout`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${session.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Não foi possível encerrar a sessão Supabase (HTTP ${response.status}).`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_PUBLIC_SUPABASE_URL')) {
      return;
    }

    throw error;
  }
}
