import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Base | Schema visualizers',
  description: 'Photo analysis fields, stored tables, and JSON documents for site-check.',
};

export default function SchemasLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
