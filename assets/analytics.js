/* ============================================================================
   AEM-CONSEIL — Mesure d'audience & suivi des conversions
   ----------------------------------------------------------------------------
   Couche unique, chargée sur le site ET les pages statiques.
   Deux fournisseurs possibles, au choix — laissez les deux vides pour tout
   désactiver (aucune requête, aucun cookie) :

     • PLAUSIBLE_DOMAIN : analytics SANS cookie, conforme RGPD, chargé
       immédiatement (aucun bandeau requis). Recommandé.
     • GA4_ID (Google Analytics 4) : dépose des cookies → chargé UNIQUEMENT
       après consentement (bandeau cookies du site).

   Exposé : window.aemTrack(nom, props) — envoie un événement aux fournisseurs
   actifs ; sans fournisseur configuré, c'est un no-op silencieux.
   ========================================================================== */
(function () {
  'use strict';
  if (window.aemTrack) return;

  /* ============================ CONFIGURATION ============================= */
  var PLAUSIBLE_DOMAIN = '';                              // ex. 'aemconseil.eu'
  var PLAUSIBLE_SRC    = 'https://plausible.io/js/script.tagged-events.js';
  var GA4_ID           = '';                              // ex. 'G-XXXXXXXXXX'
  /* ======================================================================= */

  var loaded = { pl: false, ga: false };

  function consent() {
    try { return localStorage.getItem('aem_cookie_consent'); } catch (e) { return null; }
  }

  // Plausible — sans cookie : on peut charger tout de suite.
  function loadPlausible() {
    if (loaded.pl || !PLAUSIBLE_DOMAIN) return;
    loaded.pl = true;
    var s = document.createElement('script');
    s.defer = true;
    s.setAttribute('data-domain', PLAUSIBLE_DOMAIN);
    s.src = PLAUSIBLE_SRC;
    document.head.appendChild(s);
    window.plausible = window.plausible || function () {
      (window.plausible.q = window.plausible.q || []).push(arguments);
    };
  }

  // Google Analytics 4 — avec cookies : uniquement après consentement.
  function loadGA() {
    if (loaded.ga || !GA4_ID) return;
    loaded.ga = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA4_ID, { anonymize_ip: true });
  }

  loadPlausible();
  if (consent() === 'accepted') loadGA();

  // Appelé par le bandeau cookies quand l'utilisateur accepte / refuse.
  window.aemAnalyticsConsent = function (granted) { if (granted) loadGA(); };

  // Point d'entrée unique de suivi.
  window.aemTrack = function (name, props) {
    props = props || {};
    try { if (window.gtag) window.gtag('event', name, props); } catch (e) {}
    try { if (window.plausible) window.plausible(name, { props: props }); } catch (e) {}
  };
})();
