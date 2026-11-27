import { test, expect, type Page } from '@playwright/test';

/* Public demo build (NEXT_PUBLIC_DEMO=1): no sign-in, a welcome screen to pick a role, never a redirect loop.
   Memory data lives in the page: after the first load, move with clicks only. */

const WELCOME = 'Bienvenue dans la démo BOS';
const who = (page: Page) => page.locator('.topbar .who');
const welcome = (page: Page) => page.getByRole('heading', { name: WELCOME });

function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

async function expectAssociateHome(page: Page) {
  await expect(who(page)).toContainText('Aron Associate');
  await expect(page.getByRole('heading', { level: 1, name: 'Accueil' })).toBeVisible();
  await expect(page.locator('[data-counter="toReview"]')).toContainText('BOTe à relire');
  await expect(page.locator('[data-counter="toReview"]')).toContainText('1');
  for (const id of ['demo-atlas', 'demo-boree', 'demo-ceres', 'demo-helios']) {
    await expect(page.locator(`[data-deal-card="${id}"]`), id).toBeVisible();
  }
  await expect(page.locator('[data-deal-card="demo-dune"]')).toHaveCount(0);
}

test('welcome then associate', async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto('/');
  await expect(welcome(page)).toBeVisible();
  await expect(page.getByText('Recommandé')).toBeVisible();
  await expect(page.locator('.topbar')).toHaveCount(0);
  await page.getByRole('button', { name: /Je suis associate/ }).click();
  await expect(welcome(page)).toBeHidden();
  await expectAssociateHome(page);
  expect(errors).toEqual([]);
});

test('a deep link with no role: welcome, then the choice leads to the Accueil', async ({ page }) => {
  await page.goto('/dossiers');
  await expect(welcome(page)).toBeVisible();
  await page.getByRole('button', { name: /Je suis associate/ }).click();
  await expect(page).toHaveURL((u) => u.pathname === '/' && u.search === '');
  await expectAssociateHome(page);
});

test('a role remembered by cookie skips the welcome on the next load', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Je suis analyste/ }).click();
  await expect(who(page)).toContainText('Anna Analyst');
  await page.goto('/dossiers');
  await expect(who(page)).toContainText('Anna Analyst');
  await expect(welcome(page)).toHaveCount(0);
});

test('welcome: the 1-minute video opens the tour', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Voir la vidéo (1 min)' }).click();
  const dialog = page.getByRole('dialog', { name: 'Prendre en main BOS' });
  await expect(dialog.locator('video')).toHaveAttribute('src', '/tour-fr.mp4');
  await dialog.getByRole('button', { name: 'Fermer' }).click();
  await expect(dialog).toBeHidden();
  await expect(welcome(page)).toBeVisible();
});

test('direct link', async ({ page }) => {
  await page.goto('/login?as=associate');
  await expect(who(page)).toContainText('Aron Associate');
  await expect(welcome(page)).toHaveCount(0);
  await expect(page).toHaveURL((u) => u.pathname === '/' && u.search === '');
  await expectAssociateHome(page);
});

test('cookies refused', async ({ page }) => {
  const errors = watchConsole(page);
  // The browser keeps no cookie: none from the server, none from scripts.
  await page.context().route('**/*', async (route) => {
    const res = await route.fetch({ maxRedirects: 0 });
    const headers = Object.fromEntries(Object.entries(res.headers()).filter(([k]) => k.toLowerCase() !== 'set-cookie'));
    await route.fulfill({ response: res, headers });
  });
  await page.addInitScript(() => {
    Object.defineProperty(Document.prototype, 'cookie', { configurable: true, get: () => '', set: () => {} });
  });
  const navigations: string[] = [];
  page.on('request', (r) => { if (r.isNavigationRequest() && r.frame() === page.mainFrame()) navigations.push(r.url()); });

  await page.context().clearCookies();
  await page.goto('/');
  await expect(welcome(page)).toBeVisible();
  await page.getByRole('button', { name: /Je suis associate/ }).click();
  await expectAssociateHome(page);

  // The role survives moving around the app without any cookie.
  await page.locator('[data-deal-card="demo-atlas"]').getByRole('link', { name: 'Projet Atlas' }).click();
  await expect(page).toHaveURL(/\/projet\/demo-atlas\/synthese$/);
  await expect(who(page)).toContainText('Aron Associate');
  await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Accueil' }).click();
  await expectAssociateHome(page);
  expect(navigations.length, navigations.join('\n')).toBeLessThanOrEqual(2);
  expect(await page.context().cookies()).toEqual([]);
  expect(errors).toEqual([]);
});

test('switching role keeps data', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Je suis associate/ }).click();
  await expect(who(page)).toContainText('Aron Associate');
  await page.locator('[data-deal-card="demo-atlas"]').getByRole('link', { name: 'Projet Atlas' }).click();
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Demandes d’infos' }).click();
  await page.getByRole('button', { name: 'Valider le BOTe' }).click();
  await expect(page.getByText(/Validé par Aron Associate le/)).toBeVisible();

  const bar = page.getByRole('note');
  const roles = bar.getByRole('button');
  await expect(roles).toHaveText(['Associé', 'Analyste', 'Administrateur']);
  await expect(bar.getByRole('button', { name: 'Associé' })).toHaveAttribute('aria-pressed', 'true');
  await bar.getByRole('button', { name: 'Analyste' }).click();
  await expect(who(page)).toContainText('Anna Analyst');
  await expect(bar.getByRole('button', { name: 'Analyste' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/\/projet\/demo-atlas\/demandes$/);
  await expect(page.getByText(/Validé par Aron Associate le/)).toBeVisible();
});

test('welcome fits a phone (390 px)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(welcome(page)).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
