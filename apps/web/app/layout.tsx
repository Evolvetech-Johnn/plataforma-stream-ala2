import type { ReactNode } from 'react';
import './globals.css';
export const metadata = { title: 'Transmissão Local — Piloto', description: 'Acesso privado à transmissão autorizada' };
export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
