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
});

test('demandes : destinataire, dates et retard', async ({ page }) => {
  await page.goto(`/projet/${DEMO}/demandes`);
  const first = page.getByRole('row').filter({ has: page.locator('[id="f-questions.0.q"]') });
  await first.getByLabel('Destinataire').selectOption('seller');
  await first.getByLabel('Envoyée le').fill('2020-01-01');
  await first.getByLabel('Envoyée le').blur();
  await expect(first.getByText(/j de retard/)).toBeVisible();
  await openTab(page, 'Activité');
  await expect(page.getByText('questions.0.sentAt')).toBeVisible();
});
