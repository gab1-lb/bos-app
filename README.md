# BOS

BOS est l'outil d'équipe de l'acquéreur pour passer d'un mémorandum d'information (IM) à une note BOTe : dossiers, analyse financière (DCF, rendements, prix maximum), revue par un associé, comité, modèles d'e-mails, suivi des attentes et export Excel. Le texte est disponible en français et en anglais.

## Stack

Next.js 15 (App Router) et TypeScript, Supabase (PostgreSQL, authentification Google, sécurité par ligne, temps réel) hébergé en région UE (Francfort), déploiement sur Vercel (région `fra1`). Node 22 minimum.

## Développement local (mode mémoire, sans Supabase)

```bash
npm install
NEXT_PUBLIC_DATA_MODE=memory npm run dev
```

Ouvrez <http://localhost:3000/login?as=admin> pour entrer en administrateur (autres profils : voir `src/data/personas.ts`). Le mode mémoire est refusé par `npm run build` (production).

## Tests

- `npx vitest run` : tests unitaires (moteur financier, domaine, dépôt de données, seed SQL).
- `scripts/test-sql.sh` : migration, seed et règles de sécurité sur un PostgreSQL 16 jetable.
- `npx playwright test --trace off` : tests de bout en bout.
- `npm run gen:seed` : régénère `supabase/seed.sql` et `supabase/seed-demo.sql` depuis les sources TypeScript.
- `npm run record:tour` : réenregistre la vidéo de démonstration.

## Mise en production

Voir le guide pas à pas : [docs/INSTALLATION.md](docs/INSTALLATION.md).
