"use client";

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearLegacyAuthData, getCurrentUser, getSupabaseSession } from '@/lib/auth';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    clearLegacyAuthData();
    const publicRoutes = ['/', '/login'];
    const user = getCurrentUser();
    const session = getSupabaseSession();

    if (publicRoutes.includes(pathname)) {
      setIsReady(true);
      return;
    }

    if (!user || !session) {
      router.replace('/login');
      return;
    }

    setIsReady(true);
  }, [pathname, router]);

  if (!isReady) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f3f6fb', color: '#234' }}>
        Carregando acesso...
      </div>
    );
  }

  return <>{children}</>;
}
