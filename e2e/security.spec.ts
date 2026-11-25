import { test, expect, type Page } from '@playwright/test';

/** CSP violations and other console errors. */
function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' || /Content Security Policy/i.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

test('en-têtes de sécurité sur les pages publiques et privées', async ({ request }) => {
  for (const path of ['/login', '/attente', '/tour-fr.mp4']) {
    const res = await request.get(path, { maxRedirects: 0 });
    const h = res.headers();
    expect(h['x-frame-options'], path).toBe('DENY');
    expect(h['x-content-type-options'], path).toBe('nosniff');
    expect(h['referrer-policy'], path).toBe('same-origin');
    const csp = h['content-security-policy'];
    expect(csp, path).toContain("frame-ancestors 'none'");
    expect(csp, path).toContain("default-src 'self'");
    expect(csp, path).toContain("object-src 'none'");
    expect(csp, path).not.toContain('cdnjs');
  }
});

test('l’accueil, la vidéo et un projet s’affichent sans violation de la CSP', async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto('/login?as=analyst');
  await expect(page.getByRole('heading', { level: 1, name: 'Accueil' })).toBeVisible();
  await page.getByRole('button', { name: /Prendre en main BOS/ }).click();
  const video = page.getByRole('dialog', { name: 'Prendre en main BOS' }).locator('video');
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(1);
  await page.keyboard.press('Escape');
  await page.locator('[data-deal-card="demo-helios"]').getByRole('link', { name: 'Projet Hélios' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Projet Hélios' })).toBeVisible();
  expect(errors).toEqual([]);
});
