import { test, expect } from '@playwright/test';

test('sans session, / redirige vers /login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'Se connecter avec Google' })).toBeVisible();
});

test('as=pending mène à /attente', async ({ page }) => {
  await page.goto('/login?as=pending');
  await expect(page).toHaveURL(/\/attente$/);
  await expect(page.getByText('Votre accès est en attente de validation par un administrateur')).toBeVisible();
});

test('as=analyst mène à /', async ({ page }) => {
  await page.goto('/login?as=analyst');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Accueil' })).toBeVisible();
});

test('un pending ne peut pas ouvrir /', async ({ page }) => {
  await page.goto('/login?as=pending');
  await page.goto('/');
  await expect(page).toHaveURL(/\/attente$/);
});

test('refus affiche le message de compte non autorisé', async ({ page }) => {
  await page.goto('/attente?refus=1');
  await expect(page.getByText("Ce compte Google n'est pas autorisé")).toBeVisible();
});

test('se déconnecter renvoie vers /login', async ({ page }) => {
  await page.goto('/login?as=admin');
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
});

test.describe('navigateur en anglais', () => {
  test.use({ locale: 'en-US' });

  test('connexion et attente en anglais', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
    expect(await page.locator('html').getAttribute('lang')).toBe('en');
    await page.goto('/attente?refus=1');
    await expect(page.getByText('This Google account is not authorised')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  });

  test('la langue choisie dans l’application est retenue pour la page de connexion', async ({ page }) => {
    await page.goto('/login?as=analyst');
    await expect(page.getByRole('heading', { level: 1, name: 'Accueil' })).toBeVisible();
    await page.getByRole('button', { name: 'Se déconnecter' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: 'Se connecter avec Google' })).toBeVisible();
  });
});
