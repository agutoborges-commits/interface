"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import BarcodeScannerInput from '@/components/barcode/BarcodeScannerInput';
import { apiFetch } from '@/lib/api';
import { getCurrentUser, hasAnyRole, normalizeRole } from '@/lib/auth';
import { calcularEstoquePorProduto, type MovimentacaoEstoque } from '@/lib/stock';
import type { Produto } from '@/types/inventory';

const allowedRoles = ['GERENTE', 'CEO'];

const initialForm = {
  nome: '',
  codigoBarras: '',
  descricao: '',
  precoCusto: '',
  precoVenda: '',
  quantidadeEstoque: '1000',
  ativo: true,
};

function getProductStockStatus(quantidade: number): 'normal' | 'baixo' | 'esgotado' {
  if (quantidade <= 0) return 'esgotado';
  return quantidade <= 5 ? 'baixo' : 'normal';
}

function normalizeBarcode(value?: string | null) {
  return (value ?? '').replace(/\s+/g, '').trim();
}

async function safeDelete(endpoint: string) {
  try {
    await apiFetch<void>(endpoint, { method: 'DELETE' });
    return true;
  } catch {
    return false;
  }
}

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoEstoque[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingProductId, setRemovingProductId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState(initialForm);
  const [estoqueEdicao, setEstoqueEdicao] = useState<Record<number, string>>({});
  const [buscaProduto, setBuscaProduto] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas');
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'normal' | 'baixo' | 'esgotado'>('todos');
  const [mostrarMovimentacoes, setMostrarMovimentacoes] = useState(false);

  const estoquePorProduto = useMemo(
    () => calcularEstoquePorProduto(movimentacoes),
    [movimentacoes],
  );
  const categoriasDisponiveis = useMemo(
    () => Array.from(new Set(
      produtos
        .map((produto) => produto.idCategoria)
        .filter((idCategoria): idCategoria is number => typeof idCategoria === 'number'),
    )).sort((categoriaA, categoriaB) => categoriaA - categoriaB),
    [produtos],
  );
  const produtosFiltrados = useMemo(() => {
    const busca = buscaProduto.trim().toLocaleLowerCase('pt-BR');

    return produtos.filter((produto) => {
      if (categoriaFiltro !== 'todas' && String(produto.idCategoria) !== categoriaFiltro) return false;

      const quantidade = estoquePorProduto.get(produto.id) ?? 0;
      if (statusFiltro !== 'todos' && getProductStockStatus(quantidade) !== statusFiltro) return false;

      if (!busca) return true;
      return produto.nome.toLocaleLowerCase('pt-BR').includes(busca)
        || (produto.codigoBarras ?? '').toLocaleLowerCase('pt-BR').includes(busca);
    });
  }, [buscaProduto, categoriaFiltro, estoquePorProduto, produtos, statusFiltro]);
  const produtoPorId = useMemo(
    () => new Map(produtos.map((produto) => [produto.id, produto])),
    [produtos],
  );

  async function loadProdutos() {
    try {
      const [produtosData, movimentacoesData] = await Promise.all([
        apiFetch<Produto[]>('/api/produtos'),
        apiFetch<MovimentacaoEstoque[]>('/api/MovimentacoesEstoque'),
      ]);

      const estoqueInicial = Object.fromEntries(
        produtosData.map((produto) => [produto.id, String(calcularEstoquePorProduto(movimentacoesData).get(produto.id) ?? 0)]),
      );

      setProdutos(produtosData);
      setMovimentacoes(movimentacoesData);
      setEstoqueEdicao(estoqueInicial);
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
    const currentUser = getCurrentUser();
    if (!currentUser) {
      window.location.href = '/login';
      return;
    }
    loadProdutos();
  }, []);

  const usuarioAtual = getCurrentUser();
  const isAutorizado = !!usuarioAtual && hasAnyRole(normalizeRole(usuarioAtual.cargo), allowedRoles);

  function handleFieldChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    const { name, value } = target;
    const isCheckbox = 'checked' in target && target.type === 'checkbox';

    setForm((current) => ({
      ...current,
      [name]: isCheckbox ? target.checked : value,
    }));
  }

  function handleCodigoBarrasChange(value: string) {
    setForm((current) => ({
      ...current,
      codigoBarras: value,
    }));
  }

  function handleEstoqueEdicaoChange(produtoId: number, value: string) {
    setEstoqueEdicao((current) => ({
      ...current,
      [produtoId]: value,
    }));
  }

  async function handleSalvarEstoque(produtoId: number) {
    const valorAtual = Number(estoqueEdicao[produtoId] ?? 0);
    const estoqueAtual = estoquePorProduto.get(produtoId) ?? 0;
    const diferenca = valorAtual - estoqueAtual;

    if (diferenca === 0) {
      setMessage({
        type: 'success',
        text: 'Estoque sem alterações.',
      });
      return;
    }

    try {
      const tipo = diferenca > 0 ? 'Entrada' : 'Saida';
      await apiFetch('/api/MovimentacoesEstoque', {
        method: 'POST',
        body: JSON.stringify({
          produtoId,
          filialId: 1,
          tipo,
          quantidade: Math.abs(diferenca),
        }),
      });

      setMovimentacoes((current) => [
        ...current,
        {
          produtoId,
          filialId: 1,
          tipo,
          quantidade: Math.abs(diferenca),
        },
      ]);

      setMessage({
        type: 'success',
        text: `Estoque do produto ${produtoId} atualizado para ${valorAtual} unidade(s).`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível salvar o estoque.',
      });
    }
  }

  async function handleRemoverProduto(produto: Produto) {
    if (!isAutorizado) {
      setMessage({ type: 'error', text: 'Somente gerentes e CEO podem remover produtos.' });
      return;
    }

    const codigoBarras = normalizeBarcode(produto.codigoBarras);
    const confirmado = window.confirm(
      codigoBarras
        ? `Deseja remover permanentemente o produto ${produto.nome} (código ${codigoBarras}) e todos os registros vinculados a este código de barras?`
        : `Deseja remover permanentemente o produto ${produto.nome}?`,
    );
    if (!confirmado) return;

    setRemovingProductId(produto.id);
    setMessage(null);

    try {
      const produtosParaRemover = codigoBarras
        ? produtos.filter((item) => normalizeBarcode(item.codigoBarras) === codigoBarras)
        : [produto];

      const idsParaRemover = new Set(produtosParaRemover.map((item) => item.id));

      const movimentacoesRelacionadas = movimentacoes.filter((movimentacao) => idsParaRemover.has(movimentacao.produtoId));
      const movimentacoesApagadas = await Promise.all(
        movimentacoesRelacionadas.map(async (movimentacao) => {
          const ok = await safeDelete(`/api/MovimentacoesEstoque/${movimentacao.produtoId}`);
          return ok ? movimentacao.produtoId : null;
        }),
      );

      const idsMovimentacoesRemovidas = new Set(movimentacoesApagadas.filter((id): id is number => id !== null));

      const promessasRemocao = Array.from(idsParaRemover).map(async (produtoId) => {
        const produtoAlvo = produtos.find((item) => item.id === produtoId) ?? produto;
        const ok = await safeDelete(`/api/produtos/${produtoId}`);
        if (!ok) {
          throw new Error(`Não foi possível remover ${produtoAlvo.nome}.`);
        }
        return produtoId;
      });

      const produtosRemovidos = await Promise.all(promessasRemocao);

      setProdutos((current) => current.filter((item) => !idsParaRemover.has(item.id)));
      setMovimentacoes((current) => current.filter((item) => !idsMovimentacoesRemovidas.has(item.produtoId)));
      setEstoqueEdicao((current) => {
        const updated = { ...current };
        for (const id of idsParaRemover) {
          delete updated[id];
        }
        return updated;
      });

      const nomes = produtosParaRemover.map((item) => item.nome).join(', ');
      setMessage({
        type: 'success',
        text: produtosRemovidos.length > 1
          ? `Produtos removidos com sucesso: ${nomes}.`
          : `Produto ${produto.nome} removido com sucesso.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : `Não foi possível remover ${produto.nome}.`,
      });
    } finally {
      setRemovingProductId(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isAutorizado) {
      setMessage({
        type: 'error',
        text: 'Acesso restrito. Somente usuários autorizados podem cadastrar produtos.',
      });
      return;
    }

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

      const quantidadeEstoque = Number(form.quantidadeEstoque || 0);
      if (quantidadeEstoque > 0) {
        await apiFetch('/api/MovimentacoesEstoque', {
          method: 'POST',
          body: JSON.stringify({
            produtoId: produtoCriado.id,
            filialId: 1,
            tipo: 'Entrada',
            quantidade: quantidadeEstoque,
          }),
        });
      }

      setProdutos((current) => [produtoCriado, ...current]);
      setForm(initialForm);
      setMessage({
        type: 'success',
        text: `Produto ${produtoCriado.nome} cadastrado com sucesso${quantidadeEstoque > 0 ? ` com ${quantidadeEstoque} unidade(s) em estoque` : ''}.`,
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

        <div className="form-grid" style={{ marginBottom: '18px' }}>
        </div>

        {message && <div className={`message ${message.type}`}>{message.text}</div>}

        {!isAutorizado ? (
          <div className="message error">
            Acesso restrito. Apenas usuários com cargo de gerente ou CEO podem adicionar produtos.
          </div>
        ) : (
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
                <BarcodeScannerInput
                  name="codigoBarras"
                  value={form.codigoBarras}
                  onChange={handleCodigoBarrasChange}
                  onScan={(codigo) => {
                    setForm((current) => ({
                      ...current,
                      codigoBarras: codigo,
                    }));
                  }}
                  placeholder="7890000000000"
                  autoFocus
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

              <label className="form-field">
                <span>Quantidade inicial em estoque</span>
                <input
                  name="quantidadeEstoque"
                  type="number"
                  min="0"
                  step="1"
                  value={form.quantidadeEstoque}
                  onChange={handleFieldChange}
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
        )}
      </div>

      <div className="card">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Produtos</p>
            <h2>Lista atual</h2>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setMostrarMovimentacoes((current) => !current)}
          >
            {mostrarMovimentacoes ? 'Ocultar movimentações' : 'Movimentações'}
          </button>
        </div>

        <div className="filters-row product-filters-row">
          <label className="form-field">
            <span>Buscar produto</span>
            <input
              type="search"
              value={buscaProduto}
              onChange={(event) => setBuscaProduto(event.target.value)}
              placeholder="Nome ou código de barras"
            />
          </label>

          <label className="form-field">
            <span>Categoria</span>
            <select value={categoriaFiltro} onChange={(event) => setCategoriaFiltro(event.target.value)}>
              <option value="todas">Todas as categorias</option>
              {categoriasDisponiveis.map((idCategoria) => (
                <option key={idCategoria} value={String(idCategoria)}>
                  Categoria #{idCategoria}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Status do estoque</span>
            <select
              value={statusFiltro}
              onChange={(event) => {
                const value = event.target.value;
                if (value === 'todos' || value === 'normal' || value === 'baixo' || value === 'esgotado') {
                  setStatusFiltro(value);
                }
              }}
            >
              <option value="todos">Todos</option>
              <option value="normal">Disponível</option>
              <option value="baixo">Baixo (até 5 unidades)</option>
              <option value="esgotado">Esgotado</option>
            </select>
          </label>
        </div>

        {mostrarMovimentacoes && (
          <section className="product-movements">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Estoque</p>
                <h3>Histórico de movimentações</h3>
              </div>
            </div>
            {movimentacoes.length === 0 ? (
              <p className="notification-empty">Nenhuma movimentação registrada.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Tipo</th>
                      <th>Quantidade</th>
                      <th>Filial</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimentacoes.map((movimentacao, index) => (
                      <tr key={`${movimentacao.produtoId}-${movimentacao.filialId}-${index}`}>
                        <td>{produtoPorId.get(movimentacao.produtoId)?.nome ?? `Produto #${movimentacao.produtoId}`}</td>
                        <td>{movimentacao.tipo}</td>
                        <td>{movimentacao.quantidade}</td>
                        <td>{movimentacao.filialId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

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
                  <th>Estoque</th>
                  <th>Ativo</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {produtosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6}>Nenhum produto encontrado com esses filtros.</td>
                  </tr>
                ) : produtosFiltrados.map((produto) => (
                  <tr key={produto.id}>
                    <td>{produto.id}</td>
                    <td>{produto.nome}</td>
                    <td>
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(Number(produto.precoVenda || 0))}
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        value={estoqueEdicao[produto.id] ?? String(estoquePorProduto.get(produto.id) ?? 0)}
                        onChange={(event) => handleEstoqueEdicaoChange(produto.id, event.target.value)}
                        style={{ width: '90px' }}
                      />
                    </td>
                    <td>{produto.ativo ? 'Sim' : 'Não'}</td>
                    <td>
                      <div className="product-row-actions">
                        <button type="button" className="secondary-button" onClick={() => handleSalvarEstoque(produto.id)}>
                          Salvar
                        </button>
                        {isAutorizado && (
                          <button
                            type="button"
                            className="remove-product-button"
                            disabled={removingProductId !== null}
                            onClick={() => handleRemoverProduto(produto)}
                          >
                            {removingProductId === produto.id ? 'Removendo...' : 'Remover'}
                          </button>
                        )}
                      </div>
                    </td>
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
