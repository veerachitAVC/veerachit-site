import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const source = fs.readFileSync(path.join(root, 'post.html'), 'utf8');
const postsMatch = source.match(/var STATIC_POSTS = (\{[\s\S]*?\n  \});\n\n  function renderStatic/);
const stylesMatch = source.match(/<style>([\s\S]*?)<\/style>/);

if (!postsMatch || !stylesMatch) {
  throw new Error('Could not find STATIC_POSTS or the post stylesheet in post.html');
}

const posts = vm.runInNewContext(`(${postsMatch[1]})`);
const styles = stylesMatch[1];

const postMeta = {
  '400620ab-c1bd-8103-85df-cbd9666aaa4f': ['the-case-for-boring-ai', '2026-10-20'],
  '400620ab-c1bd-81d9-af2e-fed1bfceeedd': ['where-ai-systems-actually-break', '2026-10-14'],
  '400620ab-c1bd-816b-8e87-c0c710f6d6d0': ['label-it-by-hand-first', '2026-10-08'],
  '400620ab-c1bd-814d-be1f-df20ea23ffc1': ['why-leaders-should-go-back-to-class-on-ai', '2026-10-02'],
  '3c6620ab-c1bd-81a5-8557-dbe68b055d7c': ['headcount-is-no-longer-the-unit', '2026-08-12'],
  '3c6620ab-c1bd-81c2-9a01-f9de5eb359ad': ['taste-is-the-last-moat', '2026-07-15'],
  '3c6620ab-c1bd-81e7-8a39-da56c7c227e8': ['i-gave-my-companies-a-memory', '2026-06-18'],
  '369620ab-c1bd-81c1-8a5d-dbd8dc14aed8': ['the-edit-is-the-work', '2026-04-15'],
  '369620ab-c1bd-8127-b593-f38306fbc0f1': ['why-ai-wont-replace-the-brief', '2026-03-20'],
  '369620ab-c1bd-817a-853f-d89b6a247360': ['twenty-years-one-rule', '2026-02-10'],
  '369620ab-c1bd-81d5-883f-fef7e0e826b0': ['claypot-and-code', '2026-01-18'],
  '369620ab-c1bd-813f-991a-fb75a94358ba': ['bangkok-and-hong-kong-are-not-the-same-city', '2025-12-05']
};

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

function descriptionFor(html) {
  const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((match) => plainText(match[1]));
  const text = paragraphs.slice(0, 3).join(' ');
  if (text.length <= 158) return text;
  const clipped = text.slice(0, 158);
  return `${clipped.slice(0, clipped.lastIndexOf(' '))}…`;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function pageTemplate(post, slug, published) {
  const canonical = `https://veerachit.com/thoughts/${slug}/`;
  const description = descriptionFor(post.html);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${canonical}#article`,
    headline: post.title,
    description,
    datePublished: published,
    dateModified: published,
    mainEntityOfPage: canonical,
    image: 'https://veerachit.com/og-image.jpg',
    author: {
      '@type': 'Person',
      '@id': 'https://veerachit.com/#person',
      name: 'Veerachit Jaruthanadech',
      alternateName: 'วีรชิต จารุธนเดช',
      url: 'https://veerachit.com/'
    },
    isPartOf: { '@id': 'https://veerachit.com/#website' },
    keywords: [post.tag, 'Veerachit Jaruthanadech', 'วีรชิต จารุธนเดช']
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(post.title)} — Veerachit Jaruthanadech</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="author" content="Veerachit Jaruthanadech">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Veerachit">
<meta property="og:title" content="${escapeHtml(post.title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="https://veerachit.com/og-image.jpg">
<meta property="article:published_time" content="${published}">
<meta property="article:author" content="Veerachit Jaruthanadech">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(post.title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="https://veerachit.com/og-image.jpg">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%230B0A11'/%3E%3Ctext x='50' y='73' font-family='Arial' font-size='66' font-weight='900' fill='%238B5CF6' text-anchor='middle'%3EV%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&amp;family=Inter:wght@400;500&amp;family=Space+Mono:wght@400;700&amp;display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(schema, null, 2)}</script>
<style>${styles}</style>
</head>
<body id="top">
<div id="scrollBar" aria-hidden="true"></div>
<nav class="nav" id="nav" aria-label="Primary">
  <a href="/" class="brand" aria-label="Veerachit — home"><img src="/veerachit-logo-web.png" alt="Veerachit" class="brand-logo" width="1264" height="228"></a>
  <div class="nav-right">
    <div class="nav-links"><a href="/#about">About</a><a href="/#ventures">Ventures</a><a href="/#photography">Photography</a><a href="/#thoughts">Thoughts</a></div>
    <a href="mailto:hello@veerachit.com" class="nav-cta">Let's talk <span>↗</span></a>
    <button class="burger" id="burger" aria-label="Open menu" aria-expanded="false" aria-controls="mobileMenu"><span></span><span></span><span></span></button>
  </div>
</nav>
<div class="mobile-menu" id="mobileMenu"><a href="/#about"><span>01</span>About</a><a href="/#ventures"><span>02</span>Ventures</a><a href="/#photography"><span>03</span>Photography</a><a href="/#thoughts"><span>04</span>Thoughts</a><a href="mailto:hello@veerachit.com"><span>05</span>Contact</a><p class="mobile-foot">Bangkok, Thailand · UTC+7</p></div>
<main>
  <article class="post-wrap">
    <a href="/#thoughts" class="post-back" aria-label="Back to Thoughts"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Back to Thoughts</a>
    <div class="post-meta"><time datetime="${published}">${post.date}</time><span class="p-tag-chip">${escapeHtml(post.tag)}</span></div>
    <h1 class="post-title">${escapeHtml(post.title)}</h1>
    <div class="post-content">${post.html}</div>
  </article>
</main>
<footer class="footer"><div class="footer-bottom wrap"><p class="mono">© <span id="year"></span> Veerachit — All rights reserved</p><p class="mono"><a href="#top">Back to top ↑</a> · Designed in Bangkok</p></div><div class="footer-wordmark" aria-hidden="true">VEERACHIT</div></footer>
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
}

for (const [id, post] of Object.entries(posts)) {
  const meta = postMeta[id];
  if (!meta) throw new Error(`Missing slug/date mapping for ${id}`);
  const [slug, published] = meta;
  const outputDir = path.join(root, 'thoughts', slug);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'index.html'), pageTemplate(post, slug, published));
}

console.log(`Generated ${Object.keys(posts).length} static article pages.`);
