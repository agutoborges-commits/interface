import { apiFetch } from '@/lib/api';
import type { Usuario } from '@/types/inventory';

async function getUsuarios() {
  return apiFetch<Usuario[]>('/api/usuarios');
}

export default async function UsuariosPage() {
  const usuarios = await getUsuarios();

  return (
    <main className="page-shell">
      <div className="page-header">
        <h1>Usuários</h1>
        <a className="primary-button" href="/">Voltar ao dashboard</a>
      </div>

      <div className="card table-card">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nome</th>
              <th>Email</th>
              <th>Cargo</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((usuario) => (
              <tr key={usuario.id}>
                <td>{usuario.id}</td>
                <td>{usuario.nome}</td>
                <td>{usuario.email}</td>
                <td>{usuario.cargo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
