import type { Produto } from '@/types/inventory';

export type PedidoItemDetalhado = {
  produtoId: number;
  nome: string;
  quantidade: number;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function formatOrderItems(items: ReadonlyArray<Pick<PedidoItemDetalhado, 'nome' | 'quantidade'>>) {
  return `Itens: ${items.map((item) => `${item.nome} (${item.quantidade})`).join(', ')}`;
}

export function parseOrderItems(
  observacao: string | null | undefined,
  produtos: ReadonlyArray<Pick<Produto, 'id' | 'nome'>>,
): PedidoItemDetalhado[] {
  const texto = observacao ?? '';
  const expressoesItens = /(?:^|\r?\n)Itens:\s*/gi;
  let marcador: RegExpExecArray | null = null;
  let resultadoMarcador: RegExpExecArray | null;
  while ((resultadoMarcador = expressoesItens.exec(texto)) !== null) {
    marcador = resultadoMarcador;
  }
  if (!marcador) return [];

  const inicioItens = marcador.index + marcador[0].length;
  const listaItens = texto.slice(inicioItens).split(/\r?\n/, 1)[0].trim();
  const itens: Array<PedidoItemDetalhado & { posicao: number }> = [];

  for (const produto of produtos) {
    const padrao = new RegExp(
      `(^|,\\s*)${escapeRegExp(produto.nome)}\\s*\\((\\d+)\\)(?=\\s*(?:,|$))`,
      'gi',
    );
    let resultado: RegExpExecArray | null;

    while ((resultado = padrao.exec(listaItens)) !== null) {
      const quantidade = Number(resultado[2]);
      if (Number.isSafeInteger(quantidade) && quantidade > 0) {
        itens.push({
          produtoId: produto.id,
          nome: produto.nome,
          quantidade,
          posicao: resultado.index + resultado[1].length,
        });
      }
    }
  }

  return itens
    .sort((itemA, itemB) => itemA.posicao - itemB.posicao)
    .map(({ produtoId, nome, quantidade }) => ({ produtoId, nome, quantidade }));
}
