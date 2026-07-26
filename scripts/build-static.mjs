/* Générateur de pages statiques pré-rendues (SEO).
   Lit les données du site (index.html + assets/articles.js) et écrit :
   - /ressources/<slug>/index.html        (une page complète par article)
   - /theme/<slug>/index.html             (une page par thème)
   - /ressources/index.html               (index de tous les articles)
   - /sitemap.xml                         (toutes les URL)
   Relancer après chaque évolution du contenu :  node scripts/build-static.mjs
*/
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const ROOT = '/home/user/AEM-CONSEIL';
const SITE = 'https://aemconseil.eu';
const html = readFileSync(ROOT + '/index.html', 'utf8');
const artjs = readFileSync(ROOT + '/assets/articles.js', 'utf8');

/* --- Parse GUIDES (métadonnées, JSON) --- */
const gs = html.indexOf('var GUIDES=['); const ge = html.indexOf('];', gs);
const GUIDES = JSON.parse(html.slice(gs + 'var GUIDES='.length, ge + 1));

/* --- Parse THEMES (littéral JS) --- */
const ts = html.indexOf('var THEMES=['); const te = html.indexOf('\n];', ts);
const THEMES = eval('(' + html.slice(ts + 'var THEMES='.length, te + 2) + ')');
const THEME_BY_NAME = {}; THEMES.forEach(t => THEME_BY_NAME[t.name] = t);

/* --- Parse ARTICLE_SECTIONS (JSON) --- */
const as = artjs.indexOf('window.ARTICLE_SECTIONS='); const ae = artjs.lastIndexOf('};');
const SECTIONS = JSON.parse(artjs.slice(as + 'window.ARTICLE_SECTIONS='.length, ae + 1));

/* --- Helpers d'échappement --- */
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escA = s => esc(s).replace(/"/g, '&quot;');
const CHK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
const CHEV = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
const ARR = '<span aria-hidden="true">→</span>';
const ORG = { "@type": "Organization", "name": "AEM-CONSEIL", "url": SITE + "/", "logo": { "@type": "ImageObject", "url": SITE + "/assets/logo-full.png" } };

function write(path, content) {
  const full = ROOT + path;
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

function head({ title, desc, url, ogType, ld }) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${escA(desc)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index, follow">
<meta name="author" content="AEM-CONSEIL">
<meta name="theme-color" content="#04050b">
<meta property="og:title" content="${escA(title)}">
<meta property="og:description" content="${escA(desc)}">
<meta property="og:type" content="${ogType}">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="AEM-CONSEIL">
<meta property="og:image" content="${SITE}/assets/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="fr_FR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escA(title)}">
<meta name="twitter:description" content="${escA(desc)}">
<meta name="twitter:image" content="${SITE}/assets/og-image.png">
<link rel="icon" type="image/png" sizes="512x512" href="/assets/favicon-512.png">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/favicon-180.png">
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/article.css">
${ld.map(o => '<script type="application/ld+json">' + JSON.stringify(o) + '</script>').join('\n')}
<script src="/assets/chat.js" defer></script>
</head>
<body>
<a href="#content" class="skip-link">Aller au contenu</a>
<div class="sp-bar"><div class="sp-brand"><a class="sp-back" href="/">${CHEV} Retour au site</a></div><a href="/"><img src="/assets/logo-full.png" alt="AEM-CONSEIL"></a><a href="/#devis" class="btn btn-pri">Demander un devis</a></div>`;
}

function footer() {
  return `<footer class="sf"><div class="fl"><a href="/">Accueil</a><a href="/ressources/">Tous les articles</a><a href="/#outils">Outils gratuits</a><a href="/#contact">Contact</a></div><div>© AEM-CONSEIL — Cabinet de conseil &amp; expertise comptable. Informations générales à titre indicatif, ne constituant pas un conseil personnalisé.</div></footer>
</body>
</html>`;
}

function relatedCards(g) {
  const rel = GUIDES.filter(x => x.cat === g.cat && x.slug !== g.slug).slice(0, 3);
  if (!rel.length) return '';
  return `<div class="gd-related"><h2>Sur le même thème</h2><div class="blog-grid">` +
    rel.map(x => card(x)).join('') + `</div></div>`;
}
function card(g) {
  return `<a class="bcard" href="/ressources/${g.slug}/"><span class="bcat">${esc(g.cat)}</span><h3>${esc(g.title)}</h3><span class="bmeta">${esc(g.read)} de lecture · Lire l'article ${ARR}</span></a>`;
}
function cta(kind) {
  return `<div class="sp-final"><h2>Une question sur ${kind}&nbsp;?</h2><p>Le premier rendez-vous est offert. Parlons de votre situation, sans engagement.</p><div class="cta-actions"><a href="/#devis" class="btn btn-pri">Demander un devis ${ARR}</a><a href="/#contact" class="btn btn-ghost">Nous contacter</a></div></div>`;
}

/* --- Pages articles --- */
let nArticles = 0;
for (const g of GUIDES) {
  const secs = SECTIONS[g.slug] || [];
  const theme = THEME_BY_NAME[g.cat];
  const url = `${SITE}/ressources/${g.slug}/`;
  const body = secs.map(s => {
    const ps = (s.p || []).map(x => `<p>${esc(x)}</p>`).join('');
    const li = s.list ? `<ul class="gd-list">` + s.list.map(x => `<li>${CHK}<span>${esc(x)}</span></li>`).join('') + `</ul>` : '';
    return `<div class="gd-sec"><h2>${esc(s.h)}</h2>${ps}${li}</div>`;
  }).join('');
  const crumb = `<nav class="crumb" aria-label="Fil d'Ariane"><a href="/">Accueil</a> › ${theme ? `<a href="/theme/${theme.slug}/">${esc(g.cat)}</a> › ` : ''}<span>${esc(g.title)}</span></nav>`;
  const ld = [
    { "@context": "https://schema.org", "@type": "Article", "headline": g.title, "description": g.lead, "articleSection": g.cat, "inLanguage": "fr-FR", "url": url, "mainEntityOfPage": url, "author": ORG, "publisher": ORG, "isPartOf": { "@type": "Blog", "name": "Le blog AEM-CONSEIL", "url": SITE + "/ressources/" } },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Accueil", "item": SITE + "/" },
      ...(theme ? [{ "@type": "ListItem", "position": 2, "name": g.cat, "item": `${SITE}/theme/${theme.slug}/` }] : []),
      { "@type": "ListItem", "position": theme ? 3 : 2, "name": g.title, "item": url }
    ] }
  ];
  const page = head({ title: `${g.title} — AEM-CONSEIL`, desc: g.lead, url, ogType: 'article', ld }) +
    `<main id="content" class="sp-wrap gd-wrap">` +
    `<div class="sp-hero">${crumb}<span class="sp-kick">${esc(g.cat)} · Guide</span><h1>${esc(g.title)}</h1><p>${esc(g.lead)}</p><span class="gd-read">${esc(g.read)} de lecture</span></div>` +
    `<article class="gd-body">${body}</article>` +
    relatedCards(g) +
    cta('ce sujet') +
    `</main>` + footer();
  write(`/ressources/${g.slug}/index.html`, page);
  nArticles++;
}

/* --- Pages thèmes --- */
for (const t of THEMES) {
  const arts = GUIDES.filter(g => g.cat === t.name);
  const url = `${SITE}/theme/${t.slug}/`;
  const intro = (t.intro || []).map(p => `<p>${esc(p)}</p>`).join('');
  const crumb = `<nav class="crumb" aria-label="Fil d'Ariane"><a href="/">Accueil</a> › <span>${esc(t.name)}</span></nav>`;
  const ld = [
    { "@context": "https://schema.org", "@type": "CollectionPage", "name": `${t.name} — Guides AEM-CONSEIL`, "description": t.tag, "inLanguage": "fr-FR", "url": url, "isPartOf": { "@type": "WebSite", "name": "AEM-CONSEIL", "url": SITE + "/" } },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Accueil", "item": SITE + "/" },
      { "@type": "ListItem", "position": 2, "name": t.name, "item": url }
    ] }
  ];
  const page = head({ title: `${t.name} — Guides & articles | AEM-CONSEIL`, desc: t.tag, url, ogType: 'website', ld }) +
    `<main id="content" class="sp-wrap">` +
    `<div class="sp-hero" style="max-width:760px">${crumb}<span class="sp-kick">Thème</span><h1>${esc(t.name)}</h1><p>${esc(t.tag)}</p></div>` +
    `<div class="th-intro">${intro}</div>` +
    `<div class="th-count">${arts.length} article${arts.length > 1 ? 's' : ''} dans ce thème</div>` +
    `<div class="rel-wrap"><div class="blog-grid">${arts.map(card).join('')}</div></div>` +
    cta('ce thème') +
    `</main>` + footer();
  write(`/theme/${t.slug}/index.html`, page);
}

/* --- Index de tous les articles --- */
{
  const url = `${SITE}/ressources/`;
  const ld = [{ "@context": "https://schema.org", "@type": "Blog", "name": "Le blog AEM-CONSEIL — Guides & articles", "description": "Tous nos guides sur la comptabilité, la fiscalité, la gestion, le social, le juridique et la création d'entreprise.", "url": url, "inLanguage": "fr-FR", "publisher": ORG }];
  let sections = '';
  for (const t of THEMES) {
    const arts = GUIDES.filter(g => g.cat === t.name);
    if (!arts.length) continue;
    sections += `<div class="gd-related" style="border-top:1px solid var(--line);margin-top:34px;padding-top:26px"><h2><a href="/theme/${t.slug}/" style="color:inherit">${esc(t.name)}</a></h2><div class="blog-grid">${arts.map(card).join('')}</div></div>`;
  }
  const page = head({ title: `Tous nos articles & guides — AEM-CONSEIL`, desc: `Plus de ${GUIDES.length} guides clairs sur la comptabilité, la fiscalité, la gestion, le social, le juridique et la création d'entreprise, sans jargon.`, url, ogType: 'website', ld }) +
    `<main id="content" class="sp-wrap">` +
    `<div class="sp-hero" style="max-width:760px"><nav class="crumb"><a href="/">Accueil</a> › <span>Ressources</span></nav><span class="sp-kick">Le blog</span><h1>Nos guides &amp; articles</h1><p>Plus de ${GUIDES.length} articles clairs pour comprendre la comptabilité, la fiscalité, la gestion et la création d'entreprise — sans jargon.</p></div>` +
    `<div class="rel-wrap">${sections}</div>` +
    cta('votre situation') +
    `</main>` + footer();
  write(`/ressources/index.html`, page);
}

/* --- Index de connaissances de l'assistant (chat) ---
   Liste compacte des articles pour la recherche locale du widget de chat.
   Consommé par assets/chat.js (fetch /assets/chat-index.json à la 1re ouverture). */
{
  const articles = GUIDES.map(g => ({ t: g.title, u: `/ressources/${g.slug}/`, c: g.cat, l: g.lead }));
  const chatIndex = { site: SITE, count: articles.length, articles };
  write('/assets/chat-index.json', JSON.stringify(chatIndex));
}

/* --- Sitemap --- */
const urls = [
  { loc: SITE + '/', p: '1.0', f: 'weekly' },
  { loc: SITE + '/ressources/', p: '0.9', f: 'weekly' },
  { loc: SITE + '/espace/', p: '0.5', f: 'monthly' },
  { loc: SITE + '/facturation/', p: '0.5', f: 'monthly' },
  ...THEMES.map(t => ({ loc: `${SITE}/theme/${t.slug}/`, p: '0.7', f: 'monthly' })),
  ...GUIDES.map(g => ({ loc: `${SITE}/ressources/${g.slug}/`, p: '0.8', f: 'monthly' }))
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map(u => `  <url><loc>${u.loc}</loc><changefreq>${u.f}</changefreq><priority>${u.p}</priority></url>`).join('\n') +
  `\n</urlset>\n`;
writeFileSync(ROOT + '/sitemap.xml', sitemap);

console.log(`Généré : ${nArticles} articles + ${THEMES.length} thèmes + 1 index + chat-index.json + sitemap (${urls.length} URL).`);
