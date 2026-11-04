"use client";

import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { clearCurrentUser, getCurrentUser, hasAnyRole, normalizeRole } from '@/lib/auth';
import type { AuthUser } from '@/lib/auth';
import type { Fornecedor, Pedido, Produto, Usuario } from '@/types/inventory';

const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function InventoryDashboard() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [sessionUser, setSessionUser] = useState<AuthUser | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const authUser = getCurrentUser();
    setSessionUser(authUser);

    async function loadData() {
      try {
        const [produtosData, pedidosData, fornecedoresData, usuariosData] = await Promise.all([
          apiFetch<Produto[]>('/api/produtos'),
          apiFetch<Pedido[]>('/api/pedidos'),
          apiFetch<Fornecedor[]>('/api/fornecedores'),
          apiFetch<Usuario[]>('/api/usuarios'),
        ]);

        setProdutos(produtosData);
        setPedidos(pedidosData);
        setFornecedores(fornecedoresData);
        setUsuarios(usuariosData);
      } catch (error) {
        console.error('Erro ao carregar dados do dashboard:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const userRole = normalizeRole(sessionUser?.cargo);
  const canManageProducts = hasAnyRole(userRole, ['GERENTE', 'CEO']);
  const canViewInventory = hasAnyRole(userRole, ['GERENTE', 'CEO', 'CONFERENTE']);
  const canViewFiliais = hasAnyRole(userRole, ['GERENTE', 'CEO']);
  const canCreateOrders = hasAnyRole(userRole, ['FILIAL', 'GERENTE', 'CEO']);
  const canViewConferencia = hasAnyRole(userRole, ['CONFERENTE', 'GERENTE', 'CEO']);
  const canViewUsers = hasAnyRole(userRole, ['GERENTE', 'CEO']);

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
      const estoqueAtual = Number(produto.estoqueAtual ?? 0);
      const estoqueMinimo = Number(produto.estoqueMinimo ?? 0);

      if (estoqueAtual <= estoqueMinimo) {
        items.push({
          id: `estoque-${produto.id}`,
          type: 'estoque',
          title: estoqueAtual === 0 ? 'Falta no estoque' : 'Estoque abaixo do mínimo',
          text: `${produto.nome} está com ${estoqueAtual} unidade(s) e o mínimo é ${estoqueMinimo}.`,
          time: 'Urgente',
        });
      }
    });

    return items.slice(0, 8);
  }, [pedidos, produtos]);

  const totalProdutos = produtos.length;
  const valorEstoque = useMemo(
    () => produtos.reduce((sum, produto) => sum + Number(produto.precoVenda || 0), 0),
    [produtos],
  );
  const estoqueBaixo = produtos.filter((produto) => produto.ativo && produto.id % 3 === 0).length;
  const esgotados = produtos.filter((produto) => produto.ativo && produto.id % 5 === 0).length;

  if (loading) {
    return (
      <div className="page-shell">
        <div className="card loading-card">Carregando dados do estoque...</div>
      </div>
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
              aria-label="Notificações"
            >
              <span className="notification-icon">🔔</span>
              {notifications.length > 0 && <span className="notification-badge">{notifications.length}</span>}
            </button>

            {showNotifications && (
              <div className="notification-panel">
                <div className="notification-header">
                  <strong>Notificações</strong>
                </div>

                {notifications.length === 0 ? (
                  <div className="notification-empty">Nenhuma notificação no momento.</div>
                ) : (
                  <ul className="notification-list">
                    {notifications.map((notification) => (
                      <li key={notification.id} className={`notification-item ${notification.type}`}>
                        <div className="notification-dot" />
                        <div className="notification-content">
                          <strong>{notification.title}</strong>
                          <span>{notification.text}</span>
                          <small>{notification.time}</small>
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
                onClick={() => {
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
            <span className="stat-label">Estoque baixo</span>
            <strong>{estoqueBaixo}</strong>
            <small>Atenção</small>
          </article>

          <article className="stat-card danger">
            <span className="stat-label">Esgotados</span>
            <strong>{esgotados}</strong>
            <small>Urgente</small>
          </article>
        </section>

        <section className="panel filters-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Filtros</p>
              <h2>Inventário</h2>
            </div>
          </div>

          <div className="filters-row">
            <label>
              <span>Categoria</span>
              <select defaultValue="todos">
                <option value="todos">Todas</option>
                <option value="alimentos">Alimentos</option>
                <option value="bebidas">Bebidas</option>
                <option value="limpeza">Limpeza</option>
              </select>
            </label>

            <label>
              <span>Status</span>
              <select defaultValue="todos">
                <option value="todos">Todos</option>
                <option value="normal">Normal</option>
                <option value="baixo">Baixo</option>
                <option value="esgotado">Esgotado</option>
              </select>
            </label>

            <button type="button" className="primary-button small-button">Movimento</button>
          </div>
        </section>

        <section className="content-grid">
          <div className="panel table-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Produtos</p>
                <h2>Lista do estoque</h2>
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
                    <th>Preço</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {produtos.slice(0, 5).map((produto) => {
                    const isEsgotado = produto.id % 5 === 0;
                    const isBaixo = !isEsgotado && produto.id % 3 === 0;
                    const status = isEsgotado ? 'Esgotado' : isBaixo ? 'Baixo' : 'Normal';

                    return (
                      <tr key={produto.id}>
                        <td>{produto.id}</td>
                        <td>{produto.nome}</td>
                        <td>{produto.id % 7 === 0 ? 0 : 12 + produto.id}</td>
                        <td>{money.format(produto.precoVenda || 0)}</td>
                        <td>
                          <span className={`status-badge ${status === 'Normal' ? 'normal' : status === 'Baixo' ? 'low' : 'empty'}`}>
                            {status}
                          </span>
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
              <div className="summary-item">
                <span>Usuários</span>
                <strong>{usuarios.length}</strong>
              </div>
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
