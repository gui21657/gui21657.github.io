#!/usr/bin/env node
/* ============================================================
   POPOROPO — GENERADOR DE SITEMAP Y PÁGINAS POR TÍTULO

   Corre en GitHub Actions, NO en el navegador. Un sitemap generado
   con JS del lado del cliente no sirve: Googlebot pide /sitemap.xml
   como archivo estático por HTTP y nunca ejecuta ese JS.

   Qué hace:
     1. Baja los títulos más populares y mejor valorados de TMDB.
     2. Escribe una página real por título en /movie/{id}/ y /tv/{id}/
        con su propio <title>, description, Open Graph y JSON-LD.
     3. Escribe sitemap.xml con todas esas URLs.

   El paso 2 es lo que le da sentido al sitemap: sin páginas propias
   por título, Google solo tiene la home que indexar.

   Uso:  TMDB_API_KEY=xxx node scripts/generate-sitemap.mjs
   ============================================================ */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const API_KEY = process.env.TMDB_API_KEY;
const SITE    = (process.env.SITE_URL || 'https://cinepoporopo.com').replace(/\/$/, '');
const OUT     = process.env.OUT_DIR || '.';

/* Páginas de TMDB por listado (20 títulos por página).
   25 páginas x 4 listados x 20 = ~2.000 títulos únicos. Subirlo es
   seguro, pero recuerda que Google rastrea más lento de lo que crees. */
const PAGES_PER_LIST = Number(process.env.PAGES_PER_LIST || 25);
const CONCURRENCY    = 8;

if (!API_KEY) {
  console.error('Falta TMDB_API_KEY en el entorno.');
  process.exit(1);
}

const TMDB = 'https://api.themoviedb.org/3';
const IMG  = 'https://image.tmdb.org/t/p';

/* ---------- utilidades ---------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tmdb(path, params = {}, attempt = 0) {
  const qs = new URLSearchParams({ api_key: API_KEY, language: 'en-US', ...params });
  try {
    const res = await fetch(`${TMDB}${path}?${qs}`);
    if (res.status === 429) {                 // rate limit: espera y reintenta
      await sleep(1000 * (attempt + 1));
      return attempt < 4 ? tmdb(path, params, attempt + 1) : null;
    }
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    if (attempt < 3) { await sleep(500 * (attempt + 1)); return tmdb(path, params, attempt + 1); }
    return null;
  }
}

/* Ejecuta tareas con un límite de paralelismo para no saturar TMDB. */
async function pool(items, limit, worker) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await worker(items[idx], idx);
      }
    })
  );
  return out;
}

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const clip = (s, n) => {
  s = String(s ?? '').replace(/\s+/g, ' ').trim();
  return s.length <= n ? s : s.slice(0, n - 1).replace(/\s\S*$/, '') + '…';
};

/* ---------- recolección ---------- */

async function collect() {
  const lists = [
    { type: 'movie', path: '/movie/popular'   },
    { type: 'movie', path: '/movie/top_rated' },
    { type: 'tv',    path: '/tv/popular'      },
    { type: 'tv',    path: '/tv/top_rated'    }
  ];

  const jobs = [];
  for (const list of lists) {
    for (let p = 1; p <= PAGES_PER_LIST; p++) jobs.push({ ...list, page: p });
  }

  const seen = new Map();   // "type:id" -> item
  const pages = await pool(jobs, CONCURRENCY, (job) =>
    tmdb(job.path, { page: String(job.page) }).then((d) => ({ job, d }))
  );

  for (const { job, d } of pages) {
    for (const r of (d?.results ?? [])) {
      if (!r?.id) continue;
      const key = `${job.type}:${r.id}`;
      if (seen.has(key)) continue;
      const title = r.title || r.name || '';
      if (!title) continue;
      seen.set(key, {
        id: r.id,
        type: job.type,
        title,
        overview: r.overview || '',
        poster: r.poster_path || '',
        backdrop: r.backdrop_path || '',
        date: r.release_date || r.first_air_date || ''
      });
    }
  }
  return [...seen.values()];
}

/* ---------- página por título ---------- */

function titlePage(item) {
  const year   = (item.date || '').slice(0, 4);
  const label  = item.type === 'movie' ? 'Movie' : 'TV Series';
  const name   = item.title + (year ? ` (${year})` : '');
  const url    = `${SITE}/${item.type}/${item.id}/`;
  const img    = item.backdrop ? `${IMG}/w1280${item.backdrop}`
               : item.poster   ? `${IMG}/w780${item.poster}`
               : `${SITE}/og-image.jpg`;
  const poster = item.poster ? `${IMG}/w342${item.poster}` : '';

  const desc = clip(
    item.overview
      ? `Watch ${item.title} free in HD. ${item.overview}`
      : `Watch ${name} free online in HD with English subtitles. No sign-up required.`,
    155
  );

  const schema = {
    '@context': 'https://schema.org',
    '@type': item.type === 'movie' ? 'Movie' : 'TVSeries',
    name: item.title,
    url,
    ...(poster ? { image: poster } : {}),
    ...(item.overview ? { description: item.overview } : {}),
    ...(year ? { datePublished: year } : {}),
    inLanguage: 'en-US'
  };

  /* Nada de redirección automática: una página que se auto-redirige a
     la home es exactamente lo que Google clasifica como doorway page.
     Esta tiene contenido propio y un enlace explícito al reproductor. */
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>Watch ${esc(name)} Free Online in HD — POPOROPO</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${url}">
<meta property="og:type" content="video.${item.type === 'movie' ? 'movie' : 'tv_show'}">
<meta property="og:site_name" content="POPOROPO">
<meta property="og:title" content="Watch ${esc(name)} Free Online in HD">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${esc(img)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Watch ${esc(name)} Free — POPOROPO">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(img)}">
<meta name="theme-color" content="#141414">
<link rel="icon" href="${SITE}/android-chrome-192x192.png" type="image/png">
<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{background:#141414;color:#e5e5e5;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;line-height:1.6}
.wrap{max-width:900px;margin:0 auto;padding:40px 20px 64px}
a{color:inherit}
.brand{display:inline-block;font-size:26px;font-weight:800;letter-spacing:1px;color:#E50914;text-decoration:none;margin-bottom:32px}
.card{display:flex;gap:28px;flex-wrap:wrap}
.card img{width:220px;border-radius:8px;background:#1f1f1f;flex-shrink:0}
.info{flex:1 1 300px;min-width:0}
h1{font-size:30px;line-height:1.25;margin-bottom:10px}
.meta{color:#b0b0b0;font-size:14px;margin-bottom:18px}
.overview{margin-bottom:26px}
.play{display:inline-block;background:#E50914;color:#fff;text-decoration:none;font-weight:700;
      padding:14px 30px;border-radius:999px;font-size:16px}
.play:hover{background:#b20710}
.back{display:inline-block;margin-top:22px;color:#b0b0b0;font-size:14px}
footer{margin-top:56px;padding-top:22px;border-top:1px solid rgba(255,255,255,.1);color:#8a8a8a;font-size:12.5px}
@media(max-width:600px){.card img{width:150px}h1{font-size:23px}}
</style>
</head>
<body>
<div class="wrap">
  <a class="brand" href="${SITE}/">POPOROPO</a>
  <article class="card">
    ${poster ? `<img src="${esc(poster)}" width="342" alt="${esc(item.title)} poster" loading="lazy">` : ''}
    <div class="info">
      <h1>Watch ${esc(name)} Free Online</h1>
      <p class="meta">${esc(label)}${year ? ` · ${esc(year)}` : ''} · HD · English subtitles · No sign-up</p>
      ${item.overview ? `<p class="overview">${esc(item.overview)}</p>` : ''}
      <a class="play" href="${SITE}/?watch=${item.type}-${item.id}">▶ Watch now</a>
      <a class="back" href="${SITE}/">← Browse the full catalog</a>
    </div>
  </article>
  <footer>
    POPOROPO does not host any content. All titles are streamed from third-party
    sources. Catalog metadata provided by
    <a href="https://www.themoviedb.org" rel="noopener nofollow">The Movie Database</a>.
  </footer>
</div>
</body>
</html>
`;
}

/* ---------- sitemap ---------- */

function sitemap(items, today) {
  const urls = [
    `  <url>
    <loc>${SITE}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`
  ];

  for (const it of items) {
    urls.push(`  <url>
    <loc>${SITE}/${it.type}/${it.id}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;
}

/* ---------- main ---------- */

async function main() {
  const today = new Date().toISOString().slice(0, 10);

  console.log(`Recolectando hasta ${PAGES_PER_LIST} páginas por listado…`);
  const items = await collect();
  console.log(`  ${items.length} títulos únicos.`);

  if (!items.length) {
    console.error('TMDB no devolvió nada. ¿La API key es válida?');
    process.exit(1);
  }

  /* Un sitemap admite 50.000 URLs. Avisamos antes de pasarnos. */
  if (items.length + 1 > 50000) {
    console.error('Más de 50.000 URLs: hay que dividir el sitemap en varios archivos.');
    process.exit(1);
  }

  console.log('Escribiendo páginas por título…');
  let written = 0;
  await pool(items, 24, async (item) => {
    const file = join(OUT, item.type, String(item.id), 'index.html');
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, titlePage(item), 'utf8');
    written++;
  });
  console.log(`  ${written} páginas.`);

  await writeFile(join(OUT, 'sitemap.xml'), sitemap(items, today), 'utf8');
  console.log(`sitemap.xml con ${items.length + 1} URLs.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
