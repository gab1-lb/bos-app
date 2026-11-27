import { test, expect, type Page } from '@playwright/test';
import { blankDeal } from '../src/engine/samples';

const DEMO = 'demo-helios';
// Full timestamp: same clock time n days ago is n Paris calendar days ago whatever the UTC date.
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

type Hooks = {
  __bosRepo: {
    patchDeal(id: string, path: string[], v: unknown): Promise<void>;
    importDeal(deal: unknown, meta: unknown): Promise<string>;
    createDeal(deal: unknown): Promise<string>;
  };
};

function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

/** Example question 0 sent to the director 10 days ago (late), plus a decided deal. */
async function seed(page: Page) {
  const decided = blankDeal('Dossier décidé');
  await page.evaluate(async ({ id, sentAt, decided }) => {
    const r = (window as unknown as Hooks).__bosRepo;
    await r.patchDeal(id, ['questions', '0', 'awaitedFrom'], 'director');
    await r.patchDeal(id, ['questions', '0', 'sentAt'], sentAt);
    const t = new Date().toISOString();
    await r.importDeal(decided, {
      ownerId: '', contributorIds: [], phase: 'decided', phaseEnteredAt: t, decision: 'no_go', decidedAt: t,
      committeeDate: null, validatedBy: null, validatedAt: null, archived: false, updatedAt: t, updatedBy: '',
    });
  }, { id: DEMO, sentAt: daysAgo(10), decided });
}

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test.beforeEach(async ({ page }) => {
  await page.goto('/login?as=admin');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Accueil' })).toBeVisible();
});

test('accueil : l’exemple avec sa phase et son attente, sans le deal décidé', async ({ page }) => {
  const errors = watchConsole(page);
  const card = page.locator('[data-deal-card="demo-helios"]');
  await expect(card).toBeVisible();
  await expect(card.getByText('Analyse en cours').first()).toBeVisible();
  // The « À essayer » checklist belongs to the public demo only.
  await expect(page.locator('[data-try]')).toHaveCount(0);
  await expect(page.getByText('À essayer')).toHaveCount(0);
  await seed(page);
  // live update: the wait appears without reload
  const wait = card.locator('[data-wait]').filter({ hasText: 'Dirigeant' });
  await expect(wait).toBeVisible();
  await expect(wait).toContainText('10 j');
  await expect(wait).toHaveAttribute('data-level', 'late');
  await expect(page.getByText('Dossier décidé')).toHaveCount(0);
  await expect(page.locator('[data-counter="active"]')).toContainText('1');
  await expect(page.locator('[data-counter="lateWaits"]')).toContainText('1');
  // live update: a new active deal shows up
  await page.evaluate(async (d) => { await (window as unknown as Hooks).__bosRepo.createDeal(d); }, blankDeal('Dossier neuf'));
  await expect(page.locator('[data-deal-card]').filter({ hasText: 'Dossier neuf' })).toBeVisible();
  await expect(page.locator('[data-counter="active"]')).toContainText('2');
  // collapsible card, name links to the synthesis
  const toggle = card.getByRole('button', { name: /Replier/ });
  await toggle.click();
  await expect(wait).toBeHidden();
  await card.getByRole('button', { name: /Déplier/ }).click();
  await expect(wait).toBeVisible();
  await card.getByRole('link', { name: 'Projet Hélios' }).click();
  await expect(page).toHaveURL(new RegExp(`/projet/${DEMO}/synthese$`));
  expect(errors).toEqual([]);
});

test('prochaine action : message pré-rempli, copier, ouvrir dans la messagerie', async ({ page }) => {
  await seed(page);
  const card = page.locator('[data-deal-card="demo-helios"]');
  await expect(card.locator('[data-wait]').filter({ hasText: 'Dirigeant' })).toBeVisible();
  await card.getByRole('button', { name: 'Relancer' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Modèle')).toHaveValue('reminder');
  await expect(dialog.getByLabel('Destinataire')).toHaveValue('director');
  await expect(dialog.getByRole('textbox', { name: 'Objet' })).toHaveValue('Projet Hélios : relance');
  const body = dialog.getByLabel('Message', { exact: true });
  await expect(body).toContainText('Projet Hélios');
  await expect(body).toContainText('Quelle part du CA représentent les dix premiers clients ?');
  await expect(body).toContainText('Alice Admin');
  await expect(dialog.getByRole('link', { name: 'Ouvrir dans la messagerie' })).toHaveAttribute('href', /^mailto:\?subject=Projet%20H%C3%A9lios/);

  // switching template re-renders; recipient only for info_request / reminder
  await dialog.getByLabel('Modèle').selectOption('bote_review');
  await expect(dialog.getByLabel('Destinataire')).toHaveCount(0);
  await expect(dialog.getByRole('textbox', { name: 'Objet' })).toHaveValue('Projet Hélios : BOTe pour revue');
  await expect(dialog.getByText('Usage interne — contient des chiffres confidentiels')).toBeVisible();

  await dialog.getByLabel('Modèle').selectOption('reminder');
  await expect(dialog.getByText('Usage interne — contient des chiffres confidentiels')).toHaveCount(0);
  await expect(dialog.getByText('Message trop long pour la messagerie : utilisez Copier')).toHaveCount(0);
  await body.fill('x'.repeat(2000));
  await expect(dialog.getByText('Message trop long pour la messagerie : utilisez Copier')).toBeVisible();
  await body.fill('Bonjour,\n\nPoint sur le Projet Hélios.\n');
  await dialog.getByRole('button', { name: 'Copier', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Message copié' })).toBeVisible();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('Point sur le Projet Hélios.');

  await dialog.getByRole('button', { name: 'Fermer' }).click();
  await expect(dialog).toBeHidden();
});

test('variables à compléter listées quand le dossier est incomplet', async ({ page }) => {
  const d = blankDeal('Dossier neuf');
  const id = await page.evaluate(async (deal) => (window as unknown as Hooks).__bosRepo.createDeal(deal), d);
  const card = page.locator(`[data-deal-card="${id}"]`);
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Rédiger un message' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Modèle').selectOption('committee_note');
  await expect(dialog.getByLabel('Message', { exact: true })).toContainText('[à compléter]');
  await expect(dialog.locator('[data-missing]')).toContainText('Chiffre d’affaires');
});

test('points positifs / négatifs / à approfondir, FR puis EN', async ({ page }) => {
  const card = page.locator('[data-deal-card="demo-helios"]');
  await expect(card.getByRole('heading', { name: 'Points positifs' })).toBeVisible();
  await expect(card.getByRole('heading', { name: 'Points négatifs' })).toBeVisible();
  await expect(card.getByRole('heading', { name: 'À approfondir' })).toBeVisible();
  await expect(card.locator('[data-hl="positives"]')).toContainText('Récurrence');
  await expect(card.locator('[data-hl="toExplore"]')).toContainText('Questions décisives ouvertes');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByLabel('Langue').selectOption('en');
  await expect(card.getByRole('heading', { name: 'Strengths' })).toBeVisible();
  await expect(card.getByRole('heading', { name: 'Weaknesses' })).toBeVisible();
  await expect(card.getByRole('heading', { name: 'To investigate' })).toBeVisible();
  await expect(card.locator('[data-hl="positives"]')).toContainText('Recurring revenue');
});
