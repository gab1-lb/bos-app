import { cookies, headers } from 'next/headers';
import { SignOutButton } from '../../components/shell/SignOutButton';
import { t } from '../../i18n/format';
import { LOCALE_COOKIE, pickLocale } from '../../i18n/pickLocale';

export default async function AttentePage({ searchParams }: { searchParams: Promise<{ refus?: string }> }) {
  const { refus } = await searchParams;
  const locale = pickLocale((await cookies()).get(LOCALE_COOKIE)?.value, (await headers()).get('accept-language'));
  return (
    <main lang={locale} style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', textAlign: 'center' }}>
      <div>
        <h1>BOS</h1>
        <p>
          {refus !== undefined
            ? t(locale, "Ce compte Google n'est pas autorisé")
            : t(locale, 'Votre accès est en attente de validation par un administrateur')}
        </p>
        <SignOutButton label={t(locale, 'Se déconnecter')} />
      </div>
    </main>
  );
}
