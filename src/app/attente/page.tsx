import { SignOutButton } from '../../components/shell/SignOutButton';

export default async function AttentePage({ searchParams }: { searchParams: Promise<{ refus?: string }> }) {
  const { refus } = await searchParams;
  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', textAlign: 'center' }}>
      <div>
        <h1>BOS</h1>
        <p>
          {refus !== undefined
            ? "Ce compte Google n'est pas autorisé"
            : 'Votre accès est en attente de validation par un administrateur'}
        </p>
        <SignOutButton />
      </div>
    </main>
  );
}
