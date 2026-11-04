"use client";

import Link from 'next/link';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { apiFetch } from '@/lib/api';
import type { Produto } from '@/types/inventory';

const initialForm = {
  nome: '',
  codigoBarras: '',
  descricao: '',
  precoCusto: '',
  precoVenda: '',
  ativo: true,
};

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState(initialForm);

  async function loadProdutos() {
    try {
      const data = await apiFetch<Produto[]>('/api/produtos');
      setProdutos(data);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      setMessage({
        type: 'error',
        text: 'Não foi possível carregar a lista de produtos.',
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProdutos();
  }, []);

  function handleFieldChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    const { name, value } = target;
    const isCheckbox = 'checked' in target && target.type === 'checkbox';

    setForm((current) => ({
      ...current,
      [name]: isCheckbox ? target.checked : value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const payload = {
        nome: form.nome.trim(),
        codigoBarras: form.codigoBarras || null,
        descricao: form.descricao || null,
        precoCusto: Number(form.precoCusto || 0),
        precoVenda: Number(form.precoVenda || 0),
        ativo: form.ativo,
      };

      const produtoCriado = await apiFetch<Produto>('/api/produtos', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setProdutos((current) => [produtoCriado, ...current]);
      setForm(initialForm);
      setMessage({
        type: 'success',
        text: `Produto ${produtoCriado.nome} cadastrado com sucesso.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível cadastrar o produto.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page-shell">
      <div className="page-header">
        <h1>Produtos</h1>
        <div className="header-actions">
          <Link href="/" className="secondary-button link-button">Voltar ao dashboard</Link>
          <Link href="/pedidos" className="primary-button link-button">Ir para pedidos</Link>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="panel-header">
          <div>
            <p className="eyebrow">Cadastro</p>
            <h2>Novo produto</h2>
          </div>
        </div>

        {message && <div className={`message ${message.type}`}>{message.text}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="form-field">
              <span>Nome do produto</span>
              <input
                name="nome"
                value={form.nome}
                onChange={handleFieldChange}
                placeholder="Ex: Arroz 5kg"
                required
              />
            </label>

            <label className="form-field">
              <span>Código de barras</span>
              <input
                name="codigoBarras"
                value={form.codigoBarras}
                onChange={handleFieldChange}
                placeholder="7890000000000"
              />
            </label>

            <label className="form-field">
              <span>Preço de custo</span>
              <input
                name="precoCusto"
                type="number"
                min="0"
                step="0.01"
                value={form.precoCusto}
                onChange={handleFieldChange}
                required
              />
            </label>

            <label className="form-field">
              <span>Preço de venda</span>
              <input
                name="precoVenda"
                type="number"
                min="0"
                step="0.01"
                value={form.precoVenda}
                onChange={handleFieldChange}
                required
              />
            </label>

            <label className="form-field full-width">
              <span>Descrição</span>
              <textarea
                name="descricao"
                value={form.descricao}
                onChange={handleFieldChange}
                placeholder="Describe as características do produto"
              />
            </label>

            <label className="checkbox-field full-width">
              <input
                type="checkbox"
                name="ativo"
                checked={form.ativo}
                onChange={handleFieldChange}
              />
              Produto ativo
            </label>
          </div>

          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar produto'}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Produtos</p>
            <h2>Lista atual</h2>
          </div>
        </div>

        {loading ? (
          <div className="loading-card">Carregando produtos...</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nome</th>
                  <th>Preço venda</th>
                  <th>Ativo</th>
                </tr>
              </thead>
              <tbody>
                {produtos.map((produto) => (
                  <tr key={produto.id}>
                    <td>{produto.id}</td>
                    <td>{produto.nome}</td>
                    <td>
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(Number(produto.precoVenda || 0))}
                    </td>
                    <td>{produto.ativo ? 'Sim' : 'Não'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
