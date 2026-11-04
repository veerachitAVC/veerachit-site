// Single source of truth: STATIC_POSTS in post.html.
// Adding an essay = one entry there + a Notion row, then:  node scripts/generate-static-posts.mjs
// Writes: thoughts/<slug>/, thoughts/index.html, 404.html, sitemap.xml, feed.xml, llms.txt,
// and the generated regions of index.html. New OG cards: add --og (needs local Chrome).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const SITE = 'https://veerachit.com';
const NAME_EN = 'Veerachit Jaruthanadech';
const NAME_TH = 'วีรชิต จารุธนเดช';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const source = fs.readFileSync(path.join(root, 'post.html'), 'utf8');
const postsMatch = source.match(/var STATIC_POSTS = (\{[\s\S]*?\n  \});\n\n  function renderStatic/);
const stylesMatch = source.match(/<style>([\s\S]*?)<\/style>/);
if (!postsMatch || !stylesMatch) throw new Error('Could not find STATIC_POSTS or the post stylesheet in post.html');

const styles = stylesMatch[1];
const posts = Object.entries(vm.runInNewContext(`(${postsMatch[1]})`))
  .map(([id, post]) => {
    for (const field of ['slug', 'published', 'excerpt', 'title', 'tag', 'date', 'html']) {
      if (!post[field]) throw new Error(`Post ${id} is missing ${field}`);
    }
    return { id, lang: 'en', ...post };
  })
  .sort((a, b) => b.published.localeCompare(a.published));
const lastUpdate = posts.reduce((max, p) => {
  const d = p.updated || p.published;
  return d > max ? d : max;
}, '');

const UI = {
  en: {
    by: 'By',
    back: 'All thoughts',
    keep: 'Keep reading',
    all: `All essays by ${NAME_EN}`,
    about: 'About the author',
    home: 'Home',
    bio: `Known as VJ. An entrepreneur and CEO based in Bangkok, building companies since 2006: <a href="https://www.averyandco.co.th/" target="_blank" rel="noopener">Avery &amp; Co</a>, <a href="https://ai.averyandco.co.th/" target="_blank" rel="noopener">Avery AI</a>, Avery Global, <a href="https://www.paperyprint.com/" target="_blank" rel="noopener">Papery</a> and <a href="https://claypotking.com/" target="_blank" rel="noopener">Claypot King</a>. Holds the Google AI Professional Certificate. <a href="/#about" rel="author">More about him</a>.`
  },
  th: {
    by: 'โดย',
    back: 'บทความทั้งหมด',
    keep: 'อ่านต่อ',
    all: `บทความทั้งหมดของ ${NAME_TH}`,
    about: 'เกี่ยวกับผู้เขียน',
    home: 'หน้าแรก',
    bio: `หรือ VJ ผู้ประกอบการและซีอีโอในกรุงเทพฯ สร้างบริษัทมาตั้งแต่ปี 2006 ได้แก่ <a href="https://www.averyandco.co.th/" target="_blank" rel="noopener">Avery &amp; Co</a>, <a href="https://ai.averyandco.co.th/" target="_blank" rel="noopener">Avery AI</a>, Avery Global, <a href="https://www.paperyprint.com/" target="_blank" rel="noopener">Papery</a> และ <a href="https://claypotking.com/" target="_blank" rel="noopener">Claypot King</a> ได้รับ Google AI Professional Certificate <a href="/#about" rel="author">อ่านประวัติเพิ่มเติม</a>`
  }
};

const canonicalOf = (post) => `${SITE}/thoughts/${post.slug}/`;
const ogPath = (post) => `assets/og/${post.slug}.jpg`;
const ogUrl = (post) => (fs.existsSync(path.join(root, ogPath(post))) ? `${SITE}/${ogPath(post)}` : `${SITE}/og-image.jpg`);
const ym = (post) => post.published.slice(0, 7).replace('-', '.');
const hasThai = (s) => /[฀-๿]/.test(s);

function plainText(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function descriptionFor(post) {
  if (post.description) return post.description;
  const paragraphs = [...post.html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => plainText(m[1]));
  const text = paragraphs.slice(0, 3).join(' ').replace(/^In brief:\s*/, '');
  if (text.length <= 158) return text;
  const clipped = text.slice(0, 158);
  return `${clipped.slice(0, clipped.lastIndexOf(' '))}…`;
}

function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
const escapeXml = (v) => escapeHtml(v).replace(/'/g, '&apos;');
const jsonLd = (obj) => JSON.stringify(obj, null, 2).replace(/</g, '\\u003c');

const authorSchema = {
  '@type': 'Person',
  '@id': `${SITE}/#person`,
  name: NAME_EN,
  alternateName: [NAME_TH, 'VJ'],
  url: `${SITE}/`,
  jobTitle: 'Entrepreneur & CEO',
  image: `${SITE}/VJPortrait.png`
};

function head({ lang, title, description, canonical, ogType, ogImage, ogTitle, extra = '', schema, robots = 'index, follow, max-image-preview:large' }) {
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="author" content="${NAME_EN}">
<meta name="robots" content="${robots}">
${canonical ? `<link rel="canonical" href="${canonical}">` : ''}
<meta name="theme-color" content="#08070C">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="${NAME_EN}">
<meta property="og:locale" content="${lang === 'th' ? 'th_TH' : 'en_US'}">
<meta property="og:title" content="${escapeHtml(ogTitle || title)}">
<meta property="og:description" content="${escapeHtml(description)}">
${canonical ? `<meta property="og:url" content="${canonical}">` : ''}
<meta property="og:image" content="${ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${escapeHtml(ogTitle || title)} by ${NAME_EN}">
${extra}<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(ogTitle || title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${ogImage}">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="alternate" type="application/rss+xml" title="${NAME_EN}: Thoughts" href="/feed.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&amp;family=Inter:wght@400;500&amp;family=Space+Mono:wght@400;700&amp;family=IBM+Plex+Sans+Thai:wght@400;500;600&amp;display=swap" rel="stylesheet">
${schema ? `<script type="application/ld+json">${jsonLd(schema)}</script>` : ''}
<script type="speculationrules">{"prerender":[{"where":{"href_matches":"/thoughts/*"},"eagerness":"moderate"}]}</script>
<style>${styles}</style>
</head>`;
}

const nav = `<div id="scrollBar" aria-hidden="true"></div>
<nav class="nav" id="nav" aria-label="Primary">
  <a href="/" class="brand" aria-label="${NAME_EN}, home"><img src="/veerachit-logo-web.png" alt="Veerachit" class="brand-logo" width="1264" height="228"></a>
  <div class="nav-right">
    <div class="nav-links"><a href="/#about">About</a><a href="/#ventures">Ventures</a><a href="/#photography">Photography</a><a href="/thoughts/">Thoughts</a></div>
    <a href="mailto:hello@veerachit.com" class="nav-cta">Let's talk <span>↗</span></a>
    <button class="burger" id="burger" aria-label="Open menu" aria-expanded="false" aria-controls="mobileMenu"><span></span><span></span><span></span></button>
  </div>
</nav>
<div class="mobile-menu" id="mobileMenu"><a href="/#about"><span>01</span>About</a><a href="/#ventures"><span>02</span>Ventures</a><a href="/#photography"><span>03</span>Photography</a><a href="/thoughts/"><span>04</span>Thoughts</a><a href="mailto:hello@veerachit.com"><span>05</span>Contact</a><p class="mobile-foot">Bangkok, Thailand · UTC+7</p></div>`;

const foot = `<footer class="footer"><div class="footer-bottom wrap"><p class="mono">© <span id="year"></span> ${NAME_EN} (<span lang="th">${NAME_TH}</span>)</p><p class="mono"><a href="#top">Back to top ↑</a> · Designed in Bangkok</p></div><div class="footer-wordmark" aria-hidden="true">VEERACHIT</div></footer>
<script>
(function(){
  var nav=document.getElementById('nav'),bar=document.getElementById('scrollBar'),burger=document.getElementById('burger'),menu=document.getElementById('mobileMenu');
  function onScroll(){nav.classList.toggle('scrolled',window.scrollY>40);var h=document.body.scrollHeight-window.innerHeight;bar.style.width=(h>0?window.scrollY/h*100:0)+'%'}
  function toggle(open){nav.classList.toggle('open',open);burger.setAttribute('aria-expanded',open?'true':'false');burger.setAttribute('aria-label',open?'Close menu':'Open menu');document.body.style.overflow=open?'hidden':''}
  burger.addEventListener('click',function(){toggle(!nav.classList.contains('open'))});menu.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){toggle(false)})});
  window.addEventListener('scroll',onScroll,{passive:true});document.getElementById('year').textContent=new Date().getFullYear();onScroll();
})();
</script>
</body>
</html>`;

const backArrow = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function relatedFor(post) {
  // Newest same-tag essay (new work collects links at once), one rotating same-tag essay,
  // and one from another tag, so older essays keep receiving links too.
  const others = posts.filter((p) => p.id !== post.id);
  const sameTag = others.filter((p) => p.tag === post.tag);
  const rest = others.filter((p) => p.tag !== post.tag);
  const seed = posts.findIndex((p) => p.id === post.id);
  const rotate = (list) => (list.length ? [list[seed % list.length]] : []);
  const picks = [...sameTag.slice(0, 1), ...rotate(sameTag.slice(1)), ...rotate(rest)];
  for (const p of others) {
    if (picks.length >= 3) break;
    if (!picks.includes(p)) picks.push(p);
  }
  return picks.slice(0, 3);
}

function postLink(p, withExcerpt = false) {
  const lang = p.lang === 'th' ? ' lang="th"' : '';
  return `<a class="post-link" href="/thoughts/${p.slug}/"><span class="post-link-date">${ym(p)}</span><span class="post-link-title"${lang}>${escapeHtml(p.title)}${withExcerpt ? `<span class="post-link-excerpt">${escapeHtml(p.excerpt)}</span>` : ''}</span></a>`;
}

function articlePage(post) {
  const ui = UI[post.lang];
  const canonical = canonicalOf(post);
  const description = descriptionFor(post);
  const modified = post.updated || post.published;
  const image = ogUrl(post);
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${canonical}#article`,
        headline: post.title,
        description,
        inLanguage: post.lang,
        articleSection: post.tag,
        wordCount: plainText(post.html).split(/\s+/).length,
        datePublished: post.published,
        dateModified: modified,
        mainEntityOfPage: canonical,
        image: { '@type': 'ImageObject', url: image, width: 1200, height: 630 },
        author: authorSchema,
        publisher: { '@id': `${SITE}/#person` },
        isPartOf: { '@id': `${SITE}/#website` },
        keywords: [post.tag, NAME_EN, NAME_TH]
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: NAME_EN, item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Thoughts', item: `${SITE}/thoughts/` },
          { '@type': 'ListItem', position: 3, name: post.title, item: canonical }
        ]
      }
    ]
  };
  return `${head({
    lang: post.lang,
    title: post.lang === 'th' ? `${post.title} | ${NAME_TH}` : `${post.title} | ${NAME_EN} (${NAME_TH})`,
    ogTitle: post.title,
    description,
    canonical,
    ogType: 'article',
    ogImage: image,
    schema,
    extra: `<meta property="article:published_time" content="${post.published}">\n<meta property="article:modified_time" content="${modified}">\n<meta property="article:author" content="${SITE}/">\n<meta property="article:section" content="${escapeHtml(post.tag)}">\n`
  })}
<body id="top">
${nav}
<main>
  <article class="post-wrap">
    <a href="/thoughts/" class="post-back">${backArrow}${ui.back}</a>
    <div class="post-meta"><time datetime="${post.published}">${post.date}</time><span class="p-tag-chip">${escapeHtml(post.tag)}</span></div>
    <h1 class="post-title">${escapeHtml(post.title)}</h1>
    <p class="post-byline">${ui.by} <a href="/#about" rel="author">${post.lang === 'th' ? NAME_TH : NAME_EN}</a> (<span${post.lang === 'th' ? '' : ' lang="th"'}>${post.lang === 'th' ? NAME_EN : NAME_TH}</span>)</p>
    <div class="post-content">${post.html}</div>
    <aside class="post-author" aria-label="${ui.about}">
      <img src="/assets/vj-portrait-224.webp" alt="${NAME_TH} (${NAME_EN})" width="64" height="64" loading="lazy" decoding="async">
      <div>
        <p class="post-author-name">${post.lang === 'th' ? `${NAME_TH} (${NAME_EN})` : `${NAME_EN} (<span lang="th">${NAME_TH}</span>)`}</p>
        <p class="post-author-bio">${ui.bio}</p>
      </div>
    </aside>
    <nav class="post-related" aria-label="${ui.keep}">
      <h2>${ui.keep}</h2>
      ${relatedFor(post).map((p) => postLink(p)).join('\n      ')}
      <a class="post-all" href="/thoughts/">${ui.all} →</a>
    </nav>
  </article>
</main>
${foot}`;
}

function archivePage() {
  const canonical = `${SITE}/thoughts/`;
  const title = `Thoughts: Essays by ${NAME_EN} (${NAME_TH})`;
  const description = `Essays by ${NAME_EN} (${NAME_TH}) on AI in real operations, brand, and running five companies from Bangkok.`;
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${canonical}#page`,
        url: canonical,
        name: title,
        description,
        inLanguage: ['en', 'th'],
        author: authorSchema,
        isPartOf: { '@id': `${SITE}/#website` },
        dateModified: lastUpdate,
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: posts.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: canonicalOf(p), name: p.title }))
        }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: NAME_EN, item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Thoughts', item: canonical }
        ]
      }
    ]
  };
  return `${head({ lang: 'en', title, description, canonical, ogType: 'website', ogImage: `${SITE}/og-image.jpg`, schema })}
<body id="top">
${nav}
<main>
  <div class="post-wrap">
    <a href="/" class="post-back">${backArrow}${UI.en.home}</a>
    <h1 class="post-title">Notes on building &amp; seeing.</h1>
    <p class="archive-lede">Every essay by ${NAME_EN} (<span lang="th">${NAME_TH}</span>), newest first. Occasional writing on business, brand, and the discipline of paying attention.</p>
    <nav aria-label="All essays">
      ${posts.map((p) => postLink(p, true)).join('\n      ')}
    </nav>
  </div>
</main>
${foot}`;
}

function notFoundPage() {
  return `${head({
    lang: 'en',
    title: `Page not found | ${NAME_EN}`,
    description: `This page does not exist on the site of ${NAME_EN}.`,
    ogType: 'website',
    ogImage: `${SITE}/og-image.jpg`,
    robots: 'noindex, follow'
  })}
<body id="top">
${nav}
<main>
  <div class="post-wrap">
    <h1 class="post-title">This page is not here.</h1>
    <p class="archive-lede">It may have moved. Start again from <a href="/" style="color:var(--violet-light)">the homepage</a>, or read the latest essays.</p>
    ${posts.slice(0, 3).map((p) => postLink(p)).join('\n    ')}
  </div>
</main>
${foot}`;
}

function sitemap() {
  const row = (loc, lastmod) => `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${row(`${SITE}/`, lastUpdate)}
${row(`${SITE}/thoughts/`, lastUpdate)}
${posts.map((p) => row(canonicalOf(p), p.updated || p.published)).join('\n')}
</urlset>
`;
}

function feed() {
  const items = posts.map((p) => `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${canonicalOf(p)}</link>
      <guid isPermaLink="true">${canonicalOf(p)}</guid>
      <pubDate>${new Date(`${p.published}T09:00:00+07:00`).toUTCString()}</pubDate>
      <dc:creator>${NAME_EN}</dc:creator>
      <category>${escapeXml(p.tag)}</category>
      <description>${escapeXml(p.excerpt)}</description>
    </item>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${NAME_EN}: Thoughts</title>
    <link>${SITE}/thoughts/</link>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>Essays by ${NAME_EN} (${NAME_TH}) on AI in real operations, brand, and running companies from Bangkok.</description>
    <language>en</language>
    <lastBuildDate>${new Date(`${lastUpdate}T09:00:00+07:00`).toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

function llms() {
  return `# ${NAME_EN} (${NAME_TH})

> ${NAME_EN} (${NAME_TH}), known as VJ, is an entrepreneur and CEO based in Bangkok. Since 2006 he has built five companies across branding, AI transformation, global sourcing, print, and food & beverage.

## Facts

- Name: ${NAME_EN}. Thai: ${NAME_TH}. Nickname: VJ.
- Role: Entrepreneur and CEO. Based in Bangkok, Thailand.
- Companies: Avery & Co (branding), Avery AI (AI transformation), Avery Global (Asia-focused sourcing), Papery (print production), Claypot King (food & beverage).
- Education: University of the Arts (HfK) Bremen, Germany.
- Credential: Google AI Professional Certificate.
- Contact: hello@veerachit.com

## Pages

- [About ${NAME_EN}](${SITE}/#about)
- [All essays](${SITE}/thoughts/)
- [Frequently asked questions](${SITE}/#faq)

## Essays

${posts.map((p) => `- [${p.title}](${canonicalOf(p)}) (${p.published}): ${p.excerpt}`).join('\n')}
`;
}

function updateHomepage() {
  const file = path.join(root, 'index.html');
  let html = fs.readFileSync(file, 'utf8');
  const cards = posts.slice(0, 6).map((p, i) => {
    const delay = i ? ` style="transition-delay:${i * 80}ms"` : '';
    const lang = p.lang === 'th' ? ' lang="th"' : '';
    return `      <a class="thought" href="/thoughts/${p.slug}/" data-reveal${delay}>
        <span class="t-date">${ym(p)}</span>
        <span class="t-main"${lang}><h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.excerpt)}</p></span>
        <span class="t-tag">${escapeHtml(p.tag)}</span>
        <span class="t-ar" aria-hidden="true">↗</span>
      </a>`;
  }).join('\n');
  const slugs = posts.map((p) => `    '${p.id}':'${p.slug}'`).join(',\n');
  const hasPart = posts.slice(0, 6).map((p) =>
    `        { "@type": "Article", "headline": ${JSON.stringify(p.title)}, "url": "${canonicalOf(p)}", "datePublished": "${p.published}", "author": { "@id": "${SITE}/#person" } }`
  ).join(',\n');
  const swap = (re, value) => {
    if (!re.test(html)) throw new Error(`index.html region not found: ${re}`);
    html = html.replace(re, () => value);
  };
  swap(/<!-- GENERATED:THOUGHTS -->[\s\S]*?<!-- \/GENERATED:THOUGHTS -->/, `<!-- GENERATED:THOUGHTS -->\n${cards}\n      <!-- /GENERATED:THOUGHTS -->`);
  swap(/var POST_SLUGS = \{[\s\S]*?\n  \};/, `var POST_SLUGS = {\n${slugs}\n  };`);
  swap(/"hasPart": \[[\s\S]*?\n      \]/, `"hasPart": [\n${hasPart}\n      ]`);
  fs.writeFileSync(file, html);
}

function ogCard(post) {
  const size = post.title.length > 46 ? 58 : post.title.length > 26 ? 72 : 88;
  const portrait = `data:image/webp;base64,${fs.readFileSync(path.join(root, 'assets/vj-portrait-448.webp')).toString('base64')}`;
  return `<!doctype html><html lang="${post.lang}"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500&family=Space+Mono&family=IBM+Plex+Sans+Thai:wght@500&display=swap" rel="stylesheet">
<style>
*{margin:0;box-sizing:border-box}html,body{width:1200px;height:630px;overflow:hidden}
body{background:#08070C;color:#ECEAF4;font-family:'Space Grotesk','IBM Plex Sans Thai',sans-serif;position:relative;padding:68px 80px}
body:before{content:'';position:absolute;left:-120px;top:-180px;width:760px;height:620px;background:radial-gradient(closest-side,rgba(139,92,246,.26),transparent)}
.k{position:relative;font:400 19px 'Space Mono',monospace;letter-spacing:.2em;color:#A989FF}
h1{position:relative;margin-top:44px;width:1000px;font-weight:500;font-size:${size}px;line-height:${hasThai(post.title) ? 1.3 : 1.08};letter-spacing:${hasThai(post.title) ? '0' : '-.03em'};text-wrap:balance}
.by{position:absolute;left:80px;right:80px;bottom:60px;display:flex;align-items:center;gap:22px}
.by img{width:82px;height:82px;border-radius:50%;object-fit:cover;object-position:center top}
.n{font-size:27px}.t{font-size:21px;color:#9D99AE;margin-top:3px}
.r{position:absolute;right:0;bottom:30px;font:400 16px 'Space Mono',monospace;letter-spacing:.08em;color:#615D74}
</style></head><body>
<div class="k">VEERACHIT.COM / THOUGHTS</div>
<h1>${escapeHtml(post.title)}</h1>
<div class="by"><img src="${portrait}" alt=""><div><div class="n">${NAME_EN}</div><div class="t">${NAME_TH}</div></div><div class="r">${post.date.toUpperCase()}</div></div>
</body></html>`;
}

function renderOgCards(force) {
  const dir = path.join(root, 'assets/og');
  fs.mkdirSync(dir, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'og-'));
  for (const post of posts) {
    const target = path.join(root, ogPath(post));
    if (!force && fs.existsSync(target)) continue;
    const htmlFile = path.join(tmp, `${post.slug}.html`);
    const pngFile = path.join(tmp, `${post.slug}.png`);
    fs.writeFileSync(htmlFile, ogCard(post));
    execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
      '--window-size=1200,630', '--virtual-time-budget=6000', `--screenshot=${pngFile}`, `file://${htmlFile}`], { stdio: 'ignore' });
    execFileSync('/usr/bin/sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '84', pngFile, '--out', target], { stdio: 'ignore' });
    console.log(`OG card: ${post.slug}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (process.argv.includes('--og')) renderOgCards(process.argv.includes('--force'));

for (const post of posts) {
  const dir = path.join(root, 'thoughts', post.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), articlePage(post));
}
fs.writeFileSync(path.join(root, 'thoughts/index.html'), archivePage());
fs.writeFileSync(path.join(root, '404.html'), notFoundPage());
fs.writeFileSync(path.join(root, 'sitemap.xml'), sitemap());
fs.writeFileSync(path.join(root, 'feed.xml'), feed());
fs.writeFileSync(path.join(root, 'llms.txt'), llms());
updateHomepage();

console.log(`Generated ${posts.length} articles, archive, 404, sitemap, feed, llms.txt, homepage regions.`);
