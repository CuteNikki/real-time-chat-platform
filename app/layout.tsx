import { Toaster } from '@/components/ui/sonner';
import { Analytics } from '@vercel/analytics/next';
import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from 'next-themes';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

import { I18nProvider } from '@/components/i18n-provider';
import { detectLanguage } from '@/lib/i18n/server';

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });
const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: 'Orbit | Connect Now!',
  description:
    'Get matched with a stranger, spin up group rooms, or invite friends to private chats. Real-time conversations, instant connections.',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
};

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const lng = await detectLanguage();

  return (
    <html
      lang={lng}
      className={`${geistSans.variable} ${geistMono.variable} bg-background`}
      suppressHydrationWarning
    >
      <body className='font-sans antialiased'>
        <I18nProvider lng={lng}>
          <ThemeProvider attribute='class' defaultTheme='system' enableSystem>
            {children}
            <Toaster position='top-center' richColors closeButton />
            {process.env.NODE_ENV === 'production' && <Analytics />}
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
