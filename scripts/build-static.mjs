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
<script>(function(){try{var t=localStorage.getItem('aem_theme');if(t!=='light'&&t!=='dark')t=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches)?'light':'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();</script>
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
<script src="/assets/analytics.js" defer></script>
<script src="/assets/chat.js" defer></script>
</head>
<body>
<a href="#content" class="skip-link">Aller au contenu</a>
<div class="sp-bar"><div class="sp-brand"><a class="sp-back" href="/">${CHEV} Retour au site</a></div><a href="/"><img src="/assets/logo-full.png" alt="AEM-CONSEIL"></a><div style="display:flex;align-items:center;gap:12px"><button class="theme-toggle" type="button" aria-label="Basculer le thème clair / sombre" onclick="aemToggleTheme()"><svg class="ic-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg><svg class="ic-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></button><a href="/#devis" class="btn btn-pri">Demander un devis</a></div></div>`;
}

function footer() {
  return `<footer class="sf"><div class="fl"><a href="/">Accueil</a><a href="/ressources/">Tous les articles</a><a href="/#outils">Outils gratuits</a><a href="/#contact">Contact</a></div><div>© AEM-CONSEIL — Cabinet de conseil &amp; expertise comptable. Informations générales à titre indicatif, ne constituant pas un conseil personnalisé.</div></footer>
<script>function aemThemeLogo(){var dark=document.documentElement.getAttribute('data-theme')!=='light';document.querySelectorAll('img[src*="logo-full"]').forEach(function(im){im.src=dark?'/assets/logo-full.png':'/assets/logo-full-dark.png';});var mc=document.querySelector('meta[name=theme-color]');if(mc)mc.setAttribute('content',dark?'#04050b':'#eef1f9');}function aemToggleTheme(){var el=document.documentElement;var n=el.getAttribute('data-theme')==='light'?'dark':'light';var rm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;if(!rm){el.classList.add('theming');setTimeout(function(){el.classList.remove('theming');},480);}el.setAttribute('data-theme',n);try{localStorage.setItem('aem_theme',n);}catch(e){}aemThemeLogo();}aemThemeLogo();</script>
<script>document.addEventListener('click',function(e){var b=e.target.closest('.gs-copy');if(!b)return;var u=b.getAttribute('data-url');var s=b.querySelector('span');var done=function(){if(s){var o=s.textContent;s.textContent='Lien copié \\u2713';b.classList.add('ok');setTimeout(function(){s.textContent=o;b.classList.remove('ok');},1800);}};if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(u).then(done).catch(function(){window.prompt('Copiez le lien :',u);});}else{window.prompt('Copiez le lien :',u);}});</script>
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
function shareRow(url, title) {
  const eu = encodeURIComponent(url), et = encodeURIComponent(title);
  return `<div class="gd-share"><span class="gs-lab">Partager</span>` +
    `<a href="https://www.linkedin.com/sharing/share-offsite/?url=${eu}" target="_blank" rel="noopener" aria-label="Partager sur LinkedIn"><svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5A2.5 2.5 0 002.5 6a2.5 2.5 0 002.48 2.5A2.5 2.5 0 007.5 6a2.5 2.5 0 00-2.52-2.5zM3 9h4v12H3zM10 9h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.4c0-1.3 0-2.95-1.8-2.95s-2.07 1.4-2.07 2.85V21H10z"/></svg></a>` +
    `<a href="https://www.facebook.com/sharer/sharer.php?u=${eu}" target="_blank" rel="noopener" aria-label="Partager sur Facebook"><svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 10-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.2c-1.2 0-1.6.76-1.6 1.54V12h2.7l-.43 2.9h-2.27v7A10 10 0 0022 12z"/></svg></a>` +
    `<a href="mailto:?subject=${et}&body=${eu}" aria-label="Partager par e-mail"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg></a>` +
    `<button type="button" class="gs-copy" data-url="${escA(url)}" aria-label="Copier le lien"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg><span>Copier le lien</span></button>` +
    `</div>`;
}

/* --- Pages articles --- */
let nArticles = 0;
for (const g of GUIDES) {
  const secs = SECTIONS[g.slug] || [];
  const theme = THEME_BY_NAME[g.cat];
  const url = `${SITE}/ressources/${g.slug}/`;
  const heads = [];
  const body = secs.map((s, i) => {
    heads.push(s.h);
    const ps = (s.p || []).map(x => `<p>${esc(x)}</p>`).join('');
    const li = s.list ? `<ul class="gd-list">` + s.list.map(x => `<li>${CHK}<span>${esc(x)}</span></li>`).join('') + `</ul>` : '';
    return `<div class="gd-sec" id="gsec-${i}"><h2>${esc(s.h)}</h2>${ps}${li}</div>`;
  }).join('');
  const toc = heads.length > 2 ? `<nav class="gd-toc" aria-label="Sommaire"><span class="gd-toc-t">Dans cet article</span><ol>` +
    heads.map((h, i) => `<li><a href="#gsec-${i}">${esc(h)}</a></li>`).join('') + `</ol></nav>` : '';
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
    shareRow(url, g.title) +
    toc +
    `<article class="gd-body">${body}</article>` +
    shareRow(url, g.title) +
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
