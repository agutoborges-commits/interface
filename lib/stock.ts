export type MovimentacaoEstoque = {
  id?: number;
  produtoId: number;
  filialId: number;
  tipo: 'Entrada' | 'Saida' | 'PerdaAvaria';
  quantidade: number;
};

export function calcularEstoquePorProduto(movimentacoes: MovimentacaoEstoque[]) {
  const estoque = new Map<number, number>();

  for (const movimentacao of movimentacoes) {
    const saldoAtual = estoque.get(movimentacao.produtoId) ?? 0;

    switch (movimentacao.tipo) {
      case 'Entrada':
        estoque.set(movimentacao.produtoId, saldoAtual + movimentacao.quantidade);
        break;
      case 'Saida':
      case 'PerdaAvaria':
        estoque.set(movimentacao.produtoId, saldoAtual - movimentacao.quantidade);
        break;
      default:
        throw new Error(`Tipo de movimentação desconhecido: ${movimentacao.tipo}`);
    }
  }

  return estoque;
}
