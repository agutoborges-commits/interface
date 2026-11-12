"use client";

import { useState, type FormEvent } from 'react';
import { clearCurrentUser, saveCurrentUser, ROLE_OPTIONS } from '@/lib/auth';
import { saveSupabaseSession } from '@/lib/supabase';
import type { AuthUser } from '@/lib/auth';

const emptyLogin = {
  email: '',
  senha: '',
};

const emptyRegister = {
  nome: '',
  email: '',
  senha: '',
  confirmarSenha: '',
  cargo: 'TRABALHADOR',
};

export default function LoginPage() {
  const [showRegister, setShowRegister] = useState(false);
  const [loginForm, setLoginForm] = useState(emptyLogin);
  const [registerForm, setRegisterForm] = useState(emptyRegister);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function persistLocalSession(user: AuthUser) {
    saveSupabaseSession({
      accessToken: `local-${Date.now()}`,
      refreshToken: `local-${Date.now() + 1}`,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });
    saveCurrentUser(user);
    window.location.assign('/');
  }

  function handleLoginChange(field: keyof typeof emptyLogin, value: string) {
    setLoginForm((current) => ({ ...current, [field]: value }));
  }

  function handleRegisterChange(field: keyof typeof emptyRegister, value: string) {
    setRegisterForm((current) => ({ ...current, [field]: value }));
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const email = loginForm.email.trim();
      const senha = loginForm.senha;

      if (!email || !senha) {
        throw new Error('Informe o e-mail e a senha para entrar.');
      }

      const usuario: AuthUser = {
        id: Date.now(),
        nome: email.split('@')[0] || 'Usuário',
        email,
        cargo: 'TRABALHADOR',
      };

      persistLocalSession(usuario);
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

  async function handleRegister(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const nome = registerForm.nome.trim();
      const email = registerForm.email.trim();
      const senha = registerForm.senha;
      const confirmarSenha = registerForm.confirmarSenha;

      if (!nome || !email || !senha || !confirmarSenha) {
        throw new Error('Preencha todos os campos para criar a conta.');
      }

      if (senha.length < 6) {
        throw new Error('A senha precisa ter pelo menos 6 caracteres.');
      }

      if (senha !== confirmarSenha) {
        throw new Error('As senhas não conferem.');
      }

      const usuario: AuthUser = {
        id: Date.now(),
        nome,
        email,
        cargo: registerForm.cargo,
      };

      persistLocalSession(usuario);
    } catch (error) {
      clearCurrentUser();
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível cadastrar a conta.',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-shell" style={{ maxWidth: 1200, margin: '0 auto', paddingTop: 18 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: '4rem', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.06em', color: '#121212' }}>
          Acesso ao sistema
        </h1>
      </div>

      {message && <div className={`message ${message.type}`} style={{ marginBottom: 16 }}>{message.text}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div className="card" style={{ minHeight: 420, borderRadius: 18, boxShadow: 'none', padding: '26px 28px', background: '#f3f3f3', border: '1px solid #e7e7e7' }}>
          <div className="panel-header" style={{ display: 'block', marginBottom: 18 }}>
            <div>
              <p className="eyebrow" style={{ margin: 0, color: '#1e88e5', fontSize: 12, letterSpacing: '0.18em', fontWeight: 700 }}>
                CONTAS
              </p>
              <h2 style={{ margin: '18px 0 0', fontSize: '2.1rem', fontWeight: 800, color: '#171717' }}>
                Acesso por convite
              </h2>
            </div>
          </div>

          <p style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.6, color: '#1d1d1f' }}>
            As contas são provisionadas por um gerente ou CEO. Você receberá um convite por e-mail para definir sua senha.
          </p>
        </div>

        <div className="card" style={{ minHeight: 420, borderRadius: 18, boxShadow: 'none', padding: '26px 28px', background: '#f3f3f3', border: '1px solid #e7e7e7' }}>
          <div className="panel-header" style={{ display: 'block', marginBottom: 18 }}>
            <div>
              <p className="eyebrow" style={{ margin: 0, color: '#1e88e5', fontSize: 12, letterSpacing: '0.18em', fontWeight: 700 }}>
                ACESSO
              </p>
              <h2 style={{ margin: '18px 0 0', fontSize: '2.1rem', fontWeight: 800, color: '#171717' }}>
                {showRegister ? 'Cadastrar' : 'Entrar'}
              </h2>
            </div>
          </div>

          {showRegister ? (
            <form onSubmit={handleRegister} className="form-grid" style={{ display: 'grid', gap: 18 }}>
              <label className="form-field full-width" style={{ display: 'grid', gap: 8 }}>
                <span style={{ fontSize: '1rem', fontWeight: 600 }}>Nome</span>
                <input type="text" value={registerForm.nome} onChange={(event) => handleRegisterChange('nome', event.target.value)} placeholder="Seu nome" required style={{ width: '100%', borderRadius: 12, border: '1px solid #dfe3ea', background: '#f0f1f4', padding: '14px 16px', fontSize: '1rem', color: '#222' }} />
              </label>

              <label className="form-field full-width" style={{ display: 'grid', gap: 8 }}>
                <span style={{ fontSize: '1rem', fontWeight: 600 }}>Email</span>
                <input type="email" value={registerForm.email} onChange={(event) => handleRegisterChange('email', event.target.value)} placeholder="nome@empresa.com" required style={{ width: '100%', borderRadius: 12, border: '1px solid #dfe3ea', background: '#f0f1f4', padding: '14px 16px', fontSize: '1rem', color: '#222' }} />
              </label>

              <label className="form-field full-width" style={{ display: 'grid', gap: 8 }}>
                <span style={{ fontSize: '1rem', fontWeight: 600 }}>Cargo</span>
                <select
                  value={registerForm.cargo}
                  onChange={(event) => handleRegisterChange('cargo', event.target.value)}
                  style={{ width: '100%', borderRadius: 12, border: '1px solid #dfe3ea', background: '#f0f1f4', padding: '14px 16px', fontSize: '1rem', color: '#222' }}
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </label>

              <label className="form-field full-width" style={{ display: 'grid', gap: 8 }}>
                <span style={{ fontSize: '1rem', fontWeight: 600 }}>Senha</span>
                <input type="password" value={registerForm.senha} onChange={(event) => handleRegisterChange('senha', event.target.value)} placeholder="Crie uma senha" required style={{ width: '100%', borderRadius: 12, border: '1px solid #dfe3ea', background: '#f0f1f4', padding: '14px 16px', fontSize: '1rem', color: '#222' }} />
              </label>

              <label className="form-field full-width" style={{ display: 'grid', gap: 8 }}>
                <span style={{ fontSize: '1rem', fontWeight: 600 }}>Confirmar senha</span>
                <input type="password" value={registerForm.confirmarSenha} onChange={(event) => handleRegisterChange('confirmarSenha', event.target.value)} placeholder="Repita a senha" required style={{ width: '100%', borderRadius: 12, border: '1px solid #dfe3ea', background: '#f0f1f4', padding: '14px 16px', fontSize: '1rem', color: '#222' }} />
              </label>

              <div className="form-actions full-width" style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
                <button type="submit" className="primary-button" disabled={loading} style={{ width: 160, height: 52, borderRadius: 999, fontSize: '1.05rem', fontWeight: 700, background: '#1e88e5' }}>
                  {loading ? 'Cadastrando...' : 'Cadastrar'}
                </button>
              </div>

              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <button type="button" onClick={() => setShowRegister(false)} className="secondary-button" style={{ background: 'transparent', color: '#1e88e5', border: 'none', padding: 0, fontWeight: 700 }}>
                  Já tem conta? Entrar
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="form-grid" style={{ display: 'grid', gap: 18 }}>
              <label className="form-field full-width" style={{ display: 'grid', gap: 8 }}>
                <span style={{ fontSize: '1rem', fontWeight: 600 }}>Email</span>
                <input type="email" value={loginForm.email} onChange={(event) => handleLoginChange('email', event.target.value)} placeholder="nome@empresa.com" required style={{ width: '100%', borderRadius: 12, border: '1px solid #dfe3ea', background: '#f0f1f4', padding: '14px 16px', fontSize: '1rem', color: '#222' }} />
              </label>

              <label className="form-field full-width" style={{ display: 'grid', gap: 8 }}>
                <span style={{ fontSize: '1rem', fontWeight: 600 }}>Senha</span>
                <input type="password" value={loginForm.senha} onChange={(event) => handleLoginChange('senha', event.target.value)} placeholder="Sua senha" required style={{ width: '100%', borderRadius: 12, border: '1px solid #dfe3ea', background: '#f0f1f4', padding: '14px 16px', fontSize: '1rem', color: '#222' }} />
              </label>

              <div className="form-actions full-width" style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
                <button type="submit" className="primary-button" disabled={loading} style={{ width: 160, height: 52, borderRadius: 999, fontSize: '1.05rem', fontWeight: 700, background: '#1e88e5' }}>
                  {loading ? 'Entrando...' : 'Entrar'}
                </button>
              </div>

              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <button type="button" onClick={() => setShowRegister(true)} className="secondary-button" style={{ background: 'transparent', color: '#1e88e5', border: 'none', padding: 0, fontWeight: 700 }}>
                  Ainda não tem conta? Cadastrar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
