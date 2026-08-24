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

/* La comprobación de API_KEY vive dentro de main() (no a nivel de
   módulo): así este archivo se puede importar para testear titlePage
   sin que mate el proceso. */

const TMDB = 'https://api.themoviedb.org/3';
const IMG  = 'https://image.tmdb.org/t/p';

/* ---------- utilidades ---------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Guarda el primer fallo real para poder explicarlo al final. Sin esto,
   un 401 y un corte de red se ven idénticos desde fuera. */
let firstError = null;

async function tmdb(path, params = {}, attempt = 0) {
  const qs = new URLSearchParams({ api_key: API_KEY, language: 'en-US', ...params });
  try {
    const res = await fetch(`${TMDB}${path}?${qs}`);
    if (res.status === 429) {                 // rate limit: espera y reintenta
      await sleep(1000 * (attempt + 1));
      return attempt < 4 ? tmdb(path, params, attempt + 1) : null;
    }
    if (!res.ok) {
      if (!firstError) {
        const body = await res.text().catch(() => '');
        firstError = `HTTP ${res.status} en ${path} — ${body.slice(0, 300)}`;
      }
      return null;
    }
    return await res.json();
  } catch (err) {
    if (attempt < 3) { await sleep(500 * (attempt + 1)); return tmdb(path, params, attempt + 1); }
    if (!firstError) firstError = `Fallo de red en ${path} — ${err.message}`;
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
  /* Mismo proveedor y formato que usa la app (getEmbedUrl en script.js):
     así el reproductor funciona igual dentro de la página del título. */
  const embed  = item.type === 'movie'
               ? `https://vidsrc.pm/embed/movie/${item.id}`
               : `https://vidsrc.pm/embed/tv/${item.id}/1/1`;

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
    inLanguage: 'en-US',
    /* La página permite ver el título en el propio dominio: lo marcamos
       para que Google entienda que aquí se puede reproducir. */
    potentialAction: { '@type': 'WatchAction', target: `${url}#player` },
    video: {
      '@type': 'VideoObject',
      name,
      description: item.overview || desc,
      thumbnailUrl: img,
      embedUrl: embed,
      contentUrl: url
    }
  };

  /* Nada de redirección automática: una página que se auto-redirige a
     la home es exactamente lo que Google clasifica como doorway page.
     Esta tiene contenido propio, un reproductor incrustado y un enlace
     explícito al reproductor. */
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
.watch-row{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-bottom:8px}
.play{display:inline-block;background:#E50914;color:#fff;text-decoration:none;font-weight:700;
      padding:14px 30px;border-radius:999px;font-size:16px}
.play:hover{background:#b20710}
.app-link{color:#b0b0b0;font-size:14px}
.player{margin-top:30px}
.player-frame{position:relative;padding-top:56.25%;background:#000;border-radius:10px;overflow:hidden}
.player-frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.note{color:#8a8a8a;font-size:13px;margin-top:10px}
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
      <div class="watch-row">
        <a class="play" href="#player">▶ Watch now</a>
        <a class="app-link" href="${SITE}/?watch=${item.type}-${item.id}">Open in the full app (subtitles &amp; episodes)</a>
      </div>
    </div>
  </article>

  <!-- Reproductor incrustado: se ve en esta misma página, sin salir del dominio -->
  <section class="player" id="player" aria-label="Player for ${esc(name)}">
    <div class="player-frame">
      <iframe src="${embed}" title="Watch ${esc(name)}" loading="lazy"
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen
        referrerpolicy="strict-origin-when-cross-origin"></iframe>
    </div>
    ${item.type === 'tv'
      ? '<p class="note">This page plays Season 1 Episode 1. Use the full app for every season, episode, subtitles and the community panel.</p>'
      : ''}
  </section>

  <a class="back" href="${SITE}/">← Browse the full catalog</a>

  <!-- Espacio reservado para anuncios por título (por poblar en el futuro):
       <div class="ad-slot" data-ad-slot="${item.type}-${item.id}" hidden></div> -->

  <footer>
    POPOROPO does not host any content. All titles are streamed from third-party
    sources. Catalog metadata provided by
    <a href="https://www.themoviedb.org" rel="noopener nofollow">The Movie Database</a>.
  </footer>
</div>
<script>
/* Marca este título como "Recently Watched" en el MISMO localStorage que
   usa la app (mismo origen): al pulsar Watch now o al cargar el
   reproductor. Así la fila de recientes de la app también lo recoge. */
(function () {
  try {
    var TYPE = '${item.type}', ID = ${item.id};
    var TITLE = ${JSON.stringify(item.title)};
    var POSTER = ${JSON.stringify(item.poster)};
    var MAX = 30;
    var key = 'poporopo_watched_v1__guest';
    try {
      var u = JSON.parse(localStorage.getItem('poporopo_user_v1') || 'null');
      if (u && u.sub) key = 'poporopo_watched_v1__' + u.sub;
    } catch (e) {}
    var mark = function () {
      var list = [];
      try { list = JSON.parse(localStorage.getItem(key) || '[]') || []; } catch (e) {}
      list = list.filter(function (w) { return !(String(w.id) === String(ID) && w._type === TYPE); });
      list.unshift({ id: ID, _type: TYPE, title: TITLE, poster_path: POSTER, watchedAt: Date.now() });
      try { localStorage.setItem(key, JSON.stringify(list.slice(0, MAX))); } catch (e) {}
    };
    var btn = document.querySelector('.play');
    var frame = document.querySelector('.player-frame iframe');
    if (btn) btn.addEventListener('click', mark);
    if (frame) frame.addEventListener('load', mark);
  } catch (e) {}
})();
</script>
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
  if (!API_KEY) {
    console.error('Falta TMDB_API_KEY en el entorno.');
    process.exit(1);
  }

  const today = new Date().toISOString().slice(0, 10);

  console.log(`Recolectando hasta ${PAGES_PER_LIST} páginas por listado…`);
  const items = await collect();
  console.log(`  ${items.length} títulos únicos.`);

  if (!items.length) {
    console.error('::warning::TMDB no devolvió ningún título.');
    if (firstError) console.error(`  Causa: ${firstError}`);

    /* La confusión más común: TMDB muestra dos credenciales y la más
       vistosa es el "API Read Access Token" (v4, un JWT largo), que NO
       sirve como api_key= . La buena es la "API Key" de 32 caracteres. */
    if (/^eyJ/.test(API_KEY)) {
      console.error(
        '  Estás usando el API Read Access Token (v4), no la API Key (v3).\n' +
        '  En TMDB → Settings → API copia el campo "API Key", el de 32 caracteres.'
      );
    } else if (!/^[0-9a-f]{32}$/i.test(API_KEY)) {
      console.error(
        `  La clave no tiene la forma de una API Key v3 (32 caracteres hex);\n` +
        `  recibí ${API_KEY.length} caracteres.`
      );
    }

    /* Un tropiezo del sitemap no debe tumbar el despliegue del sitio.
       Escribimos el sitemap mínimo y seguimos. */
    await writeFile(join(OUT, 'sitemap.xml'), sitemap([], today), 'utf8');
    console.error('  Escrito sitemap.xml solo con la home; el sitio se publica igual.');
    return;
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

/* Solo arranca el generador cuando se ejecuta directamente
   (node scripts/generate-sitemap.mjs); al importarlo desde otro
   script (p. ej. para testear titlePage) no hace nada. */
import { pathToFileURL } from 'node:url';

const isEntry = process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntry) {
  main().catch((err) => { console.error(err); process.exit(1); });
}

/* Exportado para poder testear/regenerar páginas sin ejecutar el
   generador completo (scripts que importen esto no disparan main()). */
export { titlePage, sitemap };