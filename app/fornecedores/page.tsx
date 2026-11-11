"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { apiFetch } from '@/lib/api';
import { getCurrentUser, hasAnyRole, normalizeRole } from '@/lib/auth';
import type { Fornecedor } from '@/types/inventory';

type FornecedorForm = {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  telefone: string;
  email: string;
  endereco: string;
  ativo: boolean;
};

const emptyForm = (): FornecedorForm => ({
  razaoSocial: '',
  nomeFantasia: '',
  cnpj: '',
  telefone: '',
  email: '',
  endereco: '',
  ativo: true,
});

async function updateFornecedorById(id: number, payload: Partial<Fornecedor>) {
  const routes = [
    `/api/fornecedores`,
    `/api/fornecedores/${id}`,
    `/api/fornecedores/update/${id}`,
    `/api/fornecedores/${id}/editar`,
    `/api/fornecedores/editar/${id}`,
  ];

  let lastError: unknown = null;

  for (const route of routes) {
    for (const method of ['PUT', 'PATCH']) {
      try {
        return await apiFetch<Fornecedor>(route, {
          method,
          body: JSON.stringify({ ...payload, id }),
        });
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError ?? new Error('Não foi possível atualizar o fornecedor.');
}

export default function FornecedoresPage() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FornecedorForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const currentUser = getCurrentUser();
  const canEdit = !!currentUser && hasAnyRole(normalizeRole(currentUser.cargo), ['GERENTE']);

  async function loadFornecedores() {
    try {
      const data = await apiFetch<Fornecedor[]>('/api/fornecedores');
      setFornecedores(data);
    } catch (error) {
      console.error('Erro ao carregar fornecedores:', error);
      setMessage({
        type: 'error',
        text: 'Não foi possível carregar a lista de fornecedores.',
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      window.location.href = '/login';
      return;
    }

    loadFornecedores();
  }, []);

  function handleFieldChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    const { name, value, type } = target;
    const checked = 'checked' in target ? target.checked : false;

    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  function startEditing(fornecedor: Fornecedor) {
    if (!canEdit) {
      setMessage({
        type: 'error',
        text: 'Acesso restrito. Apenas gerentes podem editar fornecedores.',
      });
      return;
    }

    setEditingId(fornecedor.id);
    setForm({
      razaoSocial: fornecedor.razaoSocial ?? '',
      nomeFantasia: fornecedor.nomeFantasia ?? '',
      cnpj: fornecedor.cnpj ?? '',
      telefone: fornecedor.telefone ?? '',
      email: fornecedor.email ?? '',
      endereco: fornecedor.endereco ?? '',
      ativo: fornecedor.ativo ?? true,
    });
    setMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canEdit || editingId === null) {
      setMessage({
        type: 'error',
        text: 'Acesso restrito. Apenas gerentes podem editar fornecedores.',
      });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const payload: Partial<Fornecedor> = {
        razaoSocial: form.razaoSocial.trim(),
        nomeFantasia: form.nomeFantasia.trim() || null,
        cnpj: form.cnpj.trim(),
        telefone: form.telefone.trim() || null,
        email: form.email.trim() || null,
        endereco: form.endereco.trim() || null,
        ativo: form.ativo,
      };

      const fornecedorAtualizado = await updateFornecedorById(editingId, payload);

      setFornecedores((current) =>
        current.map((fornecedor) =>
          fornecedor.id === editingId ? { ...fornecedor, ...fornecedorAtualizado } : fornecedor,
        ),
      );

      setEditingId(null);
      setForm(emptyForm());
      setMessage({
        type: 'success',
        text: `Fornecedor ${fornecedorAtualizado.razaoSocial} atualizado com sucesso.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível salvar as alterações do fornecedor.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page-shell">
      <div className="page-header">
        <h1>Fornecedores</h1>
        <a className="primary-button" href="/">Voltar ao dashboard</a>
      </div>

      {message && <div className={`message ${message.type}`}>{message.text}</div>}

      {!canEdit && (
        <div className="message error" style={{ marginBottom: '16px' }}>
          Acesso restrito: esta ação só está disponível para gerentes.
        </div>
      )}

      {editingId !== null && canEdit && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Edição</p>
              <h2>Atualizar fornecedor</h2>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <label className="form-field">
                <span>Razão social</span>
                <input name="razaoSocial" value={form.razaoSocial} onChange={handleFieldChange} required />
              </label>

              <label className="form-field">
                <span>Nome fantasia</span>
                <input name="nomeFantasia" value={form.nomeFantasia} onChange={handleFieldChange} />
              </label>

              <label className="form-field">
                <span>CNPJ</span>
                <input name="cnpj" value={form.cnpj} onChange={handleFieldChange} required />
              </label>

              <label className="form-field">
                <span>Telefone</span>
                <input name="telefone" value={form.telefone} onChange={handleFieldChange} />
              </label>

              <label className="form-field">
                <span>E-mail</span>
                <input type="email" name="email" value={form.email} onChange={handleFieldChange} />
              </label>

              <label className="form-field full-width">
                <span>Endereço</span>
                <textarea name="endereco" value={form.endereco} onChange={handleFieldChange} />
              </label>

              <label className="checkbox-field full-width">
                <input
                  type="checkbox"
                  name="ativo"
                  checked={form.ativo}
                  onChange={handleFieldChange}
                />
                <span>Fornecedor ativo</span>
              </label>
            </div>

            <div className="action-row" style={{ marginTop: '16px' }}>
              <button type="submit" className="primary-button" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm());
                  setMessage(null);
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card table-card">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Razão social</th>
              <th>CNPJ</th>
              <th>Ativo</th>
              {canEdit && <th>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={canEdit ? 5 : 4}>Carregando fornecedores...</td>
              </tr>
            ) : (
              fornecedores.map((fornecedor) => (
                <tr key={fornecedor.id}>
                  <td>{fornecedor.id}</td>
                  <td>{fornecedor.razaoSocial}</td>
                  <td>{fornecedor.cnpj}</td>
                  <td>{fornecedor.ativo ? 'Sim' : 'Não'}</td>
                  {canEdit && (
                    <td>
                      <button type="button" className="secondary-button" onClick={() => startEditing(fornecedor)}>
                        Editar
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
