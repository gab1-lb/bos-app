import { test, expect } from '@playwright/test';

test('hors mode mémoire, /login?as=admin affiche seulement la page de connexion', async ({ page }) => {
  await page.goto('/login?as=admin');
  await expect(page).toHaveURL(/\/login\?as=admin$/);
  await expect(page.getByRole('button', { name: 'Se connecter avec Google' })).toBeVisible();
  expect((await page.context().cookies()).find((c) => c.name === 'bos_as')).toBeUndefined();
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
});
