"use client";

import { useState, type FormEvent } from 'react';
import { clearCurrentUser, saveCurrentUser } from '@/lib/auth';
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
};

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
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
        cargo: 'GERENTE',
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
        cargo: 'TRABALHADOR',
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
    <main className="page-shell">
      <div className="page-header">
        <h1>Bem-vindo</h1>
      </div>

      {message && <div className={`message ${message.type}`}>{message.text}</div>}

      <div className="form-grid" style={{ marginBottom: '24px' }}>
        <div className="card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Acesso</p>
              <h2>Controle de estoque</h2>
            </div>
          </div>
          <p>Crie sua conta ou entre com seu e-mail e senha para acessar o painel de produtos e movimentações.</p>
        </div>

        <div className="card">
          <div className="panel-header" style={{ marginBottom: '16px' }}>
            <div>
              <p className="eyebrow">Conta</p>
              <h2>{mode === 'login' ? 'Entrar' : 'Criar conta'}</h2>
            </div>
          </div>

          <div className="form-actions" style={{ marginBottom: '16px' }}>
            <button type="button" className={mode === 'login' ? 'primary-button' : 'secondary-button'} onClick={() => setMode('login')}>
              Entrar
            </button>
            <button type="button" className={mode === 'register' ? 'primary-button' : 'secondary-button'} onClick={() => setMode('register')}>
              Cadastrar
            </button>
          </div>

          {mode === 'login' ? (
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
          ) : (
            <form onSubmit={handleRegister} className="form-grid">
              <label className="form-field full-width">
                <span>Nome</span>
                <input type="text" value={registerForm.nome} onChange={(event) => handleRegisterChange('nome', event.target.value)} placeholder="Seu nome" required />
              </label>

              <label className="form-field full-width">
                <span>Email</span>
                <input type="email" value={registerForm.email} onChange={(event) => handleRegisterChange('email', event.target.value)} placeholder="nome@empresa.com" required />
              </label>

              <label className="form-field full-width">
                <span>Senha</span>
                <input type="password" value={registerForm.senha} onChange={(event) => handleRegisterChange('senha', event.target.value)} placeholder="Crie uma senha" required />
              </label>

              <label className="form-field full-width">
                <span>Confirmar senha</span>
                <input type="password" value={registerForm.confirmarSenha} onChange={(event) => handleRegisterChange('confirmarSenha', event.target.value)} placeholder="Repita a senha" required />
              </label>

              <div className="form-actions full-width">
                <button type="submit" className="primary-button" disabled={loading}>
                  {loading ? 'Cadastrando...' : 'Cadastrar'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
