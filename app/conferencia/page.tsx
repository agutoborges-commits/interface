"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import BarcodeScannerInput from '@/components/barcode/BarcodeScannerInput';
import { apiFetch } from '@/lib/api';
import { getCurrentUser, hasAnyRole, normalizeRole } from '@/lib/auth';
import { parseOrderItems, type PedidoItemDetalhado } from '@/lib/order-items';
import type { Pedido, Produto } from '@/types/inventory';

type RegistroConferencia = {
  pedidoId: number;
  produtoId: number;
  quantidadeRecebida: number;
  quantidadeEsperada: number;
  status: string;
  dataConferencia?: string | null;
};

function getRegistroItem(registros: RegistroConferencia[], produtoId: number) {
  return registros.find((registro) => registro.produtoId === produtoId) ?? null;
}

export default function ConferenciaPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [conferenciasPorPedido, setConferenciasPorPedido] = useState<Record<number, RegistroConferencia[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadingConferencia, setLoadingConferencia] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [conferenciaLoadError, setConferenciaLoadError] = useState<string | null>(null);
  const [codigoLeitura, setCodigoLeitura] = useState('');
  const [quantidadePorLeitura, setQuantidadePorLeitura] = useState(1);
  const [quantidadeRecebida, setQuantidadeRecebida] = useState('0');
  const [pedidoSelecionadoId, setPedidoSelecionadoId] = useState<number | null>(null);
  const [removingPedidoId, setRemovingPedidoId] = useState<number | null>(null);

  async function loadPedidos() {
    try {
      const [pedidosData, produtosData] = await Promise.all([
        apiFetch<Pedido[]>('/api/pedidos'),
        apiFetch<Produto[]>('/api/produtos'),
      ]);

      setPedidos(pedidosData);
      setProdutos(produtosData);
      const pedidoSolicitadoId = Number(new URLSearchParams(window.location.search).get('pedidoId'));
      if (
        Number.isSafeInteger(pedidoSolicitadoId)
        && pedidosData.some((pedido) => pedido.id === pedidoSolicitadoId
          && pedido.status !== 'Confirmado'
          && pedido.status !== 'Cancelado')
      ) {
        setPedidoSelecionadoId(pedidoSolicitadoId);
      }
    } catch (error) {
      console.error('Erro ao carregar pedidos para conferência:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível carregar os pedidos para conferência.',
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
    if (!hasAnyRole(normalizeRole(currentUser.cargo), ['CONFERENTE', 'GERENTE', 'CEO'])) {
      setLoading(false);
      return;
    }
    loadPedidos();
  }, []);

  const usuarioAtual = getCurrentUser();
  const isAutorizado = !!usuarioAtual && hasAnyRole(normalizeRole(usuarioAtual.cargo), ['CONFERENTE', 'GERENTE', 'CEO']);

  const pedidosPendentes = useMemo(
    () => pedidos.filter((pedido) => pedido.status !== 'Confirmado' && pedido.status !== 'Cancelado'),
    [pedidos],
  );
  const pedidoSelecionado = useMemo(
    () => pedidosPendentes.find((pedido) => pedido.id === pedidoSelecionadoId) ?? null,
    [pedidosPendentes, pedidoSelecionadoId],
  );
  const itensDoPedido = useMemo(
    () => pedidoSelecionado ? parseOrderItems(pedidoSelecionado.observacao, produtos) : [],
    [pedidoSelecionado, produtos],
  );
  const conferenciasDoPedido = pedidoSelecionado
    ? conferenciasPorPedido[pedidoSelecionado.id] ?? []
    : [];
  const itemAtual = useMemo(
    () => itensDoPedido.find((item) => !getRegistroItem(conferenciasDoPedido, item.produtoId)) ?? null,
    [conferenciasDoPedido, itensDoPedido],
  );
  const quantidadeItensConferidos = itensDoPedido.filter(
    (item) => getRegistroItem(conferenciasDoPedido, item.produtoId),
  ).length;
  const excessosNoPedidoSelecionado = conferenciasDoPedido.filter(
    (registro) => registro.quantidadeRecebida > registro.quantidadeEsperada,
  ).length;
  const pedidosParaConferencia = useMemo(
    () => pedidos.filter((pedido) => pedido.status === 'EmConferencia').length,
    [pedidos],
  );

  useEffect(() => {
    if (pedidosPendentes.length === 0) {
      setPedidoSelecionadoId(null);
      return;
    }

    if (!pedidoSelecionadoId || !pedidosPendentes.some((pedido) => pedido.id === pedidoSelecionadoId)) {
      setPedidoSelecionadoId(pedidosPendentes[0].id);
    }
  }, [pedidoSelecionadoId, pedidosPendentes]);

  useEffect(() => {
    if (pedidoSelecionadoId === null) {
      setLoadingConferencia(false);
      setConferenciaLoadError(null);
      return;
    }

    let active = true;
    setLoadingConferencia(true);
    setConferenciaLoadError(null);

    apiFetch<RegistroConferencia[]>(`/api/pedidos/${pedidoSelecionadoId}/conferencia`)
      .then((registros) => {
        if (active) {
          setConferenciasPorPedido((current) => ({
            ...current,
            [pedidoSelecionadoId]: registros,
          }));
        }
      })
      .catch((error: unknown) => {
        if (active) {
          const errorMessage = error instanceof Error ? error.message : 'Não foi possível carregar o progresso da conferência.';
          setConferenciaLoadError(errorMessage);
          setMessage({ type: 'error', text: errorMessage });
        }
      })
      .finally(() => {
        if (active) setLoadingConferencia(false);
      });

    return () => {
      active = false;
    };
  }, [pedidoSelecionadoId]);

  useEffect(() => {
    setCodigoLeitura('');
    setQuantidadeRecebida('0');
  }, [itemAtual?.produtoId, pedidoSelecionadoId]);

  function handleScannerScan(codigo: string) {
    const codigoLimpo = codigo.trim();
    if (!codigoLimpo) {
      setMessage({ type: 'error', text: 'Código vazio. Escaneie novamente.' });
      return;
    }

    if (!pedidoSelecionado || !itemAtual) {
      setMessage({ type: 'error', text: 'Selecione um pedido e um item pendente antes de escanear.' });
      return;
    }

    const produtoLido = produtos.find((produto) => {
      const codigoProduto = produto.codigoBarras?.trim();
      if (!codigoProduto) return false;
      return codigoProduto === codigoLimpo
        || codigoProduto.replace(/\D/g, '') === codigoLimpo.replace(/\D/g, '');
    });

    if (!produtoLido) {
      setMessage({ type: 'error', text: `Código de barras não cadastrado: ${codigoLimpo}` });
      return;
    }

    if (produtoLido.id !== itemAtual.produtoId) {
      setMessage({
        type: 'error',
        text: `Agora confira ${itemAtual.nome}. O código lido corresponde a ${produtoLido.nome}.`,
      });
      setCodigoLeitura('');
      return;
    }

    const quantidadeAtual = Number(quantidadeRecebida) || 0;
    const quantidadeLida = Math.max(1, Math.trunc(quantidadePorLeitura));
    const novaQuantidade = quantidadeAtual + quantidadeLida;
    setQuantidadeRecebida(String(novaQuantidade));
    setCodigoLeitura('');
    setMessage({
      type: novaQuantidade > itemAtual.quantidade ? 'error' : 'success',
      text: `${produtoLido.nome}: ${novaQuantidade} de ${itemAtual.quantidade} unidade(s) conferida(s).`,
    });
  }

  async function handleFinalizarPedido(
    pedido: Pedido,
    itens: PedidoItemDetalhado[],
    registros = conferenciasPorPedido[pedido.id] ?? [],
  ) {
    if (itens.length === 0 || !itens.every((item) => getRegistroItem(registros, item.produtoId))) {
      setMessage({ type: 'error', text: 'Confira todos os itens antes de finalizar o pedido.' });
      return;
    }

    setFinalizando(true);
    setMessage(null);

    try {
      const pedidoAtualizado = await apiFetch<Pedido>(`/api/pedidos/${pedido.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'Confirmado' }),
      });
      setPedidos((current) => current.map((item) => item.id === pedido.id ? pedidoAtualizado : item));
      setMessage({ type: 'success', text: `Pedido ${pedido.numeroPedido} conferido e finalizado.` });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível finalizar o pedido.',
      });
    } finally {
      setFinalizando(false);
    }
  }

  async function handleConfirmarItem() {
    if (!pedidoSelecionado || !itemAtual) return;

    const quantidade = Number(quantidadeRecebida);
    if (quantidadeRecebida.trim() === '' || !Number.isSafeInteger(quantidade) || quantidade < 0) {
      setMessage({ type: 'error', text: 'Informe uma quantidade inteira igual ou maior que zero.' });
      return;
    }

    if (quantidade < itemAtual.quantidade) {
      setMessage({
        type: 'error',
        text: `Quantidade insuficiente para ${itemAtual.nome}. Recebido ${quantidade} de ${itemAtual.quantidade} solicitado(s).`,
      });
      return;
    }

    setSavingItem(true);
    setMessage(null);

    try {
      if (pedidoSelecionado.status === 'Aberto') {
        const pedidoEmConferencia = await apiFetch<Pedido>(`/api/pedidos/${pedidoSelecionado.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'EmConferencia' }),
        });
        setPedidos((current) => current.map((pedido) =>
          pedido.id === pedidoSelecionado.id ? pedidoEmConferencia : pedido,
        ));
      }

      const rotaConferencia = `/api/pedidos/${pedidoSelecionado.id}/conferencia`;
      const dadosConferencia = {
        produtoId: itemAtual.produtoId,
        quantidadeRecebida: quantidade,
        observacao: `Conferência individual de ${itemAtual.nome}.`,
      };

      try {
        await apiFetch<void>(rotaConferencia, {
          method: 'POST',
          body: JSON.stringify(dadosConferencia),
        });
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes('Produto não está no pedido.')) {
          throw error;
        }

        const produto = produtos.find((item) => item.id === itemAtual.produtoId);
        if (!produto) throw new Error(`O produto ${itemAtual.nome} não foi encontrado no cadastro.`);

        try {
          const pedidoComItem = await apiFetch<Pedido>(`/api/pedidos/${pedidoSelecionado.id}/itens`, {
            method: 'POST',
            body: JSON.stringify({
              produtoId: itemAtual.produtoId,
              quantidade: itemAtual.quantidade,
              precoUnitario: Number(produto.precoVenda || 0),
            }),
          });
          setPedidos((current) => current.map((pedido) =>
            pedido.id === pedidoSelecionado.id ? pedidoComItem : pedido,
          ));
        } catch (adicionarItemError) {
          const detalhe = adicionarItemError instanceof Error ? adicionarItemError.message : 'Erro inesperado.';
          throw new Error(`Este pedido antigo precisa ter os itens registrados antes da conferência. Não foi possível preparar ${itemAtual.nome}: ${detalhe}`);
        }

        await apiFetch<void>(rotaConferencia, {
          method: 'POST',
          body: JSON.stringify(dadosConferencia),
        });
      }

      const novoRegistro: RegistroConferencia = {
        pedidoId: pedidoSelecionado.id,
        produtoId: itemAtual.produtoId,
        quantidadeRecebida: quantidade,
        quantidadeEsperada: itemAtual.quantidade,
        status: quantidade === itemAtual.quantidade ? 'Conferido' : 'Parcial',
      };
      const registrosAtualizados = [...conferenciasDoPedido, novoRegistro];
      setConferenciasPorPedido((current) => ({
        ...current,
        [pedidoSelecionado.id]: registrosAtualizados,
      }));

      if (quantidade > 0) {
        try {
          await apiFetch('/api/MovimentacoesEstoque', {
            method: 'POST',
            body: JSON.stringify({
              produtoId: itemAtual.produtoId,
              filialId: pedidoSelecionado.filialId,
              tipo: 'Saida',
              quantidade,
              observacao: `Conferência do pedido ${pedidoSelecionado.numeroPedido}: ${itemAtual.nome}`,
            }),
          });
        } catch (error) {
          setMessage({
            type: 'error',
            text: `A conferência de ${itemAtual.nome} foi registrada, mas o estoque não foi atualizado: ${error instanceof Error ? error.message : 'Erro inesperado.'}`,
          });
          return;
        }
      }

      const todosConferidosDepoisDeste = itensDoPedido.every((item) =>
        getRegistroItem(registrosAtualizados, item.produtoId),
      );

      if (todosConferidosDepoisDeste) {
        await handleFinalizarPedido(pedidoSelecionado, itensDoPedido, registrosAtualizados);
      } else {
        const proximoItem = itensDoPedido.find((item) => !getRegistroItem(registrosAtualizados, item.produtoId));
        setMessage({
          type: 'success',
          text: `${itemAtual.nome} registrado. Próximo item: ${proximoItem?.nome ?? 'conferência finalizada'}.`,
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : `Não foi possível registrar a conferência de ${itemAtual.nome}.`,
      });
    } finally {
      setSavingItem(false);
    }
  }

  async function handleRemoverPedido(pedido: Pedido) {
    const confirmado = window.confirm(`Deseja remover o pedido ${pedido.numeroPedido} da fila de conferência?`);
    if (!confirmado) return;

    setRemovingPedidoId(pedido.id);
    setMessage(null);

    try {
      try {
        await apiFetch<void>(`/api/pedidos/${pedido.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'Cancelado' }),
        });
      } catch {
        await apiFetch<void>(`/api/pedidos/${pedido.id}`, { method: 'DELETE' });
      }

      setPedidos((current) => current.filter((item) => item.id !== pedido.id));
      setConferenciasPorPedido((current) => {
        const next = { ...current };
        delete next[pedido.id];
        return next;
      });
      setMessage({ type: 'success', text: `Pedido ${pedido.numeroPedido} removido da conferência.` });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : `Não foi possível remover o pedido ${pedido.numeroPedido}.`,
      });
    } finally {
      setRemovingPedidoId(null);
    }
  }

  if (!isAutorizado) {
    return (
      <main className="page-shell">
        <div className="page-header">
          <h1>Conferência</h1>
          <Link href="/" className="secondary-button link-button">Voltar</Link>
        </div>
        <div className="message error">
          Acesso restrito. Apenas conferentes, gerentes ou CEO podem acessar a conferência.
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="page-header">
        <h1>Conferência</h1>
        <div className="header-actions">
          <Link href="/pedidos" className="secondary-button link-button">Pedidos</Link>
          <Link href="/produtos" className="primary-button link-button">Produtos</Link>
        </div>
      </div>

      {message && <div className={`message ${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</div>}

      <div className="card conference-orders-card">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Fila de conferência</p>
            <h2>Selecione um pedido</h2>
          </div>
        </div>

        {loading ? (
          <div className="loading-card">Carregando pedidos...</div>
        ) : pedidosPendentes.length === 0 ? (
          <div className="loading-card">Nenhum pedido aguardando conferência.</div>
        ) : (
          <div className="conference-order-list">
            {pedidosPendentes.map((pedido) => {
              const itens = parseOrderItems(pedido.observacao, produtos);
              const registros = conferenciasPorPedido[pedido.id];
              const itensConferidos = registros
                ? itens.filter((item) => getRegistroItem(registros, item.produtoId)).length
                : null;

              return (
                <button
                  key={pedido.id}
                  type="button"
                  className={`conference-order-option${pedido.id === pedidoSelecionadoId ? ' selected' : ''}`}
                  aria-pressed={pedido.id === pedidoSelecionadoId}
                  onClick={() => {
                    setPedidoSelecionadoId(pedido.id);
                    setMessage(null);
                  }}
                >
                  <span>
                    <strong>{pedido.numeroPedido}</strong>
                    <small>
                      {itens.length} produto(s) · {itensConferidos === null ? 'selecione para ver o progresso' : `${itensConferidos}/${itens.length} conferidos`}
                    </small>
                  </span>
                  <span className="conference-order-meta">Filial {pedido.filialId}</span>
                  <span className="conference-order-meta">{pedido.status || 'Aberto'}</span>
                  <button
                    type="button"
                    className="remove-product-button"
                    style={{ marginLeft: '12px' }}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleRemoverPedido(pedido);
                    }}
                    disabled={removingPedidoId !== null}
                  >
                    {removingPedidoId === pedido.id ? 'Removendo...' : 'Remover'}
                  </button>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <section className="stats-grid conference-stats">
        <article className="stat-card">
          <span className="stat-label">Pedidos recebidos</span>
          <strong>{pedidos.length}</strong>
          <small>Total no sistema</small>
        </article>
        <article className="stat-card warning">
          <span className="stat-label">Em conferência</span>
          <strong>{pedidosParaConferencia}</strong>
          <small>Pedidos em andamento</small>
        </article>
        <article className="stat-card danger">
          <span className="stat-label">Pendentes</span>
          <strong>{pedidosPendentes.length}</strong>
          <small>Aguardando conferência</small>
        </article>
        <article className="stat-card danger">
          <span className="stat-label">Excessos no pedido atual</span>
          <strong>{excessosNoPedidoSelecionado}</strong>
          <small>Itens acima do solicitado</small>
        </article>
      </section>

      <section className="card">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Conferência individual</p>
            <h2>{pedidoSelecionado ? `Pedido ${pedidoSelecionado.numeroPedido}` : 'Pedido selecionado'}</h2>
          </div>
          {pedidoSelecionado && itensDoPedido.length > 0 && (
            <span className="status-badge low">
              {quantidadeItensConferidos}/{itensDoPedido.length} itens
            </span>
          )}
        </div>

        {loading || loadingConferencia ? (
          <div className="loading-card">Carregando itens do pedido...</div>
        ) : !pedidoSelecionado ? (
          <div className="loading-card">Selecione um pedido pendente para conferir.</div>
        ) : conferenciaLoadError ? (
          <div className="message error">{conferenciaLoadError}</div>
        ) : itensDoPedido.length === 0 ? (
          <div className="message error">
            Não foi possível identificar os produtos deste pedido. Confira se ele foi criado com os itens detalhados ou crie um novo pedido pela tela de Pedidos.
          </div>
        ) : (
          <>
            <div className="conference-item-workspace">
              <div className="conference-current-item">
                {itemAtual ? (
                  <>
                    <p className="eyebrow">Item {itensDoPedido.findIndex((item) => item.produtoId === itemAtual.produtoId) + 1} de {itensDoPedido.length}</p>
                    <h3>{itemAtual.nome}</h3>
                    <p className="conference-expected">
                      Quantidade solicitada: <strong>{itemAtual.quantidade}</strong>
                    </p>

                    <label className="form-field">
                      <span>Quantidade recebida</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={quantidadeRecebida}
                        onChange={(event) => setQuantidadeRecebida(event.target.value)}
                      />
                    </label>

                    {Number(quantidadeRecebida) > itemAtual.quantidade && (
                      <div className="message error conference-overage">
                        A quantidade recebida está acima do pedido.
                      </div>
                    )}

                    <div className="conference-scanner-row">
                      <label className="form-field">
                        <span>Escanear o produto atual</span>
                        <BarcodeScannerInput
                          key={`${pedidoSelecionado.id}-${itemAtual.produtoId}`}
                          type="text"
                          value={codigoLeitura}
                          onChange={setCodigoLeitura}
                          onScan={handleScannerScan}
                          placeholder={`Código de ${itemAtual.nome}`}
                          autoFocus
                        />
                      </label>
                      <label className="form-field">
                        <span>Unidades por leitura</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={quantidadePorLeitura}
                          onChange={(event) => setQuantidadePorLeitura(Math.max(1, Math.trunc(Number(event.target.value) || 1)))}
                        />
                      </label>
                    </div>

                    <button
                      type="button"
                      className="primary-button"
                      disabled={savingItem || finalizando || loadingConferencia || Number(quantidadeRecebida) < itemAtual.quantidade}
                      onClick={handleConfirmarItem}
                    >
                      {savingItem ? 'Registrando item...' : 'Confirmar item e avançar'}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="eyebrow">Itens conferidos</p>
                    <h3>Todos os produtos deste pedido foram verificados.</h3>
                    {pedidoSelecionado.status === 'Confirmado' ? (
                      <div className="message success">Pedido concluído.</div>
                    ) : (
                      <button
                        type="button"
                        className="primary-button"
                        disabled={finalizando}
                        onClick={() => handleFinalizarPedido(pedidoSelecionado, itensDoPedido)}
                      >
                        {finalizando ? 'Finalizando...' : 'Finalizar pedido'}
                      </button>
                    )}
                  </>
                )}
              </div>

              <ol className="conference-item-list">
                {itensDoPedido.map((item, index) => {
                  const registro = getRegistroItem(conferenciasDoPedido, item.produtoId);
                  const isAtual = itemAtual?.produtoId === item.produtoId;

                  return (
                    <li
                      key={item.produtoId}
                      className={`conference-item-row${registro?.status === 'Conferido' ? ' completed' : registro ? ' partial' : ''}${isAtual ? ' current' : ''}`}
                    >
                      <span className="conference-item-number">{index + 1}</span>
                      <span className="conference-item-description">
                        <strong>{item.nome}</strong>
                        <small>Solicitado: {item.quantidade}</small>
                      </span>
                      <span className="conference-item-result">
                        {registro
                          ? `${registro.status === 'Conferido' ? 'Conferido' : 'Parcial'} · ${registro.quantidadeRecebida}/${registro.quantidadeEsperada}`
                          : 'Pendente'}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
