import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE, pickLocale } from '../i18n/pickLocale';
import '../styles/bos.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

const DESCRIPTION = 'BOS : l’outil de l’analyste M&A pour le BOTe (Business Overview) des cibles, de l’import de l’IM à la décision du comité.';

export const metadata: Metadata = {
  // Set by scripts/netlify-build.mjs from Netlify's URL: absolute links for the preview card when the site is shared.
  ...(process.env.NEXT_PUBLIC_SITE_URL ? { metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL) } : {}),
  title: 'BOS',
  description: DESCRIPTION,
  openGraph: {
    title: 'BOS · Business Overview M&A',
    description: DESCRIPTION,
    images: [{ url: '/tour-poster.jpg' }],
    type: 'website',
  },
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
