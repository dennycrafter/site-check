import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://base-home-check.dktrn9ne.chatgpt.site'),
  title: 'Base | Photo Qualification',
  description: 'Photo qualification in seconds, with human review only when it matters.',
  openGraph: {
    title: 'site-check',
    description: 'Photo qualification in seconds. Human review only when it matters.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'site-check' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'site-check',
    description: 'Photo qualification in seconds. Human review only when it matters.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
