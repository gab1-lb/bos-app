# BOS — application web d'équipe : plan de développement

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer BOS (page unique claude.ai) en application web d'équipe avec connexion Google, accueil de suivi façon Notion, messages pré-remplis par phase du BOTe, jauges de valorisation animées, en FR/EN.

**Architecture:** Next.js (App Router, TypeScript) sur Vercel, Supabase (Postgres + Auth Google + Realtime) en région Francfort. La logique métier (calculs, phases, droits, attentes, messages, import) vit dans des modules TypeScript purs testés unitairement ; l'interface lit et écrit via une interface `Repo` qui a deux implémentations : Supabase (production) et mémoire (tests de bout en bout). Les droits sont appliqués par la base (Row Level Security), l'interface ne fait que les refléter.

**Tech Stack:** Next.js 15, React 19, TypeScript 5 (strict), Supabase JS v2 + `@supabase/ssr`, Vitest, Playwright, PostgreSQL 16 (tests SQL locaux), SheetJS 0.18.5 et pdf.js 3.11.174 (chargés à la demande, comme aujourd'hui).

**Spec:** `docs/superpowers/specs/2026-11-24-bos-webapp-design.md`

## Global Constraints

- Code de l'application dans `/home/user/bos-app` (dépôt git ; poussé ensuite sur le dépôt GitHub fourni par l'utilisateur).
- Source de référence de la version actuelle : `/tmp/claude-0/-home-user/d4e25450-18b8-578f-ae79-363efbd2f870/scratchpad/bos/` (`model.js`, `data.js`, `app.js`, `en.js`, `style.css`, `terrain.min.svg`). Copier ces fichiers dans `bos-app/legacy/` à la tâche 1 : ils ne doivent plus être lus ailleurs.
- Connexion Google uniquement. Domaine autorisé : réglage `allowed_domain` ; premier admin : réglage `bootstrap_admin_email`.
- Personne du domaine à la première connexion → statut `pending`, aucune donnée visible.
- Rôles : `admin`, `associate`, `analyst`, `reader`. Analyste : modifie **tous** les dossiers, phases 1→3 seulement. Validation du BOTe, décision finale, suppression : `associate` ou `admin` ; un associate ne valide pas un BOTe dont il est responsable.
- Phases (clés) : `im_received`, `analysis`, `bote_written`, `associate_review`, `committee`, `decided` ; décisions : `go_dd`, `indicative_offer`, `no_go`. Un deal `decided` n'apparaît pas sur l'accueil.
- Attentes : orange > 7 jours, rouge > 14 jours. Destinataires : `director`, `seller`, `associate`, `committee`, `internal`.
- Messages : modèles pré-remplis, aucune rédaction par IA, aucun envoi automatique (Copier + lien `mailto:`).
- Animations : fondu-montée décalé de 60 ms, remplissage des jauges ~700 ms, aucune animation si `prefers-reduced-motion: reduce`.
- Hébergement : offres gratuites pour construire ; fonctions Vercel en région `fra1` ; Supabase région Francfort.
- Langues FR et EN, choix mémorisé par utilisateur (`members.locale`).
- Identité visuelle : celle de `legacy/style.css` (Inter, logo trois barres `#3e6cfa`, bandeau sombre avec `terrain.min.svg`).

## Review Focus

1. **Deux personnes modifient le même dossier en même temps** sur des champs différents : aucune des deux modifications ne doit être perdue → écriture champ par champ (`patch_deal`), test dans la tâche 7.
2. **Un utilisateur `pending` ou un analyste appelle l'API directement** (sans l'interface) pour lire un dossier ou valider un BOTe : refus par la base → tests RLS dans la tâche 7.
3. **Saisies vides, non numériques ou au format anglais** (« 12.4 », « 1,250.5 », « abc ») : valeur rejetée avec message, jamais `NaN` en base → tests dans la tâche 2.
4. **Dossier presque vide** (nouveau dossier sans chiffres) : accueil, synthèse et jauges s'affichent sans erreur avec des états vides → tests dans les tâches 4 et 10.
5. **Attente envoyée un soir, comptée le lendemain** : le calcul des jours de retard se fait en jours calendaires Europe/Paris, pas en tranches de 24 h → test dans la tâche 4.

---

### Task 1: Projet, moteur de calcul porté en TypeScript

**Files:**
- Create: `bos-app/` (Next.js : `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.gitignore`, `.env.example`)
- Create: `bos-app/legacy/*` (copie de la version actuelle)
- Create: `bos-app/src/engine/types.ts`, `bos-app/src/engine/finance.ts`, `bos-app/src/engine/screen.ts`, `bos-app/src/engine/samples.ts`
- Test: `bos-app/src/engine/finance.test.ts`, `bos-app/src/engine/screen.test.ts`

**Interfaces:**
- Produces:
  - `types.ts` : `Deal`, `Mandate`, `Adjustment`, `Comp`, `Question` (ajoute à la forme de `legacy/data.js` les champs `awaitedFrom: Recipient | null`, `sentAt: string | null` (ISO date), `answeredAt: string | null`), `Recipient = 'director'|'seller'|'associate'|'committee'|'internal'`.
  - `finance.ts` : `quantile(a: number[], p: number): number|null`, `irr(flows: number[]): number|null`, `base(d: Deal): Base`, `plan(d: Deal, years: number, o?: {growthShift?: number; marginShift?: number}): PlanRow[]|null`, `dcf(d: Deal, wacc?: number, g?: number): Dcf|null`, `comps(d: Deal): CompsResult`, `returns(d: Deal, o?: ReturnsOpts): Returns|null`, `maxPrice(d: Deal, hurdle: number): number|null`. Mêmes formules et mêmes noms de champs que `legacy/model.js`.
  - `screen.ts` : `screen(d: Deal, m: Mandate, cp: CompsResult, ret: Returns|null): Screen` (forme identique à `legacy/model.js`, raisons sous forme de codes).
  - `samples.ts` : `demoDeal(): Deal`, `blankDeal(name?: string): Deal`, `DEFAULT_MANDATE: Mandate`.

- [ ] **Step 1:** `npx create-next-app@15 bos-app --ts --app --src-dir --eslint --no-tailwind --import-alias "@/*"`, `git init`, ajouter `vitest`, copier les fichiers de la version actuelle dans `legacy/`. Commit `chore: scaffold`.
- [ ] **Step 2: Write the failing tests** (`finance.test.ts`, `screen.test.ts`) sur `demoDeal()` :

```ts
const d = demoDeal(); const b = base(d);
expect(b.adjEbitda).toBeCloseTo(2.90, 2);
expect(b.margin).toBeCloseTo(23.39, 1);
expect(returns(d)!.irr!).toBeCloseTo(0.1591, 3);
expect(returns(d)!.mom).toBeCloseTo(2.58, 2);
expect(maxPrice(d, 15)!).toBeCloseTo(43.93, 1);
expect(dcf(d)!.ev).toBeCloseTo(39.2, 1);
expect(comps(d).evEbitda.med).toBeCloseTo(13.46, 2);
const s = screen(d, DEFAULT_MANDATE, comps(d), returns(d));
expect([s.score, s.lowS, s.highS, s.code]).toEqual([91, 78, 93, 'go']);
expect(s.reasons[0][0]).toBe('go');
expect(base(blankDeal()).adjEbitda).toBeNull(); expect(returns(blankDeal())).toBeNull();
```

- [ ] **Step 3:** `npx vitest run src/engine` → FAIL (modules absents).
- [ ] **Step 4:** Porter `legacy/model.js` et `legacy/data.js` en TypeScript strict, sans changer la logique ; `blankDeal` initialise les nouveaux champs de `Question`.
- [ ] **Step 5:** `npx vitest run src/engine` → PASS.
- [ ] **Step 6:** Commit `feat(engine): port valuation and scoring engine`.

### Task 2: Langue et formats

**Files:**
- Create: `bos-app/src/i18n/en.ts` (dictionnaire repris de `legacy/en.js`), `bos-app/src/i18n/format.ts`
- Test: `bos-app/src/i18n/format.test.ts`

**Interfaces:**
- Produces: `type Locale = 'fr'|'en'`, `t(locale, key: string, ...args: (string|number)[]): string`, `fmt(locale)` → `{ nf(n, d?), meur(n, d?), pc(n, d?), mx(n, d?), sg(n, d?, unit?), unitM(): string }`, `parseNum(locale, s: string): number|null|'invalid'` (vide → `null`, illisible → `'invalid'`).

- [ ] **Step 1: Write the failing test**

```ts
expect(fmt('fr').meur(12.4)).toBe('12,4 M€'); expect(fmt('en').meur(12.4)).toBe('€12.4m');
expect(fmt('en').pc(15.9)).toBe('15.9%'); expect(fmt('fr').mx(14.48)).toBe('14,5×');
expect(parseNum('fr', '12,4')).toBe(12.4); expect(parseNum('en', '1,250.5')).toBe(1250.5);
expect(parseNum('en', '12.4')).toBe(12.4); expect(parseNum('fr', '')).toBeNull();
expect(parseNum('fr', 'abc')).toBe('invalid'); expect(parseNum('fr', '−3,5 %')).toBe(-3.5);
expect(t('en', 'TRI de {0} au prix d’entrée, au-dessus du seuil de {1}.', '15.9%', '15%')).toBe('IRR of 15.9% at the entry price, above the 15% hurdle.');
expect(t('en', 'clé inconnue')).toBe('clé inconnue');
```

(Le séparateur entre nombre et « M€ » est celui que produit `toLocaleString('fr-FR')` pour les espaces ; ajuster l'assertion à l'espace insécable utilisé, pas au contenu.)
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implémenter (reprendre `legacy/app.js` : `nf`, `meur`, `pc`, `mx`, `sg`, `parseNum`). **Step 4:** Run → PASS. **Step 5:** Commit `feat(i18n): locale formatting and translations`.

### Task 3: Phases et droits

**Files:**
- Create: `bos-app/src/domain/phases.ts`, `bos-app/src/domain/permissions.ts`
- Test: `bos-app/src/domain/phases.test.ts`, `bos-app/src/domain/permissions.test.ts`

**Interfaces:**
- Produces:
  - `Phase`, `Decision`, `PHASES: Phase[]` (ordre de la spec 5.3), `phaseLabel(locale, p)`.
  - `type Role = 'admin'|'associate'|'analyst'|'reader'`, `type MemberStatus = 'pending'|'active'|'denied'`, `type Member = { id: string; email: string; name: string; avatarUrl: string|null; role: Role|null; status: MemberStatus; locale: Locale }`.
  - `DealMeta = { id; ownerId; contributorIds: string[]; phase: Phase; phaseEnteredAt: string; decision: Decision|null; decidedAt: string|null; committeeDate: string|null; validatedBy: string|null; validatedAt: string|null; archived: boolean; updatedAt: string; updatedBy: string }`.
  - `can(member: Member, action: Action, deal?: DealMeta): boolean`, `Action = 'read'|'edit'|'create'|'setPhase:<Phase>'|'validateBote'|'decide'|'delete'|'archive'|'manageMembers'|'manageMandate'|'manageTemplates'|'import'`.
  - `suggestNextPhase(meta: DealMeta, s: Screen): Phase|null` (de `analysis` vers `bote_written` quand `s.coverage >= 0.7` et un prix existe).
- [ ] **Step 1: Write the failing tests** — tableau de cas : `pending` ne peut rien (`read` false) ; `reader` : `read` seulement ; `analyst` : `edit` sur un dossier dont il n'est ni responsable ni contributeur → true, `setPhase:bote_written` true, `setPhase:associate_review` false, `validateBote` false, `delete` false, `archive` true seulement si `ownerId` = lui ; `associate` : `validateBote` true sauf si `ownerId` = lui ; `decide` et `delete` true ; `admin` : tout, y compris `manageMembers`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implémenter. **Step 4:** Run → PASS. **Step 5:** Commit `feat(domain): phases and permissions`.

### Task 4: Attentes, retards et vue d'accueil

**Files:**
- Create: `bos-app/src/domain/waits.ts`, `bos-app/src/domain/home.ts`
- Test: `bos-app/src/domain/waits.test.ts`, `bos-app/src/domain/home.test.ts`

**Interfaces:**
- Consumes: `Deal`, `DealMeta`, `screen`, `base`, `returns`.
- Produces:
  - `type Wait = { dealId; source: 'question'|'phase'; label: string; from: Recipient; since: string; days: number; level: 'ok'|'late'|'overdue'; questionIndex?: number }`.
  - `daysSince(sinceIso: string, now: Date): number` (jours calendaires Europe/Paris).
  - `waitsFor(deal: Deal, meta: DealMeta, now: Date): Wait[]` : questions avec `sentAt` et sans `answeredAt` ; plus une attente `associate` si phase `associate_review` et pas `validatedAt` (depuis `phaseEnteredAt`) ; plus une attente `committee` si phase `committee` (depuis `phaseEnteredAt`). Niveau : `late` si `days > 7`, `overdue` si `days > 14`.
  - `homeCards(items: {deal: Deal; meta: DealMeta}[], mandate: Mandate, now: Date, suggest: (meta: DealMeta, waits: Wait[]) => string|null): HomeCard[]` — exclut `decided` et `archived` ; tri : nombre d'attentes `overdue` décroissant, puis `late`, puis `updatedAt` décroissant. `HomeCard = { meta; name; screen: Screen; irr: number|null; waits: Wait[]; coverage: {known: number; total: number}; suggestion: TemplateKey|null }`.
  - `homeCounters(cards: HomeCard[], now: Date): { active: number; toReview: number; lateWaits: number; committeeSoon: number }` (`committeeSoon` : `committeeDate` dans les 14 jours).
- [ ] **Step 1: Write the failing tests**

```ts
expect(daysSince('2026-11-10T22:30:00+01:00', new Date('2026-11-11T08:00:00+01:00'))).toBe(1);
// question envoyée il y a 8 jours au dirigeant → late ; 15 jours → overdue ; 7 jours → ok
// phase associate_review depuis 9 jours sans validation → attente 'associate' late
// homeCards : un deal decided est exclu ; blankDeal() produit une carte sans erreur (irr null, coverage 0/7)
// tri : deal avec 1 overdue avant deal avec 2 late
```

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implémenter (`suggestion` = résultat de la fonction `suggest` reçue en paramètre ; l'accueil, tâche 11, passe `suggestTemplate` de la tâche 5). **Step 4:** Run → PASS. **Step 5:** Commit `feat(domain): waits and home model`.

### Task 5: Messages pré-remplis

**Files:**
- Create: `bos-app/src/domain/templates.ts`
- Test: `bos-app/src/domain/templates.test.ts`

**Interfaces:**
- Produces:
  - `type TemplateKey = 'info_request'|'reminder'|'bote_review'|'committee_note'|'no_go'|'go_dd'`.
  - `type Template = { key: TemplateKey; locale: Locale; subject: string; body: string }` — variables `{{deal.name}}`, `{{rev}}`, `{{adjEbitda}}`, `{{margin}}`, `{{ask}}`, `{{askMultiple}}`, `{{range}}`, `{{irr}}`, `{{maxPrice}}`, `{{hurdle}}`, `{{thesis}}`, `{{risks}}`, `{{openQuestions}}` (liste à puces), `{{questionsFor}}` (questions ouvertes du destinataire choisi), `{{author}}`, `{{days}}`.
  - `DEFAULT_TEMPLATES: Template[]` : 6 modèles × 2 langues (texte à écrire, ton professionnel, court).
  - `renderTemplate(tpl: Template, ctx: { deal: Deal; meta: DealMeta; mandate: Mandate; author: Member; recipient?: Recipient; locale: Locale; now: Date }): { subject: string; body: string; missing: string[] }` — une variable sans valeur est remplacée par `[à compléter]` / `[to complete]` et listée dans `missing`.
  - `suggestTemplate(meta: DealMeta, waits: Wait[]): TemplateKey|null` : une attente `late`/`overdue` venant d'une question → `reminder` ; phase `analysis` avec questions non envoyées → `info_request` ; `bote_written` → `bote_review` ; `associate_review` validé → `committee_note` ; décision `no_go` → `no_go` ; `go_dd` → `go_dd`.
  - `mailtoHref(subject, body, to?: string): string`.
- [ ] **Step 1: Write the failing tests** — `committee_note` FR sur `demoDeal()` contient « Projet Hélios », « 15,9 % », « 43,9 M€ » ; EN contient « €43.9m » ; sur `blankDeal()` `missing` contient `irr` et le corps contient `[à compléter]` ; `suggestTemplate` pour chaque cas listé ; `mailtoHref` encode les retours à la ligne en `%0D%0A`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implémenter. **Step 4:** Run → PASS. **Step 5:** Commit `feat(domain): prefilled message templates`.

### Task 6: Import depuis la version actuelle (et export côté page actuelle)

**Files:**
- Create: `bos-app/src/domain/importLegacy.ts`
- Test: `bos-app/src/domain/importLegacy.test.ts`
- Modify: `/tmp/claude-0/-home-user/d4e25450-18b8-578f-ae79-363efbd2f870/scratchpad/bos/app.js` (bouton « Exporter mes dossiers (JSON) » dans `vDossiers`), puis reconstruire `bos.html` et republier l'artefact `https://claude.ai/artifact/MAkgBimmezPEuxSorAXZih`.

**Interfaces:**
- Produces: `importLegacy(json: unknown, importer: Member, now: Date): { items: { deal: Deal; meta: Omit<DealMeta,'id'> }[]; errors: string[] }`. Format d'export : `{ format: 'bos-legacy-v1', exportedAt, deals: Deal[] }` (mandat non inclus).
- Correspondance des étapes : `Présélection`, `IM reçu` → phase `im_received` ; `Offre indicative` → `decided` + `indicative_offer` ; `Due diligence`, `Offre ferme`, `Signé` → `decided` + `go_dd` ; `Abandonné` → `decided` + `no_go`. `ownerId` = importeur ; champ `team` conservé dans `deal.team`.
- [ ] **Step 1: Write the failing tests** — chaque étape ; JSON invalide ou mauvais `format` → `errors` non vide et `items` vide ; un dossier sans `hist` est complété par `blankDeal` (comme `migrate` dans `legacy/app.js`).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implémenter. **Step 4:** Run → PASS.
- [ ] **Step 5:** Ajouter le bouton d'export à la page actuelle (téléchargement via la capacité `downloads`, nom `BOS_export.json`), reconstruire, vérifier dans un navigateur sans erreur de console, republier. 
- [ ] **Step 6:** Commit `feat(domain): legacy import`.

### Task 7: Base de données, règles d'accès, inscription

**Files:**
- Create: `bos-app/supabase/migrations/0001_init.sql`, `bos-app/supabase/tests/rls.test.sql`, `bos-app/scripts/test-sql.sh`
- Test: `bos-app/supabase/tests/rls.test.sql`

**Interfaces:**
- Produces (schéma `public`) :
  - `app_settings(id int primary key default 1, allowed_domain text not null, bootstrap_admin_email text not null)`.
  - `members(id uuid pk references auth.users, email, name, avatar_url, role text check in roles or null, status text check in ('pending','active','denied'), locale text default 'fr', created_at)`.
  - `invites(email text pk, role text, invited_by uuid, created_at)`.
  - `mandate(id int pk default 1, data jsonb)`, `templates(key text, locale text, subject text, body text, updated_by uuid, primary key(key, locale))`.
  - `deals(id uuid pk, data jsonb not null, owner_id uuid, contributor_ids uuid[], phase text, phase_entered_at timestamptz, decision text, decided_at timestamptz, committee_date date, validated_by uuid, validated_at timestamptz, archived bool default false, updated_at timestamptz, updated_by uuid)`.
  - `activity(id bigserial, deal_id uuid, actor_id uuid, at timestamptz default now(), kind text, path text, old_value jsonb, new_value jsonb)`.
  - Fonctions : `current_member()`, `has_role(roles text[]) returns bool`, `patch_deal(p_id uuid, p_path text[], p_value jsonb) returns void` (`jsonb_set` sur `data`, met à jour `updated_at/updated_by`, écrit `activity`), `set_phase(p_id uuid, p_phase text)`, `validate_bote(p_id uuid)`, `decide(p_id uuid, p_decision text)` — toutes `security definer` et vérifiant les droits de la tâche 3 elles-mêmes.
  - Déclencheur sur `auth.users` insert : invité → `active` + rôle de l'invitation ; e-mail = `bootstrap_admin_email` → `active` + `admin` ; domaine = `allowed_domain` → `pending` ; sinon `denied`.
  - RLS : aucune ligne visible pour un membre non `active` ; `deals` lecture pour tous les `active`, écriture directe interdite (passer par les fonctions) ; `members`, `invites`, `mandate`, `templates` modifiables par `admin` seulement.
  - Realtime activé sur `deals` et `activity`.
- [ ] **Step 1:** `scripts/test-sql.sh` : installe/lance PostgreSQL 16 local, crée un schéma `auth` minimal (table `users`, fonction `auth.uid()` lisant `current_setting('test.uid')`), applique la migration puis `rls.test.sql`.
- [ ] **Step 2: Write the failing SQL tests** (assertions `DO $$ ... RAISE EXCEPTION` si échec) :
  - utilisateur `pending` : `select count(*) from deals` = 0 ;
  - analyste : `validate_bote` lève une erreur ; `set_phase(..., 'associate_review')` lève une erreur ; `patch_deal` sur un dossier d'un autre → OK ;
  - associate responsable du dossier : `validate_bote` lève une erreur ; autre associate → OK ;
  - deux `patch_deal` successifs sur `{kpi,churn}` et `{kpi,top10}` → les deux valeurs présentes ;
  - `insert into deals` direct par un analyste → refusé ;
  - inscription : e-mail hors domaine → `denied`, e-mail du domaine → `pending`, e-mail bootstrap → `admin active`.
- [ ] **Step 3:** `scripts/test-sql.sh` → FAIL. **Step 4:** Écrire la migration. **Step 5:** `scripts/test-sql.sh` → tous les tests passent. **Step 6:** Commit `feat(db): schema, RLS and signup rules`.

### Task 8: Accès aux données

**Files:**
- Create: `bos-app/src/data/repo.ts`, `bos-app/src/data/supabaseRepo.ts`, `bos-app/src/data/memoryRepo.ts`, `bos-app/src/data/index.ts`
- Test: `bos-app/src/data/memoryRepo.test.ts`

**Interfaces:**
- Produces: `interface Repo { me(): Promise<Member|null>; listDeals(): Promise<{deal: Deal; meta: DealMeta}[]>; getDeal(id): Promise<{deal; meta}|null>; createDeal(deal: Deal): Promise<string>; patchDeal(id, path: string[], value: unknown): Promise<void>; setPhase(id, p: Phase): Promise<void>; validateBote(id): Promise<void>; decide(id, d: Decision): Promise<void>; archive(id, v: boolean): Promise<void>; deleteDeal(id): Promise<void>; activity(dealId): Promise<ActivityEntry[]>; subscribe(dealId: string|null, cb: () => void): () => void; members(): Promise<Member[]>; setMember(id, patch: Partial<Pick<Member,'role'|'status'|'locale'>>): Promise<void>; invite(email, role: Role): Promise<void>; mandate(): Promise<Mandate>; setMandate(m: Mandate): Promise<void>; templates(): Promise<Template[]>; saveTemplate(t: Template): Promise<void> }`.
  - `getRepo()` : `memoryRepo` si `process.env.NEXT_PUBLIC_DATA_MODE === 'memory'`, sinon `supabaseRepo`.
  - `memoryRepo` applique `can()` de la tâche 3 (mêmes erreurs que la base) et démarre avec `demoDeal()` et un admin de test.
- [ ] **Step 1: Write the failing tests** sur `memoryRepo` : `patchDeal` sur deux chemins conserve les deux ; `validateBote` par un analyste rejette ; `subscribe` est appelé après `patchDeal` ; `activity` enregistre auteur et chemin.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implémenter les deux dépôts (`supabaseRepo` appelle les fonctions SQL de la tâche 7 via `rpc`). **Step 4:** Run → PASS. **Step 5:** Commit `feat(data): repository layer`.

### Task 9: Connexion Google et contrôle d'accès

**Files:**
- Create: `bos-app/src/app/login/page.tsx`, `bos-app/src/app/auth/callback/route.ts`, `bos-app/src/app/attente/page.tsx`, `bos-app/src/middleware.ts`, `bos-app/src/lib/supabase/{client,server}.ts`
- Test: `bos-app/e2e/auth.spec.ts`

**Interfaces:**
- Consumes: `Repo.me()`.
- Produces: routes `/login`, `/auth/callback`, `/attente` (statut `pending` : « Votre accès est en attente de validation par un administrateur »), refus (`denied` : « Ce compte Google n'est pas autorisé »). Le middleware redirige toute route vers `/login` sans session, vers `/attente` si `pending`/`denied`. En mode mémoire, `/login?as=<role>` connecte un utilisateur de test (désactivé hors mode mémoire).
- [ ] **Step 1: Write the failing e2e test** (mode mémoire) : sans session `/` → `/login` ; `as=pending` → `/attente` ; `as=analyst` → `/`.
- [ ] **Step 2:** `npx playwright test e2e/auth.spec.ts --trace off` → FAIL. **Step 3:** Implémenter (Supabase `signInWithOAuth({ provider: 'google' })`). **Step 4:** Run → PASS. **Step 5:** Commit `feat(auth): google sign-in and access gate`.

### Task 10: Coquille, système visuel, animations, onglets du projet

**Files:**
- Create: `bos-app/src/styles/bos.css` (tokens et composants de `legacy/style.css`), `bos-app/public/terrain.svg`, `bos-app/src/components/shell/{TopBar,Tabs,LocaleSwitch}.tsx`, `bos-app/src/components/ui/{Card,Chip,Metric,Spark,Field,Reveal,CountUp}.tsx`, `bos-app/src/app/projet/[id]/[tab]/page.tsx`, `bos-app/src/components/project/{Synthese,Financiers,Valorisation,Rendement,Demandes,Activite}.tsx`, `bos-app/src/components/valuation/Gauges.tsx`
- Test: `bos-app/src/components/valuation/gauges.test.ts`, `bos-app/e2e/project.spec.ts`

**Interfaces:**
- Consumes: moteur (tâche 1), `fmt`/`t` (tâche 2), `can` (tâche 3), `waitsFor` (tâche 4), `Repo` (tâche 8).
- Produces:
  - Navigation : **Accueil** (`/`), **Mon projet** (`/projet/<dernier dossier ouvert>/synthese`), **Mes dossiers** (`/dossiers`), plus **Administration** (`/admin`) pour les admins.
  - `gaugeScale(rows: {lo: number; mid: number; hi: number}[], marks: number[]): { min: number; max: number; ticks: number[]; x(v: number): number }` (même logique de pas « ronds » que `footballField` dans `legacy/app.js`).
  - `<Gauges rows marks={{ask, entry}} />` : piste arrondie pleine largeur, segment bas–haut en dégradé bleu animé de 0 à sa largeur en 700 ms (`cubic-bezier(.2,.8,.2,1)`), point de valeur centrale, repère vertical « Demandé » commun ; valeurs bas/haut affichées ; `aria-label` par jauge avec les trois valeurs.
  - `<Reveal index={n}>` : fondu + translation 8 px, délai `n × 60 ms` ; `<CountUp value format>` ; tous deux inactifs si `prefers-reduced-motion`.
  - Les 5 onglets reprennent le contenu et la mise en page des vues de `legacy/app.js` (`vSynthese`, `vFinanciers`, `vValo`, `vRendement`, `vDiligence`) ; chaque saisie appelle `Repo.patchDeal` avec le chemin du champ (`parseNum` de la tâche 2, message si `'invalid'`) ; les champs sont en lecture seule si `!can(me,'edit')`.
  - `Demandes` ajoute par question : destinataire (`awaitedFrom`), date d'envoi, date de réponse, niveau de retard ; boutons de phase (`set_phase`, `validate_bote`, `decide`) visibles selon `can` ; date de comité.
  - Quand `suggestNextPhase` (tâche 3) renvoie une phase, la synthèse affiche une bannière « Passer en <phase> ? » avec un bouton (si `can`).
  - `Activite` : journal (auteur, date, champ, ancienne → nouvelle valeur), mis à jour en direct via `Repo.subscribe`.
- [ ] **Step 1: Write the failing tests** — `gaugeScale` : avec rows `[{lo:34,mid:39,hi:46}]` et marks `[42]` → `min ≤ 34`, `max ≥ 46`, `x(min) = 0`, `x(max) = 100`, ticks croissants à pas constant ; rows vide → `ticks` vide sans exception. E2E (mode mémoire, `as=analyst`) : ouvrir `/projet/demo-helios/synthese`, voir « Opportunité à poursuivre » et 4 jauges dans `/valorisation` ; saisir `38` en VE demandée dans Données financières → la synthèse affiche le nouveau TRI ; saisir `abc` → message d'erreur et valeur inchangée ; ouvrir un `blankDeal` → synthèse et valorisation s'affichent avec états vides, sans erreur de console ; passer en anglais → « Preliminary view ».
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implémenter. **Step 4:** Run → PASS ; capture d'écran de la valorisation pour vérification visuelle. **Step 5:** Commit `feat(ui): shell, motion, gauges and project tabs`.

### Task 11: Accueil façon Notion et messages

**Files:**
- Create: `bos-app/src/app/page.tsx`, `bos-app/src/components/home/{Counters,DealCard}.tsx`, `bos-app/src/components/messages/MessageDialog.tsx`
- Test: `bos-app/e2e/home.spec.ts`

**Interfaces:**
- Consumes: `homeCards`, `homeCounters` (tâche 4), `renderTemplate`, `suggestTemplate`, `mailtoHref` (tâche 5), `Repo`.
- Produces: 4 compteurs (deals en cours, BOTe à relire, attentes en retard, comités sous 14 jours) ; une carte repliable par deal avec les puces de la spec 5.5 (phase, responsable + contributeurs avec avatar, « mis à jour par X il y a Y », couverture, attentes avec destinataire et jours, prochaine action, avis + TRI) ; bouton de la prochaine action → `MessageDialog` (sélection du modèle et du destinataire, aperçu modifiable, **Copier**, **Ouvrir dans la messagerie**, liste des variables `[à compléter]`). Mise à jour en direct.
- [ ] **Step 1: Write the failing e2e test** (mode mémoire) : l'exemple apparaît avec « Analyse en cours », une attente « Dirigeant » ; un deal `decided` n'apparaît pas ; cliquer la prochaine action ouvre un message contenant « Projet Hélios » ; **Copier** met le texte dans le presse-papiers (permission Playwright `clipboard-read`).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implémenter. **Step 4:** Run → PASS. **Step 5:** Commit `feat(home): notion-style board and prefilled messages`.

### Task 12: Mes dossiers, import, administration

**Files:**
- Create: `bos-app/src/app/dossiers/page.tsx`, `bos-app/src/app/admin/page.tsx`, `bos-app/src/components/admin/{Members,MandateForm,TemplateEditor}.tsx`, `bos-app/src/components/dossiers/{DealTable,ImportDialog,ImDialog}.tsx`, `bos-app/src/lib/exports/{xlsx,memo}.ts`
- Test: `bos-app/e2e/dossiers.spec.ts`

**Interfaces:**
- Consumes: `importLegacy` (tâche 6), `Repo`, `can`.
- Produces: tableau filtrable (phase, responsable, avis, archivés / décidés), création, duplication, archivage, suppression (confirmation dans la page) ; import JSON (admin/associate) avec rapport ; import d'IM (logique `extract`/`pdfPages` de `legacy/app.js`) ; exports Excel et note de comité (logique `exportXlsx`/`exportMemo` de `legacy/app.js`, téléchargement navigateur classique). Admin : liste des membres (approuver un `pending` avec un rôle, refuser, changer de rôle), invitations hors domaine, mandat unique, éditeur des 12 modèles.
- [ ] **Step 1: Write the failing e2e test** (mode mémoire) : un `pending` approuvé en `analyst` par l'admin peut ensuite ouvrir `/` ; importer un fichier `bos-legacy-v1` avec un dossier « Signé » → il apparaît dans Mes dossiers en décision « Go DD » et pas sur l'accueil ; un analyste ne voit pas le bouton Supprimer ; filtre par phase.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implémenter. **Step 4:** Run → PASS. **Step 5:** Commit `feat: deals list, import and admin`.

### Task 13: Déploiement et guide d'installation

**Files:**
- Create: `bos-app/vercel.json` (`{ "regions": ["fra1"] }`), `bos-app/docs/INSTALLATION.md`, `bos-app/supabase/seed.sql` (réglages, mandat par défaut, modèles par défaut, dossier exemple)
- Modify: `bos-app/.env.example` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_DATA_MODE`)

**Interfaces:**
- Consumes: migration (tâche 7), `DEFAULT_TEMPLATES` (tâche 5), `demoDeal`/`DEFAULT_MANDATE` (tâche 1).
- Produces: guide FR pas à pas, sans prérequis technique : créer le projet Supabase (région Francfort), coller la migration et le seed (en remplaçant `allowed_domain` et `bootstrap_admin_email`), créer les identifiants OAuth Google (écran de consentement, URI de redirection Supabase), activer Google dans Supabase, importer le dépôt dans Vercel, renseigner les variables, premier déploiement, première connexion admin, inviter l'équipe ; section « Passer en offre Pro » ; limites de l'offre gratuite (usage non commercial Vercel, pause Supabase après une semaine d'inactivité).
- [ ] **Step 1:** `npm run build` → succès ; `npx vitest run` → tout passe ; `scripts/test-sql.sh` → tout passe ; `npx playwright test --trace off` → tout passe.
- [ ] **Step 2:** Relire le guide en suivant chaque étape contre la migration et le seed (noms de réglages et variables identiques).
- [ ] **Step 3:** Commit `docs: deployment guide and seed`, puis pousser sur le dépôt GitHub de l'utilisateur quand il est fourni.
