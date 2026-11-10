"use client";

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
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

const emptyForm: FornecedorForm = {
  razaoSocial: '',
  nomeFantasia: '',
  cnpj: '',
  telefone: '',
  email: '',
  endereco: '',
  ativo: true,
};

export default function FornecedoresPage() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FornecedorForm>(emptyForm);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function loadFornecedores() {
    try {
      const data = await apiFetch<Fornecedor[]>('/api/Fornecedores');
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
    loadFornecedores();
  }, []);

  function handleFieldChange(field: keyof FornecedorForm, value: string | boolean) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const razaoSocial = form.razaoSocial.trim();
    const cnpj = form.cnpj.trim();

    if (!razaoSocial) {
      setMessage({
        type: 'error',
        text: 'A razão social do fornecedor é obrigatória.',
      });
      return;
    }

    setSaving(true);
    setMessage(null);

    const payload = {
      razaoSocial,
      nomeFantasia: form.nomeFantasia.trim() || null,
      cnpj: cnpj || null,
      telefone: form.telefone.trim() || null,
      email: form.email.trim() || null,
      endereco: form.endereco.trim() || null,
      ativo: form.ativo,
    };

    try {
      const fornecedorSalvo = editingId
        ? await apiFetch<Fornecedor>(`/api/Fornecedores/${editingId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          })
        : await apiFetch<Fornecedor>('/api/Fornecedores', {
            method: 'POST',
            body: JSON.stringify(payload),
          });

      setFornecedores((current) => {
        if (editingId) {
          return current.map((item) => (item.id === editingId ? fornecedorSalvo : item));
        }

        return [fornecedorSalvo, ...current];
      });

      setMessage({
        type: 'success',
        text: editingId
          ? `Fornecedor ${fornecedorSalvo.razaoSocial} atualizado com sucesso.`
          : `Fornecedor ${fornecedorSalvo.razaoSocial} cadastrado com sucesso.`,
      });

      resetForm();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível salvar o fornecedor.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    const fornecedor = fornecedores.find((item) => item.id === id);
    const nome = fornecedor?.razaoSocial ?? 'este fornecedor';

    const confirmed = window.confirm(`Deseja excluir ${nome}?`);
    if (!confirmed) return;

    try {
      await apiFetch<void>(`/api/Fornecedores/${id}`, {
        method: 'DELETE',
      });

      setFornecedores((current) => current.filter((item) => item.id !== id));
      if (editingId === id) {
        resetForm();
      }

      setMessage({
        type: 'success',
        text: `Fornecedor ${nome} removido com sucesso.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível excluir o fornecedor.',
      });
    }
  }

  function handleEdit(fornecedor: Fornecedor) {
    setEditingId(fornecedor.id);
    setForm({
      razaoSocial: fornecedor.razaoSocial ?? '',
      nomeFantasia: fornecedor.nomeFantasia ?? '',
      cnpj: fornecedor.cnpj ?? '',
      telefone: fornecedor.telefone ?? '',
      email: fornecedor.email ?? '',
      endereco: fornecedor.endereco ?? '',
      ativo: fornecedor.ativo,
    });
    setMessage(null);
  }

  return (
    <main className="page-shell">
      <div className="page-header">
        <h1>Fornecedores</h1>
        <div className="header-actions">
          <Link href="/" className="secondary-button link-button">Voltar ao dashboard</Link>
        </div>
      </div>

      {message && <div className={`message ${message.type}`}>{message.text}</div>}

      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="panel-header">
          <div>
            <p className="eyebrow">Cadastro</p>
            <h2>{editingId ? 'Editar fornecedor' : 'Novo fornecedor'}</h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="form-grid">
          <label className="form-field full-width">
            <span>Razão social</span>
            <input
              value={form.razaoSocial}
              onChange={(event) => handleFieldChange('razaoSocial', event.target.value)}
              placeholder="Ex: Distribuidora Norte Ltda"
              required
            />
          </label>

          <label className="form-field">
            <span>Nome fantasia</span>
            <input
              value={form.nomeFantasia}
              onChange={(event) => handleFieldChange('nomeFantasia', event.target.value)}
              placeholder="Ex: Norte Distribuição"
            />
          </label>

          <label className="form-field">
            <span>CNPJ</span>
            <input
              value={form.cnpj}
              onChange={(event) => handleFieldChange('cnpj', event.target.value)}
              placeholder="00.000.000/0000-00"
            />
          </label>

          <label className="form-field">
            <span>Telefone</span>
            <input
              value={form.telefone}
              onChange={(event) => handleFieldChange('telefone', event.target.value)}
              placeholder="(11) 99999-9999"
            />
          </label>

          <label className="form-field">
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => handleFieldChange('email', event.target.value)}
              placeholder="contato@fornecedor.com"
            />
          </label>

          <label className="form-field full-width">
            <span>Endereço</span>
            <textarea
              value={form.endereco}
              onChange={(event) => handleFieldChange('endereco', event.target.value)}
              placeholder="Rua, número, bairro, cidade, estado"
            />
          </label>

          <label className="checkbox-field full-width">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(event) => handleFieldChange('ativo', event.target.checked)}
            />
            Fornecedor ativo
          </label>

          <div className="form-actions full-width">
            <button type="button" className="ghost-button" onClick={resetForm} disabled={saving}>
              Limpar
            </button>
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar fornecedor'}
            </button>
          </div>
        </form>
      </div>

      <div className="card table-card">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Lista</p>
            <h2>Fornecedores cadastrados</h2>
          </div>
        </div>

        {loading ? (
          <p>Carregando fornecedores...</p>
        ) : fornecedores.length === 0 ? (
          <p>Nenhum fornecedor cadastrado até o momento.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Razão social</th>
                <th>Nome fantasia</th>
                <th>CNPJ</th>
                <th>Contato</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {fornecedores.map((fornecedor) => (
                <tr key={fornecedor.id}>
                  <td>{fornecedor.id}</td>
                  <td>{fornecedor.razaoSocial}</td>
                  <td>{fornecedor.nomeFantasia || '—'}</td>
                  <td>{fornecedor.cnpj || '—'}</td>
                  <td>
                    <div className="stacked-cell">
                      <span>{fornecedor.email || '—'}</span>
                      <small>{fornecedor.telefone || 'Telefone não informado'}</small>
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge ${fornecedor.ativo ? 'normal' : 'empty'}`}>
                      {fornecedor.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    <div className="inline-actions">
                      <button type="button" onClick={() => handleEdit(fornecedor)}>
                        Editar
                      </button>
                      <button type="button" onClick={() => handleDelete(fornecedor.id)}>
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
