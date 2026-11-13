"use client";

import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  clearCurrentUser,
  getCurrentUser,
  getSupabaseSession,
  hasAnyRole,
  normalizeRole,
} from '@/lib/auth';
import { calcularEstoquePorProduto, type MovimentacaoEstoque } from '@/lib/stock';
import { signOutSupabase } from '@/lib/supabase';
import type { AuthUser } from '@/lib/auth';
import type { Fornecedor, Pedido, Produto, Usuario } from '@/types/inventory';

const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function getReadNotificationsStorageKey(userId: number) {
  return `stock-read-notifications-${userId}`;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function getProductStatus(quantidade: number) {
  if (quantidade <= 0) {
    return { label: 'Esgotado', className: 'empty' };
  }

  if (quantidade <= 5) {
    return { label: 'Baixo', className: 'low' };
  }

  return { label: 'Disponível', className: 'normal' };
}

export function InventoryDashboard() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoEstoque[]>([]);
  const [sessionUser, setSessionUser] = useState<AuthUser | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [notificationReadError, setNotificationReadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [inventoryMessage, setInventoryMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savingProductId, setSavingProductId] = useState<number | null>(null);
  const [quantidadeManual, setQuantidadeManual] = useState<Record<number, number>>({});
  const [precoManual, setPrecoManual] = useState<Record<number, number>>({});

  useEffect(() => {
    const authUser = getCurrentUser();
    setSessionUser(authUser);

    async function loadData() {
      try {
        const canLoadUsers = hasAnyRole(normalizeRole(authUser?.cargo), ['GERENTE', 'CEO']);
        const [produtosData, pedidosData, fornecedoresData, usuariosData, movimentacoesData] = await Promise.all([
          apiFetch<Produto[]>('/api/produtos'),
          apiFetch<Pedido[]>('/api/pedidos'),
          apiFetch<Fornecedor[]>('/api/fornecedores'),
          canLoadUsers ? apiFetch<Usuario[]>('/api/usuarios') : Promise.resolve([]),
          apiFetch<MovimentacaoEstoque[]>('/api/MovimentacoesEstoque'),
        ]);

        setProdutos(produtosData);
        setPedidos(pedidosData);
        setFornecedores(fornecedoresData);
        setUsuarios(usuariosData);
        setMovimentacoes(movimentacoesData);
      } catch (error) {
        console.error('Erro ao carregar dados do dashboard:', error);
        setLoadError(error instanceof Error ? error.message : 'Erro inesperado ao carregar o estoque.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    if (!sessionUser) return;

    try {
      const stored = window.localStorage.getItem(getReadNotificationsStorageKey(sessionUser.id));
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      if (!isStringArray(parsed)) {
        throw new Error('Formato inválido para as notificações lidas.');
      }

      setReadNotificationIds(parsed);
      setNotificationReadError(null);
    } catch (error) {
      console.error('Erro ao carregar notificações lidas:', error);
      setReadNotificationIds([]);
      setNotificationReadError('Não foi possível carregar o status das notificações lidas.');
    }
  }, [sessionUser]);

  const userRole = normalizeRole(sessionUser?.cargo);
  const canManageProducts = hasAnyRole(userRole, ['GERENTE', 'CEO']);
  const canViewInventory = hasAnyRole(userRole, ['GERENTE', 'CEO', 'CONFERENTE']);
  const canViewFiliais = hasAnyRole(userRole, ['GERENTE', 'CEO']);
  const canCreateOrders = hasAnyRole(userRole, ['FILIAL', 'GERENTE', 'CEO']);
  const canViewConferencia = hasAnyRole(userRole, ['CONFERENTE', 'GERENTE', 'CEO']);
  const canViewUsers = hasAnyRole(userRole, ['GERENTE', 'CEO']);
  const estoquePorProduto = useMemo(
    () => calcularEstoquePorProduto(movimentacoes),
    [movimentacoes],
  );

  const notifications = useMemo(() => {
    const items: Array<{ id: string; type: 'pedido' | 'estoque'; title: string; text: string; time: string }> = [];

    pedidos.forEach((pedido) => {
      items.push({
        id: `pedido-${pedido.id}`,
        type: 'pedido',
        title: `Pedido da filial ${pedido.filialId}`,
        text: `${pedido.numeroPedido} foi solicitado${pedido.dataPedido ? ` em ${new Date(pedido.dataPedido).toLocaleDateString('pt-BR')}` : ''}.`,
        time: pedido.dataPedido ? new Date(pedido.dataPedido).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Agora',
      });
    });

    produtos.forEach((produto) => {
      if (!produto.ativo) return;

      const estoqueAtual = quantidadeManual[produto.id] ?? (estoquePorProduto.get(produto.id) ?? 0);
      if (estoqueAtual <= 0) {
        items.push({
          id: `estoque-${produto.id}`,
          type: 'estoque',
          title: 'Produto sem estoque',
          text: `${produto.nome} está com saldo de ${estoqueAtual} unidade(s).`,
          time: 'Urgente',
        });
      }
    });

    return items.slice(0, 8);
  }, [estoquePorProduto, pedidos, produtos, quantidadeManual]);
  const unreadNotificationsCount = notifications.filter(
    (notification) => !readNotificationIds.includes(notification.id),
  ).length;

  function handleMarcarNotificacaoLida(notificationId: string) {
    if (!sessionUser) return;

    const updatedReadIds = Array.from(new Set([...readNotificationIds, notificationId]));
    try {
      window.localStorage.setItem(
        getReadNotificationsStorageKey(sessionUser.id),
        JSON.stringify(updatedReadIds),
      );
    } catch (error) {
      console.error('Erro ao salvar notificação como lida:', error);
      setNotificationReadError('Não foi possível salvar o status da notificação.');
      return;
    }

    setReadNotificationIds(updatedReadIds);
    setNotificationReadError(null);
  }

  const totalProdutos = produtos.length;
  const valorEstoque = useMemo(
    () => produtos.reduce(
      (sum, produto) => {
        const quantidadeAtual = quantidadeManual[produto.id] ?? (estoquePorProduto.get(produto.id) ?? 0);
        const valorAtual = precoManual[produto.id] ?? Number(produto.precoVenda || 0);
        return sum + valorAtual * quantidadeAtual;
      },
      0,
    ),
    [estoquePorProduto, precoManual, produtos, quantidadeManual],
  );
  const totalUnidades = produtos.reduce(
    (sum, produto) => sum + (quantidadeManual[produto.id] ?? (estoquePorProduto.get(produto.id) ?? 0)),
    0,
  );
  const semEstoque = produtos.filter(
    (produto) => produto.ativo && (quantidadeManual[produto.id] ?? (estoquePorProduto.get(produto.id) ?? 0)) <= 0,
  ).length;
  const produtosComMenorEstoque = useMemo(
    () => produtos
      .filter((produto) => produto.ativo)
      .sort((produtoA, produtoB) => {
        const estoqueA = quantidadeManual[produtoA.id] ?? (estoquePorProduto.get(produtoA.id) ?? 0);
        const estoqueB = quantidadeManual[produtoB.id] ?? (estoquePorProduto.get(produtoB.id) ?? 0);
        return estoqueA - estoqueB;
      }),
    [estoquePorProduto, produtos, quantidadeManual],
  );

  async function handleSalvarEstoque(produto: Produto) {
    const quantidadeAtual = quantidadeManual[produto.id] ?? (estoquePorProduto.get(produto.id) ?? 0);
    const precoAtual = precoManual[produto.id] ?? Number(produto.precoVenda || 0);

    if (!Number.isInteger(quantidadeAtual) || quantidadeAtual < 0 || !Number.isFinite(precoAtual) || precoAtual < 0) {
      setInventoryMessage({ type: 'error', text: 'Informe uma quantidade inteira e valores iguais ou maiores que zero.' });
      return;
    }

    setSavingProductId(produto.id);
    setInventoryMessage(null);

    try {
      if (precoAtual !== Number(produto.precoVenda || 0)) {
        await apiFetch(`/api/produtos/${produto.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            nome: produto.nome,
            codigoBarras: produto.codigoBarras ?? null,
            descricao: produto.descricao ?? null,
            precoCusto: produto.precoCusto,
            precoVenda: precoAtual,
            idCategoria: produto.idCategoria ?? null,
            idFornecedor: produto.idFornecedor ?? null,
            ativo: produto.ativo,
          }),
        });

        setProdutos((current) =>
          current.map((item) => (item.id === produto.id ? { ...item, precoVenda: precoAtual } : item)),
        );
      }

      const estoqueAtual = estoquePorProduto.get(produto.id) ?? 0;
      const diferenca = quantidadeAtual - estoqueAtual;
      if (diferenca !== 0) {
        const tipo = diferenca > 0 ? 'Entrada' : 'Saida';
        const quantidade = Math.abs(diferenca);
        const filialId =
          movimentacoes.find((movimentacao) => movimentacao.produtoId === produto.id)?.filialId ??
          movimentacoes[0]?.filialId ??
          pedidos[0]?.filialId ??
          1;
        await apiFetch('/api/MovimentacoesEstoque', {
          method: 'POST',
          body: JSON.stringify({
            produtoId: produto.id,
            filialId,
            tipo,
            quantidade,
          }),
        });

        setMovimentacoes((current) => [...current, { produtoId: produto.id, filialId, tipo, quantidade }]);
      }

      setInventoryMessage({ type: 'success', text: `Estoque de ${produto.nome} salvo com sucesso.` });
    } catch (error) {
      setInventoryMessage({
        type: 'error',
        text: error instanceof Error ? error.message : `Não foi possível salvar ${produto.nome}.`,
      });
    } finally {
      setSavingProductId(null);
    }
  }

  if (loading) {
    return (
      <div className="page-shell">
        <div className="card loading-card">Carregando dados do estoque...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <main className="page-shell">
        <div className="message error" role="alert">
          Não foi possível carregar os dados do estoque: {loadError}
          <button type="button" className="secondary-button" onClick={() => window.location.reload()}>
            Tentar novamente
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-group">
          <div className="brand-mark">E</div>
          <div>
            <p className="brand-label">Dashboard</p>
            <h1>Estoque</h1>
          </div>
        </div>

        <nav className="main-nav" aria-label="Navegação principal">
          <Link href="/">Dashboard</Link>
          {canViewInventory && <Link href="/produtos">Produtos</Link>}
          {canCreateOrders && <Link href="/pedidos">Pedidos</Link>}
          {canViewConferencia && <Link href="/conferencia">Conferência</Link>}
          {canViewFiliais && <Link href="/fornecedores">Filiais</Link>}
          {canViewUsers && <Link href="/usuarios">Usuários</Link>}
          {!sessionUser && <Link href="/login">Login</Link>}
        </nav>

        <div className="header-actions">
          <div className="notification-wrap">
            <button
              type="button"
              className="notification-button"
              onClick={() => setShowNotifications((current) => !current)}
              aria-label={`Notificações, ${unreadNotificationsCount} não lidas`}
            >
              <span className="notification-icon">🔔</span>
              {unreadNotificationsCount > 0 && (
                <span className="notification-badge">{unreadNotificationsCount}</span>
              )}
            </button>

            {showNotifications && (
              <div className="notification-panel">
                <div className="notification-header">
                  <strong>Notificações</strong>
                </div>

                {notificationReadError && (
                  <div className="notification-read-error" role="alert">{notificationReadError}</div>
                )}

                {notifications.length === 0 ? (
                  <div className="notification-empty">Nenhuma notificação no momento.</div>
                ) : (
                  <ul className="notification-list">
                    {notifications.map((notification) => (
                      <li
                        key={notification.id}
                        className={`notification-item ${notification.type}${readNotificationIds.includes(notification.id) ? ' read' : ''}`}
                      >
                        <div className="notification-dot" />
                        <div className="notification-content">
                          <strong>{notification.title}</strong>
                          <span>{notification.text}</span>
                          <small>{notification.time}</small>
                          <button
                            type="button"
                            className="notification-read-button"
                            disabled={readNotificationIds.includes(notification.id)}
                            onClick={() => handleMarcarNotificacaoLida(notification.id)}
                          >
                            {readNotificationIds.includes(notification.id) ? 'Lida' : 'Marcar como lida'}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {sessionUser ? (
            <>
              <span style={{ fontSize: '0.82rem', color: '#42526e', fontWeight: 600 }}>{sessionUser.nome} · {sessionUser.cargo}</span>
              <button
                type="button"
                className="secondary-button"
                onClick={async () => {
                  setLogoutError(null);
                  const session = getSupabaseSession();
                  if (session) {
                    try {
                      await signOutSupabase(session);
                    } catch (error) {
                      setLogoutError(error instanceof Error ? error.message : 'Não foi possível encerrar a sessão.');
                      return;
                    }
                  }
                  clearCurrentUser();
                  window.location.href = '/login';
                }}
              >
                Sair
              </button>
            </>
          ) : (
            <Link href="/login" className="secondary-button link-button">Novo login</Link>
          )}
          {canCreateOrders && <Link href="/pedidos" className="secondary-button link-button">Novo pedido</Link>}
          {canManageProducts && <Link href="/produtos" className="primary-button link-button">Novo produto</Link>}
        </div>
      </header>

      <main className="dashboard">
        {logoutError && <div className="message error" role="alert">{logoutError}</div>}
        <section className="stats-grid">
          <article className="stat-card">
            <span className="stat-label">Total de produtos</span>
            <strong>{totalProdutos}</strong>
            <small>Atualizado agora</small>
          </article>

          <article className="stat-card">
            <span className="stat-label">Valor em estoque</span>
            <strong>{money.format(valorEstoque)}</strong>
            <small>Em valor de venda</small>
          </article>

          <article className="stat-card warning">
            <span className="stat-label">Unidades em estoque</span>
            <strong>{totalUnidades}</strong>
            <small>Saldo calculado pelas movimentações</small>
          </article>

          <article className="stat-card danger">
            <span className="stat-label">Produtos sem estoque</span>
            <strong>{semEstoque}</strong>
            <small>Produtos ativos com saldo zero ou negativo</small>
          </article>
        </section>

        <section className="content-grid">
          <div className="panel table-panel">
            {inventoryMessage && (
              <div className={`message ${inventoryMessage.type}`} role={inventoryMessage.type === 'error' ? 'alert' : 'status'}>
                {inventoryMessage.text}
              </div>
            )}
            <div className="panel-header">
              <div>
                <p className="eyebrow">Acompanhe o estoque</p>
                <h2>Produtos com menor saldo</h2>
              </div>
              <Link href="/produtos" className="ghost-button inline-link">Ver todos</Link>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Produto</th>
                    <th>Qtd</th>
                    <th>Valor estoque</th>
                    <th>Status</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {produtosComMenorEstoque.length === 0 ? (
                    <tr>
                      <td colSpan={6}>Nenhum produto ativo cadastrado.</td>
                    </tr>
                  ) : produtosComMenorEstoque.slice(0, 5).map((produto) => {
                    const estoqueAtual = quantidadeManual[produto.id] ?? (estoquePorProduto.get(produto.id) ?? 0);
                    const valorAtual = precoManual[produto.id] ?? Number(produto.precoVenda || 0);
                    const statusAtual = getProductStatus(estoqueAtual);

                    return (
                      <tr key={produto.id}>
                        <td>{produto.id}</td>
                        <td>{produto.nome}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={estoqueAtual}
                            disabled={!canManageProducts}
                            className="inline-edit-input"
                            onChange={(event) => {
                              const value = Number(event.target.value || 0);
                              setQuantidadeManual((current) => ({
                                ...current,
                                [produto.id]: Number.isFinite(value) ? Math.max(0, value) : 0,
                              }));
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={valorAtual}
                            disabled={!canManageProducts}
                            className="inline-edit-input"
                            onChange={(event) => {
                              const value = Number(event.target.value || 0);
                              const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
                              setPrecoManual((current) => ({
                                ...current,
                                [produto.id]: safeValue,
                              }));
                            }}
                          />
                        </td>
                        <td>
                          <span className={`status-badge ${statusAtual.className}`}>
                            {statusAtual.label}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={!canManageProducts || savingProductId !== null}
                            onClick={() => handleSalvarEstoque(produto)}
                          >
                            {savingProductId === produto.id ? 'Salvando...' : 'Salvar'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Resumo</p>
                <h2>Dados do sistema</h2>
              </div>
            </div>

            <div className="summary-list">
              <div className="summary-item">
                <span>Fornecedores</span>
                <strong>{fornecedores.length}</strong>
              </div>
              {canViewUsers && (
                <div className="summary-item">
                  <span>Usuários</span>
                  <strong>{usuarios.length}</strong>
                </div>
              )}
              <div className="summary-item">
                <span>Produtos ativos</span>
                <strong>{produtos.filter((p) => p.ativo).length}</strong>
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
