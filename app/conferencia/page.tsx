"use client";

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { apiFetch } from '@/lib/api';
import { getCurrentUser, hasAnyRole, normalizeRole } from '@/lib/auth';
import type { Pedido } from '@/types/inventory';

export default function ConferenciaPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [quantidades, setQuantidades] = useState<Record<number, { pedida: number; enviada: number }>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [codigoLeitura, setCodigoLeitura] = useState('');
  const scannerBufferRef = useRef('');
  const scannerTimestampRef = useRef<number | null>(null);

  async function loadPedidos() {
    try {
      const data = await apiFetch<Pedido[]>('/api/pedidos');
      setPedidos(data);

      const valoresIniciais: Record<number, { pedida: number; enviada: number }> = {};
      data.forEach((pedido, index) => {
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
    () => pedidos.filter((pedido) => pedido.status !== 'EmConferencia' && pedido.status !== 'Conferido').length,
    [pedidos],
  );
  const pedidosComExcesso = useMemo(
    () => pedidos.filter((pedido) => {
      const registro = quantidades[pedido.id] ?? { pedida: 0, enviada: 0 };
      return registro.enviada > registro.pedida * 1.2;
    }).length,
    [pedidos, quantidades],
  );

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

  function handleScannerKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      const codigo = scannerBufferRef.current.trim();

      if (codigo) {
        const pedidoEncontrado = pedidos.find((pedido) => {
          const codigoPedido = pedido.numeroPedido.replace(/\D/g, '');
          const codigoId = String(pedido.id);
          const codigoNormalizado = codigo.replace(/\D/g, '');

          return codigoPedido === codigoNormalizado || codigoId === codigo || codigo === pedido.numeroPedido;
        });

        if (pedidoEncontrado) {
          setCodigoLeitura(pedidoEncontrado.numeroPedido);
          handleConferir(pedidoEncontrado);
        } else {
          setMessage({
            type: 'error',
            text: `Pedido não encontrado para o código lido: ${codigo}`,
          });
        }
      }

      scannerBufferRef.current = '';
      scannerTimestampRef.current = null;
      setCodigoLeitura('');
      event.preventDefault();
      return;
    }

    if (event.key.length !== 1 || event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }

    const now = Date.now();

    if (!scannerTimestampRef.current || now - scannerTimestampRef.current > 50) {
      scannerBufferRef.current = '';
    }

    scannerTimestampRef.current = now;
    scannerBufferRef.current += event.key;
  }

  function handleConferir(pedido: Pedido) {
    setPedidos((current) =>
      current.map((item) =>
        item.id === pedido.id ? { ...item, status: 'Conferido' } : item,
      ),
    );
    setMessage({
      type: 'success',
      text: `Pedido ${pedido.numeroPedido} enviado para conferência concluída.`,
    });
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

        <label className="form-field full-width" style={{ marginTop: '8px' }}>
          <span>Código do pedido / scanner</span>
          <input
            type="text"
            value={codigoLeitura}
            onKeyDown={handleScannerKeyDown}
            onChange={(event) => setCodigoLeitura(event.target.value)}
            placeholder="Escaneie o código do pedido ou digite o número"
            autoFocus
          />
        </label>
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
          <strong>{pedidosPendentes}</strong>
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
            <h2>Pedidos em conferência</h2>
          </div>
        </div>

        {loading ? (
          <div className="loading-card">Carregando conferência...</div>
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
                {pedidos.map((pedido) => {
                  const status = pedido.status || 'Aberto';
                  const statusClass = status === 'Conferido' ? 'normal' : status === 'EmConferencia' ? 'low' : 'empty';
                  const registroAtual = quantidades[pedido.id] ?? { pedida: 0, enviada: 0 };
                  const pedidoExcedido = registroAtual.enviada > registroAtual.pedida * 1.2;

                  return (
                    <tr key={pedido.id} className={pedidoExcedido ? 'row-alert' : ''}>
                      <td>{pedido.id}</td>
                      <td>{pedido.numeroPedido}</td>
                      <td>{pedido.filialId}</td>
                      <td>
                        <span className={`status-badge ${statusClass}`}>{status}</span>
                      </td>
                      <td>{pedido.dataPedido ? new Date(pedido.dataPedido).toLocaleString('pt-BR') : '—'}</td>
                      <td>
                        <div className="stacked-cell">
                          <span>{pedido.observacao || '—'}</span>
                          {pedidoExcedido && (
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
                              value={registroAtual.pedida}
                              onChange={(event) => handleQuantidadeChange(pedido.id, 'pedida', event.target.value)}
                            />
                          </label>
                          <label className="mini-field">
                            <span>Enviada</span>
                            <input
                              type="number"
                              min="0"
                              value={registroAtual.enviada}
                              onChange={(event) => handleQuantidadeChange(pedido.id, 'enviada', event.target.value)}
                            />
                          </label>
                          <div className="inline-actions" style={{ marginTop: '8px' }}>
                            <button type="button" onClick={() => handleConferir(pedido)}>
                              {status === 'Conferido' ? 'Conferido' : 'Conferir'}
                            </button>
                          </div>
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
