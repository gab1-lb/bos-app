import { test, expect, type Page } from '@playwright/test';
import { demoDeal, blankDeal } from '../src/engine/samples';
import { returns } from '../src/engine/finance';
import { fmt } from '../src/i18n/format';

const DEMO = 'demo-helios';
const irrText = (askPrice: number) => {
  const d = demoDeal();
  d.askPrice = askPrice;
  const r = returns(d);
  return `TRI ${fmt('fr').pc((r!.irr as number) * 100)}`;
};

function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

async function openTab(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/login?as=analyst');
  await expect(page).toHaveURL(/\/$/);
});

test('synthèse puis valorisation de l’exemple', async ({ page }) => {
  await page.goto(`/projet/${DEMO}/synthese`);
  await expect(page.getByRole('heading', { level: 1, name: 'Projet Hélios' })).toBeVisible();
  await expect(page.getByText('Opportunité à poursuivre')).toBeVisible();
  await openTab(page, 'Valorisation');
  await expect(page).toHaveURL(new RegExp(`/projet/${DEMO}/valorisation$`));
  await expect(page.locator('[data-gauge]')).toHaveCount(4);
  await expect(page.getByRole('img', { name: /^Transactions · VE \/ EBITDA/ })).toBeVisible();
});

test('saisie de la VE demandée : nouveau TRI, puis saisie invalide refusée', async ({ page }) => {
  await page.goto(`/projet/${DEMO}/synthese`);
  await expect(page.getByText(irrText(42)).first()).toBeVisible();
  await openTab(page, 'Données financières');
  const ask = page.getByLabel('VE demandée (100 %)');
  await ask.fill('38');
  await ask.press('Enter');
  await expect(ask).toHaveValue('38,0');
  await ask.fill('abc');
  await ask.blur();
  await expect(page.getByRole('alert').filter({ hasText: 'Valeur non reconnue' })).toBeVisible();
  await expect(ask).toHaveValue('38,0');
  await openTab(page, 'Synthèse');
  expect(irrText(38)).not.toBe(irrText(42));
  await expect(page.getByText(irrText(38)).first()).toBeVisible();
});

test('un dossier vierge s’affiche avec des états vides, sans erreur', async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto(`/projet/${DEMO}/synthese`);
  await expect(page.getByRole('heading', { level: 1, name: 'Projet Hélios' })).toBeVisible();
  const blank = blankDeal('Dossier vierge');
  const id = await page.evaluate(async (deal) => {
    const w = window as unknown as { __bosRepo: { createDeal(d: unknown): Promise<string> }; __bosGo(p: string): void };
    const newId = await w.__bosRepo.createDeal(deal);
    w.__bosGo(`/projet/${newId}/synthese`);
    return newId;
  }, blank);
  await expect(page).toHaveURL(new RegExp(`/projet/${id}/synthese$`));
  await expect(page.getByRole('heading', { level: 1, name: 'Dossier vierge' })).toBeVisible();
  await expect(page.getByText('Prix à obtenir')).toBeVisible();
  await openTab(page, 'Valorisation');
  await expect(page.getByText('Renseignez le CA, l’EBITDA et au moins un comparable pour afficher les fourchettes.')).toBeVisible();
  await expect(page.locator('[data-gauge]')).toHaveCount(0);
  for (const tab of ['Données financières', 'Rendement & LBO', 'Demandes d’infos', 'Activité']) {
    await openTab(page, tab);
    await expect(page.locator('main')).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('passer en anglais', async ({ page }) => {
  await page.goto(`/projet/${DEMO}/synthese`);
  await expect(page.getByText('Avis préliminaire')).toBeVisible();
  await page.getByLabel('Langue').selectOption('en');
  await expect(page.getByText('Preliminary view')).toBeVisible();
});

test('un lecteur voit les champs en lecture seule', async ({ page }) => {
  await page.goto('/login?as=reader');
  await page.goto(`/projet/${DEMO}/financiers`);
  await expect(page.getByLabel('VE demandée (100 %)')).toHaveAttribute('readonly', '');
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Demandes d’infos' }).click();
  await expect(page.locator('[id="f-questions.0.sentAt"]')).toBeDisabled();
  await expect(page.locator('[id="f-questions.0.answeredAt"]')).toBeDisabled();
  await expect(page.getByLabel('Date de comité')).toBeDisabled();
});

test('demandes : destinataire, dates et retard', async ({ page }) => {
  await page.goto(`/projet/${DEMO}/demandes`);
  const first = page.getByRole('row').filter({ has: page.locator('[id="f-questions.0.q"]') });
  await first.getByLabel('Destinataire').selectOption('seller');
  await first.getByLabel('Envoyée le').fill('2020-01-01');
  await first.getByLabel('Envoyée le').blur();
  await expect(first.getByText(/j de retard/)).toBeVisible();
  await expect(first.getByLabel('Statut')).toHaveValue('Envoyée');
  await first.getByLabel('Envoyée le').fill('');
  await first.getByLabel('Envoyée le').blur();
  await expect(first.getByLabel('Statut')).toHaveValue('Ouverte');
  await expect(first.getByText(/j de retard/)).toHaveCount(0);
  await openTab(page, 'Activité');
  await expect(page.getByText('questions.0.sentAt', { exact: true }).first()).toBeVisible();
});

test('demandes : une question supprimée par un collègue ne détourne pas la saisie en cours', async ({ page }) => {
  type R = { __bosRepo: {
    removeItem(id: string, list: string, itemId: string): Promise<void>;
    getDeal(id: string): Promise<{ deal: { questions: { id: string; q: string; answer: string }[] } }>;
  } };
  await page.goto(`/projet/${DEMO}/demandes`);
  const third = page.locator('[data-question="helios-q3"]');
  const answer = third.getByLabel('Réponse');
  await answer.click();
  await answer.fill('Contrat de travail joint');
  // meanwhile, someone else deletes the first question: the rows shift while the field is focused
  await page.evaluate(async (id) => { await (window as unknown as R).__bosRepo.removeItem(id, 'questions', 'helios-q1'); }, DEMO);
  await expect(page.locator('[data-question="helios-q1"]')).toHaveCount(0);
  await expect(answer).toHaveValue('Contrat de travail joint');
  await answer.blur();
  await expect.poll(async () => page.evaluate(async (id) => {
    const { deal } = await (window as unknown as R).__bosRepo.getDeal(id);
    return deal.questions.map((q) => [q.id, q.answer]);
  }, DEMO)).toEqual([['helios-q2', ''], ['helios-q3', 'Contrat de travail joint'], ['helios-q4', '']]);
});

test('retraitements et comparables : ajout puis suppression par ligne', async ({ page }) => {
  await page.goto(`/projet/${DEMO}/financiers`);
  const qoe = page.locator('.card').filter({ hasText: 'Qualité des résultats' });
  await expect(qoe.getByLabel('Libellé')).toHaveCount(3);
  await qoe.getByRole('button', { name: 'Ajouter' }).click();
  await expect(qoe.getByLabel('Libellé')).toHaveCount(4);
  await qoe.getByLabel('Libellé').nth(3).fill('Loyer intragroupe');
  await qoe.getByLabel('Libellé').nth(3).press('Enter');
  await qoe.getByRole('button', { name: 'Supprimer' }).first().click();
  await expect(qoe.getByLabel('Libellé')).toHaveCount(3);
  await expect(qoe.getByLabel('Libellé').nth(2)).toHaveValue('Loyer intragroupe');
  await openTab(page, 'Valorisation');
  const comps = page.locator('.card').filter({ hasText: 'Transactions comparables' });
  await expect(comps.getByLabel('Cible')).toHaveCount(6);
  await comps.getByRole('button', { name: 'Supprimer' }).nth(1).click();
  await expect(comps.getByLabel('Cible')).toHaveCount(5);
  await expect(comps.getByLabel('Cible').nth(1)).toHaveValue('Cible C (illustratif)');
});

test('fiche du dossier : un associate change le responsable, un analyste ajoute un contributeur', async ({ page }) => {
  await page.goto(`/projet/${DEMO}/demandes`);
  // analyst: owner locked, contributors editable
  const owner = page.getByLabel('Responsable', { exact: true });
  await expect(owner).toBeDisabled();
  await expect(owner).toHaveValue('u-admin');
  await page.getByLabel('Aron Associate').check();
  await expect(page.getByLabel('Aron Associate')).toBeChecked();
  await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Accueil' }).click();
  const card = page.locator('[data-deal-card="demo-helios"]');
  await expect(card).toContainText('1 contributeur');

  await page.goto('/login?as=associate');
  await page.goto(`/projet/${DEMO}/demandes`);
  await expect(owner).toBeEnabled();
  await owner.selectOption({ label: 'Anna Analyst' });
  await expect(page.locator('.pagehead')).toContainText('Responsable : Anna Analyst');
  await openTab(page, 'Activité');
  await expect(page.locator('.logrow').first()).toContainText('Responsable');
});
