-- BOS : données initiales. GÉNÉRÉ par `npm run gen:seed` (scripts/gen-seed.ts) : ne pas modifier à la main.
-- À exécuter dans Supabase (SQL Editor) APRÈS supabase/migrations/0001_init.sql.
--
-- AVANT D'EXÉCUTER, remplacez les deux valeurs ci-dessous (gardez les apostrophes) :
--   __ALLOWED_DOMAIN__  -> le domaine e-mail de votre entreprise, sans @   (ex. : monentreprise.com)
--   __ADMIN_EMAIL__     -> l'adresse e-mail Google du premier administrateur (ex. : prenom.nom@monentreprise.com)

insert into public.app_settings (id, allowed_domain, bootstrap_admin_email)
values (1, '__ALLOWED_DOMAIN__', '__ADMIN_EMAIL__')
on conflict (id) do update
  set allowed_domain = excluded.allowed_domain,
      bootstrap_admin_email = excluded.bootstrap_admin_email;

-- Mandat d'investissement par défaut (modifiable ensuite dans l'application).
insert into public.mandate (id, data)
values (1, $bos${"name":"Consolidateur logiciel vertical · détention longue","sectors":"logiciel, saas, software, edition","geos":"france, belgique, pays-bas, allemagne, espagne, italie, europe","minRev":2,"maxRev":60,"minRecurring":50,"minMargin":10,"hurdle":15}$bos$::jsonb)
on conflict (id) do nothing;

-- Modèles d'e-mails par défaut (6 en français, 6 en anglais).
insert into public.templates (key, locale, subject, body) values
  ('info_request', 'fr', $bos${{deal.name}} : demande d’informations complémentaires$bos$, $bos$Bonjour,

Dans le cadre de notre analyse du {{deal.name}}, plusieurs points restent à clarifier. Pourriez-vous nous apporter votre éclairage sur les questions suivantes ?

{{questionsFor}}

Ces éléments nous permettront de finaliser notre Business Overview. Nous restons à votre disposition pour en échanger.

Bien cordialement,
{{author}}$bos$),
  ('info_request', 'en', $bos${{deal.name}}: request for additional information$bos$, $bos$Hello,

As part of our review of {{deal.name}}, a few points remain to be clarified. Could you please help us with the following questions?

{{questionsFor}}

These answers will allow us to finalise our Business Overview. Happy to discuss at your convenience.

Best regards,
{{author}}$bos$),
  ('reminder', 'fr', $bos${{deal.name}} : relance$bos$, $bos$Bonjour,

Nous nous permettons de revenir vers vous au sujet de notre demande sur le {{deal.name}}, restée sans réponse depuis {{days}} jours. Les points en attente sont les suivants :

{{questionsFor}}

Votre retour nous permettrait de poursuivre l’analyse dans les meilleurs délais.

Bien cordialement,
{{author}}$bos$),
  ('reminder', 'en', $bos${{deal.name}}: follow-up$bos$, $bos$Hello,

I am following up on our request regarding {{deal.name}}, which has been pending for {{days}} days. The outstanding points are:

{{questionsFor}}

Your feedback would help us move the analysis forward promptly.

Best regards,
{{author}}$bos$),
  ('bote_review', 'fr', $bos${{deal.name}} : BOTe pour revue$bos$, $bos$Bonjour,

Le BOTe du {{deal.name}} est prêt pour votre revue.

Synthèse :
- Chiffre d’affaires : {{rev}}
- EBITDA ajusté : {{adjEbitda}} (marge {{margin}})
- Prix demandé : {{ask}} ({{askMultiple}} l’EBITDA ajusté)
- TRI au prix demandé : {{irr}} (seuil : {{hurdle}})

Thèse : {{thesis}}

Risques : {{risks}}

Questions encore ouvertes :
{{openQuestions}}

Merci de me faire part de vos commentaires.

Bien cordialement,
{{author}}$bos$),
  ('bote_review', 'en', $bos${{deal.name}}: BOTe for review$bos$, $bos$Hello,

The BOTe for {{deal.name}} is ready for your review.

Summary:
- Revenue: {{rev}}
- Adjusted EBITDA: {{adjEbitda}} ({{margin}} margin)
- Asking price: {{ask}} ({{askMultiple}} adjusted EBITDA)
- IRR at asking price: {{irr}} (hurdle: {{hurdle}})

Thesis: {{thesis}}

Risks: {{risks}}

Open questions:
{{openQuestions}}

Please share your comments.

Best regards,
{{author}}$bos$),
  ('committee_note', 'fr', $bos${{deal.name}} : note pour le comité$bos$, $bos$Bonjour,

Veuillez trouver ci-dessous la synthèse du {{deal.name}} pour le comité.

- Chiffre d’affaires : {{rev}} ; EBITDA ajusté : {{adjEbitda}} (marge {{margin}})
- Prix demandé : {{ask}}, soit {{askMultiple}} l’EBITDA ajusté
- Valorisation implicite (multiples de transactions comparables) : {{range}}
- TRI au prix demandé : {{irr}}, pour un seuil de {{hurdle}}
- Prix maximum compatible avec le seuil : {{maxPrice}}

Thèse : {{thesis}}

Risques : {{risks}}

Questions ouvertes :
{{openQuestions}}

Bien cordialement,
{{author}}$bos$),
  ('committee_note', 'en', $bos${{deal.name}}: committee note$bos$, $bos$Hello,

Please find below the {{deal.name}} summary for the committee.

- Revenue: {{rev}}; adjusted EBITDA: {{adjEbitda}} ({{margin}} margin)
- Asking price: {{ask}}, i.e. {{askMultiple}} adjusted EBITDA
- Implied valuation (precedent-transaction multiples): {{range}}
- IRR at asking price: {{irr}}, against a {{hurdle}} hurdle
- Maximum price consistent with the hurdle: {{maxPrice}}

Thesis: {{thesis}}

Risks: {{risks}}

Open questions:
{{openQuestions}}

Best regards,
{{author}}$bos$),
  ('no_go', 'fr', $bos${{deal.name}} : suite de nos échanges$bos$, $bos$Bonjour,

Nous vous remercions du temps consacré à la présentation du {{deal.name}} et des informations partagées. Après examen approfondi, nous avons décidé de ne pas donner suite à ce stade, au regard de nos critères d’investissement.

Nous restons ouverts à échanger si la situation évolue.

Bien cordialement,
{{author}}$bos$),
  ('no_go', 'en', $bos${{deal.name}}: following our discussions$bos$, $bos$Hello,

Thank you for the time spent presenting {{deal.name}} and for the information shared. After careful review, we have decided not to proceed at this stage, given our investment criteria.

We remain open to reconnecting should circumstances change.

Best regards,
{{author}}$bos$),
  ('go_dd', 'fr', $bos${{deal.name}} : passage en due diligence$bos$, $bos$Bonjour,

Nous avons le plaisir de vous confirmer que nous souhaitons poursuivre avec le {{deal.name}} et engager une due diligence, sous réserve de la confirmation des éléments ci-dessous.

Pourriez-vous nous transmettre les informations suivantes ?

{{openQuestions}}

Nous vous proposerons prochainement un calendrier.

Bien cordialement,
{{author}}$bos$),
  ('go_dd', 'en', $bos${{deal.name}}: moving to due diligence$bos$, $bos$Hello,

We are pleased to confirm that we wish to proceed with {{deal.name}} and begin due diligence, subject to confirmation of the items below.

Could you please provide the following information?

{{openQuestions}}

We will propose a timetable shortly.

Best regards,
{{author}}$bos$)
on conflict (key, locale) do nothing;
