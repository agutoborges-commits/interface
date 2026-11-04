import { apiFetch } from '@/lib/api';
import type { Produto } from '@/types/inventory';

async function getProdutos() {
  return apiFetch<Produto[]>('/api/produtos');
}

export default async function ProdutosPage() {
  const produtos = await getProdutos();

  return (
    <main className="page-shell">
      <div className="page-header">
        <h1>Produtos</h1>
        <a className="primary-button" href="/">Voltar ao dashboard</a>
      </div>

      <div className="card table-card">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nome</th>
              <th>Preço</th>
              <th>Ativo</th>
            </tr>
          </thead>
          <tbody>
            {produtos.map((produto) => (
              <tr key={produto.id}>
                <td>{produto.id}</td>
                <td>{produto.nome}</td>
                <td>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(produto.precoVenda || 0))}</td>
                <td>{produto.ativo ? 'Sim' : 'Não'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
