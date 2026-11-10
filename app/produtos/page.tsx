"use client";

import Link from 'next/link';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { apiFetch } from '@/lib/api';
import { getCurrentUser, hasAnyRole, normalizeRole } from '@/lib/auth';
import { SearchableCatalogSelect, type SearchableCatalogOption } from '@/components/products/SearchableCatalogSelect';
import type { Categoria, Fornecedor, Produto, Usuario } from '@/types/inventory';

const allowedRoles = ['GERENTE', 'CEO'];

const initialForm = {
  nome: '',
  codigoBarras: '',
  descricao: '',
  precoCusto: '',
  precoVenda: '',
  idCategoria: '',
  idFornecedor: '',
  ativo: true,
};

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [usuarioSelecionadoId, setUsuarioSelecionadoId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeProductId, setActiveProductId] = useState<number | null>(null);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Produto | null>(null);
  const [catalogErrors, setCatalogErrors] = useState<{ categorias?: string; fornecedores?: string }>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState(initialForm);

  async function loadProdutos() {
    try {
      const [produtosData, usuariosData] = await Promise.all([
        apiFetch<Produto[]>('/api/produtos'),
        apiFetch<Usuario[]>('/api/usuarios'),
      ]);

      setProdutos(produtosData);
      setUsuarios(usuariosData);

      if (!usuarioSelecionadoId && usuariosData.length > 0) {
        setUsuarioSelecionadoId(usuariosData[0].id);
      }

      const [categoriasResult, fornecedoresResult] = await Promise.allSettled([
        apiFetch<Categoria[]>('/api/categorias'),
        apiFetch<Fornecedor[]>('/api/fornecedores'),
      ]);

      if (categoriasResult.status === 'fulfilled') {
        setCategorias(categoriasResult.value);
      } else {
        setCatalogErrors((current) => ({
          ...current,
          categorias: 'Não foi possível carregar as categorias. Verifique a disponibilidade da API.',
        }));
      }

      if (fornecedoresResult.status === 'fulfilled') {
        setFornecedores(fornecedoresResult.value);
      } else {
        setCatalogErrors((current) => ({
          ...current,
          fornecedores: 'Não foi possível carregar os fornecedores.',
        }));
      }
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

  const usuarioAtual = usuarios.find((usuario) => usuario.id === usuarioSelecionadoId) ?? getCurrentUser() ?? null;
  const isAutorizado = !!usuarioAtual && hasAnyRole(normalizeRole(usuarioAtual.cargo), allowedRoles);
  const categoriaOptions: SearchableCatalogOption[] = categorias
    .filter((categoria) => categoria.ativo !== false)
    .map((categoria) => ({
      value: String(categoria.id),
      label: categoria.nome,
      description: categoria.descricao ?? undefined,
    }));
  const fornecedorOptions: SearchableCatalogOption[] = fornecedores.map((fornecedor) => ({
    value: String(fornecedor.id),
    label: fornecedor.nomeFantasia || fornecedor.razaoSocial,
    description: [
      fornecedor.nomeFantasia && fornecedor.nomeFantasia !== fornecedor.razaoSocial ? fornecedor.razaoSocial : null,
      fornecedor.cnpj,
      fornecedor.email,
      fornecedor.ativo ? null : 'Inativo',
    ].filter(Boolean).join(' · '),
  }));

  function handleFieldChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    const { name, value } = target;
    const isCheckbox = 'checked' in target && target.type === 'checkbox';

    setForm((current) => ({
      ...current,
      [name]: isCheckbox ? target.checked : value,
    }));
  }

  async function fetchProduto(id: number) {
    const produto = await apiFetch<Produto>(`/api/produtos/${id}`);
    setSelectedProduct(produto);
    return produto;
  }

  async function handleViewProduct(id: number) {
    setActiveProductId(id);
    setMessage(null);

    try {
      await fetchProduto(id);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível consultar o produto.',
      });
    } finally {
      setActiveProductId(null);
    }
  }

  async function handleEditProduct(id: number) {
    if (!isAutorizado) {
      setMessage({ type: 'error', text: 'Apenas gerentes ou CEO podem editar produtos.' });
      return;
    }

    setActiveProductId(id);
    setMessage(null);

    try {
      const produto = await fetchProduto(id);
      setEditingProductId(produto.id);
      setForm({
        nome: produto.nome ?? '',
        codigoBarras: produto.codigoBarras ?? '',
        descricao: produto.descricao ?? '',
        precoCusto: String(produto.precoCusto ?? ''),
        precoVenda: String(produto.precoVenda ?? ''),
        idCategoria: produto.idCategoria == null ? '' : String(produto.idCategoria),
        idFornecedor: produto.idFornecedor == null ? '' : String(produto.idFornecedor),
        ativo: produto.ativo,
      });
      document.getElementById('product-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível carregar o produto para edição.',
      });
    } finally {
      setActiveProductId(null);
    }
  }

  async function handleDeleteProduct(produto: Produto) {
    if (!isAutorizado) {
      setMessage({ type: 'error', text: 'Apenas gerentes ou CEO podem excluir produtos.' });
      return;
    }

    if (!window.confirm(`Excluir o produto "${produto.nome}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    setActiveProductId(produto.id);
    setMessage(null);

    try {
      await apiFetch<void>(`/api/produtos/${produto.id}`, { method: 'DELETE' });
      setProdutos((current) => current.filter((item) => item.id !== produto.id));
      setSelectedProduct((current) => current?.id === produto.id ? null : current);

      if (editingProductId === produto.id) {
        setEditingProductId(null);
        setForm(initialForm);
      }

      setMessage({ type: 'success', text: `Produto ${produto.nome} excluído.` });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível excluir o produto.',
      });
    } finally {
      setActiveProductId(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isAutorizado) {
      setMessage({
        type: 'error',
        text: 'Acesso restrito. Somente gerentes ou CEO podem cadastrar ou editar produtos.',
      });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const payload = {
        nome: form.nome.trim(),
        codigoBarras: form.codigoBarras.trim() || null,
        descricao: form.descricao.trim() || null,
        precoCusto: Number(form.precoCusto),
        precoVenda: Number(form.precoVenda),
        idCategoria: form.idCategoria ? Number(form.idCategoria) : null,
        idFornecedor: form.idFornecedor ? Number(form.idFornecedor) : null,
        ativo: form.ativo,
      };

      const produtoSalvo = await apiFetch<Produto>(
        editingProductId ? `/api/produtos/${editingProductId}` : '/api/produtos',
        {
          method: editingProductId ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        },
      );

      setProdutos((current) => editingProductId
        ? current.map((produto) => produto.id === produtoSalvo.id ? produtoSalvo : produto)
        : [produtoSalvo, ...current]);
      setSelectedProduct((current) => current?.id === produtoSalvo.id ? produtoSalvo : current);
      setForm(initialForm);
      setEditingProductId(null);
      setMessage({
        type: 'success',
        text: editingProductId
          ? `Produto ${produtoSalvo.nome} atualizado com sucesso.`
          : `Produto ${produtoSalvo.nome} cadastrado com sucesso.`,
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

  function handleCancelEdit() {
    setEditingProductId(null);
    setForm(initialForm);
    setMessage(null);
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

      <div id="product-form" className="card" style={{ marginBottom: '24px' }}>
        <div className="panel-header">
          <div>
            <p className="eyebrow">{editingProductId ? 'Edição' : 'Cadastro'}</p>
            <h2>{editingProductId ? `Editar produto #${editingProductId}` : 'Novo produto'}</h2>
          </div>
        </div>

        <div className="form-grid" style={{ marginBottom: '18px' }}>
          <label className="form-field full-width">
            <span>Usuário autenticado</span>
            <select value={usuarioSelecionadoId ?? ''} onChange={(event) => setUsuarioSelecionadoId(Number(event.target.value))}>
              {usuarios.map((usuario) => (
                <option key={usuario.id} value={usuario.id}>
                  {usuario.nome} - {usuario.cargo}
                </option>
              ))}
            </select>
          </label>
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

              <SearchableCatalogSelect
                label="Categoria"
                value={form.idCategoria}
                options={categoriaOptions}
                placeholder="Buscar por nome ou descrição"
                emptyLabel="Sem categoria"
                emptyMessage={catalogErrors.categorias ? 'Catálogo indisponível' : 'Nenhuma categoria encontrada'}
                disabled={!!catalogErrors.categorias}
                onChange={(value) => setForm((current) => ({ ...current, idCategoria: value }))}
              />

              <SearchableCatalogSelect
                label="Fornecedor"
                value={form.idFornecedor}
                options={fornecedorOptions}
                placeholder="Buscar por nome, razão social ou CNPJ"
                emptyLabel="Sem fornecedor"
                emptyMessage={catalogErrors.fornecedores ? 'Catálogo indisponível' : 'Nenhum fornecedor encontrado'}
                disabled={!!catalogErrors.fornecedores}
                onChange={(value) => setForm((current) => ({ ...current, idFornecedor: value }))}
              />

              {(catalogErrors.categorias || catalogErrors.fornecedores) && (
                <div className="full-width">
                  {catalogErrors.categorias && <div className="message error">{catalogErrors.categorias}</div>}
                  {catalogErrors.fornecedores && <div className="message error">{catalogErrors.fornecedores}</div>}
                </div>
              )}

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
              {editingProductId && (
                <button type="button" className="secondary-button" onClick={handleCancelEdit} disabled={saving}>
                  Cancelar edição
                </button>
              )}
              <button type="submit" className="primary-button" disabled={saving}>
                {saving ? 'Salvando...' : editingProductId ? 'Salvar alterações' : 'Salvar produto'}
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
                  <th>Ativo</th>
                  <th>Ações</th>
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
                    <td>
                      <div className="inline-actions">
                        <button type="button" onClick={() => handleViewProduct(produto.id)} disabled={activeProductId === produto.id}>
                          Detalhes
                        </button>
                        {isAutorizado && (
                          <>
                            <button type="button" onClick={() => handleEditProduct(produto.id)} disabled={activeProductId === produto.id || saving}>
                              Editar
                            </button>
                            <button type="button" onClick={() => handleDeleteProduct(produto)} disabled={activeProductId === produto.id || saving}>
                              Excluir
                            </button>
                          </>
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

      {selectedProduct && (
        <section className="card" aria-labelledby="product-details-title" style={{ marginTop: '24px' }}>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Consulta por ID</p>
              <h2 id="product-details-title">{selectedProduct.nome}</h2>
            </div>
            <button type="button" className="ghost-button" onClick={() => setSelectedProduct(null)} aria-label="Fechar detalhes">
              Fechar
            </button>
          </div>
          <div className="summary-list">
            <div className="summary-item"><span>ID</span><strong>{selectedProduct.id}</strong></div>
            <div className="summary-item"><span>Código de barras</span><strong>{selectedProduct.codigoBarras || '—'}</strong></div>
            <div className="summary-item"><span>Descrição</span><strong>{selectedProduct.descricao || '—'}</strong></div>
            <div className="summary-item"><span>Preço de custo</span><strong>{Number(selectedProduct.precoCusto).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></div>
            <div className="summary-item"><span>Preço de venda</span><strong>{Number(selectedProduct.precoVenda).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></div>
            <div className="summary-item"><span>Categoria</span><strong>{categorias.find((categoria) => categoria.id === selectedProduct.idCategoria)?.nome ?? '—'}</strong></div>
            <div className="summary-item"><span>Fornecedor</span><strong>{fornecedores.find((fornecedor) => fornecedor.id === selectedProduct.idFornecedor)?.nomeFantasia || fornecedores.find((fornecedor) => fornecedor.id === selectedProduct.idFornecedor)?.razaoSocial || '—'}</strong></div>
            <div className="summary-item"><span>Estoque atual / mínimo</span><strong>{selectedProduct.estoqueAtual ?? '—'} / {selectedProduct.estoqueMinimo ?? '—'}</strong></div>
            <div className="summary-item"><span>Status</span><strong>{selectedProduct.ativo ? 'Ativo' : 'Inativo'}</strong></div>
            <div className="summary-item"><span>Cadastrado em</span><strong>{selectedProduct.dataCadastro ? new Date(selectedProduct.dataCadastro).toLocaleString('pt-BR') : '—'}</strong></div>
          </div>
        </section>
      )}
    </main>
  );
}
