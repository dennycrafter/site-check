import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Base | Home eligibility check',
  description: 'A guided exterior electrical photo check for Base home eligibility.',
};

export default function CustomerDeckLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
