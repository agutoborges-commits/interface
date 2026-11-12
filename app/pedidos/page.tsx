"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { apiFetch } from '@/lib/api';
import { getCurrentUser, hasAnyRole, normalizeRole } from '@/lib/auth';
import { calcularEstoquePorProduto, type MovimentacaoEstoque } from '@/lib/stock';
import type { Pedido, Produto } from '@/types/inventory';

const createNumeroPedido = () => `PED-${Date.now().toString().slice(-6)}`;

const initialForm = {
  numeroPedido: createNumeroPedido(),
  filialId: 1,
  status: 'EmConferencia',
  observacao: '',
};

const initialSelection = {
  produtoId: '',
  quantidade: '1',
};

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoEstoque[]>([]);
  const [form, setForm] = useState(initialForm);
  const [selection, setSelection] = useState(initialSelection);
  const [itensPedido, setItensPedido] = useState<Array<{ id: number; produtoId: number; nome: string; quantidade: number; precoVenda: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [conferidos, setConferidos] = useState<Record<number, boolean>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function loadPedidos() {
    try {
      const [pedidosData, produtosData, movimentacoesData] = await Promise.all([
        apiFetch<Pedido[]>('/api/pedidos'),
        apiFetch<Produto[]>('/api/produtos'),
        apiFetch<MovimentacaoEstoque[]>('/api/MovimentacoesEstoque'),
      ]);

      setPedidos(pedidosData);
      setProdutos(produtosData);
      setMovimentacoes(movimentacoesData);
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error
          ? `Não foi possível carregar os pedidos: ${error.message}`
          : 'Erro inesperado ao carregar os pedidos.',
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      window.location.href = '/login';
      return;
    }
    loadPedidos();
  }, []);

  const usuarioAtual = getCurrentUser();
  const isAutorizado = !!usuarioAtual && hasAnyRole(normalizeRole(usuarioAtual.cargo), ['FILIAL', 'GERENTE', 'CEO']);
  const estoquePorProduto = useMemo(
    () => calcularEstoquePorProduto(movimentacoes),
    [movimentacoes],
  );

  function handleFieldChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleSelectionChange(event: ChangeEvent<HTMLSelectElement | HTMLInputElement>) {
    const { name, value } = event.target;
    setSelection((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleAdicionarProduto() {
    const produtoId = Number(selection.produtoId);
    const quantidade = Number(selection.quantidade || 0);

    if (!produtoId || quantidade <= 0) {
      setMessage({
        type: 'error',
        text: 'Selecione um produto e informe uma quantidade válida.',
      });
      return;
    }

    const produtoSelecionado = produtos.find((produto) => produto.id === produtoId);

    if (!produtoSelecionado) {
      setMessage({
        type: 'error',
        text: 'Produto não encontrado no estoque.',
      });
      return;
    }

    const estoqueAtual = estoquePorProduto.get(produtoSelecionado.id) ?? 0;
    const quantidadeJaNoPedido = itensPedido.find((item) => item.produtoId === produtoId)?.quantidade ?? 0;

    if (quantidadeJaNoPedido + quantidade > estoqueAtual) {
      setMessage({
        type: 'error',
        text: `A quantidade total solicitada excede o estoque disponível (${estoqueAtual} unidades).`,
      });
      return;
    }

    setItensPedido((current) => {
      const existente = current.find((item) => item.produtoId === produtoId);

      if (existente) {
        return current.map((item) =>
          item.produtoId === produtoId
            ? { ...item, quantidade: item.quantidade + quantidade }
            : item,
        );
      }

      return [
        ...current,
        {
          id: produtoSelecionado.id,
          produtoId: produtoSelecionado.id,
          nome: produtoSelecionado.nome,
          quantidade,
          precoVenda: Number(produtoSelecionado.precoVenda || 0),
        },
      ];
    });

    setSelection(initialSelection);
    setMessage({
      type: 'success',
      text: `${produtoSelecionado.nome} adicionado ao pedido.`,
    });
  }

  function handleRemoverItem(produtoId: number) {
    setItensPedido((current) => current.filter((item) => item.produtoId !== produtoId));
  }

  const valorTotalPedido = useMemo(
    () => itensPedido.reduce((sum, item) => sum + item.quantidade * item.precoVenda, 0),
    [itensPedido],
  );

  const semEstoque = useMemo(
    () => produtos.filter((produto) => (estoquePorProduto.get(produto.id) ?? 0) <= 0).length,
    [estoquePorProduto, produtos],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isAutorizado) {
      setMessage({
        type: 'error',
        text: 'Acesso restrito. Somente usuários de filial, gerente ou CEO podem criar pedidos.',
      });
      return;
    }

    if (!itensPedido.length) {
      setMessage({
        type: 'error',
        text: 'Adicione pelo menos um produto ao pedido antes de salvar.',
      });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const payload = {
        numeroPedido: form.numeroPedido || createNumeroPedido(),
        filialId: Number(form.filialId || 1),
        status: form.status || 'EmConferencia',
        valorTotal: valorTotalPedido,
        observacao: form.observacao || `Itens: ${itensPedido.map((item) => `${item.nome} (${item.quantidade})`).join(', ')}`,
      };

      const pedidoCriado = await apiFetch<Pedido>('/api/pedidos', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setPedidos((current) => [pedidoCriado, ...current]);
      setItensPedido([]);
      setForm({
        ...initialForm,
        numeroPedido: createNumeroPedido(),
      });
      setSelection(initialSelection);
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
          <Link href="/conferencia" className="secondary-button link-button">Conferência</Link>
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

        {!isAutorizado ? (
          <div className="message error">
            Acesso restrito. Apenas usuários de filial, gerente ou CEO podem criar pedidos.
          </div>
        ) : (
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

            <div className="panel-header" style={{ marginTop: '20px' }}>
              <div>
                <p className="eyebrow">Itens</p>
                <h2>Produtos do pedido</h2>
              </div>
            </div>

            <div className="form-grid">
              <label className="form-field">
                <span>Produto</span>
                <select name="produtoId" value={selection.produtoId} onChange={handleSelectionChange}>
                  <option value="">Selecione um produto</option>
                  {produtos.map((produto) => (
                    <option key={produto.id} value={produto.id}>
                      {produto.nome} ({estoquePorProduto.get(produto.id) ?? 0} em estoque)
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span>Quantidade</span>
                <input
                  name="quantidade"
                  type="number"
                  min="1"
                  value={selection.quantidade}
                  onChange={handleSelectionChange}
                />
              </label>
            </div>

            <div className="form-actions" style={{ justifyContent: 'space-between' }}>
              <button type="button" className="secondary-button" onClick={handleAdicionarProduto}>
                Adicionar produto
              </button>
              <button type="submit" className="primary-button" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar pedido'}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="panel-header">
          <div>
            <p className="eyebrow">Resumo</p>
            <h2>Estoque e alertas</h2>
          </div>
        </div>

        <div className="stats-grid">
          <article className="stat-card">
            <span className="stat-label">Produtos no pedido</span>
            <strong>{itensPedido.length}</strong>
            <small>Itens selecionados</small>
          </article>

          <article className="stat-card">
            <span className="stat-label">Total do pedido</span>
            <strong>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotalPedido)}</strong>
            <small>Valor estimado</small>
          </article>

          <article className="stat-card">
            <span className="stat-label">Unidades disponíveis</span>
            <strong>{Array.from(estoquePorProduto.values()).reduce((total, quantidade) => total + quantidade, 0)}</strong>
            <small>Saldo calculado pelas movimentações</small>
          </article>

          <article className="stat-card danger">
            <span className="stat-label">Sem estoque</span>
            <strong>{semEstoque}</strong>
            <small>Produtos zerados</small>
          </article>
        </div>

        <div className="table-wrap" style={{ marginTop: '18px' }}>
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Estoque</th>
                <th>Status</th>
                <th>Qtd no pedido</th>
                <th>Valor</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((produto) => {
                const estoqueAtual = estoquePorProduto.get(produto.id) ?? 0;
                const semEstoque = estoqueAtual <= 0;

                return (
                  <tr key={produto.id} className={semEstoque ? 'row-alert' : ''}>
                    <td>{produto.nome}</td>
                    <td>{estoqueAtual}</td>
                    <td>
                      <span className={`status-badge ${semEstoque ? 'empty' : 'normal'}`}>
                        {semEstoque ? 'Sem estoque' : 'Disponível'}
                      </span>
                    </td>
                    <td>{itensPedido.find((item) => item.produtoId === produto.id)?.quantidade ?? 0}</td>
                    <td>
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(Number(produto.precoVenda || 0))}
                    </td>
                    <td>
                      {itensPedido.some((item) => item.produtoId === produto.id) ? 'Incluído' : 'Disponível'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
