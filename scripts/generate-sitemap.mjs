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

/* Config que se inyecta en cada página de título para el panel social
   (likes y comentarios). En CI vienen de los secrets del workflow; en
   local quedan los placeholders y el panel se apaga solo (social.js
   detecta las claves que empiezan por "__" y se deshabilita). */
const SOCIAL_GOOGLE_CLIENT_ID    = process.env.GOOGLE_CLIENT_ID    || '__GOOGLE_CLIENT_ID__';
const SOCIAL_FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || '__FIREBASE_PROJECT_ID__';
const SOCIAL_FIREBASE_API_KEY    = process.env.FIREBASE_API_KEY    || '__FIREBASE_API_KEY__';

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
<link rel="stylesheet" href="${SITE}/style.css">
<style>
/* Página por título con interfaz tipo YouTube: reproductor arriba,
   título + acciones, descripción del video y debajo los comentarios.
   La hoja de la app (style.css) ya se carga arriba y estila el panel
   social (likes/comentarios) igual que en el modal de la app. */
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{background:#141414;color:#e5e5e5;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;line-height:1.6}
.wrap{max-width:1024px;margin:0 auto;padding:24px 20px 64px}
a{color:inherit}
.brand{display:inline-block;font-size:26px;font-weight:800;letter-spacing:1px;color:#E50914;text-decoration:none;margin-bottom:22px}
.player{margin:0 0 18px}
.player-frame{position:relative;padding-top:56.25%;background:#000;border-radius:12px;overflow:hidden;box-shadow:0 10px 34px rgba(0,0,0,.55)}
.player-frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.note{color:#8a8a8a;font-size:13px;margin-top:10px}
.title-row h1{font-size:30px;line-height:1.25;color:#fff}
.meta{color:#b0b0b0;font-size:14px;margin-top:6px}
.actions{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:16px 0 24px}
.tplay{display:inline-flex;align-items:center;gap:8px;background:#E50914;color:#fff;text-decoration:none;font-weight:700;
       padding:12px 26px;border-radius:999px;font-size:15px}
.tplay:hover{background:#b20710}
.tapp-link{display:inline-flex;align-items:center;gap:8px;color:#e5e5e5;text-decoration:none;font-weight:600;
           padding:12px 22px;border-radius:999px;font-size:14px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18)}
.tapp-link:hover{background:rgba(255,255,255,.18)}
/* Descripción del video, al estilo de YouTube (plegable) */
.desc{border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:14px 16px;margin-bottom:26px;
      background:rgba(255,255,255,.03)}
.desc summary{cursor:pointer;font-weight:700;font-size:15px;color:#fff;list-style:none;display:flex;align-items:center;gap:8px}
.desc summary::-webkit-details-marker{display:none}
.desc summary::after{content:'▾';font-size:13px;color:#8a8a8a;transition:transform .2s}
.desc[open] summary::after{transform:rotate(180deg)}
.desc p{margin-top:10px;color:#c9c9c9;white-space:pre-wrap;font-size:14.5px}
/* El panel social se monta aquí (estilos en style.css de la app) */
#socialMount{margin:6px 0 26px}
.back{display:inline-block;margin-top:8px;color:#b0b0b0;font-size:14px}
footer{margin-top:48px;padding-top:22px;border-top:1px solid rgba(255,255,255,.1);color:#8a8a8a;font-size:12.5px}
#pp-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(16px);background:#E50914;color:#fff;
          padding:10px 20px;border-radius:999px;font-size:14px;font-weight:600;opacity:0;pointer-events:none;
          transition:opacity .25s,transform .25s;z-index:99;max-width:90vw}
#pp-toast.is-visible{opacity:1;transform:translateX(-50%) translateY(0)}
@media(max-width:600px){.wrap{padding:16px 14px 48px}.title-row h1{font-size:22px}}
</style>
</head>
<body>
<div class="wrap">
  <a class="brand" href="${SITE}/">POPOROPO</a>

  <!-- Reproductor incrustado: se ve en esta misma página, sin salir del dominio -->
  <section class="player" id="player" aria-label="Player for ${esc(name)}">
    <div class="player-frame">
      <iframe src="${embed}" title="Watch ${esc(name)}" loading="lazy"
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen
        referrerpolicy="strict-origin-when-cross-origin"></iframe>
    </div>
    ${item.type === 'tv'
      ? '<p class="note">Playing Season 1 Episode 1. Use the full app to pick any season and episode and to change the subtitle language.</p>'
      : ''}
  </section>

  <!-- Título y acciones, como en YouTube -->
  <header class="title-row">
    <h1>${esc(item.title)}</h1>
    <p class="meta">${esc(label)}${year ? ` · ${esc(year)}` : ''} · HD · English subtitles · Free</p>
    <div class="actions">
      <a class="tplay" href="#player">▶&nbsp; Watch now</a>
      <a class="tapp-link" href="${SITE}/?watch=${item.type}-${item.id}">Open in the full app — every episode &amp; subtitles</a>
    </div>
  </header>

  <!-- Descripción del video (plegable, como la de YouTube) -->
  <details class="desc" open>
    <summary>Description</summary>
    <p>${esc(item.overview || `Watch ${item.title} free online in HD with English subtitles. No sign-up required.`)}</p>
  </details>

  <!-- Panel social: me gusta + comentarios (lo monta social.js, misma
       base de datos y login que el modal de la app) -->
  <section id="socialMount" aria-label="Likes and comments for ${esc(item.title)}"></section>

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
/* Config inyectada en el build (secrets): habilita el panel social
   (likes/comentarios) de esta página. En local quedan los placeholders
   y social.js se apaga solo. */
window.POPOROPO_CONFIG = {
  TMDB_API_KEY: '',
  GOOGLE_CLIENT_ID: '${SOCIAL_GOOGLE_CLIENT_ID}',
  FIREBASE_PROJECT_ID: '${SOCIAL_FIREBASE_PROJECT_ID}',
  FIREBASE_API_KEY: '${SOCIAL_FIREBASE_API_KEY}'
};
</script>
<script src="${SITE}/social.js"></script>
<script>
/* Puente de login de Google para esta página estática. social.js pide
   estos ganchos cuando hace falta iniciar sesión para dar like o
   comentar; aquí se replican con el MISMO almacenamiento que usa la app
   (poporopo_user_v1), así la sesión es compartida en todo el dominio. */
(function () {
  'use strict';
  var CFG = window.POPOROPO_CONFIG || {};

  window.PoporopoAppUser = function () {
    try { return JSON.parse(localStorage.getItem('poporopo_user_v1') || 'null'); } catch (e) { return null; }
  };

  window.PoporopoToast = function (msg) {
    try {
      var t = document.getElementById('pp-toast');
      if (!t) {
        t = document.createElement('div');
        t.id = 'pp-toast';
        t.setAttribute('role', 'status');
        document.body.appendChild(t);
      }
      t.textContent = msg;
      t.classList.add('is-visible');
      clearTimeout(t._t);
      t._t = setTimeout(function () { t.classList.remove('is-visible'); }, 2400);
    } catch (e) {}
  };

  function parseJwt(token) {
    try {
      var part = token.split('.')[1];
      var base64 = part.replace(/-/g, '+').replace(/_/g, '/');
      var json = decodeURIComponent(atob(base64).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(json);
    } catch (e) { return null; }
  }

  /* Igual que en la app: al entrar, el historial de invitado ("Recently
     Watched") viaja a la cuenta del usuario. */
  function migrateGuestWatch(user) {
    try {
      var userKey = 'poporopo_watched_v1__' + user.sub;
      if (!localStorage.getItem(userKey)) {
        var g = localStorage.getItem('poporopo_watched_v1__guest');
        if (g) { localStorage.setItem(userKey, g); localStorage.removeItem('poporopo_watched_v1__guest'); }
      }
    } catch (e) {}
  }

  function handleCredential(response) {
    if (!response || !response.credential) return;
    var payload = parseJwt(response.credential);
    if (!payload || !payload.sub) {
      window.PoporopoToast("Couldn't read your account");
      return;
    }
    var user = {
      sub: payload.sub,
      name: payload.name || '',
      given_name: payload.given_name || '',
      email: payload.email || '',
      picture: payload.picture || ''
    };
    migrateGuestWatch(user);
    try { localStorage.setItem('poporopo_user_v1', JSON.stringify(user)); } catch (e) {}
    if (window.PoporopoSocial && window.PoporopoSocial.enabled) {
      window.PoporopoSocial.signIn(response.credential);
    }
    window.PoporopoToast('Welcome, ' + (user.given_name || user.name || 'friend'));
  }

  window.PoporopoRequestSignIn = function () {
    if (window.google && google.accounts && google.accounts.id) {
      try { google.accounts.id.prompt(); } catch (e) {}
    }
  };

  var gsiPromise = null;
  function loadGsi() {
    if (window.google && google.accounts && google.accounts.id) return Promise.resolve(true);
    if (gsiPromise) return gsiPromise;
    gsiPromise = new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = function () { resolve(true); };
      s.onerror = function () { gsiPromise = null; resolve(false); };
      document.head.appendChild(s);
      setTimeout(function () { resolve(true); }, 6000);
    });
    return gsiPromise;
  }

  window.PoporopoRenderSignInButton = function (container, attempts) {
    attempts = attempts || 0;
    if (!container) return false;
    if (!CFG.GOOGLE_CLIENT_ID || CFG.GOOGLE_CLIENT_ID.indexOf('__') === 0) return false;
    if (!(window.google && google.accounts && google.accounts.id)) {
      loadGsi().then(function (ok) {
        if (ok) window.PoporopoRenderSignInButton(container, attempts);
        else if (attempts < 25) setTimeout(function () {
          window.PoporopoRenderSignInButton(container, attempts + 1);
        }, 250);
      });
      return false;
    }
    try {
      google.accounts.id.initialize({
        client_id: CFG.GOOGLE_CLIENT_ID,
        callback: handleCredential,
        auto_select: false,
        cancel_on_tap_outside: true
      });
      container.innerHTML = '';
      google.accounts.id.renderButton(container, {
        type: 'standard', theme: 'filled_black',
        size: 'medium', text: 'signin_with', shape: 'pill'
      });
      return true;
    } catch (e) { return false; }
  };
})();
</script>
<script>
/* Marca este título como "Recently Watched" en el MISMO localStorage que
   usa la app (mismo origen): al pulsar Watch now o al cargar el
   reproductor. Así la fila de recientes de la app también lo recoge.
   Además monta el panel de likes y comentarios en esta página. */
(function () {
  var TYPE = '${item.type}', ID = ${item.id};
  var TITLE = ${JSON.stringify(item.title)};
  var POSTER = ${JSON.stringify(item.poster)};
  var MAX = 30;
  try {
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
    var btn = document.querySelector('.tplay');
    var frame = document.querySelector('.player-frame iframe');
    if (btn) btn.addEventListener('click', mark);
    if (frame) frame.addEventListener('load', mark);
  } catch (e) {}

  /* Panel social: mismos likes/comentarios que el modal de la app.
     Las series se etiquetan por episodio (S1E1 en esta página), igual
     que en la app, para compartir la misma conversación. */
  try {
    if (window.PoporopoSocial && window.PoporopoSocial.enabled) {
      var host = document.getElementById('socialMount');
      if (host) {
        window.PoporopoSocial.mount(host);
        window.PoporopoSocial.setContent(
          TYPE === 'tv' ? 'tv_' + ID + '_s1_e1' : 'movie_' + ID,
          TITLE
        );
      }
    }
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