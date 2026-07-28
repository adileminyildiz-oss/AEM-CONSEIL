/* ============================================================================
   AEM-CONSEIL — Assistant conversationnel
   ----------------------------------------------------------------------------
   Widget de chat autonome, injecté sur toutes les pages (SPA + pages statiques).
   Fonctionne en deux modes :
     • LOCAL (par défaut) : assistant intelligent qui répond à partir de la base
       de connaissances du cabinet (FAQ, services, contact) et de l'index des
       articles (assets/chat-index.json), avec recherche insensible aux accents.
     • IA GÉNÉRATIVE (optionnel) : si window.AEM_CHAT_ENDPOINT est défini, les
       messages sont envoyés à ce backend (fonction Supabase → Claude) et la
       réponse générée est affichée. En cas d'erreur réseau, repli automatique
       sur l'assistant local.
   Aucune dépendance externe. Le style est injecté par le script lui-même.
   ========================================================================== */
(function () {
  'use strict';
  if (window.__aemChatLoaded) return;
  window.__aemChatLoaded = true;

  /* ---------- Coordonnées & liens (source unique) ------------------------- */
  var TEL_HREF = 'tel:+33665908325';
  var TEL_TXT  = '06 65 90 83 25';
  var MAIL     = 'aemconseil.sas@gmail.com';
  var HOME     = '/';
  /* Sur la SPA, les ancres sont des routes de hash ; sur une page statique il
     faut repartir de l'accueil. On préfixe donc par HOME quand on n'y est pas. */
  var onHome = (function () {
    var p = location.pathname.replace(/index\.html$/, '');
    return p === '/' || p === '';
  })();
  function anchor(id) { return onHome ? ('#' + id) : (HOME + '#' + id); }

  /* ---------- Normalisation (minuscules, sans accents, sans ponctuation) --- */
  function norm(s) {
    return (s || '')
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  var STOP = norm(
    'le la les un une des de du au aux et ou a as ai est sont ce cette ces mon ma mes ' +
    'votre vos notre nos je tu il elle on nous vous ils elles pour par sur dans avec ' +
    'que qui quoi quel quelle quels quelles comment combien pourquoi quand ou est ce ' +
    'que qu il faut peut puis dois vais suis me te se ne pas plus moins tres si en y'
  ).split(' ');
  function tokens(s) {
    return norm(s).split(' ').filter(function (t) {
      return t.length > 2 && STOP.indexOf(t) === -1;
    });
  }

  /* ---------- Base de connaissances (intents) ----------------------------- */
  /* Chaque entrée : kw (mots-clés / synonymes), a (réponse HTML), chips ? */
  var KB = [
    { id: 'rdv', kw: 'rendez vous rdv gratuit premier echange offert appel decouverte contact prendre reserver creneau disponibilite',
      a: 'Le <b>premier rendez-vous est offert et sans engagement</b>. C\'est l\'occasion de faire le point sur votre situation et de voir concrètement comment nous pouvons vous aider. Vous pouvez réserver un créneau en ligne, nous appeler au <a href="' + TEL_HREF + '">' + TEL_TXT + '</a> ou nous écrire à <a href="mailto:' + MAIL + '">' + MAIL + '</a>.',
      chips: [['Prendre rendez-vous', anchor('rdv')], ['Être recontacté', '@lead']] },

    { id: 'tarif', kw: 'prix tarif tarifs cout couts coute coutent couter couteux honoraires devis combien facturation forfait abonnement mensuel payer budget',
      a: 'Nos honoraires sont établis <b>sur-mesure</b> : chaque mission fait l\'objet d\'un devis clair et d\'une lettre de mission, selon votre activité, votre volume et vos besoins. Pas de mauvaise surprise, vous savez à l\'avance ce qui est inclus.',
      chips: [['Voir les tarifs', anchor('tarifs')], ['Demander un devis gratuit', anchor('devis')]] },

    { id: 'services', kw: 'service services prestation prestations que faites vous accompagnement missions offre proposez',
      a: 'Nous accompagnons entrepreneurs, indépendants, TPE et PME sur : <b>expertise comptable</b>, <b>conseil &amp; gestion</b>, <b>paie &amp; social</b>, <b>fiscalité</b>, <b>création d\'entreprise</b> et un <b>accompagnement personnalisé</b> par un interlocuteur dédié.',
      chips: [['Voir nos services', anchor('services')], ['Nos outils gratuits', anchor('outils')]] },

    { id: 'compta', kw: 'comptabilite comptable bilan tenue liasse fiscale comptes annuels ecritures fec saisie revision',
      a: 'Notre mission d\'<b>expertise comptable</b> couvre la tenue complète de votre comptabilité, la saisie, la révision, le bilan et le compte de résultat, les comptes annuels et liasses fiscales, ainsi que des tableaux de bord réguliers.',
      chips: [['Expertise comptable', anchor('services')], ['Reprendre ma compta', anchor('contact')]] },

    { id: 'paie', kw: 'paie salaire bulletin bulletins dsn social salarie salaries embauche contrat employeur conges',
      a: 'Le pôle <b>paie &amp; social</b> gère vos bulletins de paie mensuels, les déclarations sociales (DSN), les congés et absences, les contrats et documents de fin de contrat, ainsi que le conseil en droit social.',
      chips: [['Paie & social', anchor('services')], ['En parler', anchor('contact')]] },

    { id: 'fisca', kw: 'fiscalite fiscal tva impot impots declaration declarations optimisation controle taxe',
      a: 'Côté <b>fiscalité</b>, nous prenons en charge vos déclarations de TVA, les déclarations fiscales annuelles, l\'optimisation adaptée à votre situation, la veille réglementaire et l\'assistance en cas de contrôle.',
      chips: [['Fiscalité', anchor('services')], ['Calculer ma TVA', anchor('outils')]] },

    { id: 'creation', kw: 'creation creer entreprise statut statuts societe immatriculation lancer demarrer business plan sasu sarl auto entrepreneur micro',
      a: 'Nous vous accompagnons dans la <b>création d\'entreprise</b> de A à Z : choix du statut juridique, rédaction des statuts, formalités et immatriculation, business plan et prévisionnel, puis suivi au démarrage.',
      chips: [['Création d\'entreprise', anchor('services')], ['Être accompagné', anchor('contact')]] },

    { id: 'gestion', kw: 'conseil gestion pilotage tableau bord previsionnel budget rentabilite marge tresorerie strategie',
      a: 'Notre offre <b>conseil &amp; gestion</b> vous aide à piloter et anticiper : tableaux de bord personnalisés, prévisionnels et budgets, analyse de rentabilité et de marges, suivi de trésorerie et aide à la décision.',
      chips: [['Conseil & gestion', anchor('services')], ['Mes outils de calcul', anchor('outils')]] },

    { id: 'changer', kw: 'changer changement expert comptable cabinet actuel quitter transferer reprise dossier',
      a: 'Changer d\'expert-comptable est <b>possible à tout moment</b>, même en cours d\'année. Nous récupérons votre dossier (FEC et pièces comptables) auprès de votre ancien cabinet et reprenons la tenue <b>sans interruption de service</b>.',
      chips: [['En savoir plus', anchor('faq')], ['Démarrer', anchor('contact')]] },

    { id: 'distance', kw: 'distance presentiel deplacer bureau cabinet rencontrer visio en ligne rendez ou situe adresse zone secteur region',
      a: 'Nous travaillons <b>à distance comme en présentiel</b>, selon votre préférence. Tout peut se faire en ligne via des outils sécurisés (transmission des pièces, échanges, signature), et nous restons disponibles pour vous rencontrer quand c\'est utile.',
      chips: [['Nous contacter', anchor('contact')]] },

    { id: 'securite', kw: 'securite donnees rgpd confidentiel confidentialite protection heberges chiffres serveurs',
      a: 'Vos données sont <b>hébergées sur des serveurs sécurisés et chiffrés, conformes au RGPD</b>. Vous gardez un accès permanent via un espace en ligne dédié pour déposer vos pièces et suivre votre dossier.',
      chips: [['Confidentialité', anchor('confidentialite')]] },

    { id: 'delai', kw: 'delai delais reponse repondre rapidite disponible joindre contacter reactivite temps',
      a: 'Nous nous engageons à répondre à toute demande <b>sous 24 h ouvrées</b>. Votre interlocuteur dédié connaît votre dossier : pas besoin de tout réexpliquer à chaque échange.',
      chips: [['Nous écrire', anchor('contact')], ['Nous appeler', TEL_HREF]] },

    { id: 'qui', kw: 'qui entreprises clients accompagnez type tpe pme independant freelance artisan commercant profession liberale',
      a: 'Nous accompagnons les <b>entrepreneurs individuels, indépendants, TPE et PME</b>, quel que soit leur secteur d\'activité et leur stade de développement.',
      chips: [['Nos services', anchor('services')], ['Prendre contact', anchor('contact')]] },

    { id: 'outils', kw: 'outil outils calcul calculer calculatrice simulateur tva marge tjm seuil rentabilite micro pret emprunt',
      a: 'Le cabinet met à votre disposition des <b>outils de calcul gratuits</b> : TVA, marge commerciale, TJM, seuil de rentabilité, coût d\'un salarié, régime micro et mensualité de prêt.',
      chips: [['Ouvrir les outils', anchor('outils')]] },

    { id: 'ressources', kw: 'article articles guide guides blog ressource ressources lire conseils fiche fiches documentation',
      a: 'Nous publions de nombreux <b>guides gratuits</b> sur la comptabilité, la fiscalité, la paie, la gestion et la création d\'entreprise. Dites-moi votre sujet et je vous oriente vers les bons articles.',
      chips: [['Tous les articles', onHome ? '#ressources' : '/ressources/']] },

    { id: 'contact', kw: 'contact contacter joindre telephone mail email ecrire appeler numero coordonnees',
      a: 'Vous pouvez nous joindre par téléphone au <a href="' + TEL_HREF + '">' + TEL_TXT + '</a> ou par e-mail à <a href="mailto:' + MAIL + '">' + MAIL + '</a>. Réponse assurée sous 24 h ouvrées.',
      chips: [['Être recontacté', '@lead'], ['Prendre rendez-vous', anchor('rdv')]] }
  ];
  // Pré-calcul des tokens de mots-clés
  KB.forEach(function (e) { e._t = tokens(e.kw); });

  /* ---------- Index des articles (chargé à la 1re ouverture) --------------- */
  var ARTICLES = null;          // [{t,u,c,l}]
  var articlesTried = false;
  function loadArticles(cb) {
    if (ARTICLES || articlesTried) { cb(); return; }
    articlesTried = true;
    var base = onHome ? '' : '';
    fetch('/assets/chat-index.json', { cache: 'force-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data && Array.isArray(data.articles)) {
          ARTICLES = data.articles.map(function (a) {
            a._t = tokens((a.t || '') + ' ' + (a.l || '') + ' ' + (a.c || ''));
            return a;
          });
        }
        cb();
      })
      .catch(function () { cb(); });
  }
  function searchArticles(qt, limit) {
    if (!ARTICLES) return [];
    var scored = [];
    for (var i = 0; i < ARTICLES.length; i++) {
      var a = ARTICLES[i], s = 0;
      for (var j = 0; j < qt.length; j++) {
        if (a._t.indexOf(qt[j]) !== -1) s += 2;
        else if (a._t.some(function (w) { return w.indexOf(qt[j]) === 0; })) s += 1;
      }
      if (s > 0) scored.push({ a: a, s: s });
    }
    scored.sort(function (x, y) { return y.s - x.s; });
    return scored.slice(0, limit || 3).map(function (o) { return o.a; });
  }

  /* ---------- Moteur de réponse local ------------------------------------- */
  function bestIntent(qt) {
    var best = null, bestScore = 0;
    for (var i = 0; i < KB.length; i++) {
      var e = KB[i], s = 0;
      for (var j = 0; j < qt.length; j++) {
        if (e._t.indexOf(qt[j]) !== -1) s += 2;
        else if (e._t.some(function (w) { return w.indexOf(qt[j]) === 0 || qt[j].indexOf(w) === 0; })) s += 1;
      }
      if (s > bestScore) { bestScore = s; best = e; }
    }
    return { entry: best, score: bestScore };
  }

  // Détection d'une demande de mise en relation (rappel / laisser ses coordonnées)
  var LEAD_KW = tokens('rappel rappelez rappeler recontacter recontactez recontacte recontact laisser coordonnees rappelle');
  var EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
  function wantsLead(q, qt) {
    if (EMAIL_RE.test(q)) return true;
    for (var i = 0; i < qt.length; i++) if (LEAD_KW.indexOf(qt[i]) !== -1) return true;
    return false;
  }

  function localAnswer(q) {
    var qt = tokens(q);
    if (!qt.length) {
      return { html: 'Je peux vous renseigner sur nos <b>services</b>, nos <b>tarifs</b>, la <b>prise de rendez-vous</b> ou vous orienter vers un <b>article</b>. Que souhaitez-vous savoir ?',
        chips: defaultChips() };
    }
    // Demande explicite d'être recontacté → on propose de laisser ses coordonnées
    if (wantsLead(q, qt)) {
      return { html: 'Avec plaisir. Laissez-moi vos coordonnées ci-dessous : notre équipe vous recontacte sous 24 h ouvrées.', lead: true, chips: [] };
    }
    var r = bestIntent(qt);
    var arts = searchArticles(qt, 3);

    // Bonne correspondance d'intention
    if (r.entry && r.score >= 2) {
      var chips = (r.entry.chips || []).slice();
      var html = r.entry.a;
      if (arts.length) {
        html += '<div class="aem-arts"><span>Articles utiles :</span>' +
          arts.map(function (a) { return '<a href="' + a.u + '">' + esc(a.t) + '</a>'; }).join('') + '</div>';
      }
      return { html: html, chips: chips };
    }

    // Sinon : proposer des articles pertinents
    if (arts.length) {
      return {
        html: 'Voici des articles qui devraient vous aider :' +
          '<div class="aem-arts">' + arts.map(function (a) {
            return '<a href="' + a.u + '">' + esc(a.t) + '</a>';
          }).join('') + '</div>' +
          'Besoin d\'un conseil personnalisé ? Le premier échange est offert.',
        chips: [['Nous contacter', anchor('contact')], ['Demander un devis', anchor('devis')]]
      };
    }

    // Repli : contact humain
    return {
      html: 'Je n\'ai pas d\'information précise sur ce point, mais notre équipe se fera un plaisir de vous répondre. ' +
        'Le <b>premier échange est gratuit et sans engagement</b> : appelez-nous au <a href="' + TEL_HREF + '">' + TEL_TXT +
        '</a>, écrivez-nous à <a href="mailto:' + MAIL + '">' + MAIL + '</a>, ou laissez-moi vos coordonnées.',
      chips: [['Être recontacté', '@lead'], ['Prendre rendez-vous', anchor('rdv')]]
    };
  }

  function defaultChips() {
    return [
      ['Vos services', anchor('services')],
      ['Vos tarifs', anchor('tarifs')],
      ['Prendre rendez-vous', anchor('contact')],
      ['Outils gratuits', anchor('outils')]
    ];
  }

  function esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ---------- Mode IA générative (backend optionnel) ---------------------- */
  var history = []; // {role, content}
  function remoteAnswer(q, done) {
    var endpoint = window.AEM_CHAT_ENDPOINT;
    var msgs = history.concat([{ role: 'user', content: q }]);
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: msgs })
    })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (data) {
        var text = (data && (data.reply || data.text || data.content)) || '';
        if (!text) throw new Error('empty');
        history.push({ role: 'user', content: q });
        history.push({ role: 'assistant', content: text });
        if (history.length > 12) history = history.slice(-12);
        done({ html: mdToHtml(text), chips: [] });
      })
      .catch(function () {
        // Repli sur l'assistant local en cas d'échec du backend
        done(localAnswer(q));
      });
  }
  // Mini rendu markdown (gras, liens, sauts de ligne) — sortie IA
  function mdToHtml(t) {
    t = esc(t)
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/\n/g, '<br>');
    return '<p>' + t + '</p>';
  }

  function answer(q, done) {
    if (window.AEM_CHAT_ENDPOINT) { remoteAnswer(q, done); return; }
    // léger délai pour l'effet « en train d'écrire »
    setTimeout(function () { done(localAnswer(q)); }, 260);
  }

  /* ---------- Styles ------------------------------------------------------ */
  var CSS =
  '.aem-chat-btn{position:fixed;right:20px;bottom:20px;z-index:2147483000;width:60px;height:60px;border-radius:50%;border:1px solid rgba(140,160,255,.5);cursor:pointer;display:grid;place-items:center;color:#eaf0ff;background:radial-gradient(120% 120% at 30% 20%,#3350ff,#141a4d);box-shadow:0 12px 34px rgba(20,30,110,.55),inset 0 1px 0 rgba(255,255,255,.25);transition:transform .2s ease,box-shadow .2s ease}' +
  '.aem-chat-btn:hover{transform:translateY(-2px) scale(1.03);box-shadow:0 16px 42px rgba(30,45,150,.62)}' +
  '.aem-chat-btn svg{width:26px;height:26px}' +
  '.aem-chat-btn .aem-dot{position:absolute;top:-3px;right:-3px;width:15px;height:15px;border-radius:50%;background:#38e0a6;border:2px solid #0a0f24;animation:aem-pulse 2.4s infinite}' +
  '@keyframes aem-pulse{0%,100%{box-shadow:0 0 0 0 rgba(56,224,166,.5)}50%{box-shadow:0 0 0 7px rgba(56,224,166,0)}}' +
  '.aem-chat-panel{position:fixed;right:20px;bottom:92px;z-index:2147483000;width:min(380px,calc(100vw - 32px));height:min(600px,calc(100vh - 130px));display:flex;flex-direction:column;border-radius:20px;overflow:hidden;opacity:0;transform:translateY(14px) scale(.98);pointer-events:none;transition:opacity .22s ease,transform .22s ease;font-family:"Inter Tight",system-ui,-apple-system,Segoe UI,Roboto,sans-serif;border:1px solid rgba(120,140,255,.28);background:linear-gradient(170deg,#0b1030,#070a1c 70%);box-shadow:0 24px 70px rgba(4,6,20,.7)}' +
  '.aem-chat-panel.open{opacity:1;transform:none;pointer-events:auto}' +
  '.aem-ch-head{display:flex;align-items:center;gap:11px;padding:15px 16px;border-bottom:1px solid rgba(120,140,255,.18);background:linear-gradient(180deg,rgba(40,60,190,.28),transparent)}' +
  '.aem-ch-ava{width:38px;height:38px;border-radius:50%;flex:none;display:grid;place-items:center;color:#fff;background:radial-gradient(120% 120% at 30% 20%,#3350ff,#141a4d);border:1px solid rgba(150,170,255,.4);font-weight:700;font-size:14px}' +
  '.aem-ch-head .aem-ti{flex:1;min-width:0}' +
  '.aem-ch-head .aem-ti b{display:block;font-size:14.5px;color:#eef2ff;font-weight:600;letter-spacing:-.01em}' +
  '.aem-ch-head .aem-ti span{display:flex;align-items:center;gap:6px;font-size:12px;color:#9fb0e6;margin-top:2px}' +
  '.aem-ch-head .aem-ti span::before{content:"";width:7px;height:7px;border-radius:50%;background:#38e0a6}' +
  '.aem-ch-x{background:none;border:none;color:#9fb0e6;cursor:pointer;padding:6px;border-radius:8px;display:grid;place-items:center}' +
  '.aem-ch-x:hover{background:rgba(255,255,255,.06);color:#eef2ff}' +
  '.aem-ch-body{flex:1;overflow-y:auto;padding:16px 14px 8px;display:flex;flex-direction:column;gap:12px;scrollbar-width:thin;scrollbar-color:rgba(120,140,255,.35) transparent}' +
  '.aem-ch-body::-webkit-scrollbar{width:7px}.aem-ch-body::-webkit-scrollbar-thumb{background:rgba(120,140,255,.3);border-radius:8px}' +
  '.aem-msg{max-width:86%;padding:11px 14px;border-radius:15px;font-size:14px;line-height:1.55;word-wrap:break-word}' +
  '.aem-msg p{margin:0 0 8px}.aem-msg p:last-child{margin:0}' +
  '.aem-msg a{color:#a9baff;text-decoration:underline;text-underline-offset:2px}' +
  '.aem-bot{align-self:flex-start;background:rgba(130,150,255,.11);border:1px solid rgba(130,150,255,.2);color:#e4e9fb;border-bottom-left-radius:5px}' +
  '.aem-usr{align-self:flex-end;background:linear-gradient(180deg,#2b45ff,#2036cc);color:#fff;border-bottom-right-radius:5px}' +
  '.aem-arts{margin-top:9px;display:flex;flex-direction:column;gap:5px}' +
  '.aem-arts span{font-size:11.5px;text-transform:uppercase;letter-spacing:.05em;color:#8ba0dd;font-weight:600}' +
  '.aem-arts a{font-size:13px;color:#c2ceff;text-decoration:none;padding:6px 9px;border-radius:9px;background:rgba(120,140,255,.09);border:1px solid rgba(120,140,255,.16)}' +
  '.aem-arts a:hover{background:rgba(120,140,255,.16)}' +
  '.aem-chips{display:flex;flex-wrap:wrap;gap:7px;padding:2px 2px 4px}' +
  '.aem-chip{font-family:inherit;font-size:12.5px;color:#cdd8ff;cursor:pointer;padding:7px 12px;border-radius:20px;background:rgba(120,140,255,.1);border:1px solid rgba(120,140,255,.26);transition:background .15s,border-color .15s}' +
  '.aem-chip:hover{background:rgba(120,140,255,.2);border-color:rgba(150,170,255,.5)}' +
  '.aem-lead{max-width:100%;width:100%}' +
  '.aem-lead form{display:flex;flex-direction:column;gap:9px}' +
  '.aem-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}' +
  '.aem-lead label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:#a9b8e8;font-weight:600}' +
  '.aem-lead input,.aem-lead textarea{font-family:inherit;font-size:13.5px;color:#eef2ff;background:rgba(8,12,30,.7);border:1px solid rgba(120,140,255,.28);border-radius:10px;padding:9px 11px;outline:none;resize:none}' +
  '.aem-lead input:focus,.aem-lead textarea:focus{border-color:rgba(150,170,255,.6)}' +
  '.aem-lead input::placeholder,.aem-lead textarea::placeholder{color:#7f8fc4}' +
  '.aem-lead button[type=submit]{margin-top:2px;font-family:inherit;font-size:13.5px;font-weight:600;color:#fff;cursor:pointer;padding:11px;border-radius:11px;border:none;background:linear-gradient(180deg,#2b45ff,#2036cc)}' +
  '.aem-lead button[type=submit]:hover{filter:brightness(1.12)}.aem-lead button[type=submit]:disabled{opacity:.5;cursor:default}' +
  '.aem-lead-note{font-size:11px;color:#7f8fc4;text-align:center}' +
  '.aem-lead-status{font-size:12px;text-align:center}.aem-lead-status.err{color:#ff9c9c}' +
  '.aem-typing{align-self:flex-start;display:flex;gap:4px;padding:13px 15px;background:rgba(130,150,255,.11);border:1px solid rgba(130,150,255,.2);border-radius:15px;border-bottom-left-radius:5px}' +
  '.aem-typing i{width:7px;height:7px;border-radius:50%;background:#9fb0e6;animation:aem-bl 1.2s infinite}' +
  '.aem-typing i:nth-child(2){animation-delay:.2s}.aem-typing i:nth-child(3){animation-delay:.4s}' +
  '@keyframes aem-bl{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}' +
  '.aem-ch-foot{padding:10px 12px 13px;border-top:1px solid rgba(120,140,255,.16)}' +
  '.aem-ch-form{display:flex;gap:8px;align-items:flex-end}' +
  '.aem-ch-form textarea{flex:1;resize:none;max-height:96px;min-height:44px;padding:12px 14px;border-radius:13px;border:1px solid rgba(120,140,255,.28);background:rgba(8,12,30,.7);color:#eef2ff;font-family:inherit;font-size:14px;line-height:1.4;outline:none}' +
  '.aem-ch-form textarea::placeholder{color:#7f8fc4}' +
  '.aem-ch-form textarea:focus{border-color:rgba(150,170,255,.6)}' +
  '.aem-ch-send{flex:none;width:44px;height:44px;border-radius:12px;border:none;cursor:pointer;display:grid;place-items:center;color:#fff;background:linear-gradient(180deg,#2b45ff,#2036cc);transition:filter .15s}' +
  '.aem-ch-send:hover{filter:brightness(1.12)}.aem-ch-send:disabled{opacity:.45;cursor:default}' +
  '.aem-ch-foot .aem-legal{margin:8px 2px 0;font-size:10.5px;color:#6f7fb5;text-align:center}' +
  '@media (prefers-reduced-motion:reduce){.aem-chat-btn,.aem-chat-panel,.aem-chip,.aem-ch-send{transition:none}.aem-chat-btn .aem-dot,.aem-typing i{animation:none}}';

  /* ---------- Construction du DOM ----------------------------------------- */
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  var opened = false, greeted = false, panel, body, ta, sendBtn, btn;

  function build() {
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    // Bouton flottant
    btn = el('button', 'aem-chat-btn');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Ouvrir l\'assistant AEM-CONSEIL');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span class="aem-dot" aria-hidden="true"></span>' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.7 8.7 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 4 11.5 8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z"/></svg>';
    btn.addEventListener('click', toggle);
    document.body.appendChild(btn);

    // Panneau
    panel = el('div', 'aem-chat-panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-label', 'Assistant AEM-CONSEIL');
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML =
      '<div class="aem-ch-head">' +
        '<span class="aem-ch-ava" aria-hidden="true">AE</span>' +
        '<span class="aem-ti"><b>Assistant AEM-CONSEIL</b><span>En ligne · réponse immédiate</span></span>' +
        '<button type="button" class="aem-ch-x" aria-label="Fermer l\'assistant">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="aem-ch-body" role="log" aria-live="polite"></div>' +
      '<div class="aem-ch-foot">' +
        '<form class="aem-ch-form">' +
          '<textarea rows="1" placeholder="Posez votre question…" aria-label="Votre message"></textarea>' +
          '<button type="submit" class="aem-ch-send" aria-label="Envoyer">' +
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>' +
          '</button>' +
        '</form>' +
        '<div class="aem-legal">Assistant informatif — ne remplace pas un conseil personnalisé.</div>' +
      '</div>';
    document.body.appendChild(panel);

    body = panel.querySelector('.aem-ch-body');
    ta = panel.querySelector('textarea');
    sendBtn = panel.querySelector('.aem-ch-send');
    panel.querySelector('.aem-ch-x').addEventListener('click', close);
    panel.querySelector('.aem-ch-form').addEventListener('submit', function (ev) {
      ev.preventDefault(); submit();
    });
    ta.addEventListener('input', function () {
      ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 96) + 'px';
    });
    ta.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); submit(); }
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && opened) close();
    });
  }

  /* ---------- Rendu des messages ------------------------------------------ */
  function addBot(html, chips) {
    var m = el('div', 'aem-msg aem-bot', html);
    body.appendChild(m);
    if (chips && chips.length) renderChips(chips);
    scrollDown();
  }
  function addUser(text) {
    var m = el('div', 'aem-msg aem-usr', esc(text));
    body.appendChild(m);
    scrollDown();
  }
  function renderChips(chips) {
    var wrap = el('div', 'aem-chips');
    chips.forEach(function (c) {
      var label = c[0], target = c[1];
      var chip = el('button', 'aem-chip', esc(label));
      chip.type = 'button';
      chip.addEventListener('click', function () {
        if (target === '@lead') {
          // Formulaire de mise en relation dans le chat
          renderLead();
        } else if (typeof target === 'string' && (target.charAt(0) === '#' || target.indexOf('/') === 0 || target.indexOf('tel:') === 0 || target.indexOf('mailto:') === 0)) {
          // Lien : on navigue et on ferme
          if (target.indexOf('tel:') === 0 || target.indexOf('mailto:') === 0) {
            window.location.href = target;
          } else {
            navigateTo(target);
          }
          close();
        } else {
          // Question rapide : on la pose
          ask(label);
        }
      });
      wrap.appendChild(chip);
    });
    body.appendChild(wrap);
    scrollDown();
  }
  function navigateTo(target) {
    // Sur la SPA, un hash déclenche la route ; sinon navigation normale.
    window.location.href = target;
  }

  /* ---------- Formulaire de mise en relation (lead) ----------------------- */
  var LEAD_ENDPOINT = 'https://formsubmit.co/ajax/' + MAIL;
  var leadOpen = false;
  function renderLead() {
    if (leadOpen) return;               // évite les doublons
    leadOpen = true;
    var wrap = el('div', 'aem-msg aem-bot aem-lead');
    wrap.innerHTML =
      '<form novalidate>' +
        '<input type="text" class="aem-hp" name="_honey" tabindex="-1" autocomplete="off" aria-hidden="true">' +
        '<label>Prénom<input type="text" name="nom" required autocomplete="given-name" placeholder="Votre prénom"></label>' +
        '<label>E-mail<input type="email" name="email" autocomplete="email" placeholder="vous@exemple.fr"></label>' +
        '<label>Téléphone<input type="tel" name="telephone" autocomplete="tel" placeholder="06 12 34 56 78"></label>' +
        '<label>Votre demande (facultatif)<textarea name="message" rows="2" placeholder="En quelques mots…"></textarea></label>' +
        '<button type="submit">Être recontacté</button>' +
        '<div class="aem-lead-note">E-mail ou téléphone requis. Réponse sous 24 h ouvrées.</div>' +
        '<div class="aem-lead-status" role="status" aria-live="polite"></div>' +
      '</form>';
    body.appendChild(wrap);
    scrollDown();
    var form = wrap.querySelector('form');
    var statusEl = wrap.querySelector('.aem-lead-status');
    var submitBtn = wrap.querySelector('button[type=submit]');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form._honey && form._honey.value) return;
      var nom = form.nom.value.trim();
      var email = form.email.value.trim();
      var tel = form.telephone.value.trim();
      if (!nom || (!email && !tel)) {
        statusEl.textContent = 'Merci d\'indiquer votre prénom et un e-mail ou un téléphone.';
        statusEl.className = 'aem-lead-status err';
        return;
      }
      submitBtn.disabled = true;
      var orig = submitBtn.textContent;
      submitBtn.textContent = 'Envoi…';
      statusEl.textContent = '';
      statusEl.className = 'aem-lead-status';
      var payload = {
        nom: nom, email: email, telephone: tel,
        message: form.message.value.trim(),
        _subject: 'Demande de rappel — assistant du site AEM-CONSEIL',
        _template: 'table', _captcha: 'false'
      };
      fetch(LEAD_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          if (res.ok && (res.d.success === undefined || String(res.d.success) === 'true')) {
            wrap.remove();
            leadOpen = false;
            try { if (window.aemTrack) window.aemTrack('generate_lead', { method: 'chat' }); } catch (e) {}
            addBot('Merci ' + esc(nom) + '&nbsp;! Votre demande est bien enregistrée. Notre équipe vous recontacte sous 24 h ouvrées. 😊',
              [['Voir nos services', anchor('services')], ['Nos outils gratuits', anchor('outils')]]);
          } else { throw new Error('refus'); }
        })
        .catch(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = orig;
          statusEl.textContent = 'Une erreur est survenue. Écrivez-nous à ' + MAIL + '.';
          statusEl.className = 'aem-lead-status err';
        });
    });
    setTimeout(function () { var f = form.querySelector('input[name=nom]'); if (f) f.focus(); }, 60);
  }
  function showTyping() {
    var t = el('div', 'aem-typing');
    t.innerHTML = '<i></i><i></i><i></i>';
    t.setAttribute('data-typing', '1');
    body.appendChild(t);
    scrollDown();
    return t;
  }
  function scrollDown() { body.scrollTop = body.scrollHeight; }

  /* ---------- Cycle question / réponse ------------------------------------ */
  function ask(q) {
    q = (q || '').trim();
    if (!q) return;
    addUser(q);
    var typing = showTyping();
    answer(q, function (res) {
      typing.remove();
      addBot(res.html, res.chips);
      if (res.lead) renderLead();
    });
  }
  function submit() {
    var v = ta.value.trim();
    if (!v) return;
    ta.value = ''; ta.style.height = 'auto';
    ask(v);
  }

  function greet() {
    if (greeted) return;
    greeted = true;
    loadArticles(function () {
      addBot('Bonjour&nbsp;👋 Je suis l\'assistant du cabinet <b>AEM-CONSEIL</b>. ' +
        'Je peux vous renseigner sur nos services, nos tarifs, la prise de rendez-vous ou vous orienter vers nos guides. Comment puis-je vous aider ?',
        defaultChips());
    });
  }

  /* ---------- Ouverture / fermeture --------------------------------------- */
  function toggle() { opened ? close() : open(); }
  function open() {
    opened = true;
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    btn.setAttribute('aria-expanded', 'true');
    try { if (window.aemTrack) window.aemTrack('chat_open'); } catch (e) {}
    greet();
    setTimeout(function () { ta && ta.focus(); }, 220);
  }
  function close() {
    opened = false;
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.focus();
  }

  /* ---------- Init -------------------------------------------------------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
  // API publique minimale
  window.AEMChat = { open: open, close: close, ask: function (q) { open(); ask(q); } };
})();
