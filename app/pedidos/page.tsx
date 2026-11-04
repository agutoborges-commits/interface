"use client";

import Link from 'next/link';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { apiFetch } from '@/lib/api';
import type { Pedido } from '@/types/inventory';

const createNumeroPedido = () => `PED-${Date.now().toString().slice(-6)}`;

const initialForm = {
  numeroPedido: createNumeroPedido(),
  filialId: 1,
  status: 'EmConferencia',
  valorTotal: '0',
  observacao: '',
};

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [conferidos, setConferidos] = useState<Record<number, boolean>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function loadPedidos() {
    try {
      const data = await apiFetch<Pedido[]>('/api/pedidos');
      setPedidos(data);
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
      setMessage({
        type: 'error',
        text: 'Não foi possível carregar os pedidos no momento.',
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPedidos();
  }, []);

  function handleFieldChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const payload = {
        numeroPedido: form.numeroPedido || createNumeroPedido(),
        filialId: Number(form.filialId || 1),
        status: form.status || 'EmConferencia',
        valorTotal: Number(form.valorTotal || 0),
        observacao: form.observacao || null,
      };

      const pedidoCriado = await apiFetch<Pedido>('/api/pedidos', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setPedidos((current) => [pedidoCriado, ...current]);
      setForm({
        ...initialForm,
        numeroPedido: createNumeroPedido(),
      });
      setMessage({
        type: 'success',
        text: `Pedido ${pedidoCriado.numeroPedido} criado com sucesso.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível criar o pedido.',
      });
    } finally {
      setSaving(false);
    }
  }

  function handleConferir(pedido: Pedido) {
    setConferidos((current) => ({
      ...current,
      [pedido.id]: true,
    }));
    setMessage({
      type: 'success',
      text: `Pedido ${pedido.numeroPedido} marcado como conferido na interface.`,
    });
  }

  return (
    <main className="page-shell">
      <div className="page-header">
        <h1>Pedidos</h1>
        <div className="header-actions">
          <Link href="/" className="secondary-button link-button">Voltar ao dashboard</Link>
          <Link href="/produtos" className="primary-button link-button">Ver produtos</Link>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="panel-header">
          <div>
            <p className="eyebrow">Cadastro</p>
            <h2>Novo pedido</h2>
          </div>
        </div>

        {message && <div className={`message ${message.type}`}>{message.text}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="form-field">
              <span>Número do pedido</span>
              <input
                name="numeroPedido"
                value={form.numeroPedido}
                onChange={handleFieldChange}
                placeholder="PED-1001"
              />
            </label>

            <label className="form-field">
              <span>Filial</span>
              <select name="filialId" value={form.filialId} onChange={handleFieldChange}>
                <option value={1}>Filial 1</option>
                <option value={2}>Filial 2</option>
                <option value={3}>Filial 3</option>
              </select>
            </label>

            <label className="form-field">
              <span>Status</span>
              <select name="status" value={form.status} onChange={handleFieldChange}>
                <option value="Aberto">Aberto</option>
                <option value="EmConferencia">Em conferência</option>
                <option value="Conferido">Conferido</option>
              </select>
            </label>

            <label className="form-field">
              <span>Valor total</span>
              <input
                name="valorTotal"
                type="number"
                min="0"
                step="0.01"
                value={form.valorTotal}
                onChange={handleFieldChange}
              />
            </label>

            <label className="form-field full-width">
              <span>Observação</span>
              <textarea
                name="observacao"
                value={form.observacao}
                onChange={handleFieldChange}
                placeholder="Descreva detalhes do pedido"
              />
            </label>
          </div>

          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar pedido'}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Lista</p>
            <h2>Pedidos em análise</h2>
          </div>
        </div>

        {loading ? (
          <div className="loading-card">Carregando pedidos...</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Pedido</th>
                  <th>Filial</th>
                  <th>Status</th>
                  <th>Valor</th>
                  <th>Data</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((pedido) => {
                  const statusFinal = conferidos[pedido.id] ? 'Conferido' : pedido.status || 'Aberto';
                  const statusClass = statusFinal === 'Conferido' ? 'normal' : statusFinal === 'EmConferencia' ? 'low' : 'empty';

                  return (
                    <tr key={pedido.id}>
                      <td>{pedido.id}</td>
                      <td>{pedido.numeroPedido}</td>
                      <td>{pedido.filialId}</td>
                      <td>
                        <span className={`status-badge ${statusClass}`}>{statusFinal}</span>
                      </td>
                      <td>
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(Number(pedido.valorTotal || 0))}
                      </td>
                      <td>{pedido.dataPedido ? new Date(pedido.dataPedido).toLocaleString('pt-BR') : '—'}</td>
                      <td>
                        <div className="inline-actions">
                          <button type="button" onClick={() => handleConferir(pedido)}>
                            {conferidos[pedido.id] ? 'Conferido' : 'Conferir'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
