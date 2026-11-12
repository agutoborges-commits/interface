"use client";

import { useState, type FormEvent } from 'react';
import { apiFetch } from '@/lib/api';
import { clearCurrentUser, saveCurrentUser } from '@/lib/auth';
import { saveSupabaseSession, signInWithPassword } from '@/lib/supabase';
import type { AuthUser } from '@/lib/auth';

const emptyLogin = {
  email: '',
  senha: '',
};

export default function LoginPage() {
  const [loginForm, setLoginForm] = useState(emptyLogin);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function handleLoginChange(field: keyof typeof emptyLogin, value: string) {
    setLoginForm((current) => ({ ...current, [field]: value }));
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const session = await signInWithPassword(
        loginForm.email.trim(),
        loginForm.senha,
      );
      saveSupabaseSession(session);
      const user = await apiFetch<AuthUser>('/api/usuarios/me');
      saveCurrentUser(user);
      window.location.assign('/');
    } catch (error) {
      clearCurrentUser();
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível entrar.',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-shell">
      <div className="page-header">
        <h1>Acesso ao sistema</h1>
      </div>

      {message && <div className={`message ${message.type}`}>{message.text}</div>}

      <div className="form-grid" style={{ marginBottom: '24px' }}>
        <div className="card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Contas</p>
              <h2>Acesso por convite</h2>
            </div>
          </div>
          <p>As contas são provisionadas por um gerente ou CEO. Você receberá um convite por e-mail para definir sua senha.</p>
        </div>

        <div className="card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Acesso</p>
              <h2>Entrar</h2>
            </div>
          </div>

          <form onSubmit={handleLogin} className="form-grid">
            <label className="form-field full-width">
              <span>Email</span>
              <input type="email" value={loginForm.email} onChange={(event) => handleLoginChange('email', event.target.value)} placeholder="nome@empresa.com" required />
            </label>

            <label className="form-field full-width">
              <span>Senha</span>
              <input type="password" value={loginForm.senha} onChange={(event) => handleLoginChange('senha', event.target.value)} placeholder="Sua senha" required />
            </label>

            <div className="form-actions full-width">
              <button type="submit" className="primary-button" disabled={loading}>
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
