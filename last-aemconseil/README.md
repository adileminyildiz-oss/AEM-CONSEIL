# LAST — `last.aemconseil.eu`

Back-office du cabinet AEM-CONSEIL : **traitement des demandes** du site vitrine
et **formalités**. Troisième pilier de l'écosystème (aux côtés de `aemconseil.eu`
et `yada.aemconseil.eu`).

> Fiche technique complète : `AEM-CONSEIL/docs/LAST-fiche-technique.md`.

## Contenu (Phases 0 & 1)

```
index.html                        Back-office : connexion cabinet + boîte de réception des demandes
supabase/schema.sql               Tables + RLS (demandes, clients, dossiers, pièces, journal)
supabase/functions/intake/        Edge Function : réception des demandes du site + notif e-mail
snippets/aemconseil-intake.js     Passerelle à inclure sur aemconseil.eu (double envoi)
.github/workflows/deploy-pages.yml  Déploiement GitHub Pages
CNAME · manifest.webmanifest · sw.js
```

## Mise en route

### 1. Projet Supabase (dédié)
1. Créer un projet Supabase (région **UE**).
2. SQL Editor → exécuter `supabase/schema.sql`.
3. Créer les comptes du cabinet (Auth → Users) puis, pour chacun, une ligne dans
   `profils` (`id` = user id, `role` = `admin`/`gestionnaire`/`lecture`).

### 2. Fonction d'intake
```bash
supabase functions deploy intake --no-verify-jwt
supabase secrets set RESEND_API_KEY=...  NOTIFY_TO=aemconseil.sas@gmail.com  ALLOW_ORIGIN=https://aemconseil.eu
```
(`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont injectés automatiquement.)

### 3. Back-office
Dans `index.html`, renseigner :
```js
var SUPABASE_URL  = 'https://<projet>.supabase.co';
var SUPABASE_ANON = '<clé publishable / anon>';
```

### 4. Déploiement
- Push sur `main` → GitHub Pages déploie automatiquement.
- Repo → Settings → Pages : source « GitHub Actions ».
- DNS : `CNAME last → <user>.github.io` (le fichier `CNAME` fixe le domaine).

### 5. Brancher le site aemconseil.eu (double envoi)
1. Inclure `snippets/aemconseil-intake.js` sur `aemconseil.eu`.
2. Définir l'endpoint : `window.LAST_INTAKE = 'https://<projet>.supabase.co/functions/v1/intake';`
3. Dans chaque handler de formulaire, ajouter à côté de l'envoi FormSubmit :
   `LAST.intake('contact', { nom, email, telephone, objet, message });`
   Tant que `window.LAST_INTAKE` n'est pas défini, l'appel est inerte (aucune régression).

## Sécurité
- RLS active partout ; accès réservé aux membres du cabinet (table `profils`).
- Les demandes publiques n'entrent QUE via la fonction `intake` (service role) —
  aucune écriture anonyme directe sur les tables.
- Pièces en stockage privé (URL signées).

## Feuille de route
- **P0/P1 (ce dépôt)** : connexion + boîte de réception + intake.
- **P2** : pipeline (attribution, priorités, Kanban), conversion en client.
- **P3** : dossiers de formalités, pièces, checklists, suivi guichet unique INPI.
- **P4** : lien facturation yada, génération de documents, portail client.
