/* ============================================================================
   SIREN Autofill — remplissage automatique des informations entreprise
   ----------------------------------------------------------------------------
   Composant autonome, sans dépendance, réutilisable (facturation / inscription
   client). Le client saisit son SIREN (ou SIRET) → les informations légales
   sont récupérées automatiquement et les champs du formulaire sont pré-remplis.

   Source des données : API OFFICIELLE GRATUITE de l'État
     https://recherche-entreprises.api.gouv.fr  (données INSEE Sirene + INPI/RNE)
   Aucune clé requise, CORS autorisé (appel direct depuis le navigateur).

   Utilisation minimale :
     <input id="siren"> <button id="siren-go">Rechercher</button>
     SirenAutofill.bind({
       input: '#siren', button: '#siren-go', status: '#siren-status',
       fields: {
         raisonSociale: '#f-raison', siret: '#f-siret', tvaIntra: '#f-tva',
         adresse: '#f-adresse', codePostal: '#f-cp', ville: '#f-ville',
         formeJuridique: '#f-forme', codeApe: '#f-ape'
       },
       onResult: function(data){ ... }
     });
   ========================================================================== */
(function (global) {
  'use strict';

  var API = 'https://recherche-entreprises.api.gouv.fr/search';

  /* --- Nettoyage & validation --------------------------------------------- */
  function digits(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }

  // Algorithme de Luhn (clé de contrôle SIREN/SIRET)
  function luhn(num) {
    var sum = 0, alt = false;
    for (var i = num.length - 1; i >= 0; i--) {
      var d = parseInt(num.charAt(i), 10);
      if (alt) { d *= 2; if (d > 9) d -= 9; }
      sum += d; alt = !alt;
    }
    return sum % 10 === 0;
  }
  function isValidSiren(v) { var d = digits(v); return d.length === 9 && luhn(d); }
  function isValidSiret(v) {
    var d = digits(v);
    if (d.length !== 14) return false;
    if (d.slice(0, 9) === '356000000') return true; // La Poste : dérogation Luhn
    return luhn(d);
  }

  // N° de TVA intracommunautaire français calculé à partir du SIREN
  function tvaIntra(siren) {
    var d = digits(siren).slice(0, 9);
    if (d.length !== 9) return '';
    var key = (12 + 3 * (parseInt(d, 10) % 97)) % 97;
    return 'FR' + (key < 10 ? '0' + key : key) + d;
  }

  /* --- Libellés de forme juridique (codes INSEE fréquents) ---------------- */
  /* Modifiable / complétable selon vos besoins. */
  var FORMES = {
    '1000': 'Entrepreneur individuel',
    '5202': 'Société en nom collectif (SNC)',
    '5306': 'Société en commandite simple',
    '5498': 'EURL (SARL à associé unique)',
    '5499': 'SARL',
    '5505': 'SA à conseil d’administration',
    '5510': 'SA',
    '5710': 'SAS',
    '5720': 'SASU (SAS à associé unique)',
    '5785': 'Société d’exercice libéral (SEL)',
    '6540': 'SCI',
    '6901': 'Autre personne physique',
    '9220': 'Association déclarée'
  };
  function formeLabel(code) { code = String(code || ''); return FORMES[code] || (code ? 'Code ' + code : ''); }

  /* --- Recherche via l'API officielle ------------------------------------- */
  function lookup(input) {
    var d = digits(input);
    var siren = d.slice(0, 9);
    if (!isValidSiren(siren)) {
      return Promise.reject(new Error('Numéro SIREN/SIRET invalide.'));
    }
    var url = API + '?q=' + encodeURIComponent(siren) + '&page=1&per_page=1';
    return fetch(url, { headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error('Service indisponible (' + r.status + ').'); return r.json(); })
      .then(function (json) {
        var res = json && json.results && json.results[0];
        if (!res) throw new Error('Aucune entreprise trouvée pour ce numéro.');
        return normalize(res, d);
      })
      .catch(function (e) {
        if (e && e.name === 'TypeError') throw new Error('Recherche indisponible : vérifiez votre connexion et réessayez.');
        throw e;
      });
  }

  function normalize(res, entered) {
    var s = res.siege || {};
    // Adresse « voie » sans le code postal / la commune, quand c'est possible
    var voie = [s.numero_voie, s.indice_repetition, s.type_voie, s.libelle_voie]
      .filter(Boolean).join(' ').trim();
    if (!voie && s.adresse) {
      // repli : retire CP + commune de l'adresse complète
      voie = String(s.adresse).replace(new RegExp('\\s*' + (s.code_postal || '') + '.*$'), '').trim();
    }
    var siret = (entered && entered.length === 14) ? entered : (s.siret || '');
    return {
      siren: res.siren || '',
      siret: siret,
      raisonSociale: res.nom_raison_sociale || res.nom_complet || '',
      sigle: res.sigle || '',
      formeJuridiqueCode: res.nature_juridique || '',
      formeJuridique: formeLabel(res.nature_juridique) || res.libelle_nature_juridique || '',
      adresse: voie,
      adresseComplete: s.adresse || voie,
      codePostal: s.code_postal || '',
      ville: s.libelle_commune || '',
      codeApe: res.activite_principale || '',
      libelleApe: res.libelle_activite_principale || '',
      tvaIntra: tvaIntra(res.siren),
      dirigeant: (res.dirigeants && res.dirigeants[0])
        ? [res.dirigeants[0].prenoms, res.dirigeants[0].nom].filter(Boolean).join(' ').trim()
        : '',
      dateCreation: res.date_creation || '',
      raw: res
    };
  }

  /* --- Liaison automatique à un formulaire -------------------------------- */
  function $(sel, root) { return typeof sel === 'string' ? (root || document).querySelector(sel) : sel; }
  function setField(el, val) {
    if (!el) return;
    if ('value' in el) el.value = (val == null ? '' : val);
    else el.textContent = (val == null ? '' : val);
    // Notifie les frameworks (React/Vue) d'un changement de valeur
    try { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
  }

  function bind(opts) {
    opts = opts || {};
    var input = $(opts.input);
    if (!input) return;
    var button = opts.button ? $(opts.button) : null;
    var status = opts.status ? $(opts.status) : null;
    var fields = opts.fields || {};
    var busy = false;

    function say(msg, kind) {
      if (!status) return;
      status.textContent = msg || '';
      status.setAttribute('data-state', kind || '');
    }
    function run() {
      if (busy) return;
      var val = input.value;
      if (!digits(val)) { say('Saisissez un numéro SIREN (9 chiffres) ou SIRET (14 chiffres).', 'err'); return; }
      if (!isValidSiren(digits(val).slice(0, 9))) { say('Numéro invalide : vérifiez les chiffres saisis.', 'err'); return; }
      busy = true; say('Recherche en cours…', 'loading'); if (button) button.disabled = true;
      lookup(val)
        .then(function (data) {
          Object.keys(fields).forEach(function (k) { if (data[k] !== undefined) setField($(fields[k]), data[k]); });
          say('Informations récupérées ✓ Vérifiez et complétez si besoin.', 'ok');
          if (typeof opts.onResult === 'function') opts.onResult(data);
        })
        .catch(function (err) {
          say((err && err.message) || 'Recherche impossible.', 'err');
          if (typeof opts.onError === 'function') opts.onError(err);
        })
        .then(function () { busy = false; if (button) button.disabled = false; });
    }

    if (button) button.addEventListener('click', function (e) { e.preventDefault(); run(); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); run(); } });
    if (opts.auto !== false) input.addEventListener('blur', function () { if (digits(input.value).length >= 9) run(); });
    return { run: run };
  }

  global.SirenAutofill = {
    lookup: lookup,
    bind: bind,
    isValidSiren: isValidSiren,
    isValidSiret: isValidSiret,
    tvaIntra: tvaIntra,
    formeLabel: formeLabel,
    FORMES: FORMES
  };
})(typeof window !== 'undefined' ? window : this);
