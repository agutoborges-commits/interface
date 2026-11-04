"use client";

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getCurrentUser } from '@/lib/auth';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const publicRoutes = ['/login'];
    const user = getCurrentUser();

    if (publicRoutes.includes(pathname)) {
      if (user) {
        router.replace('/');
        return;
      }

      setIsReady(true);
      return;
    }

    if (!user) {
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
