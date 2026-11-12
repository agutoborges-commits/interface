"use client";

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch } from '@/lib/api';
import { getCurrentUser, hasAnyRole, normalizeRole, ROLE_OPTIONS } from '@/lib/auth';
import type { Usuario } from '@/types/inventory';

const emptyForm = {
  nome: '',
  email: '',
  cargo: 'TRABALHADOR',
};

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const usuarioAtual = getCurrentUser();
  const podeGerenciar = hasAnyRole(normalizeRole(usuarioAtual?.cargo), ['GERENTE', 'CEO']);
  const cargosDisponiveis = usuarioAtual?.cargo.toUpperCase() === 'CEO'
    ? ROLE_OPTIONS
    : ROLE_OPTIONS.filter((role) => role.value !== 'GERENTE' && role.value !== 'CEO');

  useEffect(() => {
    if (!podeGerenciar) {
      setLoading(false);
      return;
    }

    apiFetch<Usuario[]>('/api/usuarios')
      .then(setUsuarios)
      .catch((error: unknown) => {
        setMessage({
          type: 'error',
          text: error instanceof Error ? error.message : 'Não foi possível carregar os usuários.',
        });
      })
      .finally(() => setLoading(false));
  }, [podeGerenciar]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const usuario = await apiFetch<Usuario>('/api/usuarios', {
        method: 'POST',
        body: JSON.stringify({
          nome: form.nome.trim(),
          email: form.email.trim(),
          cargo: form.cargo,
          ativo: true,
        }),
      });

      setUsuarios((current) => [...current, usuario].sort((a, b) => a.nome.localeCompare(b.nome)));
      setForm(emptyForm);
      setMessage({ type: 'success', text: `Convite enviado para ${usuario.email}.` });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível enviar o convite.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page-shell">
      <div className="page-header">
        <h1>Usuários</h1>
        <Link className="secondary-button link-button" href="/">Voltar ao dashboard</Link>
      </div>

      {message && <div className={`message ${message.type}`} role="status">{message.text}</div>}

      {!podeGerenciar ? (
        <div className="message error" role="alert">Acesso restrito a gerentes e CEO.</div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="panel-header">
              <div>
                <p className="eyebrow">Acesso</p>
                <h2>Convidar usuário</h2>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="form-grid">
              <label className="form-field">
                <span>Nome</span>
                <input
                  value={form.nome}
                  onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))}
                  required
                />
              </label>

              <label className="form-field">
                <span>E-mail</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  required
                />
              </label>

              <label className="form-field">
                <span>Cargo</span>
                <select
                  value={form.cargo}
                  onChange={(event) => setForm((current) => ({ ...current, cargo: event.target.value }))}
                >
                  {cargosDisponiveis.map((role) => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </label>

              <div className="form-actions full-width">
                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? 'Enviando convite...' : 'Enviar convite'}
                </button>
              </div>
            </form>
          </div>

          <div className="card table-card">
            <div className="panel-header">
              <h2>Contas cadastradas</h2>
            </div>
            {loading ? (
              <div className="loading-card">Carregando usuários...</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Cargo</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((usuario) => (
                    <tr key={usuario.id}>
                      <td>{usuario.id}</td>
                      <td>{usuario.nome}</td>
                      <td>{usuario.email}</td>
                      <td>{usuario.cargo}</td>
                      <td>{usuario.ativo ? 'Ativo' : 'Inativo'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </main>
  );
}
