import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Machinery',
  description: 'Machine lifecycle and finance dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
