import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE, pickLocale } from '../../i18n/pickLocale';
import { LoginButton } from './LoginButton';

export default async function LoginPage() {
  const locale = pickLocale((await cookies()).get(LOCALE_COOKIE)?.value, (await headers()).get('accept-language'));
  return (
    <main lang={locale} style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', gap: 16, textAlign: 'center' }}>
      <div>
        <h1>BOS</h1>
        <LoginButton locale={locale} />
      </div>
    </main>
  );
}
