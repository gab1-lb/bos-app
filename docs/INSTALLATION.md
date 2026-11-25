# Guide d'installation de BOS

Ce guide s'adresse à une personne sans compétence technique. Comptez environ 1 heure. Les intitulés des écrans de Supabase, Google et Vercel évoluent régulièrement : si un libellé diffère légèrement de celui indiqué ici, cherchez le mot-clé en gras ou utilisez la recherche de la console.

## Ce qu'il faut avoir avant de commencer

- Un compte **GitHub** et le dépôt de BOS (le code de l'application) dans votre compte ou celui de votre entreprise.
- Un compte **Supabase** (<https://supabase.com>), un compte **Vercel** (<https://vercel.com>) et l'accès à **Google Cloud Console** (<https://console.cloud.google.com>), avec les adresses e-mail Google de votre entreprise.
- Le **domaine e-mail** de l'entreprise (la partie après le @, par exemple `monentreprise.com`) et l'adresse e-mail Google du **premier administrateur**.

### Offres gratuites et usage professionnel

Vous pouvez construire et tester BOS avec les offres gratuites, mais elles ne conviennent pas à un usage réel par l'équipe :

- **Vercel Hobby interdit l'usage commercial.** Pour travailler sur de vrais dossiers, passez en offre Pro (voir la section « Passer en offre Pro »).
- **Supabase gratuit met le projet en pause après environ une semaine sans activité.** L'application devient alors inaccessible jusqu'à ce que vous le réactiviez dans le tableau de bord Supabase.

Le coût de l'offre Pro est d'environ 45 $ par mois en tout (Vercel Pro et Supabase Pro).

## 1. Créer le projet Supabase

1. Connectez-vous à Supabase, puis cliquez sur **New project**.
2. Choisissez votre organisation, donnez un nom (par exemple `bos`), saisissez un **mot de passe de base de données** (conservez-le dans votre gestionnaire de mots de passe : vous n'en aurez pas besoin pour ce guide) et choisissez la région **Central EU (Frankfurt) / eu-central-1**. Ce choix garde les données en Union européenne et ne peut pas être modifié ensuite.
3. Cliquez sur **Create new project** et attendez la fin de la préparation (1 à 2 minutes).
4. Notez l'identifiant du projet (« project ref »), visible dans l'adresse du tableau de bord (`https://supabase.com/dashboard/project/<project-ref>`) et dans **Project Settings → General**.

## 2. Créer les tables et les règles de sécurité

1. Dans le menu de gauche, ouvrez **SQL Editor**, puis **New query**.
2. Ouvrez le fichier `supabase/migrations/0001_init.sql` du dépôt (sur GitHub, bouton **Raw** ou **Copy raw file**), copiez tout son contenu, collez-le dans l'éditeur et cliquez sur **Run**. Le message « Success. No rows returned » est attendu.
3. Ouvrez une nouvelle requête (**New query**), puis copiez-y le contenu de `supabase/seed.sql`. **Avant de lancer**, remplacez les deux valeurs entre apostrophes, en gardant les apostrophes :
   - `__ALLOWED_DOMAIN__` par le domaine de votre entreprise, sans @ (par exemple `monentreprise.com`) ;
   - `__ADMIN_EMAIL__` par l'adresse e-mail Google du premier administrateur (par exemple `prenom.nom@monentreprise.com`).
4. Cliquez sur **Run**. Cela enregistre ces deux réglages, le mandat d'investissement par défaut et les 12 modèles d'e-mails (6 en français, 6 en anglais). Aucun dossier n'est créé (voir « Dossier de démonstration » plus bas).
5. Vérifiez : **Table Editor → app_settings** doit contenir une ligne avec vos deux valeurs.

Ne lancez le seed qu'une seule fois : relancé, il remet les deux réglages à la valeur du fichier.

## 3. Récupérer l'adresse et la clé de Supabase

Ouvrez **Project Settings → API** (parfois **Data API** ou **API Keys** selon la version). Notez :

- **Project URL** : de la forme `https://<project-ref>.supabase.co` ;
- la clé publique **anon** (parfois nommée **publishable** ou **anon public**). Ne copiez jamais la clé **service_role**.

## 4. Créer l'accès Google (connexion par compte Google uniquement)

### 4a. Dans Google Cloud Console

1. Créez un projet (sélecteur de projet en haut, **New project**), nommez-le `BOS`.
2. Ouvrez **APIs & Services → OAuth consent screen** (le menu peut s'appeler **Google Auth Platform → Branding / Audience**). Choisissez le type d'utilisateurs **Internal** si votre entreprise utilise Google Workspace : seuls les comptes de votre organisation pourront alors se connecter. Sinon choisissez **External** (les personnes extérieures au domaine peuvent alors s'authentifier chez Google, mais l'application les refuse ensuite, voir plus bas). Renseignez le nom de l'application (`BOS`), l'e-mail d'assistance et l'e-mail du développeur, puis enregistrez.
3. Ouvrez **APIs & Services → Credentials** (ou **Google Auth Platform → Clients**), cliquez sur **Create credentials → OAuth client ID**, type d'application **Web application**, nom `BOS`.
4. Dans **Authorized redirect URIs**, ajoutez exactement : `https://<project-ref>.supabase.co/auth/v1/callback` (en remplaçant `<project-ref>` par l'identifiant de l'étape 1). Cliquez sur **Create**.
5. Copiez le **Client ID** et le **Client secret** affichés.

### 4b. Dans Supabase

1. Ouvrez **Authentication → Providers** (ou **Sign In / Providers**) puis **Google**.
2. Activez **Enable Sign in with Google**, collez le Client ID et le Client secret, puis **Save**.
3. Dans la même page de fournisseurs, **désactivez Email** (« Enable Email provider ») afin que la connexion ne soit possible que par Google. C'est indispensable : la règle de domaine de BOS fait confiance à l'adresse e-mail vérifiée par Google ; avec l'inscription par e-mail et mot de passe, quelqu'un pourrait créer un compte avec l'adresse d'un autre sans la prouver. Laissez **Allow new users to sign up** activé (nécessaire pour la première connexion Google) et vérifiez qu'aucun autre fournisseur n'est actif.

Les adresses du site (Site URL, Redirect URLs) seront renseignées à l'étape 6, quand vous connaîtrez l'adresse Vercel.

## 5. Déployer sur Vercel

1. Connectez-vous à Vercel avec GitHub. Cliquez sur **Add New… → Project**, puis **Import** à côté du dépôt BOS (autorisez l'accès au dépôt si Vercel le demande).
2. **Framework Preset** : **Next.js** (détecté automatiquement). Ne changez ni la commande de build ni le dossier de sortie.
3. Ouvrez **Settings → General → Node.js Version** (après la création du projet, si l'option n'est pas visible à l'import) et choisissez **22.x**. BOS nécessite Node 22 minimum.
4. Dans **Environment Variables**, ajoutez les trois variables suivantes (modèle : `.env.example`) :
   - `NEXT_PUBLIC_SUPABASE_URL` : le Project URL de l'étape 3 ;
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` : la clé anon de l'étape 3 ;
   - `NEXT_PUBLIC_DATA_MODE` : `supabase` (jamais `memory` : le déploiement serait refusé).
5. Cliquez sur **Deploy**. Au bout de 1 à 3 minutes, Vercel affiche l'adresse du site (par exemple `https://bos-xxxx.vercel.app`). Le fichier `vercel.json` du dépôt place déjà l'hébergement à Francfort (région `fra1`).
6. Si vous modifiez une variable plus tard, relancez un déploiement (**Deployments → … → Redeploy**) : les variables `NEXT_PUBLIC_` sont figées à la construction.

## 6. Dire à Supabase où se trouve le site

Dans Supabase, ouvrez **Authentication → URL Configuration** :

- **Site URL** : l'adresse Vercel, par exemple `https://bos-xxxx.vercel.app` ;
- **Redirect URLs** → **Add URL** : `https://bos-xxxx.vercel.app/auth/callback`.

Si vous ajoutez plus tard un domaine personnalisé, ajoutez aussi son `/auth/callback` ici. Sans cette étape, la connexion échoue ou renvoie vers une mauvaise adresse.

## 7. Première connexion (administrateur)

1. Ouvrez l'adresse du site et cliquez sur **Se connecter avec Google**.
2. Connectez-vous avec l'adresse que vous avez saisie à la place de `__ADMIN_EMAIL__`. Vous êtes automatiquement administrateur actif.
3. Dans le menu, **Administration** apparaît : c'est là que vous gérez l'équipe.

## 8. Inviter et valider l'équipe

- **Collègues du domaine** : ils se connectent avec leur compte Google et arrivent sur une page d'attente. Dans **Administration**, choisissez leur rôle (administrateur, associé, analyste ou lecteur) et validez-les. Vous pouvez aussi **Refuser** une demande ou **Retirer l'accès** plus tard.
- **Personnes hors domaine** (conseils, partenaires) : dans **Administration**, section **Inviter une personne**, saisissez leur adresse e-mail Google et un rôle. Dès leur première connexion avec cette adresse, ils sont acceptés avec ce rôle. Sans invitation, une personne hors domaine est refusée.

Au moins un administrateur actif doit toujours exister : l'application (et la base de données) empêche de retirer ou de refuser le dernier.

## Dossier de démonstration (facultatif)

Pour afficher le dossier d'exemple « Projet Hélios » : après votre première connexion (étape 7), ouvrez une nouvelle requête dans **SQL Editor**, collez le contenu de `supabase/seed-demo.sql` et lancez-la. Le dossier vous est attribué. Si le script indique « Administrateur introuvable », connectez-vous d'abord à BOS. Relancer le script ne crée pas de doublon ; un administrateur peut supprimer le dossier ensuite.

## Reprendre les dossiers de l'ancienne version de BOS

1. Ouvrez l'ancienne page BOS (fichier ou site d'origine, dans le même navigateur que d'habitude) et cliquez sur **Exporter mes dossiers (JSON)** : un fichier est téléchargé.
2. Dans la nouvelle application, ouvrez **Mes dossiers**, cliquez sur **Importer des dossiers** et sélectionnez le fichier. (Rôle associé ou administrateur requis ; vous devenez responsable des dossiers importés.) Le mandat personnel de l'ancienne version n'est pas repris : modifiez le mandat dans l'application.

## Passer en offre Pro

Quand l'équipe travaille sur de vrais dossiers :

1. **Vercel** : **Settings → Billing** (ou en haut à gauche, votre équipe → **Upgrade to Pro**), puis suivez l'assistant. Cela lève l'interdiction d'usage commercial de l'offre Hobby. Si le projet est dans un compte personnel, créez ou utilisez une équipe (« team ») Pro et transférez le projet si Vercel le propose.
2. **Supabase** : **Organization → Billing → Change subscription plan → Pro**. Le projet n'est plus mis en pause et des sauvegardes quotidiennes sont incluses.

Prévoyez environ 45 $ par mois au total (tarifs indicatifs, à vérifier sur les sites des fournisseurs).

## Limites connues

- **Bibliothèques externes** : la lecture des PDF (import d'un IM) utilise pdf.js et l'export Excel utilise SheetJS, tous deux chargés à la demande depuis `cdnjs.cloudflare.com`. Après le déploiement, testez une fois l'import d'un IM en PDF et un export Excel. Si le réseau de l'entreprise bloque cdnjs, ces deux fonctions échoueront.
- **Pas de SRI** : ces scripts sont chargés sans contrôle d'intégrité (Subresource Integrity) pour le moment.
- **Temps réel** : les mises à jour en direct entre collègues supposent que la publication `supabase_realtime` existe. La migration l'y ajoute si elle existe. Vérifiez dans **Database → Publications** que `supabase_realtime` contient bien les tables `deals` et `activity` ; sinon activez-les (interrupteurs de la ligne `supabase_realtime`). Sans cela, les pages ne se rafraîchissent qu'au rechargement.
- **Dernier administrateur** : il ne peut être ni rétrogradé, ni refusé, ni remis en attente. Pour changer d'administrateur, nommez d'abord le suivant.
- **Node 22** : requis par les bibliothèques Supabase. Choisissez Node 22.x dans Vercel (étape 5) ; en local, utilisez Node 22 ou plus.
- **Offres gratuites** : usage commercial interdit sur Vercel Hobby, pause de Supabase après une semaine d'inactivité (voir plus haut).

## Mettre à jour la vidéo de démonstration

La vidéo de prise en main de la page d'accueil est un fichier enregistré dans le dépôt. Après un changement d'interface, sur un ordinateur de développement (Node 22, Chromium Playwright et ffmpeg installés), lancez `npm run record:tour`, puis validez les fichiers modifiés (dossier `public/` et `src/components/home/tour-meta.json`) et poussez-les : Vercel redéploie automatiquement.

## En cas de problème

- **« Accès refusé » à la connexion Google** : l'URI de redirection de l'étape 4a est incorrecte (elle doit être exactement celle de Supabase), ou l'écran de consentement est en mode Internal et le compte n'appartient pas à l'organisation.
- **Retour sur la page de connexion en boucle** : vérifiez Site URL et Redirect URLs (étape 6).
- **Page blanche ou erreur à l'ouverture** : vérifiez les trois variables d'environnement Vercel, puis redéployez.
- **Le site ne répond plus après une période d'inactivité** (offre gratuite Supabase) : dans le tableau de bord Supabase, cliquez sur **Restore project**.
