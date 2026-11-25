import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/login?as=analyst');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Accueil' })).toBeVisible();
});

test('accueil : la carte « Prendre en main BOS » ouvre la vidéo française', async ({ page, request }) => {
  const card = page.getByRole('button', { name: /Prendre en main BOS/ });
  await expect(card).toBeVisible();
  await expect(card).toContainText('Démonstration');
  await expect(card).toContainText('De l’import de l’IM à la note de comité.');
  await expect(card.locator('[data-duration]')).toHaveText(/^\d:\d{2}$/);
  await card.click();
  const dialog = page.getByRole('dialog', { name: 'Prendre en main BOS' });
  await expect(dialog).toBeVisible();
  const video = dialog.locator('video');
  await expect(video).toHaveAttribute('src', '/tour-fr.mp4');
  await expect(video).toHaveAttribute('poster', '/tour-poster.jpg');
  await expect(video).toHaveAttribute('controls', '');
  await expect(video).toHaveAttribute('autoplay', '');
  await expect(video).toHaveAttribute('playsinline', '');
  expect(await video.evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);
  // Public static assets: served without a session (no redirect to /login).
  for (const path of ['/tour-fr.mp4', '/tour-en.mp4', '/tour-poster.jpg']) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status(), path).toBe(200);
  }
  await dialog.getByRole('button', { name: 'Fermer' }).click();
  await expect(dialog).toBeHidden();
});

test('en anglais : « Getting started with BOS » ouvre la vidéo anglaise', async ({ page }) => {
  await page.getByLabel('Langue').selectOption('en');
  const card = page.getByRole('button', { name: /Getting started with BOS/ });
  await expect(card).toBeVisible();
  await expect(card).toContainText('Demo');
  await card.click();
  const dialog = page.getByRole('dialog', { name: 'Getting started with BOS' });
  const video = dialog.locator('video');
  await expect(video).toHaveAttribute('src', '/tour-en.mp4');
  const res = await page.request.get('/tour-en.mp4');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('video/mp4');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
