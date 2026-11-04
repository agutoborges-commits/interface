export type Produto = {
  id: number;
  nome: string;
  codigoBarras?: string | null;
  descricao?: string | null;
  precoCusto: number;
  precoVenda: number;
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
  dataCadastro?: string | null;
};
