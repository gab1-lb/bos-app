import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE, pickLocale } from '../i18n/pickLocale';
import '../styles/bos.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'BOS',
  description: 'Business Opportunity Screening',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Until the member (and their language) is loaded: the remembered or browser language.
  const lang = pickLocale((await cookies()).get(LOCALE_COOKIE)?.value, (await headers()).get('accept-language'));
  return (
    <html lang={lang} className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
