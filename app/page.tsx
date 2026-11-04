const produtos = [
  { codigo: '001', nome: 'Arroz 5kg', qtd: 32, preco: 'R$ 28,90', status: 'Normal' },
  { codigo: '002', nome: 'Leite Integral', qtd: 12, preco: 'R$ 6,50', status: 'Baixo' },
  { codigo: '003', nome: 'Café Premium', qtd: 5, preco: 'R$ 19,90', status: 'Baixo' },
  { codigo: '004', nome: 'Pão de Forma', qtd: 0, preco: 'R$ 12,00', status: 'Esgotado' },
  { codigo: '005', nome: 'Água Mineral', qtd: 46, preco: 'R$ 4,80', status: 'Normal' },
];

const movimentacoes = [
  { titulo: 'Entrada de produtos', descricao: '12 itens adicionados ao estoque', hora: 'Hoje, 09:30' },
  { titulo: 'Baixa de estoque', descricao: '3 itens com quantidade crítica', hora: 'Hoje, 08:15' },
  { titulo: 'Pedido de Fornecedor', descricao: 'Requisição enviada para distribuidora', hora: 'Ontem, 18:45' },
];

export default function HomePage() {
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

        <div className="header-actions">
          <button type="button" className="secondary-button">Relatórios</button>
          <button type="button" className="primary-button">Novo produto</button>
        </div>
      </header>

      <main className="dashboard">
        <section className="stats-grid">
          <article className="stat-card">
            <span className="stat-label">Total de produtos</span>
            <strong>128</strong>
            <small>+12,4% no mês</small>
          </article>

          <article className="stat-card">
            <span className="stat-label">Valor em estoque</span>
            <strong>R$ 18.420</strong>
            <small>Atualizado agora</small>
          </article>

          <article className="stat-card warning">
            <span className="stat-label">Estoque baixo</span>
            <strong>8</strong>
            <small>Atenção</small>
          </article>

          <article className="stat-card danger">
            <span className="stat-label">Esgotados</span>
            <strong>3</strong>
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
              <button type="button" className="ghost-button">Exportar</button>
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
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {produtos.map((produto) => (
                    <tr key={produto.codigo}>
                      <td>{produto.codigo}</td>
                      <td>{produto.nome}</td>
                      <td>{produto.qtd}</td>
                      <td>{produto.preco}</td>
                      <td>
                        <span
                          className={`status-badge ${
                            produto.status === 'Normal'
                              ? 'normal'
                              : produto.status === 'Baixo'
                                ? 'low'
                                : 'empty'
                          }`}
                        >
                          {produto.status}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button type="button">Editar</button>
                          <button type="button" className="delete">Excluir</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Histórico</p>
                <h2>Movimentações recentes</h2>
              </div>
            </div>

            <div className="movement-list">
              {movimentacoes.map((item) => (
                <div key={item.titulo} className="movement-item">
                  <div className="dot" />
                  <div>
                    <strong>{item.titulo}</strong>
                    <p>{item.descricao}</p>
                    <small>{item.hora}</small>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
