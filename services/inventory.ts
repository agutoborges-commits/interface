import { apiFetch } from '@/lib/api';
import type { Fornecedor, Produto, Usuario } from '@/types/inventory';

export async function getProdutos(): Promise<Produto[]> {
  return apiFetch<Produto[]>('/api/produtos');
}

export async function getFornecedores(): Promise<Fornecedor[]> {
  return apiFetch<Fornecedor[]>('/api/fornecedores');
}

export async function getUsuarios(): Promise<Usuario[]> {
  return apiFetch<Usuario[]>('/api/usuarios');
}
