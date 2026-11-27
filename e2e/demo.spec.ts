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
  const roles = bar.locator('.demoroles').getByRole('button');
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

test('checklist ticks', async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto('/');
  await page.getByRole('button', { name: /Je suis associate/ }).click();
  const card = page.locator('[data-try]');
  const step = (id: string) => card.locator(`[data-step="${id}"]`);
  await expect(card.getByRole('heading', { name: 'À essayer' })).toBeVisible();
  await expect(card.locator('[data-try-count]')).toHaveText('0 / 5');
  await expect(card.locator('[data-step]')).toHaveCount(5);
  await expect(step('import_im').getByRole('link', { name: 'IM fictif à importer (PDF)' })).toHaveAttribute('href', '/demo/IM_Projet_Kepler_fictif.pdf');

  // First step: Atlas's « Suivi du dossier » (Demandes d'infos tab), where the BOTe is signed off.
  await step('review_atlas').getByRole('link', { name: 'Relire le BOTe d’Atlas, puis le valider ou le renvoyer' }).click();
  await expect(page).toHaveURL(/\/projet\/demo-atlas\/demandes$/);
  await page.getByRole('button', { name: 'Valider le BOTe' }).click();
  await expect(page.getByText(/Validé par Aron Associate le/)).toBeVisible();

  // Back by the nav link: no reload, so the in-memory progress is kept.
  await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Accueil' }).click();
  await expect(card.locator('[data-try-count]')).toHaveText('1 / 5');
  await expect(step('review_atlas')).toHaveAttribute('data-done', 'true');
  for (const id of ['open_synthese', 'committee_msg', 'import_im', 'feedback']) await expect(step(id), id).toHaveAttribute('data-done', 'false');

  // Third step: Cérès's Synthèse (ticks « Ouvrir une synthèse »); BOS suggests the « Note au comité » itself.
  await expect(page.locator('[data-deal-card="demo-ceres"]')).toContainText('BOTe validé, note à préparer pour le comité');
  await step('committee_msg').getByRole('link', { name: 'Préparer le message au comité (Cérès)' }).click();
  await expect(page).toHaveURL(/\/projet\/demo-ceres\/synthese$/);
  await page.getByRole('button', { name: 'Rédiger un message' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Modèle')).toHaveValue('committee_note');
  await dialog.getByRole('button', { name: 'Fermer' }).click();
  await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Accueil' }).click();
  await expect(step('committee_msg')).toHaveAttribute('data-done', 'true');
  await expect(card.locator('[data-try-count]')).toHaveText('3 / 5');

  // Collapsible.
  await card.getByRole('button', { name: 'Replier À essayer' }).click();
  await expect(card.locator('[data-step]')).toHaveCount(0);
  await card.getByRole('button', { name: 'Déplier À essayer' }).click();
  await expect(card.locator('[data-step]')).toHaveCount(5);
  expect(errors).toEqual([]);
});

test('checklist: the « Note de comité » download ticks the committee step', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Je suis associate/ }).click();
  const step = page.locator('[data-try] [data-step="committee_msg"]');
  await expect(step).toHaveAttribute('data-done', 'false');
  await page.locator('[data-deal-card="demo-ceres"]').getByRole('link', { name: 'Projet Cérès' }).click();
  await expect(page).toHaveURL(/\/projet\/demo-ceres\/synthese$/);
  await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Note de comité' }).click()]);
  await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Accueil' }).click();
  await expect(step).toHaveAttribute('data-done', 'true');
});

test('demo bar: « Donner mon avis » stays with the roles (1360 px), no scroll at 390 px', async ({ page }) => {
  await page.setViewportSize({ width: 1360, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: /Je suis associate/ }).click();
  const bar = page.locator('.demobar');
  const mid = async (sel: string) => { const b = (await bar.locator(sel).first().boundingBox())!; return b.y + b.height / 2; };
  await expect(bar.locator('.demofb')).toBeVisible();
  expect(Math.abs((await mid('.demofb')) - (await mid('.demoroles button')))).toBeLessThan(4);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(bar.locator('.demofb')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const box = (await bar.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(390);
});

test('checklist: the analyst steps tick', async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto('/');
  await page.getByRole('button', { name: /Je suis analyste/ }).click();
  const card = page.locator('[data-try]');
  await expect(card.locator('[data-step]')).toHaveText([
    /Importer l’IM fictif Kepler/, 'Compléter une donnée manquante', 'Passer un dossier en « BOTe rédigé »', 'Écrire au dirigeant', 'Donner mon avis',
  ]);
  await expect(card.locator('[data-try-count]')).toHaveText('0 / 5');
  const step = (id: string) => card.locator(`[data-step="${id}"]`);

  // A message to the director from Borée's card (late waits: a reminder).
  const boree = page.locator('[data-deal-card="demo-boree"]');
  await boree.getByRole('button', { name: 'Relancer' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Destinataire')).toBeVisible();
  await dialog.getByRole('button', { name: 'Fermer' }).click();
  await expect(step('director_msg')).toHaveAttribute('data-done', 'true');

  // A missing data point filled in on Borée's Synthèse.
  await boree.getByRole('link', { name: 'Projet Borée' }).click();
  await expect(page).toHaveURL(/\/projet\/demo-boree\/synthese$/);
  const field = page.locator('.mdata input:not([readonly])').first();
  await field.fill('12');
  await field.press('Enter');
  await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Accueil' }).click();
  await expect(step('fill_missing')).toHaveAttribute('data-done', 'true');
  await expect(card.locator('[data-try-count]')).toHaveText('2 / 5');
  expect(errors).toEqual([]);
});

test('checklist fits a phone (390 px)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: /Je suis associate/ }).click();
  await expect(page.locator('[data-try] [data-step]')).toHaveCount(5);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const box = await page.locator('[data-try]').boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
});

test('feedback: mailto link, copy, checklist step ticked', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const errors = watchConsole(page);
  await page.goto('/');
  await page.getByRole('button', { name: /Je suis associate/ }).click();
  const step = page.locator('[data-try] [data-step="feedback"]');
  await expect(step).toHaveAttribute('data-done', 'false');

  await page.locator('.demobar').getByRole('button', { name: 'Donner mon avis' }).click();
  const dialog = page.getByRole('dialog', { name: 'Votre avis sur BOS' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '4', exact: true }).click();
  await dialog.getByLabel('Qu’est-ce qui manque le plus ?').fill('Un export Excel');
  await dialog.getByRole('button', { name: 'Oui' }).click();
  await dialog.getByLabel('Un commentaire ?').fill('Très utile & clair');
  const mail = dialog.getByRole('link', { name: 'Envoyer par e-mail' });
  await expect(mail).toHaveAttribute('href', /^mailto:test@example\.com\?subject=/);
  await expect(dialog.getByText('Votre messagerie ne s’ouvre pas ? Copiez vos réponses et envoyez-les à test@example.com.')).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  await dialog.getByRole('button', { name: 'Copier mes réponses' }).click();
  await expect(page.getByText('Réponses copiées')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('Très utile & clair');
  await dialog.getByRole('button', { name: 'Fermer' }).click();
  await expect(dialog).toBeHidden();
  await expect(step).toHaveAttribute('data-done', 'true');

  // The checklist row opens the same dialog.
  await step.getByRole('button', { name: 'Donner mon avis' }).click();
  await expect(page.getByRole('dialog', { name: 'Votre avis sur BOS' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('feedback dialog fits a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: /Je suis associate/ }).click();
  await page.locator('.demobar').getByRole('button', { name: 'Donner mon avis' }).click();
  const dialog = page.getByRole('dialog', { name: 'Votre avis sur BOS' });
  await expect(dialog).toBeVisible();
  const o = await dialog.evaluate((d) => [d.scrollWidth - d.clientWidth, document.documentElement.scrollWidth - document.documentElement.clientWidth, d.getBoundingClientRect().right]);
  expect(o[0]).toBeLessThanOrEqual(0);
  expect(o[1]).toBeLessThanOrEqual(0);
  expect(o[2]).toBeLessThanOrEqual(390);
});

test('feedback: answers survive an accidental close', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Je suis associate/ }).click();
  const open = () => page.locator('.demobar').getByRole('button', { name: 'Donner mon avis' }).click();
  await open();
  let dialog = page.getByRole('dialog', { name: 'Votre avis sur BOS' });
  await dialog.getByLabel('Un commentaire ?').fill('à garder');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await open();
  dialog = page.getByRole('dialog', { name: 'Votre avis sur BOS' });
  await expect(dialog.getByLabel('Un commentaire ?')).toHaveValue('à garder');
});

test('feedback: the mail link ticks the step but keeps the answers (webmail: nothing may open)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Je suis associate/ }).click();
  const step = page.locator('[data-try] [data-step="feedback"]');
  const open = () => page.locator('.demobar').getByRole('button', { name: 'Donner mon avis' }).click();
  await open();
  let dialog = page.getByRole('dialog', { name: 'Votre avis sur BOS' });
  await dialog.getByLabel('Un commentaire ?').fill('envoyé par webmail');
  const mail = dialog.getByRole('link', { name: 'Envoyer par e-mail' });
  // No mail app in the test browser: stop the mailto navigation, keep the click handler.
  await mail.evaluate((a) => a.addEventListener('click', (e) => e.preventDefault()));
  await mail.click();
  await dialog.getByRole('button', { name: 'Fermer' }).click();
  await expect(dialog).toBeHidden();
  await expect(step).toHaveAttribute('data-done', 'true');
  await open();
  dialog = page.getByRole('dialog', { name: 'Votre avis sur BOS' });
  await expect(dialog.getByLabel('Un commentaire ?')).toHaveValue('envoyé par webmail');
});

test('feedback: copy refused, the answers are shown to select', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Je suis associate/ }).click();
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('denied')) } });
  });
  await page.locator('.demobar').getByRole('button', { name: 'Donner mon avis' }).click();
  const dialog = page.getByRole('dialog', { name: 'Votre avis sur BOS' });
  await dialog.getByLabel('Un commentaire ?').fill('à copier à la main');
  await dialog.getByRole('button', { name: 'Copier mes réponses' }).click();
  await expect(page.getByText('Copie impossible : sélectionnez vos réponses dans la fenêtre puis copiez-les.')).toBeVisible();
  const text = dialog.getByLabel('Vos réponses, à sélectionner puis copier');
  await expect(text).toHaveJSProperty('readOnly', true);
  await expect(text).toHaveValue(/Commentaire : à copier à la main/);
  await expect(page.locator('[data-try] [data-step="feedback"]')).toHaveAttribute('data-done', 'false');
});
