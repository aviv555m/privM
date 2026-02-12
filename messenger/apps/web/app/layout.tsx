import './globals.css';
import './chat-theme.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Messenger',
  description: 'Cross-platform Firebase messenger'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
