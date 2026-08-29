/* ============================================================================
   AEM-CONSEIL — passerelle d'intake du site
   ----------------------------------------------------------------------------
   Envoie une COPIE de chaque demande vers le back-office interne, EN PLUS de
   l'e-mail FormSubmit existant. Tant que window.AEM_INTAKE_URL n'est pas défini,
   la fonction ne fait rien — aucun risque de régression.

   Intégration dans un handler de formulaire existant :
     AEM.intake('contact', { nom, email, telephone, objet, message });
     AEM.intake('rappel',  { nom, telephone });
     AEM.intake('rdv',     { nom, email, telephone, message, meta:{ format, date_souhaitee, creneau } });
     AEM.intake('kit',     { email, meta:{ ressource } });
     AEM.intake('identification', { type, siren, entreprise, email, telephone, meta:{ forme, adresse, siret, tva } });
     // NB : seules les colonnes de la table `demandes` vont au niveau racine
     //      (source, type, nom, prenom, email, telephone, siren, entreprise, objet, message, meta).
     //      Tout le reste (forme, adresse, siret, iban…) doit être imbriqué dans `meta`.

   Activation — deux modes :
     • Insertion directe Supabase (recommandé, aucune fonction à déployer) :
         window.AEM_INTAKE_URL = 'https://<projet>.supabase.co/rest/v1/demandes';
         window.AEM_INTAKE_KEY = '<clé publishable / anon>';
       (nécessite la policy RLS d'insertion publique sur la table `demandes`.)
     • Endpoint personnalisé : définir window.AEM_INTAKE_URL seul.
   Tant que window.AEM_INTAKE_URL n'est pas défini, la fonction ne fait rien.
   ========================================================================== */
(function (global) {
  'use strict';
  function intake(source, payload) {
    var url = global.AEM_INTAKE_URL;
    if (!url) return Promise.resolve({ skipped: true }); // dormant tant que non configuré
    var key = global.AEM_INTAKE_KEY;
    var headers = { 'Content-Type': 'application/json' };
    if (key) { headers.apikey = key; headers.Authorization = 'Bearer ' + key; headers.Prefer = 'return=minimal'; }
    var body = Object.assign({ source: source }, payload || {});
    return fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
      keepalive: true            // survit à une navigation immédiate
    }).then(function (r) { return { ok: r.ok, status: r.status }; })
      .catch(function () { return { ok: false }; }); // best-effort, ne bloque jamais l'UX
  }
  global.AEM = global.AEM || {};
  global.AEM.intake = intake;
})(window);
