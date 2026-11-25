import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { blankDeal } from '../src/engine/samples';

const FIXTURE = join(__dirname, 'fixtures', 'legacy-v1.json');

type Hooks = { __bosRepo: { createDeal(d: unknown): Promise<string> } };

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  // In-page confirmations only: a native dialog is a failure.
  page.on('dialog', (d) => { errors.push(`native dialog: ${d.message()}`); void d.dismiss(); });
  return errors;
}

async function loginAs(page: Page, role: string) {
  await page.goto(`/login?as=${role}`);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Accueil' })).toBeVisible();
}

/** Client-side navigation keeps the in-memory data of the page. */
async function openDossiers(page: Page) {
  await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Mes dossiers' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Mes dossiers' })).toBeVisible();
}

const row = (page: Page, name: string) => page.locator('[data-deal-row]').filter({ hasText: name });

test('admin : un pending approuvé en analyste peut ensuite ouvrir /', async ({ page }) => {
  const errors = watchErrors(page);
  await loginAs(page, 'admin');
  await page.getByRole('link', { name: 'Administration' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Administration' })).toBeVisible();
  const pending = page.locator('[data-member="u-pending"]');
  await expect(pending).toContainText('Paul Pending');
  await expect(pending).toContainText('En attente');
  await pending.getByLabel('Rôle').selectOption('analyst');
  await pending.getByRole('button', { name: 'Approuver' }).click();
  await expect(pending).toContainText('Actif');
  // an admin cannot change their own role
  await expect(page.locator('[data-member="u-admin"]').getByLabel('Rôle')).toBeDisabled();

  await page.goto('/login?as=pending');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Accueil' })).toBeVisible();
  await expect(page.locator('[data-deal-card="demo-helios"]')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Administration' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('admin : refuser un pending le renvoie vers le message de refus', async ({ page }) => {
  await loginAs(page, 'admin');
  await page.goto('/admin');
  const pending = page.locator('[data-member="u-pending"]');
  await pending.getByRole('button', { name: 'Refuser' }).click();
  await expect(pending).toContainText('Refusé');
  await page.goto('/login?as=pending');
  await expect(page).toHaveURL(/\/attente\?refus=1$/);
});

test('import bos-legacy-v1 : « Signé » arrive en décision Go DD, absent de l’accueil', async ({ page }) => {
  const errors = watchErrors(page);
  await loginAs(page, 'admin');
  await openDossiers(page);
  await page.getByRole('button', { name: 'Importer des dossiers' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Fichier JSON').setInputFiles(FIXTURE);
  const report = dialog.locator('[data-import-report]');
  await expect(report).toContainText('2 dossiers importés');
  await expect(report).toContainText('Dossier 3 : invalide');
  await dialog.getByRole('button', { name: 'Fermer' }).first().click();
  await expect(dialog).toBeHidden();

  const atlas = row(page, 'Projet Atlas');
  await expect(atlas).toContainText('Go DD');
  await expect(atlas).toContainText('Alice Admin');
  await expect(row(page, 'Projet Borée')).toContainText('IM reçu');

  await page.getByRole('link', { name: 'Accueil' }).click();
  await expect(page.locator('[data-deal-card]').filter({ hasText: 'Projet Borée' })).toBeVisible();
  await expect(page.getByText('Projet Atlas')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('import refusé à un analyste : pas de bouton', async ({ page }) => {
  await loginAs(page, 'analyst');
  await openDossiers(page);
  await expect(page.getByRole('button', { name: 'Nouveau dossier' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Importer des dossiers' })).toHaveCount(0);
});

test('un analyste ne voit pas le bouton Supprimer ; l’admin supprime après confirmation dans la page', async ({ page }) => {
  const errors = watchErrors(page);
  await loginAs(page, 'analyst');
  await openDossiers(page);
  await expect(row(page, 'Projet Hélios')).toBeVisible();
  await expect(page.getByRole('button', { name: /Supprimer/ })).toHaveCount(0);
  // the sample belongs to the admin: an analyst cannot archive it either
  await expect(row(page, 'Projet Hélios').getByRole('button', { name: /Archiver/ })).toHaveCount(0);

  await loginAs(page, 'admin');
  await openDossiers(page);
  const helios = row(page, 'Projet Hélios');
  await helios.getByRole('button', { name: 'Supprimer Projet Hélios' }).click();
  await expect(helios).toContainText('Supprimer définitivement ?');
  await helios.getByRole('button', { name: 'Annuler' }).click();
  await expect(helios).not.toContainText('Supprimer définitivement ?');
  await helios.getByRole('button', { name: 'Supprimer Projet Hélios' }).click();
  await helios.getByRole('button', { name: 'Confirmer la suppression' }).click();
  await expect(row(page, 'Projet Hélios')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('filtres : phase, statut (archivés), avis ; duplication et archivage', async ({ page }) => {
  const errors = watchErrors(page);
  await loginAs(page, 'admin');
  await page.evaluate(async (d) => { await (window as unknown as Hooks).__bosRepo.createDeal(d); }, blankDeal('Dossier neuf'));
  await openDossiers(page);
  await expect(page.locator('[data-deal-row]')).toHaveCount(2);

  await page.getByLabel('Phase', { exact: true }).selectOption('im_received');
  await expect(page.locator('[data-deal-row]')).toHaveCount(1);
  await expect(row(page, 'Dossier neuf')).toBeVisible();
  await page.getByLabel('Phase', { exact: true }).selectOption('analysis');
  await expect(page.locator('[data-deal-row]')).toHaveCount(1);
  await expect(row(page, 'Projet Hélios')).toBeVisible();
  await page.getByLabel('Phase', { exact: true }).selectOption('');
  await expect(page.locator('[data-deal-row]')).toHaveCount(2);

  // duplicate
  await row(page, 'Projet Hélios').getByRole('button', { name: 'Dupliquer Projet Hélios' }).click();
  await expect(row(page, 'Projet Hélios (copie)')).toContainText('IM reçu');
  await expect(page.locator('[data-deal-row]')).toHaveCount(3);

  // archive: leaves the default view, shows under "Archivés"
  await row(page, 'Dossier neuf').getByRole('button', { name: 'Archiver Dossier neuf' }).click();
  await expect(row(page, 'Dossier neuf')).toHaveCount(0);
  await page.getByLabel('Statut').selectOption('archived');
  await expect(page.locator('[data-deal-row]')).toHaveCount(1);
  await row(page, 'Dossier neuf').getByRole('button', { name: 'Désarchiver Dossier neuf' }).click();
  await expect(page.locator('[data-deal-row]')).toHaveCount(0);
  await page.getByLabel('Statut').selectOption('all');
  await expect(page.locator('[data-deal-row]')).toHaveCount(3);

  // avis: the blank deal lacks data ("À compléter"), the sample too, none are "Réserves"
  await page.getByLabel('Avis').selectOption('stop');
  await expect(page.locator('[data-deal-row]')).toHaveCount(0);
  await expect(page.getByText('Aucun dossier ne correspond aux filtres.')).toBeVisible();
  expect(errors).toEqual([]);
});

test('nouveau dossier : créé puis ouvert', async ({ page }) => {
  await loginAs(page, 'analyst');
  await openDossiers(page);
  await page.getByRole('button', { name: 'Nouveau dossier' }).click();
  await expect(page).toHaveURL(/\/projet\/[^/]+\/synthese$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Nouveau dossier' })).toBeVisible();
});

test('import d’IM (texte collé) : nouveau dossier avec les valeurs reconnues', async ({ page }) => {
  const errors = watchErrors(page);
  await loginAs(page, 'analyst');
  await openDossiers(page);
  await page.getByRole('button', { name: 'Importer un IM' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Ou collez des extraits de l’IM').fill(
    'Secteur : Logiciel métier\nPays : France\nExercice clos en 2025\nChiffre d’affaires : 12,4 M€\nEBITDA : 3,1 M€\nRevenus récurrents : 78 %\nPrix demandé : 30 M€',
  );
  await dialog.getByRole('button', { name: 'Analyser le texte' }).click();
  await expect(dialog.locator('[data-extract-row]')).toHaveCount(4);
  await dialog.getByRole('checkbox', { name: 'Revenus récurrents' }).uncheck();
  await expect(dialog.getByRole('button', { name: 'Appliquer au dossier ouvert' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Créer un nouveau dossier' }).click();
  await expect(page).toHaveURL(/\/projet\/[^/]+\/financiers$/);
  await expect(page.getByText('Logiciel métier')).toBeVisible();
  await expect(page.locator('#f-hist\\.rev\\.4')).toHaveValue('12,4');
  await expect(page.locator('#f-kpi\\.recurring')).toHaveValue('');
  expect(errors).toEqual([]);
});

test('en-tête du projet : note de comité et Excel téléchargés, IM appliqué au dossier ouvert', async ({ page }) => {
  // SheetJS comes from cdnjs: stub it so the test does not depend on the network.
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/xlsx/**', (r) => r.fulfill({
    contentType: 'application/javascript',
    body: `window.XLSX = { utils: { book_new: () => ({ s: [] }), aoa_to_sheet: (a) => ({ a }), book_append_sheet: (wb, ws, n) => wb.s.push(n) },
      write: (wb) => new TextEncoder().encode(wb.s.join('|')) };`,
  }));
  await loginAs(page, 'admin');
  await page.goto('/projet/demo-helios/synthese');
  await expect(page.getByRole('heading', { level: 1, name: 'Projet Hélios' })).toBeVisible();

  const [memo] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Note de comité' }).click()]);
  expect(memo.suggestedFilename()).toBe('Note_comite_Projet_Helios.html');
  const html = readFileSync(await memo.path(), 'utf8');
  expect(html).toContain('<h1>Projet Hélios</h1>');
  expect(html).toContain('Note préparatoire au comité d’investissement');

  const [xlsx] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Excel' }).click()]);
  expect(xlsx.suggestedFilename()).toBe('BOS_Projet_Helios.xlsx');
  expect(readFileSync(await xlsx.path(), 'utf8')).toBe('Synthèse|Données financières|Comparables|DCF|Rendement|Demandes');

  await page.getByRole('button', { name: 'Importer un IM' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Ou collez des extraits de l’IM').fill('Dette nette : 2,5 M€');
  await dialog.getByRole('button', { name: 'Analyser le texte' }).click();
  await dialog.getByRole('button', { name: 'Appliquer au dossier ouvert' }).click();
  await expect(page).toHaveURL(/\/projet\/demo-helios\/financiers$/);
  await expect(page.locator('#f-bs\\.netDebt')).toHaveValue('2,5');
});

test('admin : mandat et modèles de messages', async ({ page }) => {
  const errors = watchErrors(page);
  await loginAs(page, 'admin');
  await page.getByRole('link', { name: 'Administration' }).click();

  const hurdle = page.getByLabel('TRI cible (%)');
  await expect(hurdle).toHaveValue('15');
  await hurdle.fill('18');
  await page.getByRole('button', { name: 'Enregistrer le mandat' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Mandat enregistré' })).toBeVisible();

  const list = page.locator('[data-template]');
  await expect(list).toHaveCount(12);
  await page.locator('[data-template="reminder:en"]').click();
  const subject = page.getByLabel('Objet du modèle');
  await expect(subject).toHaveValue('{{deal.name}}: follow-up');
  await subject.fill('{{deal.name}}: gentle reminder');
  await page.getByRole('button', { name: 'Enregistrer le modèle' }).click();
  await expect(page.locator('[data-template="reminder:en"]')).toContainText('Modifié');
  await page.getByRole('button', { name: 'Rétablir le modèle par défaut' }).click();
  await expect(subject).toHaveValue('{{deal.name}}: follow-up');
  await expect(page.locator('[data-template="reminder:en"]')).not.toContainText('Modifié');

  // invitation
  await page.getByLabel('E-mail à inviter').fill('consultant@partenaire.fr');
  await page.getByLabel('Rôle de l’invité').selectOption('reader');
  await page.getByRole('button', { name: 'Inviter' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'consultant@partenaire.fr' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('administration réservée aux admins', async ({ page }) => {
  await loginAs(page, 'associate');
  await page.goto('/admin');
  await expect(page.getByText('Réservé aux administrateurs.')).toBeVisible();
  await expect(page.locator('[data-member]')).toHaveCount(0);
});

test('limites d’import : 500 dossiers par fichier, IM texte de 5 Mo au plus', async ({ page }) => {
  await loginAs(page, 'admin');
  await openDossiers(page);
  await page.getByRole('button', { name: 'Importer des dossiers' }).click();
  let dialog = page.getByRole('dialog');
  const many = { format: 'bos-legacy-v1', deals: Array.from({ length: 501 }, (_, i) => ({ name: `D${i}`, stage: 'IM reçu' })) };
  await dialog.getByLabel('Fichier JSON').setInputFiles({ name: 'many.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(many)) });
  await expect(dialog.locator('[data-import-report]')).toContainText('501 dossiers, 500 au maximum par import');
  await expect(dialog.locator('[data-import-report]')).toContainText('Aucun dossier importé');
  await dialog.getByRole('button', { name: 'Fermer' }).first().click();
  await expect(page.locator('[data-deal-row]')).toHaveCount(1);

  await page.getByRole('button', { name: 'Importer un IM' }).click();
  dialog = page.getByRole('dialog');
  await dialog.locator('input[type=file]').setInputFiles({ name: 'im.txt', mimeType: 'text/plain', buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 'a') });
  await expect(dialog.getByRole('alert')).toHaveText('Fichier texte trop volumineux : 5 Mo au maximum.');
});

test('membre actif sans rôle : « Rôle à définir »', async ({ page }) => {
  await loginAs(page, 'admin');
  await page.evaluate(async () => {
    await (window as unknown as { __bosRepo: { setMember(id: string, p: unknown): Promise<void> } }).__bosRepo.setMember('u-reader', { role: null });
  });
  await page.getByRole('link', { name: 'Administration' }).click();
  const select = page.locator('[data-member="u-reader"]').getByLabel('Rôle');
  await expect(select.locator('option:checked')).toHaveText('Rôle à définir');
  await select.selectOption('reader');
  await expect(select.locator('option:checked')).toHaveText('Lecteur');
  await expect(select.locator('option', { hasText: 'Rôle à définir' })).toHaveCount(0);
});

test('le dernier admin ne peut pas se retirer ses droits', async ({ page }) => {
  await loginAs(page, 'admin');
  await page.getByRole('link', { name: 'Administration' }).click();
  await expect(page.locator('[data-member="u-admin"]')).toBeVisible();
  const err = await page.evaluate(async () => {
    try {
      await (window as unknown as { __bosRepo: { setMember(id: string, p: unknown): Promise<void> } }).__bosRepo.setMember('u-admin', { role: 'associate' });
      return 'ok';
    } catch (e) { return (e as { code?: string }).code; }
  });
  expect(err).toBe('forbidden');
});
