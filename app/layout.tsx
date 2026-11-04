import './globals.css';
import type { Metadata } from 'next';
import { AuthGate } from '@/components/auth/AuthGate';

export const metadata: Metadata = {
  title: 'Interface',
  description: 'Sistema de estoque com login por perfil',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
