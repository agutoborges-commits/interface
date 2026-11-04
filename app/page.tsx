import { InventoryDashboard } from '@/components/dashboard/InventoryDashboard';
import { getFornecedores, getProdutos, getUsuarios } from '@/services/inventory';

export default async function HomePage() {
  const [produtos, fornecedores, usuarios] = await Promise.all([
    getProdutos(),
    getFornecedores(),
    getUsuarios(),
  ]);

  return <InventoryDashboard produtos={produtos} fornecedores={fornecedores} usuarios={usuarios} />;
}
