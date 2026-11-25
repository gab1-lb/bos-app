import { test, expect, type Page } from '@playwright/test';

/* Golden path, end to end, through the UI only (memory mode):
   first admin approves a teammate as analyst → the analyst creates a deal, fills its key figures and moves it to
   "BOTe rédigé" → an associate moves it to review → another senior validates the BOTe → the committee note is
   offered → decision → the deal leaves the Accueil and shows in Mes dossiers with its decision and its message.
   Memory mode keeps its data in the page, so teammates take turns with window.__bosAs (no reload). */

const DEAL = 'Projet Orion';

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', (d) => { errors.push(`native dialog: ${d.message()}`); void d.dismiss(); });
  return errors;
}

async function as(page: Page, personaId: string, name: string) {
  await page.evaluate(async (id) => { await (window as unknown as { __bosAs(id: string): Promise<void> }).__bosAs(id); }, personaId);
  await expect(page.locator('header').getByText(name).first()).toBeVisible();
}

const nav = (page: Page) => page.getByRole('navigation', { name: 'Navigation principale' });
const tabs = (page: Page) => page.getByRole('navigation', { name: 'Sections' });
const step = (page: Page, name: string) => page.getByRole('group', { name: 'Phase' }).getByRole('button', { name });

test('parcours complet : de l’approbation d’un analyste à la décision du comité', async ({ page }) => {
  const errors = watchErrors(page);

  // 1. The first admin approves a pending teammate as analyst.
  await page.goto('/login?as=admin');
  await expect(page.getByRole('heading', { level: 1, name: 'Accueil' })).toBeVisible();
  await nav(page).getByRole('link', { name: 'Administration' }).click();
  const paul = page.locator('[data-member="u-pending"]');
  await paul.getByLabel('Rôle').selectOption('analyst');
  await paul.getByRole('button', { name: 'Approuver' }).click();
  await expect(paul).toContainText('Actif');

  // 2. The new analyst creates a deal, names it and fills its key figures.
  await as(page, 'u-pending', 'Paul Pending');
  await expect(nav(page).getByRole('link', { name: 'Administration' })).toHaveCount(0);
  await nav(page).getByRole('link', { name: 'Mes dossiers' }).click();
  await page.getByRole('button', { name: 'Nouveau dossier' }).click();
  await expect(page).toHaveURL(/\/projet\/[^/]+\/synthese$/);
  await tabs(page).getByRole('link', { name: 'Demandes d’infos' }).click();
  const name = page.getByLabel('Nom de code');
  await name.fill(DEAL);
  await name.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: DEAL })).toBeVisible();
  await expect(page.getByLabel('Responsable', { exact: true })).toHaveValue('u-pending');

  await tabs(page).getByRole('link', { name: 'Données financières' }).click();
  for (const [sel, v] of [['#f-hist\\.rev\\.4', '20'], ['#f-hist\\.ebitda\\.4', '4,2'], ['#f-kpi\\.recurring', '80'], ['#f-askPrice', '45']] as const) {
    await page.locator(sel).fill(v);
    await page.locator(sel).press('Enter');
  }
  await expect(page.locator('#f-hist\\.ebitda\\.4')).toHaveValue('4,20');

  // 3. ... and moves it to "BOTe rédigé"; the associate review is not theirs to start.
  await tabs(page).getByRole('link', { name: 'Demandes d’infos' }).click();
  await step(page, 'Analyse en cours').click();
  await step(page, 'BOTe rédigé').click();
  await expect(step(page, 'BOTe rédigé')).toHaveAttribute('aria-current', 'step');
  await expect(step(page, 'Revue associate')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Valider le BOTe' })).toHaveCount(0);

  // 4. An associate moves it to review (and could not validate their own BOTe; here they are not the owner).
  await as(page, 'u-associate', 'Aron Associate');
  await expect(step(page, 'Revue associate')).toBeEnabled();
  await step(page, 'Revue associate').click();
  await expect(step(page, 'Revue associate')).toHaveAttribute('aria-current', 'step');

  // 5. Another senior validates the BOTe.
  await as(page, 'u-admin', 'Alice Admin');
  await page.getByRole('button', { name: 'Valider le BOTe' }).click();
  await expect(page.getByText(/Validé par Alice Admin le/)).toBeVisible();

  // 6. On the Accueil, the deal's next action is the committee note.
  await nav(page).getByRole('link', { name: 'Accueil' }).click();
  const card = page.locator('[data-deal-card]').filter({ hasText: DEAL });
  await expect(card).toContainText('BOTe validé, note à préparer pour le comité');
  await card.getByRole('button', { name: 'Préparer la note au comité' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Modèle')).toHaveValue('committee_note');
  await expect(dialog.locator('[data-internal]')).toBeVisible();
  await expect(dialog.getByLabel('Message')).toContainText(DEAL);
  await dialog.getByRole('button', { name: 'Fermer' }).click();
  await expect(dialog).toBeHidden();

  // 7. Committee, then decision.
  await card.getByRole('link', { name: DEAL }).click();
  await tabs(page).getByRole('link', { name: 'Demandes d’infos' }).click();
  await step(page, 'Présentation comité').click();
  await expect(step(page, 'Présentation comité')).toHaveAttribute('aria-current', 'step');
  await page.getByRole('button', { name: 'No-go' }).click();
  await expect(page.locator('.pagehead')).toContainText('Décision · No-go');

  // 8. The deal has left the Accueil and shows, decided, in Mes dossiers ...
  await nav(page).getByRole('link', { name: 'Accueil' }).click();
  await expect(page.locator('[data-deal-card="demo-helios"]')).toBeVisible();
  await expect(page.locator('[data-deal-card]').filter({ hasText: DEAL })).toHaveCount(0);
  await nav(page).getByRole('link', { name: 'Mes dossiers' }).click();
  await page.getByLabel('Statut').selectOption('all');
  const row = page.locator('[data-deal-row]').filter({ hasText: DEAL });
  await expect(row).toContainText('No-go');
  await expect(row).toContainText('Paul Pending');

  // ... where its no-go message to the banker is one click away.
  await row.getByRole('link', { name: DEAL }).click();
  await page.getByRole('button', { name: 'Rédiger un message' }).click();
  const msg = page.getByRole('dialog');
  await expect(msg.getByLabel('Modèle')).toHaveValue('no_go');
  await expect(msg.getByRole('textbox', { name: 'Objet' })).toHaveValue(new RegExp(DEAL));
  await expect(msg.locator('[data-internal]')).toHaveCount(0);
  expect(errors).toEqual([]);
});
