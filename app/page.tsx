"use client";

import { InventoryDashboard } from '@/components/dashboard/InventoryDashboard';
import { getCurrentUser, getSupabaseSession } from '@/lib/auth';
import LoginPage from './login/page';

export default function HomePage() {
  const user = getCurrentUser();
  const session = getSupabaseSession();

  if (user && session) {
    return <InventoryDashboard />;
  }

  return <LoginPage />;
}
