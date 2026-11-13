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

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoEstoque[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingProductId, setRemovingProductId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState(initialForm);
  const [estoqueEdicao, setEstoqueEdicao] = useState<Record<number, string>>({});

  const estoquePorProduto = useMemo(
    () => calcularEstoquePorProduto(movimentacoes),
    [movimentacoes],
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

    const confirmado = window.confirm(`Deseja remover permanentemente o produto ${produto.nome}?`);
    if (!confirmado) return;

    setRemovingProductId(produto.id);
    setMessage(null);

    try {
      await apiFetch<void>(`/api/produtos/${produto.id}`, { method: 'DELETE' });
      setProdutos((current) => current.filter((item) => item.id !== produto.id));
      setEstoqueEdicao((current) => {
        const updated = { ...current };
        delete updated[produto.id];
        return updated;
      });
      setMessage({ type: 'success', text: `Produto ${produto.nome} removido com sucesso.` });
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
                  <th>Estoque</th>
                  <th>Ativo</th>
                  <th>Ação</th>
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
