#!/usr/bin/env node
/* ============================================================
   POPOROPO — GENERADOR DE SITEMAP

   Corre en GitHub Actions, NO en el navegador. Un sitemap generado
   con JS del lado del cliente no sirve: Googlebot pide /sitemap.xml
   como archivo estático por HTTP y nunca ejecuta ese JS.

   Qué hace:
     1. Baja los títulos más populares y mejor valorados de TMDB.
     2. Escribe sitemap.xml con la home y un deep link por título
        (https://cinepoporopo.com/?watch=movie-550). No existe página
        estática por título: al abrir ese enlace la app carga el título
        con reproductor, episodios, subtítulos y panel de comentarios.

   El refresco diario del sitemap es lo que hace que los estrenos
   aparezcan sin tocar el repo.

   Uso:  TMDB_API_KEY=xxx node scripts/generate-sitemap.mjs
   ============================================================ */

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const API_KEY = process.env.TMDB_API_KEY;
const SITE    = (process.env.SITE_URL || 'https://cinepoporopo.com').replace(/\/$/, '');
const OUT     = process.env.OUT_DIR || '.';

/* Páginas de TMDB por listado (20 títulos por página).
   25 páginas x 4 listados x 20 = ~2.000 títulos únicos. Subirlo es
   seguro, pero recuerda que Google rastrea más lento de lo que crees. */
const PAGES_PER_LIST = Number(process.env.PAGES_PER_LIST || 25);
const CONCURRENCY    = 8;

/* La comprobación de API_KEY vive dentro de main() (no a nivel de
   módulo): así este archivo se puede importar para testear el sitemap
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

  /* Cada título apunta a la app con el deep link ?watch=: no hay página
     estática por título — la app ES la página (reproductor, episodios,
     subtítulos y panel de likes/comentarios al abrir ese enlace). */
  for (const it of items) {
    urls.push(`  <url>
    <loc>${SITE}/?watch=${it.type}-${it.id}</loc>
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

  await writeFile(join(OUT, 'sitemap.xml'), sitemap(items, today), 'utf8');
  console.log(`sitemap.xml con ${items.length + 1} URLs.`);
}

/* Solo arranca el generador cuando se ejecuta directamente
   (node scripts/generate-sitemap.mjs); al importarlo desde otro
   script (p. ej. para testear sitemap) no hace nada. */
import { pathToFileURL } from 'node:url';

const isEntry = process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntry) {
  main().catch((err) => { console.error(err); process.exit(1); });
}

/* Exportado para poder testear el sitemap sin ejecutar el generador
   completo (scripts que importen esto no disparan main()). */
export { sitemap };