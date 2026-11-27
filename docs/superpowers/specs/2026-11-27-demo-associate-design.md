# Démo « parcours associate » — design

Date : 2026-11-27 · Statut : en attente d'approbation

## Intention

Le fondateur (analyste, ex-stagiaire M&A chez TSS) veut envoyer BOS à **un associate de TSS** pour qu'il
le teste **seul, sans accompagnement**, sur la **démo publique** (bosolution.netlify.app, build
`BOS_DEMO=1`, données fictives en mémoire du navigateur) avec **l'IM fictif proposé par le site**.
L'associate ouvre le lien entre deux réunions : en moins de 2 minutes il doit comprendre à quoi sert
BOS, voir l'outil **de son point de vue** (relire/valider un BOTe, voir ce qui l'attend, préparer le
comité) et pouvoir **renvoyer un avis** au fondateur sans effort. Son retour décidera des chantiers
suivants (import robuste, export PowerPoint, NDA, mémoire des deals…), hors périmètre ici.

## Objectifs

1. **Écran de bienvenue** (démo seulement, à la première arrivée sans rôle choisi) : une page, style BOS
   (héros navy + relief), 2 lignes de promesse, choix du rôle **Associate** (recommandé) ou **Analyste**,
   lien « Voir la vidéo (1 min) » (la vidéo existante `tour-fr.mp4` / `tour-en.mp4`). Le choix mène à
   l'Accueil dans ce rôle.
   - Lien direct sans bienvenue : `/login?as=associate` (route existante) — c'est le lien que le fondateur
     enverra.
2. **Carte « À essayer »** sur l'Accueil (démo seulement), propre au rôle, 4–5 étapes qui se cochent
   toutes seules quand l'action est faite, avec un lien qui mène au bon endroit :
   - Associate : relire le BOTe d'Atlas puis le **valider** ou le **renvoyer** ; ouvrir la **Synthèse**
     et ses données manquantes ; rédiger le **message au comité** (Cérès) ; **importer l'IM fictif**
     Kepler ; **donner son avis**.
   - Analyste : importer l'IM Kepler ; compléter une donnée manquante ; passer un dossier en
     « BOTe rédigé » / revue associate ; rédiger un message au dirigeant ; donner son avis.
   - Repliable ; l'état coché vit en mémoire comme le reste de la démo (un rechargement remet à zéro).
3. **Jeu de données démo réaliste** (démo seulement ; le mode mémoire des tests garde son seul dossier
   Hélios pour ne pas casser les e2e). Tous fictifs, cohérents avec le mandat par défaut
   « Consolidateur logiciel vertical · détention longue » :
   - **Hélios** — tel qu'aujourd'hui (analyse en cours).
   - **Atlas** — BOTe en **revue associate** : il attend l'associate (responsable : l'analyste).
   - **Borée** — analyse en cours, **questions envoyées au dirigeant il y a 9 jours** sans réponse
     (attente en retard).
   - **Cérès** — **présentation comité** dans 5 jours, BOTe validé.
   - **Dune** — **no-go** décidé (quitte l'Accueil, visible dans Mes dossiers) avec sa raison.
   Chaque dossier a des chiffres complets et plausibles (CA, EBITDA, croissance, récurrence, clients,
   prix demandé) pour que jauges, LBO, points positifs/négatifs et données manquantes aient du sens ;
   1–2 données manquantes volontaires par dossier.
4. **« Donner mon avis »** : bouton dans le bandeau démo + dernière étape de la carte. Ouvre une petite
   fenêtre avec 3 questions — utilité dans votre process (note 1–5) ; ce qui manque le plus (texte) ;
   l'utiliseriez-vous sur un vrai dossier (oui / peut-être / non + commentaire). Bouton **« Envoyer par
   e-mail »** = lien `mailto:` pré-rempli (objet + réponses) vers l'adresse du fondateur ; bouton
   **« Copier le texte »** en secours (webmail sans client mail). Aucun serveur, aucun compte.
   - Adresse fournie au build par une variable Netlify `NEXT_PUBLIC_FEEDBACK_EMAIL` du projet démo
     (pas écrite dans le dépôt GitHub public). Sans variable : seulement « Copier le texte ».
5. **Correctif boucle de redirection** (commit 854bed1, déjà prêt) livré dans le même envoi.
6. **Économie de crédits Netlify** : règle `ignore` dans `netlify.toml` qui saute le build quand seuls
   `docs/`, `e2e/`, des `*.test.ts` ou des `*.md` changent. Tout le chantier part en **un seul envoi**
   (≈ 30 crédits, les deux sites).

## Non-objectifs

Import d'IM sur vrais documents (tableaux, OCR), confidentialité/NDA, export PowerPoint, mémoire des
deals, tableau de bord pipeline, visite guidée à bulles, stockage serveur des avis, toute modification
du comportement du site d'équipe (bos-app-bnq1).

## Anti-objectifs (échec même si ça « marche »)

- L'associate tombe sur une erreur, une page de connexion, ou un écran vide.
- Il ne sait pas quoi faire en arrivant, ou ne voit que la vue analyste.
- Donner son avis demande un compte, plus de 2 minutes, ou ne parvient jamais au fondateur.
- Le site d'équipe change de comportement, ou le chantier coûte plusieurs envois Netlify.
- Une donnée laisse croire qu'il s'agit d'un vrai dossier TSS (tout est fictif ; TSS n'est cité nulle part).

## Contraintes

- Entièrement gratuit ; aucun service nouveau.
- Tout le nouveau comportement derrière `isDemo()` (build `NEXT_PUBLIC_DEMO=1`), sauf la règle `ignore`.
- FR/EN (dictionnaire `src/i18n/en.ts`), mobile (390 px sans défilement horizontal), style BOS existant,
  animations existantes (`Reveal`).
- Permissions existantes respectées (l'associate valide/renvoie, l'analyste ne peut pas valider).
- Tests : unitaires pour la détection des étapes et le jeu de données ; e2e pour le parcours associate
  (bienvenue → valider Atlas → étape cochée → avis) sur un serveur démo dédié ; suite existante verte.

## Approches considérées

- **A. Démo « parcours associate »** (bienvenue + carte « À essayer » + jeu de données + avis) —
  **choisie par le fondateur.** Meilleur rapport impression/effort, répond directement à l'objectif.
- B. Visite guidée interactive à bulles : spectaculaire mais plus longue et fragile au moindre changement
  d'écran.
- C. Aucun code (lien + e-mail d'instructions) : immédiat, mais l'associate risque de ne voir que la vue
  analyste et de passer à côté de ce qui le concerne.

## Décisions de conception (appels du concepteur, corrigeables)

- Rôle par défaut sans choix : l'écran de bienvenue (et non plus l'entrée directe en analyste) ; si les
  cookies sont refusés, entrée directe en associate (pas de boucle).
- Avancement des étapes déduit de l'état du dépôt mémoire et du journal d'activité (ex. Atlas validé ou
  renvoyé ; dossier importé) plutôt que de clics, pour rester juste quel que soit le chemin pris.
- Personas inchangés (Anna Analyst, Aron Associate…) pour ne pas toucher aux e2e.
- Pas de vue Accueil séparée par rôle : le point de vue associate passe par la carte « À essayer » (dont la
  1re étape mène à Atlas), le compteur existant « BOTe à relire » (= 1 grâce à Atlas) et le jeu de données.
  Une vraie vue « Ce qui vous attend » par rôle serait un changement du site d'équipe : à décider après
  le retour de l'associate.
- « Renvoyer » = l'action existante de retour à une phase antérieure (étapes de phase). L'étape est cochée
  dès qu'Atlas quitte `associate_review` (validé ou renvoyé). Pas de nouveau bouton ni de commentaire.
- Raison du no-go de Dune : écrite dans les textes existants du dossier (risques / thèse), sans nouveau champ.
- Branches : tout le travail reste local sur `feat/bos-webapp` ; aucun envoi intermédiaire, aucune PR
  (pas de déploiement de prévisualisation). Un seul envoi final vers `main`, qui alimente les deux sites.
- L'entrée directe en analyste du correctif 854bed1 est remplacée par l'écran de bienvenue (toujours
  sans redirection, donc sans boucle).
- Tests démo e2e : un troisième serveur Playwright avec `NEXT_PUBLIC_DEMO=1`.

## Laissé au constructeur

Textes exacts (FR/EN), mise en page de la bienvenue et de la carte, chiffres précis des dossiers fictifs,
détection précise de chaque étape, ordre des commits.
