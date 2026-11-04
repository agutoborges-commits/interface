export type Produto = {
  id: number;
  nome: string;
  codigoBarras?: string | null;
  descricao?: string | null;
  precoCusto: number;
  precoVenda: number;
  estoqueAtual?: number | null;
  estoqueMinimo?: number | null;
  idCategoria?: number | null;
  idFornecedor?: number | null;
  ativo: boolean;
  dataCadastro?: string | null;
};

export type Fornecedor = {
  id: number;
  razaoSocial: string;
  nomeFantasia?: string | null;
  cnpj: string;
  telefone?: string | null;
  email?: string | null;
  endereco?: string | null;
  ativo: boolean;
  dataCadastro?: string | null;
};

export type Usuario = {
  id: number;
  nome: string;
  email: string;
  cargo: string;
  ativo: boolean;
  senha?: string;
  dataCadastro?: string | null;
};

export type Pedido = {
  id: number;
  numeroPedido: string;
  filialId: number;
  status: string;
  valorTotal: number;
  dataPedido?: string | null;
  observacao?: string | null;
};
