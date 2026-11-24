# BOS — application web d'équipe pour le BOTe M&A

*Document de conception · 24 novembre 2026 · statut : à valider*

## 1. Intention

BOS aide une équipe M&A côté acquéreur industriel (profil « consolidateur de logiciels verticaux qui conserve ses acquisitions », type TSS) à produire le **BOTe** (*Business Overview*) d'une cible : la première analyse, **avant la due diligence**, qui permet au comité de décider si l'on continue.

Aujourd'hui, BOS existe sous forme d'une page unique hébergée sur claude.ai (artefact `https://claude.ai/artifact/MAkgBimmezPEuxSorAXZih`, source locale `bos.html`). Elle couvre l'analyse d'un dossier (synthèse, données financières et QoE, valorisation, rendement / LBO, demandes d'infos, FR/EN) mais chaque utilisateur voit seulement ses propres dossiers.

L'utilisateur veut :
1. **Plusieurs personnes** de l'équipe (analystes, associate) sur les **mêmes dossiers**, chacun avec son compte.
2. Une **application indépendante** (hors claude.ai), avec **connexion Google**.
3. Un **accueil façon Notion** qui montre d'un coup d'œil, par deal : ce qui est à jour, qui travaille dessus, ce qu'on attend et de qui (dirigeant, associate…), la phase du deal.
4. Des **propositions d'action** à chaque étape, sous forme de **messages pré-remplis** (pas de rédaction par IA), par exemple le message au comité quand le BOTe est terminé.
5. Une **valorisation en jauges** plus belles que le graphique actuel, et du **mouvement** : textes qui apparaissent, jauges qui se remplissent à l'arrivée sur une page.
6. La navigation **Accueil → Mon projet → Mes dossiers**.

## 2. Objectifs, non-objectifs, anti-objectifs

**Objectifs**
- Une équipe peut suivre tous ses deals en phase BOTe depuis un seul écran et savoir, sans ouvrir chaque dossier, ce qui bloque et qui doit agir.
- Un analyste produit le BOTe d'un dossier dans BOS (chiffres, retraitements, valorisation, rendement, thèse, questions) et l'envoie au comité avec un message prêt.
- Chaque modification est attribuée (qui, quand).

**Non-objectifs (cette version)**
- Pas de rédaction de texte par IA.
- Pas de modélisation post-acquisition détaillée ni de suivi de due diligence complet (la DD est après le BOTe).
- Pas de connexion à des bases de données de marché payantes (Capital IQ, Mergermarket) : les transactions comparables restent saisies à la main.
- Pas d'application mobile native (le site doit rester utilisable sur téléphone, en lecture surtout).
- Pas d'envoi automatique d'e-mails : BOS prépare le message, l'utilisateur le copie et l'envoie lui-même.

**Anti-objectifs (échec même si « ça marche »)**
- Des données de deal visibles par une personne hors de l'équipe autorisée.
- Une interface chargée ou des animations qui ralentissent le travail : chaque animation dure moins d'une seconde et ne bloque jamais la saisie.
- Une note ou un avis qui paraît plus certain que les données ne le permettent (règle déjà en place : note « provisoire » et fourchette tant que des données manquent).

## 3. Contraintes

- **Confidentialité** : noms de cibles et chiffres non publics. Données hébergées dans l'Union européenne.
- **Connexion Google** uniquement (Google Workspace de l'entreprise ou comptes Google invités).
- **Hébergement** : Vercel (application) + Supabase (base PostgreSQL, authentification, temps réel), région Francfort. Comptes à créer par l'utilisateur ; dépôt GitHub fourni par l'utilisateur.
- **Coût** (décision utilisateur) : **offres gratuites pour construire et tester**, passage aux offres Pro (environ 45 $/mois) avant l'utilisation réelle par l'équipe. Points à connaître : l'offre gratuite Vercel n'autorise pas l'usage commercial et l'offre gratuite Supabase met en pause un projet inactif après une semaine. Les fonctions serveur Vercel sont fixées à la région de Francfort (`fra1`) dès le départ.
- **Langues** : français et anglais, choix mémorisé par utilisateur.
- **Identité visuelle** : celle de la version actuelle (police Inter, logo BOS à trois barres obliques bleues `#3e6cfa`, cartes arrondies, bandeau sombre avec relief `terrain.svg`, pastilles de statut). La page actuelle sert de référence visuelle.

## 4. Approches envisagées

| | Approche | Avantages | Inconvénients |
|---|---|---|---|
| A | Garder la page claude.ai, avec un espace de données partagé | Rapide, gratuit, aucun hébergement | Chaque membre doit avoir un compte Claude et être invité ; dépendance à claude.ai |
| **B** | **Application web indépendante (Next.js + Supabase), connexion Google** | Accessible à toute l'équipe sans compte Claude ; contrôle complet des accès et des données ; évolutive | Plus de travail ; hébergement, sécurité et coût à gérer |

**Choix de l'utilisateur : B.**

## 5. Ce qui est décidé

### 5.1 Pile technique (choix de l'analyste-développeur, validé dans la conversation)
- Next.js (App Router) + TypeScript, déployé sur Vercel.
- Supabase : PostgreSQL, Auth (fournisseur Google), Row Level Security, Realtime.
- Le moteur de calcul actuel (`model.js` : base, plan, DCF, comparables, rendement / LBO, prix maximal au TRI cible, grille de notation) est repris en TypeScript **sans changer la logique**, avec des tests unitaires qui reproduisent les résultats du dossier exemple (TRI 15,9 %, prix max 43,9 M€ au seuil de 15 %, EBITDA retenu 2,90 M€, note 91/100 provisoire).
- Les traductions FR/EN actuelles (`en.js`) sont reprises.

### 5.2 Accès et rôles
- Connexion Google. Accès restreint : **un domaine d'entreprise autorisé** (variable de configuration `ALLOWED_DOMAIN`, renseignée à l'installation) **plus une liste d'e-mails invités** (pour les personnes hors domaine). Toute autre connexion est refusée avec un message clair.
- **Première connexion** (décision utilisateur) : toute personne du domaine arrive avec le statut **« en attente d'approbation »** et ne voit aucune donnée tant qu'un admin ne lui a pas attribué un rôle. Un invité hors domaine reçoit son rôle au moment de l'invitation.
- **Premier admin** (proposition non contestée) : l'adresse e-mail de l'utilisateur, définie par la variable `BOOTSTRAP_ADMIN_EMAIL`.
- Rôles :
  - **Admin** : gère les membres, le mandat acquéreur unique de l'équipe, les modèles de messages ; a aussi les droits d'un associate.
  - **Associate** : tout faire sur tous les dossiers ; **seul rôle qui peut valider un BOTe** (action enregistrée : qui, quand), ce qui débloque le modèle « Note au comité ». Un associate ne peut pas valider un BOTe dont il est responsable.
  - **Analyste** (décision utilisateur) : créer et modifier **tous** les dossiers de l'équipe, changer la phase jusqu'à « BOTe rédigé », archiver ses propres dossiers.
  - **Lecteur** : lecture seule.
  - Seuls admin et associate peuvent supprimer un dossier ou enregistrer la décision finale.
- Un dossier a un **responsable** (un membre) et des **contributeurs** : ce sont des informations d'organisation, pas des restrictions d'accès. Tous les membres approuvés voient tous les dossiers (une seule équipe dans cette version). Les règles d'accès sont appliquées par la base (Row Level Security).
- Journal d'activité : chaque modification enregistre auteur, date, champ modifié.

### 5.3 Phases du deal (centrées BOTe)
1. IM reçu
2. Analyse en cours
3. BOTe rédigé
4. Revue associate
5. Présentation comité
6. Décision : Go DD / Offre indicative / No-go

La phase est changée manuellement ; BOS propose le passage (ex. « tous les champs clés sont remplis, passer en BOTe rédigé ? »).

**Après la décision** (décision utilisateur) : un deal en phase 6 **quitte l'accueil** et reste consultable dans « Mes dossiers » avec son statut final (Go DD, Offre indicative, No-go) et la date de décision.

Le dossier porte une **date de comité** (facultative), saisie quand la présentation est planifiée.

### 5.4 Attentes (« on attend quoi, de qui »)
- Chaque demande d'information (déjà présente dans BOS) gagne : **de qui on attend** (Dirigeant, Vendeur / banquier conseil, Associate, Comité, Interne), **date d'envoi**, **date de réponse**.
- Une attente sans réponse depuis plus de **7 jours** est signalée en orange, plus de **14 jours** en rouge.
- *Choix de conception :* deux attentes sont **créées automatiquement par la phase** : en « Revue associate », une attente « Associate » (depuis la date d'entrée dans la phase, close à la validation) ; en « Présentation comité », une attente « Comité » (close quand la décision est enregistrée). Elles suivent les mêmes règles de retard.

### 5.5 Accueil (façon Notion)
Liste de cartes repliables, une par deal actif, triée par urgence (attentes en retard d'abord). Pour chaque deal, des puces :
- **Phase** (pastille) et responsable + contributeurs (avatars Google).
- **À jour** : dernière modification (« par Camille, il y a 2 h ») et indicateurs remplis / manquants (couverture de la grille).
- **En attente** : liste des attentes ouvertes, avec de qui et depuis combien de jours.
- **Prochaine action** : la suggestion du moment (voir 5.6), avec un bouton qui ouvre le message pré-rempli.
- **Avis** : avis préliminaire + TRI au prix demandé.

En tête de l'accueil : 4 compteurs (deals en cours, BOTe à relire, attentes en retard, décisions comité à venir).

### 5.6 Messages pré-remplis
Modèles avec variables remplies depuis le dossier (nom, chiffres clés, fourchette de valeur, TRI, prix max, risques, questions ouvertes, auteur). L'utilisateur voit le texte, le modifie, puis **Copier** (et un lien `mailto:` en option). Modèles livrés, en FR et EN :
1. Demande d'informations au dirigeant / vendeur (liste des questions ouvertes de ce destinataire).
2. Relance (attente > 7 jours).
3. BOTe prêt à relire (à l'associate).
4. Note au comité (après validation de l'associate).
5. No-go poli au banquier conseil.
6. Passage en due diligence : liste des sujets à creuser.

Les admins peuvent modifier les modèles. Une suggestion apparaît selon la phase et les attentes (ex. phase « BOTe rédigé » → suggérer le modèle 3).

### 5.7 Navigation
- **Accueil** : la vue de la section 5.5.
- **Mon projet** : le dossier ouvert, avec les onglets actuels (Synthèse, Données financières, Valorisation, Rendement & LBO, Demandes d'infos) plus un onglet **Activité** (journal).
- **Mes dossiers** : tableau de tous les dossiers (filtres par phase, responsable, avis), création, duplication, archivage.

### 5.8 Jauges et mouvement
- Valorisation : chaque méthode (transactions VE/EBITDA, transactions VE/CA, DCF, prix max au TRI cible) devient une **jauge horizontale** : piste arrondie pleine largeur, segment bas–haut en dégradé bleu, point pour la valeur centrale, repère vertical commun pour le prix demandé (et pour la VE d'entrée si différente), échelle commune en M€.
- À l'arrivée sur une page : les blocs apparaissent en fondu-montée, l'un après l'autre (décalage ~60 ms) ; les jauges se remplissent de gauche à droite (~700 ms) ; les grands chiffres défilent jusqu'à leur valeur.
- Animations désactivées si l'utilisateur demande « réduire les animations » au niveau du système.

### 5.8 bis Vidéo de prise en main (demande ajoutée le 24/11)
- L'accueil affiche une carte « Prendre en main BOS » (comme le site d'origine) qui ouvre une vidéo de démonstration dans une fenêtre.
- Contenu : enregistrement réel de l'application (connexion, accueil, dossier et onglets, jauges, demandes d'infos, message pré-rempli, Mes dossiers), 60 à 90 s, sous-titres explicatifs ; une version FR et une version EN, choisie selon la langue de l'utilisateur.
- Pas de voix off (pas de synthèse vocale disponible) ; la vidéo est régénérée par un script (`npm run record:tour`) quand l'interface évolue.

### 5.9 Reprise de l'existant
- Le dossier exemple « Projet Hélios » est créé à l'initialisation, marqué comme exemple.
- Import des dossiers de la version actuelle : j'ajoute moi-même à la page actuelle un bouton « Exporter mes dossiers (JSON) » ; la nouvelle application a un bouton « Importer » (admin et associate).
  - *Choix de conception :* le mandat personnel de l'ancienne version n'est pas importé (le mandat est unique pour l'équipe et géré par l'admin). Le champ texte « Équipe » est conservé comme note ; le responsable est la personne qui importe.
  - Conversion des étapes : Présélection, IM reçu → « IM reçu » ; Offre indicative → décision « Offre indicative » ; Due diligence, Offre ferme, Signé → décision « Go DD » ; Abandonné → « No-go ».
- Fonctions conservées : import d'IM (PDF lu dans le navigateur ou texte collé), export Excel, note de comité HTML, mandat acquéreur, grille de notation, sensibilités.

## 6. Laissé au développeur
- Structure du code, découpage en composants, bibliothèque d'animations (CSS ou Framer Motion), bibliothèque de graphiques.
- Schéma détaillé des tables (un dossier peut rester un document JSON + tables pour membres, attentes, activité), tant que les règles d'accès de 5.2 sont appliquées par la base (Row Level Security) et pas seulement par l'interface.
- Gestion de l'édition simultanée : dernière écriture gagnante par champ, avec rafraîchissement en direct ; pas de co-édition caractère par caractère.
- Tests : unitaires sur le moteur de calcul (obligatoires), tests de bout en bout sur le parcours principal (connexion, création de dossier, saisie, changement de phase, message pré-rempli).
- Mise en place : guide pas à pas pour que l'utilisateur crée les comptes Vercel / Supabase / Google Cloud (identifiants OAuth) et renseigne les variables d'environnement.
