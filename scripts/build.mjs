/* ============================================================
   POPOROPO — BUILD (esbuild)
   Transpila script.js y social.js a ES5 compatible con Smart TV
   antiguas (LG webOS 4 = Chromium 53, Samsung Tizen 3) y minifica
   todo (JS + CSS) para que pese menos y cargue mas rapido.

   Uso:  node scripts/build.mjs   (desde la raiz del repo)
   ============================================================ */

import { build } from 'esbuild';

const TARGET = ['chrome53']; // webOS 4 = Chromium 53; cubre Tizen 3+ y Android TV 8+

async function main() {
  await build({
    entryPoints: ['script.js', 'social.js'],
    outdir: '.',
    allowOverwrite: true,
    minify: true,
    target: TARGET,
    charset: 'utf8'
  });

  await build({
    entryPoints: ['style.css'],
    outfile: 'style.css',
    allowOverwrite: true,
    minify: true
  });

  console.log('Build OK: script.js, social.js y style.css transpilados (chrome53) y minificados.');
}

main().catch((err) => { console.error(err); process.exit(1); });
