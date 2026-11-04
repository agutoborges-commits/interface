"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { apiFetch } from '@/lib/api';
import type { Usuario } from '@/types/inventory';

const allowedRoles = ['CEO', 'GERENTE', 'FILIAL', 'LOJA', 'SUPERVISOR', 'ADMINISTRADOR'];

const emptyRegister = {
  nome: '',
  email: '',
  senha: '',
  cargo: 'FILIAL',
};

const emptyLogin = {
  email: '',
  senha: '',
};

export default function LoginPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [registerForm, setRegisterForm] = useState(emptyRegister);
  const [loginForm, setLoginForm] = useState(emptyLogin);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const storedUsers = localStorage.getItem('stock-users');
    if (storedUsers) {
      try {
        const parsedUsers = JSON.parse(storedUsers) as Usuario[];
        setUsuarios(parsedUsers);
      } catch {
        setUsuarios([]);
      }
    }

    apiFetch<Usuario[]>('/api/usuarios')
      .then((data) => {
        setUsuarios((current) => current.length ? current : data);
        localStorage.setItem('stock-users', JSON.stringify(data));
      })
      .catch(() => {
        setUsuarios((current) => current);
      })
      .finally(() => setLoading(false));
  }, []);

  const usuariosDisponiveis = useMemo(
    () => usuarios.filter((usuario) => !!usuario.email),
    [usuarios],
  );

  function handleRegisterChange(field: keyof typeof emptyRegister, value: string) {
    setRegisterForm((current) => ({ ...current, [field]: value }));
  }

  function handleLoginChange(field: keyof typeof emptyLogin, value: string) {
    setLoginForm((current) => ({ ...current, [field]: value }));
  }

  async function handleCreateUser(event: FormEvent) {
    event.preventDefault();

    if (!registerForm.nome.trim() || !registerForm.email.trim() || !registerForm.senha.trim()) {
      setMessage({ type: 'error', text: 'Preencha nome, e-mail e senha.' });
      return;
    }

    const cargo = registerForm.cargo.toUpperCase();
    if (!allowedRoles.some((role) => cargo.includes(role))) {
      setMessage({ type: 'error', text: 'Cargo inválido. Use um cargo como FILIAL, GERENTE, CEO, SUPERVISOR ou ADMINISTRADOR.' });
      return;
    }

    const novoUsuario: Usuario & { senha?: string } = {
      id: Date.now(),
      nome: registerForm.nome.trim(),
      email: registerForm.email.trim(),
      cargo,
      ativo: true,
      senha: registerForm.senha,
    };

    const nextUsers = [novoUsuario, ...usuariosDisponiveis];
    setUsuarios(nextUsers);
    localStorage.setItem('stock-users', JSON.stringify(nextUsers));

    try {
      await apiFetch<Usuario>('/api/usuarios', {
        method: 'POST',
        body: JSON.stringify({
          nome: novoUsuario.nome,
          email: novoUsuario.email,
          cargo: novoUsuario.cargo,
          ativo: true,
        }),
      });
    } catch (error) {
      console.warn('Cadastro local realizado; backend pode rejeitar sem senha', error);
    }

    setRegisterForm(emptyRegister);
    setMessage({
      type: 'success',
      text: `Login criado com sucesso para ${novoUsuario.nome}.`,
    });
  }

  function handleLogin(event: FormEvent) {
    event.preventDefault();

    const usuarioEncontrado = usuariosDisponiveis.find(
      (usuario) => usuario.email?.toLowerCase() === loginForm.email.trim().toLowerCase(),
    );

    if (!usuarioEncontrado) {
      setMessage({ type: 'error', text: 'Usuário não encontrado.' });
      return;
    }

    const senhaGuardada = (usuarioEncontrado as Usuario & { senha?: string }).senha;
    if (senhaGuardada && senhaGuardada !== loginForm.senha) {
      setMessage({ type: 'error', text: 'Senha incorreta.' });
      return;
    }

    const sessionUser = {
      id: usuarioEncontrado.id,
      nome: usuarioEncontrado.nome,
      email: usuarioEncontrado.email,
      cargo: usuarioEncontrado.cargo,
    };

    localStorage.setItem('stock-auth-user', JSON.stringify(sessionUser));
    setMessage({
      type: 'success',
      text: `Login realizado com sucesso. Bem-vindo, ${usuarioEncontrado.nome}.`,
    });
    window.location.href = '/';
  }

  return (
    <main className="page-shell">
      <div className="page-header">
        <h1>Login e cadastro</h1>
        <div className="header-actions">
          <Link href="/" className="secondary-button link-button">Voltar ao dashboard</Link>
          <Link href="/usuarios" className="primary-button link-button">Usuários</Link>
        </div>
      </div>

      {message && <div className={`message ${message.type}`}>{message.text}</div>}

      <div className="form-grid" style={{ marginBottom: '24px' }}>
        <div className="card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Novo</p>
              <h2>Criar login</h2>
            </div>
          </div>

          <form onSubmit={handleCreateUser} className="form-grid">
            <label className="form-field full-width">
              <span>Nome</span>
              <input value={registerForm.nome} onChange={(event) => handleRegisterChange('nome', event.target.value)} placeholder="Seu nome completo" required />
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
              <span>Cargo</span>
              <select value={registerForm.cargo} onChange={(event) => handleRegisterChange('cargo', event.target.value)}>
                <option value="FILIAL">Filial</option>
                <option value="LOJA">Loja</option>
                <option value="GERENTE">Gerente</option>
                <option value="SUPERVISOR">Supervisor</option>
                <option value="ADMINISTRADOR">Administrador</option>
                <option value="CEO">CEO</option>
              </select>
            </label>

            <div className="form-actions full-width">
              <button type="submit" className="primary-button" disabled={loading}>
                {loading ? 'Carregando...' : 'Criar login'}
              </button>
            </div>
          </form>
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
              <button type="submit" className="primary-button">
                Entrar
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
