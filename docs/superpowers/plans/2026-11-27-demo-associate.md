# Démo « parcours associate » Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the public demo self-explanatory for an associate (from the acquirer) testing alone: welcome screen with role choice, realistic 5-deal dataset, an auto-ticking "À essayer" checklist, and a "Donner mon avis" feedback dialog — shipped in one push.

**Architecture:** Everything new is gated by `isDemo()` (build flag `NEXT_PUBLIC_DEMO=1`, set by `scripts/netlify-build.mjs` when `BOS_DEMO=1`). The demo never depends on cookies: the middleware lets demo pages through, the role is chosen in the client (welcome screen or `?as=` URL param) and applied to the in-memory repo without navigation. Checklist progress = repo state (deal phases, imported deals) + a small in-memory signal store for UI-only actions (page visited, message opened, data edited, feedback sent).

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, Vitest (`src/**/*.test.ts`), Playwright (`--trace off`, Chromium at `/opt/pw-browsers/chromium`).

**Spec:** `docs/superpowers/specs/2026-11-27-demo-associate-design.md`

## Global Constraints

- Entirely free; no new service, no new npm dependency.
- All new behaviour behind `isDemo()` from `src/lib/session.ts`, except the Netlify `ignore` rule. The team site (`NEXT_PUBLIC_DATA_MODE=supabase`) and the plain memory mode used by e2e must behave exactly as before.
- Every visible string in French with its English entry in `src/i18n/en.ts` (no duplicate keys — grep before adding).
- Phone width 390 px: no horizontal scroll. Existing BOS style (`src/styles/bos.css` tokens, `Reveal`, `.card`, `.btn`).
- All data fictitious; the acquirer's name appears nowhere in code or content.
- No intermediate push to `main` (each costs ~30 Netlify credits). Commit locally on `feat/bos-webapp`; pushing that branch is fine. Task 6 does the single push to `main`.
- Founder's e-mail never written in the repo: read at build from Netlify variable `BOS_FEEDBACK_EMAIL`, base64-encoded into `NEXT_PUBLIC_FEEDBACK_B64`, decoded only on click.
- Commit trailers: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01BaopDUTkAfJuSb86apM3bL`.

## Review Focus

1. Cookies refused (embedded preview, strict Safari): the demo must still show the welcome, accept a role and work — never a redirect loop. → Task 3 e2e `cookies refused`.
2. Switching role from the demo bar keeps the visitor's work (imported deal, validated Atlas) instead of resetting it. → Task 3 e2e `switching role keeps data`.
3. The associate validates or sends back Atlas via the existing phase steps — either path ticks the step; an analyst cannot validate. → Task 4 unit `derives steps`.
4. No mail client (webmail users): "Envoyer" may do nothing, "Copier mes réponses" must work and give the full text. Missing `NEXT_PUBLIC_FEEDBACK_B64` → only "Copier". → Task 5 unit + e2e.
5. Dates are relative to "now": Borée's late wait and Cérès's committee-in-5-days must hold whatever day the demo is opened. → Task 2 unit with two different `now`.

---

### Task 1: Skip Netlify builds when only docs/tests change

**Files:**
- Create: `scripts/netlify-ignore.mjs`, `src/lib/netlifyIgnore.test.ts`
- Modify: `netlify.toml` (`[build]` section)

**Interfaces:**
- Produces: `export function onlyNonBuildChanges(files: string[]): boolean` in `scripts/netlify-ignore.mjs`; when run as a script it exits `0` (skip build) or `1` (build).

- [ ] **Step 1: Write the failing test** `src/lib/netlifyIgnore.test.ts` importing `../../scripts/netlify-ignore.mjs`:
  - `onlyNonBuildChanges(['docs/a.md', 'e2e/x.spec.ts', 'src/domain/home.test.ts', 'README.md'])` → `true`
  - `onlyNonBuildChanges(['docs/a.md', 'src/app/page.tsx'])` → `false`
  - `onlyNonBuildChanges(['netlify.toml'])` → `false`
  - `onlyNonBuildChanges([])` → `false` (empty diff = unknown → build)
- [ ] **Step 2:** `npx vitest run src/lib/netlifyIgnore.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement.** Non-build paths: `^docs/`, `^e2e/`, `\.test\.tsx?$`, `\.md$`. Script mode (`import.meta.url === pathToFileURL(process.argv[1]).href`): if `CACHED_COMMIT_REF` or `COMMIT_REF` missing, or `git diff --name-only $CACHED_COMMIT_REF $COMMIT_REF` fails → exit 1; else exit `onlyNonBuildChanges(files) ? 0 : 1`, logging the decision. In `netlify.toml` `[build]`: `ignore = "node scripts/netlify-ignore.mjs"`.
- [ ] **Step 4:** test → PASS; `node scripts/netlify-ignore.mjs; echo $?` with no env → prints build decision, exit 1.
- [ ] **Step 5: Commit** `chore(netlify): skip builds when only docs or tests change`.

### Task 2: Demo dataset (Atlas, Borée, Cérès, Dune)

**Files:**
- Create: `src/engine/demoDeals.ts`, `src/engine/demoDeals.test.ts`
- Modify: `src/data/memoryRepo.ts` (options + seed), `src/data/index.ts` (demo seeding)

**Interfaces:**
- Produces: `export type SeedDeal = { deal: Deal; meta: DealMeta }`; `export function demoSeed(now: Date): SeedDeal[]` (Atlas, Borée, Cérès, Dune, in that order; ids `demo-atlas`, `demo-boree`, `demo-ceres`, `demo-dune`); `export const DEMO_DEAL_IDS: string[]` = `['demo-helios', 'demo-atlas', 'demo-boree', 'demo-ceres', 'demo-dune']`.
- Produces: `MemoryRepoOptions.extraDeals?: SeedDeal[]` — stored after Hélios, no activity entry.
- Consumes: `demoDeal()` / `blankDeal()` from `src/engine/samples.ts`; personas `analyst`, `associate`, `admin` from `src/data/personas.ts`.

Content (fictitious, vertical-software niches, France/Benelux/Spain, figures in M€, complete enough for jauges/LBO/points; exactly 1–2 missing data items each per `missingItems()`):
- **Atlas** — gestion de flottes pour transporteurs; owner `analyst.id`; phase `associate_review`, `phaseEnteredAt` = now − 2 days, not validated.
- **Borée** — logiciel pour laboratoires d'analyses; owner `analyst.id`; phase `analysis`; 3 questions `status: 'Envoyée'`, `sentAt` = now − 9 days, `awaitedFrom: 'director'`, unanswered.
- **Cérès** — ERP pour coopératives agricoles; owner `associate.id`; phase `associate_review` (BOTe validé, comité dans 5 jours), `committeeDate` = now + 5 days (ISO date `YYYY-MM-DD`), `validatedBy: associate.id`, `validatedAt` = now − 3 days.
- **Dune** — logiciel de billetterie; phase `decided`, `decision: 'no_go'`, `decidedAt` = now − 6 days; no-go reason written at the start of `risks` (e.g. « No-go : 45 % du CA sur un seul client public, marge en baisse 3 années de suite. »).
- All `example: true`, `source` « <Nom>_IM (exemple fictif) ».

- [ ] **Step 1: Write the failing tests** `src/engine/demoDeals.test.ts`, run for `now` = `2026-11-27T10:00:00Z` and `2027-03-02T10:00:00Z`:
  - `demoSeed(now).map(s => s.meta.id)` equals `['demo-atlas','demo-boree','demo-ceres','demo-dune']`; each `deal.id === meta.id`.
  - every deal: `missingItems(deal, meta).length` between 1 and 2.
  - `homeCards(...)` over Hélios + seed with `DEFAULT_MANDATE`: contains Atlas, Borée, Cérès, Hélios, not Dune; `homeCounters(cards, now)` → `toReview === 1`, `committeeSoon === 1`, `lateWaits >= 3`.
  - `createMemoryRepo({ me: associate, extraDeals: demoSeed(now) })`: `listDeals()` has 5 records; `validateBote('demo-atlas')` resolves; `createMemoryRepo()` (no option) still lists only `demo-helios`.
  - no string field of any seed deal contains the acquirer's name.
- [ ] **Step 2:** `npx vitest run src/engine/demoDeals.test.ts` → FAIL.
- [ ] **Step 3: Implement** `demoSeed`, the `extraDeals` option, and in `getRepo()` pass `extraDeals: demoSeed(new Date())` only when `process.env.NEXT_PUBLIC_DEMO === '1'` (literal check so other builds drop it).
- [ ] **Step 4:** `npx vitest run` → all PASS.
- [ ] **Step 5: Commit** `feat(demo): realistic fictitious deals at every stage`.

### Task 3: Cookie-free demo entry and welcome screen

**Files:**
- Create: `src/components/demo/Welcome.tsx`, `e2e/demo.spec.ts`
- Modify: `src/middleware.ts` (memoryGate demo branch), `src/lib/session.ts`, `src/lib/repo-context.tsx` (expose `switchPersona`), `src/components/shell/AppShell.tsx`, `src/components/shell/DemoBar.tsx`, `src/i18n/en.ts`, `src/styles/bos.css`, `playwright.config.ts`
- Spec: in `docs/superpowers/specs/2026-11-27-demo-associate-design.md`, replace the "Rôle par défaut" decision line with: demo never redirects except `/login?as=X` → `/?as=X`; role chosen client-side (welcome or `?as=`), remembered by cookie when allowed.

**Interfaces:**
- Produces: `export type DemoRole = 'associate' | 'analyst' | 'admin'`; `export function demoRoleFrom(v: string | null | undefined): DemoRole | null` in `src/lib/session.ts`.
- Produces: `RepoCtx.switchPersona(id: string): Promise<void>` in `src/lib/repo-context.tsx` (memory mode only: `asMember`, write `bos_as` cookie, `setMe`; same logic as the existing `__bosAs` hook, which now calls it).
- Produces: `useDemoChosen(): [boolean, (role: DemoRole) => Promise<void>]` hook (in `Welcome.tsx` or session helpers) — chosen = cookie `bos_as` present at load, or a role picked/`?as=` applied in this page life.

Behaviour:
- `memoryGate` when `isDemo()`: `/login` → redirect to `/` plus `?as=<role>` if `demoRoleFrom(as)`; every other path → `NextResponse.next()` (no cookie set, no redirect). Remove the `next`/default-persona code from commit 854bed1.
- `AppShell` in demo: if `?as=` valid → `switchPersona` then strip the param (`router.replace(pathname)`); else if not chosen → render `<Welcome />` instead of TopBar+children (DemoBar stays).
- `Welcome`: hero (navy + `terrain.svg`), title « Bienvenue dans la démo BOS », 2 lines « L'outil de l'analyste M&A pour le BOTe : de l'IM reçu à la décision du comité. Données fictives, rien n'est enregistré. », two cards « Je suis associate » (badge « Recommandé ») / « Je suis analyste » with one line each, link « Voir la vidéo (1 min) » opening the existing `TourDialog` (export it from `TourCard.tsx`).
- `DemoBar` role links become buttons calling `switchPersona` (no navigation); order Associé, Analyste, Administrateur.

- [ ] **Step 1: Playwright demo project.** Add a third `webServer` (`npx next dev -p ${PORT + 2}`, env `NEXT_PUBLIC_DATA_MODE=memory`, `NEXT_PUBLIC_DEMO=1`, `NEXT_PUBLIC_FEEDBACK_B64=` base64 of `test@example.com`, `NEXT_DIST_DIR=.next-demo-dev`) and project `demo` (`testMatch: /demo\.spec/`); add `/demo\.spec/` to the memory project's `testIgnore`; add `/.next-demo-dev/` to `.gitignore`.
- [ ] **Step 2: Write failing e2e** `e2e/demo.spec.ts`:
  - `welcome then associate`: goto `/` → heading « Bienvenue dans la démo BOS »; click « Je suis associate » → topbar shows `Aron Associate`, counter « BOTe à relire » shows 1, cards Atlas/Borée/Cérès/Hélios visible, Dune not.
  - `direct link`: goto `/login?as=associate` → no welcome, `Aron Associate`, URL path `/` without `?as`.
  - `cookies refused`: context route stripping `set-cookie` and `page.context().clearCookies()` before each navigation; goto `/` → welcome; pick associate → app works; no more than 2 main-frame navigations recorded.
  - `switching role keeps data`: as associate validate Atlas (deal page → « Valider le BOTe »), then demo bar « Analyste » → `Anna Analyst`, Atlas still validated.
- [ ] **Step 3:** `npx playwright test --project=demo --trace off` → FAIL.
- [ ] **Step 4: Implement** per Behaviour above.
- [ ] **Step 5:** demo project PASS; `npx playwright test --trace off` (all projects) PASS; `npx vitest run`, `npx tsc --noEmit`, `npx eslint src scripts` clean.
- [ ] **Step 6: Commit** `feat(demo): welcome screen and cookie-free role choice`.

### Task 4: "À essayer" checklist

**Files:**
- Create: `src/lib/demo/progress.ts`, `src/lib/demo/progress.test.ts`, `src/components/demo/TryCard.tsx`
- Modify: `src/components/home/HomeBoard.tsx` (render `<TryCard />` first when `isDemo()`), `src/components/messages/MessageDialog.tsx` (signal on open), `src/app/projet/[id]/[tab]/…` synthèse tab or `ProjectContext` (signal on view), `src/lib/session.ts` (`getMemorySessionRepo` wraps `patchDeal`/`updateItem`/`appendItem` in demo to signal `edit`), `src/i18n/en.ts`, `src/styles/bos.css`

**Interfaces:**
- Produces: `export type DemoSignal = 'synthese' | 'msg:committee_note' | 'msg:director' | 'edit' | 'feedback'`; `markDemo(s: DemoSignal): void` (no-op unless `isDemo()`); `useDemoSignals(): ReadonlySet<DemoSignal>` (module-level set + listeners, in memory only).
- Produces: `export type StepId = 'review_atlas' | 'open_synthese' | 'committee_msg' | 'import_im' | 'fill_missing' | 'write_bote' | 'director_msg' | 'feedback'`; `export function demoSteps(role: DemoRole, deals: DealRecord[], signals: ReadonlySet<DemoSignal>): { id: StepId; done: boolean; href: string | null }[]`.
- Consumes: `DEMO_DEAL_IDS` (Task 2), `DemoRole` (Task 3).

Step lists (in order) and done rules:
- associate: `review_atlas` (Atlas `meta.phase !== 'associate_review'` or `validatedAt` set; href `/projet/demo-atlas/demandes`, « Suivi du dossier »), `open_synthese` (signal `synthese`), `committee_msg` (signal `msg:committee_note`, also sent by the « Note de comité » download; href `/projet/demo-ceres/synthese`), `import_im` (any deal id not in `DEMO_DEAL_IDS`; href `/dossiers`), `feedback` (signal `feedback`; href null → opens the dialog from Task 5).
- analyst: `import_im`, `fill_missing` (signal `edit`), `write_bote` (any deal with `phase === 'bote_written'`, or any deal other than `demo-atlas` / `demo-ceres` in `associate_review`), `director_msg` (signal `msg:director` = MessageDialog opened with key `info_request` or `reminder`), `feedback`.
- admin: same list as associate.
- Labels FR: « Relire le BOTe d'Atlas, puis le valider ou le renvoyer », « Ouvrir une synthèse et ses données manquantes », « Préparer le message au comité (Cérès) », « Importer l'IM fictif Kepler » (+ download link `/demo/IM_Projet_Kepler_fictif.pdf`), « Compléter une donnée manquante », « Passer un dossier en « BOTe rédigé » », « Écrire au dirigeant », « Donner mon avis ».
- Card: title « À essayer », counter « 2 / 5 », collapsible, each step a checkbox-style row (done = struck + green check) linking to `href`; reloads deals on `repo.subscribe(null, …)`.

- [ ] **Step 1: Write failing unit tests** `progress.test.ts` (with `demoSeed` + Hélios records):
  - associate, untouched → all `done: false`, ids in the order above.
  - Atlas phase set to `analysis` (sent back) → `review_atlas` done; Atlas validated (`validatedAt` set) → done.
  - extra record id `x1` → `import_im` done for both roles.
  - analyst with signals `{edit, msg:director}` and a deal in `bote_written` → `fill_missing`, `director_msg`, `write_bote` done.
  - `markDemo` outside demo (env unset) leaves the set empty.
- [ ] **Step 2:** `npx vitest run src/lib/demo/progress.test.ts` → FAIL.
- [ ] **Step 3: Implement** `progress.ts`, signals at the listed call sites, `TryCard`.
- [ ] **Step 4: Add e2e** to `e2e/demo.spec.ts` `checklist ticks`: associate → card shows « 0 / 5 »; click first step → validate Atlas → back to Accueil (crumb/nav link, no reload) → « 1 / 5 » and that row checked; plain memory-mode home test still shows no « À essayer » (add assertion to `e2e/home.spec.ts`).
- [ ] **Step 5:** vitest + full Playwright + tsc + eslint PASS.
- [ ] **Step 6: Commit** `feat(demo): self-ticking "À essayer" checklist`.

### Task 5: "Donner mon avis"

**Files:**
- Create: `src/lib/demo/feedback.ts`, `src/lib/demo/feedback.test.ts`, `src/components/demo/FeedbackDialog.tsx`
- Modify: `scripts/netlify-build.mjs` (encode `BOS_FEEDBACK_EMAIL`), `src/components/shell/DemoBar.tsx` (button), `src/components/demo/TryCard.tsx` (feedback step opens dialog), `src/i18n/en.ts`, `src/styles/bos.css`, `e2e/demo.spec.ts`

**Interfaces:**
- Produces: `export type Feedback = { usefulness: 1 | 2 | 3 | 4 | 5 | null; missing: string; wouldUse: 'yes' | 'maybe' | 'no' | null; comment: string; role: DemoRole }`; `feedbackText(f: Feedback, locale: Locale): string`; `feedbackMailto(f: Feedback, to: string, locale: Locale): string`; `feedbackEmail(): string | null` (decodes `process.env.NEXT_PUBLIC_FEEDBACK_B64` with `atob`, null when absent/invalid/not containing `@`).
- Consumes: `markDemo('feedback')` (Task 4).

Copy (FR): title « Votre avis sur BOS » ; Q1 « Dans votre process M&A, BOS vous serait-il utile ? » (1–5) ; Q2 « Qu'est-ce qui manque le plus ? » ; Q3 « L'utiliseriez-vous sur un vrai dossier ? » (Oui / Peut-être / Non) + « Un commentaire ? » ; buttons « Envoyer par e-mail » (only when `feedbackEmail()` non-null; `<a href={mailto}>`) and « Copier mes réponses » (clipboard, toast « Réponses copiées »). Mail subject « Avis sur BOS (démo) ». Both actions call `markDemo('feedback')`.

- [ ] **Step 1: Write failing unit tests** `feedback.test.ts`:
  - `feedbackText` includes the role label, « 4 / 5 », the missing text and comment verbatim, « Oui »; empty answers render « — ».
  - `feedbackMailto(f, 'a@b.fr', 'fr')` starts with `mailto:a@b.fr?subject=` and decodes (via `decodeURIComponent`) back to the subject and `feedbackText` body; text containing `&`, `#`, line breaks and accents survives.
  - `feedbackEmail()` with env `btoa('a@b.fr')` → `'a@b.fr'`; unset → null; `'%%%'` → null.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement**; in `netlify-build.mjs`, when `BOS_DEMO=1` and `BOS_FEEDBACK_EMAIL` set, `NEXT_PUBLIC_FEEDBACK_B64 = Buffer.from(email.trim()).toString('base64')` (never log it).
- [ ] **Step 4: Add e2e** `feedback`: demo bar « Donner mon avis » → fill → « Envoyer par e-mail » link `href` starts with `mailto:test@example.com?subject=` ; « Copier mes réponses » (grant `clipboard-read`/`clipboard-write`) → clipboard contains the comment; checklist feedback step now done.
- [ ] **Step 5:** vitest + full Playwright + tsc + eslint PASS; `git grep -nE "[A-Za-z0-9._%+-]+@(gmail|outlook|hotmail|yahoo)\." -- src scripts e2e` → no match.
- [ ] **Step 6: Commit** `feat(demo): feedback dialog sent to the founder`.

### Task 6: Verify the demo build and ship once

**Files:** none new (fixes only if a check fails).

- [ ] **Step 1:** `BOS_DEMO=1 BOS_FEEDBACK_EMAIL=test@example.com NEXT_DIST_DIR=.next-demo URL=https://bosolution.netlify.app node scripts/netlify-build.mjs` → build OK; `next start` on it; headless check: `/` welcome; `/login?as=associate` → associate home with 4 cards + « À essayer »; 390 px → `scrollWidth === 390`; cookies stripped → still works; built JS does not contain `test@example.com` in clear (`grep -rl "test@example.com" .next-demo` → nothing).
- [ ] **Step 2:** team build sanity: `node scripts/netlify-build.mjs` with the `netlify.toml` env (supabase mode) → build OK, `/` redirects to `/login` with the Google button, no demo bar.
- [ ] **Step 3:** full `npx vitest run` and `npx playwright test --trace off` PASS; remove `.next-demo`.
- [ ] **Step 4:** final whole-branch review (subagent-driven-development final reviewer); fix findings.
- [ ] **Step 5:** confirm with the founder that `BOS_FEEDBACK_EMAIL` is set on the bosolution project, then single push `git -c push.negotiate=true push origin feat/bos-webapp:main`.
