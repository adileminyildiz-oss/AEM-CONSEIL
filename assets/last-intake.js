/* ============================================================================
   LAST — passerelle d'intake pour le site aemconseil.eu
   ----------------------------------------------------------------------------
   À inclure sur aemconseil.eu (ex. dans <head> ou avant </body>).
   Envoie une COPIE de chaque demande vers LAST, EN PLUS de l'e-mail FormSubmit
   existant (« double envoi » de transition). Tant que window.LAST_INTAKE n'est
   pas défini, la fonction ne fait rien — aucun risque de régression.

   Intégration dans un handler de formulaire existant :
     LAST.intake('contact', { nom, email, telephone, objet, message });
     LAST.intake('rappel',  { nom, telephone });
     LAST.intake('rdv',     { nom, email, telephone, message, meta:{ format, date_souhaitee, creneau } });
     LAST.intake('kit',     { email, meta:{ ressource } });
     LAST.intake('chatbot', { nom, email, telephone, message });
     LAST.intake('identification', { type, siren, raison, ... });

   Activation : définir l'endpoint de la fonction Edge, ex.
     window.LAST_INTAKE = 'https://<projet>.supabase.co/functions/v1/intake';
   ========================================================================== */
(function (global) {
  'use strict';
  function intake(source, payload) {
    var url = global.LAST_INTAKE;
    if (!url) return Promise.resolve({ skipped: true }); // dormant tant que non configuré
    var body = Object.assign({ source: source }, payload || {});
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true            // survit à une navigation immédiate
    }).then(function (r) { return r.ok ? r.json() : { ok: false }; })
      .catch(function () { return { ok: false }; }); // best-effort, ne bloque jamais l'UX
  }
  global.LAST = global.LAST || {};
  global.LAST.intake = intake;
})(window);
