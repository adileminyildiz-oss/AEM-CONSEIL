# Facturation — mise en route

L'outil de facturation (`facturation/`) fonctionne immédiatement en **mode local**
(données dans le navigateur, isolées par compte). Une seule étape est nécessaire
pour activer la **sauvegarde cloud** (synchro multi-appareils, aucune perte si le
navigateur est nettoyé).

## Étape unique — activer la persistance cloud (Supabase)

1. Va sur **https://supabase.com** → connecte-toi → ouvre le projet
   **`ammmyhtxnwyoopfxtans`** (le même que l'espace client).
2. Menu de gauche → **SQL Editor** → **+ New query**.
3. Copie-colle le contenu de **`facturation-schema.sql`** (à la racine du dépôt),
   puis clique **Run**.
4. Résultat attendu : **« Success. No rows returned »**.
5. Vérifie dans **Table Editor** : deux tables `fact_documents` et `fact_profile`,
   chacune avec **RLS enabled** (cadenas).

C'est tout. Rien à configurer côté secrets : le script ne crée que les tables et
les règles RLS. La sécurité repose sur `auth.uid()` — chaque compte est cloisonné.

## Vérifier que ça marche

1. Ouvre **Facturation** dans ton espace client (connecté).
2. En haut à droite, l'indicateur doit afficher **« Cloud »** (point vert).
   S'il affiche « Local », c'est que la session n'est pas authentifiée.
3. Renseigne le **Profil émetteur**, crée une facture, **recharge la page** :
   le document et le profil réapparaissent → la synchro fonctionne.

## Bon à savoir

- **Sans cette étape** : tout marche en local (isolé par compte), mais sans
  synchro ni sauvegarde multi-appareils.
- **Migration automatique** : les factures créées en local avant l'activation
  sont remontées vers le cloud à la première connexion.
- **Conformité** : renseigne le profil émetteur (raison sociale, forme juridique,
  SIRET, RCS, capital, TVA intracom, IBAN) — ces mentions conditionnent la
  conformité des factures. L'émission attribue un numéro séquentiel définitif et
  **verrouille** le document (inaltérable) ; pour corriger, on duplique ou on crée
  un avoir.
