import { apiFetch } from '@/lib/api';
import type { Fornecedor } from '@/types/inventory';

async function getFornecedores() {
  return apiFetch<Fornecedor[]>('/api/fornecedores');
}

export default async function FornecedoresPage() {
  const fornecedores = await getFornecedores();

  return (
    <main className="page-shell">
      <div className="page-header">
        <h1>Fornecedores</h1>
        <a className="primary-button" href="/">Voltar ao dashboard</a>
      </div>

      <div className="card table-card">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Razão social</th>
              <th>CNPJ</th>
              <th>Ativo</th>
            </tr>
          </thead>
          <tbody>
            {fornecedores.map((fornecedor) => (
              <tr key={fornecedor.id}>
                <td>{fornecedor.id}</td>
                <td>{fornecedor.razaoSocial}</td>
                <td>{fornecedor.cnpj}</td>
                <td>{fornecedor.ativo ? 'Sim' : 'Não'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
