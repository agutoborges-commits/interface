"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import BarcodeScannerInput from '@/components/barcode/BarcodeScannerInput';
import { apiFetch } from '@/lib/api';
import { getCurrentUser, hasAnyRole, normalizeRole } from '@/lib/auth';
import type { Pedido, Produto } from '@/types/inventory';

export default function ConferenciaPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [quantidades, setQuantidades] = useState<Record<number, { pedida: number; enviada: number }>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [codigoLeitura, setCodigoLeitura] = useState('');
  const [quantidadePorLeitura, setQuantidadePorLeitura] = useState<number>(1);
  const [pedidoSelecionadoId, setPedidoSelecionadoId] = useState<number | null>(null);

  async function loadPedidos() {
    try {
      const [pedidosData, produtosData] = await Promise.all([
        apiFetch<Pedido[]>('/api/pedidos'),
        apiFetch<Produto[]>('/api/produtos'),
      ]);

      setPedidos(pedidosData);
      setProdutos(produtosData);

      const valoresIniciais: Record<number, { pedida: number; enviada: number }> = {};
      pedidosData.forEach((pedido, index) => {
        const pedidaBase = 8 + ((pedido.id + index) % 9) * 3;
        valoresIniciais[pedido.id] = {
          pedida: pedidaBase,
          enviada: pedidaBase + (pedido.id % 3 === 0 ? Math.ceil(pedidaBase * 0.35) : 0),
        };
      });

      setQuantidades((current) => ({ ...current, ...valoresIniciais }));
    } catch (error) {
      console.error('Erro ao carregar pedidos para conferência:', error);
      setMessage({
        type: 'error',
        text: 'Não foi possível carregar os pedidos para conferência.',
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
  const isAutorizado = !!usuarioAtual && hasAnyRole(normalizeRole(usuarioAtual.cargo), ['CONFERENTE', 'GERENTE', 'CEO']);

  if (!isAutorizado) {
    return (
      <main className="page-shell">
        <div className="page-header">
          <h1>Conferência</h1>
          <Link href="/" className="secondary-button link-button">Voltar ao dashboard</Link>
        </div>
        <div className="message error">
          Acesso restrito. Apenas conferentes, gerentes ou CEO podem acessar a conferência.
        </div>
      </main>
    );
  }

  const pedidosRecebidos = pedidos.length;
  const pedidosParaConferencia = useMemo(
    () => pedidos.filter((pedido) => pedido.status === 'EmConferencia' || pedido.status === 'Conferido').length,
    [pedidos],
  );
  const pedidosPendentes = useMemo(
    () => pedidos.filter((pedido) => pedido.status !== 'Conferido'),
    [pedidos],
  );
  const pedidosComExcesso = useMemo(
    () => pedidos.filter((pedido) => {
      const registro = quantidades[pedido.id] ?? { pedida: 0, enviada: 0 };
      return registro.enviada > registro.pedida * 1.2;
    }).length,
    [pedidos, quantidades],
  );
  const pedidoSelecionado = useMemo(
    () => pedidosPendentes.find((pedido) => pedido.id === pedidoSelecionadoId) ?? pedidosPendentes[0] ?? null,
    [pedidosPendentes, pedidoSelecionadoId],
  );

  useEffect(() => {
    if (pedidoSelecionado && !pedidoSelecionadoId) {
      setPedidoSelecionadoId(pedidoSelecionado.id);
    }
  }, [pedidoSelecionado, pedidoSelecionadoId]);

  function handleQuantidadeChange(pedidoId: number, field: 'pedida' | 'enviada', value: string) {
    const numero = Number(value) || 0;

    setQuantidades((current) => ({
      ...current,
      [pedidoId]: {
        pedida: field === 'pedida' ? numero : current[pedidoId]?.pedida ?? 0,
        enviada: field === 'enviada' ? numero : current[pedidoId]?.enviada ?? 0,
      },
    }));
  }

  function handleScannerScan(codigo: string) {
    const codigoLimpo = codigo.trim();
    if (!codigoLimpo) {
      setMessage({
        type: 'error',
        text: 'Código vazio. Escaneie novamente.',
      });
      return;
    }

    if (!pedidoSelecionado) {
      setMessage({
        type: 'error',
        text: 'Selecione um pedido antes de escanear o produto.',
      });
      return;
    }

    const quantidadePorEscaneamento = Math.max(1, Number(quantidadePorLeitura) || 1);
    const produtoEncontrado = produtos.find((produto) => {
      const codigoProduto = produto.codigoBarras?.trim();
      if (!codigoProduto) return false;
      return codigoProduto === codigoLimpo || codigoProduto.replace(/\D/g, '') === codigoLimpo.replace(/\D/g, '');
    });

    if (!produtoEncontrado) {
      setMessage({
        type: 'error',
        text: `Código de barras não cadastrado: ${codigoLimpo}`,
      });
      setCodigoLeitura(codigoLimpo);
      return;
    }

    const pedidoComProduto = pedidoSelecionado.observacao?.toLowerCase().includes((produtoEncontrado.nome ?? '').toLowerCase());
    if (!pedidoComProduto) {
      setMessage({
        type: 'error',
        text: `O produto ${produtoEncontrado.nome} não pertence ao pedido ${pedidoSelecionado.numeroPedido}.`,
      });
      setCodigoLeitura(codigoLimpo);
      return;
    }

    const registroAtual = quantidades[pedidoSelecionado.id] ?? { pedida: 0, enviada: 0 };
    const pedida = Math.max(registroAtual.pedida, 0);
    const quantidadeAtual = Math.max(registroAtual.enviada, 0);
    const novaQuantidadeEnviada = Math.min(quantidadeAtual + quantidadePorEscaneamento, pedida || Number.MAX_SAFE_INTEGER);

    setQuantidades((current) => ({
      ...current,
      [pedidoSelecionado.id]: {
        pedida,
        enviada: novaQuantidadeEnviada,
      },
    }));

    setCodigoLeitura(codigoLimpo);

    if (novaQuantidadeEnviada >= pedida && pedida > 0) {
      setPedidos((current) =>
        current.map((item) =>
          item.id === pedidoSelecionado.id ? { ...item, status: 'Conferido' } : item,
        ),
      );
      setMessage({
        type: 'success',
        text: `Quantidade concluída para ${produtoEncontrado.nome}. Pedido ${pedidoSelecionado.numeroPedido} conferido.`,
      });
      return;
    }

    setMessage({
      type: 'success',
      text: `${produtoEncontrado.nome} conferido. ${novaQuantidadeEnviada}/${pedida} unidades.`,
    });
  }

  async function handleConferir(pedido: Pedido) {
    const registroAtual = quantidades[pedido.id] ?? { pedida: 0, enviada: 0 };
    const quantidadeEnviada = Math.max(0, Number(registroAtual.enviada) || 0);

    setPedidos((current) =>
      current.map((item) =>
        item.id === pedido.id ? { ...item, status: 'Conferido' } : item,
      ),
    );

    try {
      if (quantidadeEnviada > 0) {
        await apiFetch('/api/MovimentacoesEstoque', {
          method: 'POST',
          body: JSON.stringify({
            produtoId: pedido.id,
            filialId: pedido.filialId,
            tipo: 'Entrada',
            quantidade: quantidadeEnviada,
          }),
        });
      }

      setMessage({
        type: 'success',
        text: `Pedido ${pedido.numeroPedido} enviado para conferência concluída. Estoque atualizado em ${quantidadeEnviada} unidade(s).`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro ao registrar a entrada no estoque.',
      });
    }
  }

  return (
    <main className="page-shell">
      <div className="page-header">
        <h1>Conferência</h1>
        <div className="header-actions">
          <Link href="/" className="secondary-button link-button">Voltar ao dashboard</Link>
          <Link href="/pedidos" className="primary-button link-button">Pedidos</Link>
        </div>
      </div>

      {message && <div className={`message ${message.type}`}>{message.text}</div>}

      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="panel-header">
          <div>
            <p className="eyebrow">Leitor</p>
            <h2>Conferência por scanner</h2>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: '16px', alignItems: 'end' }}>
          <label className="form-field full-width" style={{ marginTop: '8px' }}>
            <span>Código do pedido / scanner</span>
            <BarcodeScannerInput
              type="text"
              value={codigoLeitura}
              onChange={(value) => setCodigoLeitura(value)}
              onScan={handleScannerScan}
              placeholder="Escaneie o código do produto ou digite o número"
              autoFocus
            />
          </label>

          <label className="form-field full-width" style={{ marginTop: '8px' }}>
            <span>Quantidade por leitura</span>
            <input
              type="number"
              min="1"
              value={quantidadePorLeitura}
              onChange={(event) => setQuantidadePorLeitura(Math.max(1, Number(event.target.value) || 1))}
            />
          </label>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="panel-header">
          <div>
            <p className="eyebrow">Pendentes</p>
            <h2>Pedidos aguardando conferência</h2>
          </div>
        </div>

        <div className="stacked-list" style={{ display: 'grid', gap: '12px' }}>
          {pedidosPendentes.length === 0 ? (
            <div className="loading-card">Nenhum pedido pendente.</div>
          ) : (
            pedidosPendentes.map((pedido) => (
              <button
                key={pedido.id}
                type="button"
                onClick={() => setPedidoSelecionadoId(pedido.id)}
                className="secondary-button"
                style={{
                  width: '100%',
                  justifyContent: 'space-between',
                  textAlign: 'left',
                  padding: '14px 16px',
                  display: 'flex',
                  border: pedido.id === pedidoSelecionado?.id ? '2px solid #4f8ef7' : '1px solid #d7e4f5',
                  background: pedido.id === pedidoSelecionado?.id ? '#eef6ff' : '#fff',
                }}
              >
                <span>
                  <strong>{pedido.numeroPedido}</strong>
                </span>
                <span>{pedido.filialId}</span>
                <span>{pedido.dataPedido ? new Date(pedido.dataPedido).toLocaleString('pt-BR') : '—'}</span>
                <span>{pedido.status || 'Aberto'}</span>
              </button>
            ))
          )}
        </div>
      </div>

      <section className="stats-grid" style={{ marginBottom: '24px' }}>
        <article className="stat-card">
          <span className="stat-label">Pedidos recebidos</span>
          <strong>{pedidosRecebidos}</strong>
          <small>Total no sistema</small>
        </article>

        <article className="stat-card warning">
          <span className="stat-label">Enviados para conferência</span>
          <strong>{pedidosParaConferencia}</strong>
          <small>Já encaminhados</small>
        </article>

        <article className="stat-card danger">
          <span className="stat-label">Pendentes</span>
          <strong>{pedidosPendentes.length}</strong>
          <small>Aguardando envio</small>
        </article>

        <article className="stat-card danger">
          <span className="stat-label">Com excesso</span>
          <strong>{pedidosComExcesso}</strong>
          <small>Acima do pedido</small>
        </article>
      </section>

      <div className="card">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Fluxo</p>
            <h2>Conferência do pedido selecionado</h2>
          </div>
        </div>

        {loading ? (
          <div className="loading-card">Carregando conferência...</div>
        ) : !pedidoSelecionado ? (
          <div className="loading-card">Selecione um pedido pendente para conferir.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Pedido</th>
                  <th>Filial</th>
                  <th>Status</th>
                  <th>Data</th>
                  <th>Observação</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                <tr key={pedidoSelecionado.id} className={pedidoSelecionado.status === 'Conferido' ? 'row-alert' : ''}>
                  <td>{pedidoSelecionado.id}</td>
                  <td>{pedidoSelecionado.numeroPedido}</td>
                  <td>{pedidoSelecionado.filialId}</td>
                  <td>
                    <span className={`status-badge ${pedidoSelecionado.status === 'Conferido' ? 'normal' : pedidoSelecionado.status === 'EmConferencia' ? 'low' : 'empty'}`}>
                      {pedidoSelecionado.status || 'Aberto'}
                    </span>
                  </td>
                  <td>{pedidoSelecionado.dataPedido ? new Date(pedidoSelecionado.dataPedido).toLocaleString('pt-BR') : '—'}</td>
                  <td>
                    <div className="stacked-cell">
                      <span>{pedidoSelecionado.observacao || '—'}</span>
                      {((quantidades[pedidoSelecionado.id]?.enviada ?? 0) > (quantidades[pedidoSelecionado.id]?.pedida ?? 0) * 1.2) && (
                        <strong className="alert-text">Alerta: quantidade enviada acima do pedido</strong>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="quantity-stack">
                      <label className="mini-field">
                        <span>Pedida</span>
                        <input
                          type="number"
                          min="0"
                          value={quantidades[pedidoSelecionado.id]?.pedida ?? 0}
                          onChange={(event) => handleQuantidadeChange(pedidoSelecionado.id, 'pedida', event.target.value)}
                        />
                      </label>
                      <label className="mini-field">
                        <span>Enviada</span>
                        <input
                          type="number"
                          min="0"
                          value={quantidades[pedidoSelecionado.id]?.enviada ?? 0}
                          onChange={(event) => handleQuantidadeChange(pedidoSelecionado.id, 'enviada', event.target.value)}
                        />
                      </label>
                      <div className="inline-actions" style={{ marginTop: '8px' }}>
                        <button type="button" onClick={() => handleConferir(pedidoSelecionado)}>
                          {pedidoSelecionado.status === 'Conferido' ? 'Conferido' : 'Conferir'}
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
