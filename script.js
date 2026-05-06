/* ============================================================
   POPOROPO — SCRIPT.JS  (TMDB + vidsrc edition)
   Sections:
     A. AdBlocker (IIFE)
     B. TMDB client
     C. Embed server (vidsrc) + availability cache
     D. Lógica principal
   ============================================================ */


/* ============================================================
   A. ADBLOCKER (IIFE)
   ============================================================ */
(function () {
  'use strict';

  const ALLOWED_DOMAINS = [
    'cinepoporopo.com',
    'themoviedb.org',
    'image.tmdb.org',
    'vidsrc.xyz', 'vidsrc.to', 'vidsrc.me', 'vidsrc.in', 'vidsrc.pm',
    'cloudnestra.com',
    // legacy:
    'mega.nz', 'drive.google.com', 'docs.google.com',
  ];

  const AD_DOMAINS = [
    'doubleclick.net','googlesyndication.com','adnxs.com','popads.net',
    'popcash.net','exoclick.com','trafficjunky.net','adsterra.com',
    'propellerads.com','hilltopads.net','trafficstars.com','clickadu.com',
    'yllix.com','pushground.com','evadav.com','richpush.co','mgid.com',
    'taboola.com','outbrain.com','revcontent.com','adcash.com','juicyads.com',
    'plugrush.com','bidvertiser.com','zeropark.com','adskeeper.com',
    'shorte.st','adf.ly','linkvertise.com','ouo.io'
  ];

  function isAd(src) {
    return src && AD_DOMAINS.some(d => src.includes(d));
  }

  // window.open bloqueado
  window.open = function () {
    console.warn('[AdBlock] window.open bloqueado');
    return { closed: true, close() {}, focus() {}, document: { write() {}, close() {} } };
  };

  try {
    window.location.replace = function () { console.warn('[AdBlock] location.replace bloqueado'); };
    window.location.assign  = function () { console.warn('[AdBlock] location.assign bloqueado'); };
  } catch (e) {}

  try {
    Object.defineProperty(window, 'top',    { get: () => window });
    Object.defineProperty(window, 'parent', { get: () => window });
  } catch (e) {}

  const _st = window.setTimeout;
  const _si = window.setInterval;
  window.setTimeout = function (fn, d, ...a) {
    if (typeof fn === 'string' && /location|open|href|redirect/i.test(fn)) return 0;
    return _st.call(window, fn, d, ...a);
  };
  window.setInterval = function (fn, d, ...a) {
    if (typeof fn === 'string' && /location|open|href|redirect/i.test(fn)) return 0;
    return _si.call(window, fn, d, ...a);
  };

  const _ac = Element.prototype.appendChild;
  Element.prototype.appendChild = function (node) {
    if (node && node.nodeType === 1 && isAd(node.src || node.href || '')) {
      console.warn('[AdBlock] Elemento bloqueado:', node.src || node.href);
      return node;
    }
    return _ac.call(this, node);
  };

  const _ib = Element.prototype.insertBefore;
  Element.prototype.insertBefore = function (node, ref) {
    if (node && node.nodeType === 1 && isAd(node.src || node.href || '')) {
      console.warn('[AdBlock] Elemento bloqueado (insertBefore):', node.src);
      return node;
    }
    return _ib.call(this, node, ref);
  };

  document.addEventListener('click', function (e) {
    const a = e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (!href) return;
    if (href.startsWith('#') || href.startsWith('/') || !href.includes('://')) return;
    const ok = href.startsWith(window.location.origin) ||
               ALLOWED_DOMAINS.some(d => href.includes(d));
    if (!ok) {
      e.preventDefault();
      e.stopImmediatePropagation();
      console.warn('[AdBlock] Link bloqueado:', href);
    }
  }, true);

  const SAFE_IDS = new Set([
    'videoModal','infoModal','searchEmpty','mainHeader','mainBanner',
    'adClickBlocker','playerSpinner','toast','searchClear','catalog',
    'searchResults','searchGrid','infoBackdrop','bannerContent'
  ]);
  const SAFE_CLASSES = new Set([
    'modal','search-empty','header','banner','movie',
    'carousel-section','content-area','player-wrapper',
    'info-modal','toast','blocker-strip','carousel-loader',
    'movie-skeleton','search-results-area','search-grid',
    'info-body','info-backdrop','banner-content',
    'banner-overlay','banner-fade-bottom','carousel-wrapper',
    'movies','scroll-btn','section-header','section-title',
    'overlay-content','movie-overlay','overlay-title','overlay-meta',
    'overlay-play','badge','badge-hd','badge-sm','movie-info-btn'
  ]);

  const observer = new MutationObserver(mutations => {
    for (const { addedNodes } of mutations) {
      for (const node of addedNodes) {
        if (node.nodeType !== 1) continue;
        if (SAFE_IDS.has(node.id)) continue;
        if ([...node.classList].some(c => SAFE_CLASSES.has(c))) continue;

        const src = node.src || node.href || node.innerHTML || '';
        const isAdNode = isAd(src) ||
          /^(ad|pop|overlay|sponsor|promo|banner)/i.test(node.id || '') ||
          /\b(ad|popup|popunder|sponsor)\b/i.test([...node.classList].join(' '));

        const computed = window.getComputedStyle(node);
        const isFloating = (computed.position === 'fixed' || computed.position === 'absolute')
                         && parseInt(computed.zIndex) > 999
                         && !SAFE_IDS.has(node.id);

        if (isAdNode || isFloating) {
          node.remove();
          console.warn('[AdBlock] Nodo eliminado:', node.tagName, node.id);
        }
      }
    }
  });

  const startObserver = () => {
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }

  console.log('[AdBlock] Poporopo AdBlock v4.1 ACTIVO ✓');
})();


/* ============================================================
   B. TMDB CLIENT
   ============================================================ */
const TMDB_KEY  = '5f41e16316f1452122fe4d2c1234b068';
const TMDB_API  = 'https://api.themoviedb.org/3';
const TMDB_IMG  = 'https://image.tmdb.org/t/p';
const LANG      = 'es-ES';
const REGION    = 'GT'; // Guatemala

// 15 géneros
const GENRES = [
  { id: 28,    name: 'Acción' },
  { id: 12,    name: 'Aventura' },
  { id: 16,    name: 'Animación' },
  { id: 35,    name: 'Comedia' },
  { id: 80,    name: 'Crimen' },
  { id: 18,    name: 'Drama' },
  { id: 10751, name: 'Familia' },
  { id: 14,    name: 'Fantasía' },
  { id: 27,    name: 'Terror' },
  { id: 9648,  name: 'Misterio' },
  { id: 10749, name: 'Romance' },
  { id: 878,   name: 'Ciencia Ficción' },
  { id: 53,    name: 'Suspense' },
  { id: 10752, name: 'Bélica' },
  { id: 36,    name: 'Historia' },
];

async function tmdb(path, params = {}) {
  const url = new URL(TMDB_API + path);
  url.searchParams.set('api_key', TMDB_KEY);
  url.searchParams.set('language', LANG);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('TMDB ' + res.status);
  return res.json();
}

const posterUrl   = (p, size = 'w342')     => p ? `${TMDB_IMG}/${size}${p}` : '';
const backdropUrl = (p, size = 'original') => p ? `${TMDB_IMG}/${size}${p}` : '';

const PLACEHOLDER_POSTER =
  'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 240">
      <rect width="160" height="240" fill="#222"/>
      <text x="50%" y="50%" font-family="sans-serif" font-size="14" fill="#666"
        text-anchor="middle" dominant-baseline="middle">Sin póster</text>
    </svg>`
  );


/* ============================================================
   C. EMBED SERVER  (solo vidsrc — subtítulos en español + autoplay)
   ============================================================ */
const VIDSRC_URL = (id) =>
  `https://vidsrc.xyz/embed/movie?tmdb=${id}&ds_lang=es&autoplay=1`;

// Tiempo que esperamos a recibir señal del reproductor antes de marcar
// la película como no disponible.
const AVAILABILITY_TIMEOUT = 15000; // 15 segundos

/* ── Cache de películas no disponibles (localStorage, TTL 7 días) ── */
const BAD_CACHE_KEY = 'poporopo_unavailable_movies';
const BAD_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

function loadBadCache() {
  try {
    const raw = localStorage.getItem(BAD_CACHE_KEY);
    if (!raw) return new Set();
    const obj = JSON.parse(raw);
    const now = Date.now();
    const valid = new Set();
    const cleaned = {};
    for (const [id, ts] of Object.entries(obj)) {
      if (now - ts < BAD_CACHE_TTL) {
        valid.add(Number(id));
        cleaned[id] = ts;
      }
    }
    localStorage.setItem(BAD_CACHE_KEY, JSON.stringify(cleaned));
    return valid;
  } catch (e) { return new Set(); }
}

function markBadId(id) {
  try {
    const raw = localStorage.getItem(BAD_CACHE_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    obj[id] = Date.now();
    localStorage.setItem(BAD_CACHE_KEY, JSON.stringify(obj));
  } catch (e) {}
}

const badMovies = loadBadCache();


/* ============================================================
   D. LÓGICA PRINCIPAL
   ============================================================ */
document.addEventListener('DOMContentLoaded', function () {

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g,
      m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  /* ── Header scroll ── */
  const header = $('#mainHeader');
  const handleScroll = () => header.classList.toggle('scrolled', window.scrollY > 20);
  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  /* ── Toast ── */
  const toastEl = $('#toast');
  let toastTimer;
  function showToast(msg, ms = 2200) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.hidden = false;
    requestAnimationFrame(() => toastEl.classList.add('is-visible'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('is-visible');
      setTimeout(() => { toastEl.hidden = true; }, 250);
    }, ms);
  }

  /* ────────────────────────────────────────────────
     MODALES (video + info) — focus trap + ARIA
     ──────────────────────────────────────────────── */
  const videoModal   = $('#videoModal');
  const videoPlayer  = $('#videoPlayer');
  const closeVideo   = $('#closeModal');
  const videoBack    = videoModal.querySelector('.modal-backdrop');
  const playerSpin   = $('#playerSpinner');
  const adBlocker    = $('#adClickBlocker');

  const infoModal       = $('#infoModal');
  const closeInfoBtn    = $('#closeInfoModal');
  const infoBack        = infoModal.querySelector('.modal-backdrop');
  const infoBackdropEl  = $('#infoBackdrop');
  const infoTitleEl     = $('#infoModalTitle');
  const infoYearEl      = infoModal.querySelector('.info-year');
  const infoDurationEl  = infoModal.querySelector('.info-duration');
  const infoGenreEl     = infoModal.querySelector('.info-genre');
  const infoRatingEl    = infoModal.querySelector('.info-rating');
  const infoDescEl      = infoModal.querySelector('.info-desc');
  const infoPlayBtn     = $('#infoPlayBtn');

  let currentMovieId = null;
  const modalStack = [];

  function getFocusable(container) {
    return [...container.querySelectorAll(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input, select, textarea, iframe'
    )].filter(el => !el.hasAttribute('hidden') && el.offsetParent !== null);
  }

  function trapTab(modalEl, e) {
    if (e.key !== 'Tab') return;
    const f = getFocusable(modalEl);
    if (!f.length) { e.preventDefault(); return; }
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  }

  function openModal(modalEl, opener) {
    modalEl.classList.add('active');
    modalEl.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    modalStack.push({ el: modalEl, opener: opener || document.activeElement });
    const f = getFocusable(modalEl);
    if (f.length) f[0].focus();
  }

  function closeModalEl(modalEl) {
    modalEl.classList.remove('active');
    modalEl.setAttribute('aria-hidden', 'true');
    const idx = modalStack.findIndex(m => m.el === modalEl);
    let opener = null;
    if (idx >= 0) {
      opener = modalStack[idx].opener;
      modalStack.splice(idx, 1);
    }
    if (modalStack.length === 0) document.body.style.overflow = '';
    if (opener && typeof opener.focus === 'function') { try { opener.focus(); } catch (e) {} }
  }

  // ── Detección de disponibilidad vía postMessage ──
  let availabilityTimer = null;
  let availabilityListener = null;
  let availabilitySignal = false;

  function startAvailabilityCheck(tmdbId) {
    stopAvailabilityCheck();
    availabilitySignal = false;

    availabilityListener = (e) => {
      const data = e.data;
      if (data == null) return;
      const origin = e.origin || '';
      const fromPlayer = /vidsrc|cloudnestra|filemoon|streamwish|vidcloud|hlswish/i.test(origin);
      const looksLikePlayer = fromPlayer ||
        (typeof data === 'string' && /play|pause|time|ready|init|loaded|duration/i.test(data)) ||
        (typeof data === 'object' && (data.event || data.type || data.player || data.method));
      if (looksLikePlayer) {
        availabilitySignal = true;
        stopAvailabilityCheck();
      }
    };
    window.addEventListener('message', availabilityListener);

    availabilityTimer = setTimeout(() => {
      if (!availabilitySignal && currentMovieId === tmdbId) {
        handleUnavailable(tmdbId);
      }
    }, AVAILABILITY_TIMEOUT);
  }

  function stopAvailabilityCheck() {
    if (availabilityTimer) { clearTimeout(availabilityTimer); availabilityTimer = null; }
    if (availabilityListener) {
      window.removeEventListener('message', availabilityListener);
      availabilityListener = null;
    }
  }

  function handleUnavailable(tmdbId) {
    badMovies.add(tmdbId);
    markBadId(tmdbId);
    // Quitar todas las cards de esta película del DOM (puede estar en varios géneros)
    document.querySelectorAll(`.movie[data-tmdb-id="${tmdbId}"]`).forEach(c => c.remove());
    closeVideoModal();
    showToast('Esta película no está disponible y será ocultada.', 3500);
  }

  // ── Video modal ──
  function openVideoModal(tmdbId, opener) {
    if (badMovies.has(tmdbId)) {
      showToast('Esta película no está disponible.');
      return;
    }
    currentMovieId = tmdbId;

    if (playerSpin) playerSpin.classList.remove('is-hidden');
    videoPlayer.src = '';
    requestAnimationFrame(() => {
      videoPlayer.src = VIDSRC_URL(tmdbId);
    });

    if (adBlocker) adBlocker.classList.add('is-active');
    openModal(videoModal, opener);
    startAvailabilityCheck(tmdbId);
  }

  function closeVideoModal() {
    stopAvailabilityCheck();
    videoPlayer.src = '';
    if (adBlocker) adBlocker.classList.remove('is-active');
    if (playerSpin) playerSpin.classList.remove('is-hidden');
    currentMovieId = null;
    closeModalEl(videoModal);
  }

  videoPlayer.addEventListener('load', () => {
    if (videoPlayer.src && playerSpin) playerSpin.classList.add('is-hidden');
  });

  closeVideo.addEventListener('click', closeVideoModal);
  videoBack.addEventListener('click', closeVideoModal);

  // ── Info modal ──
  async function openInfoModal(tmdbId, opener) {
    infoTitleEl.textContent = 'Cargando…';
    infoYearEl.textContent = '';
    infoDurationEl.textContent = '';
    infoGenreEl.textContent = '';
    infoRatingEl.textContent = '';
    infoDescEl.textContent = '';
    infoBackdropEl.style.backgroundImage = '';
    infoPlayBtn.dataset.tmdbId = tmdbId;

    openModal(infoModal, opener);

    try {
      const data = await tmdb(`/movie/${tmdbId}`);
      infoTitleEl.textContent = data.title || data.original_title || '';
      const year = (data.release_date || '').slice(0, 4);
      infoYearEl.textContent = year ? `· ${year}` : '';
      const h = Math.floor((data.runtime || 0) / 60);
      const m = (data.runtime || 0) % 60;
      infoDurationEl.textContent = data.runtime ? `· ${h}h ${m}m` : '';
      infoGenreEl.textContent = data.genres?.length ? `· ${data.genres.map(g => g.name).join(', ')}` : '';
      infoRatingEl.textContent = data.vote_average ? `· ★ ${data.vote_average.toFixed(1)}` : '';
      infoDescEl.textContent = data.overview || 'Sin descripción disponible.';
      if (data.backdrop_path) {
        infoBackdropEl.style.backgroundImage = `url('${backdropUrl(data.backdrop_path, 'w780')}')`;
      }
    } catch (err) {
      console.error('Info error:', err);
      infoDescEl.textContent = 'No se pudo cargar la información.';
    }
  }

  function closeInfoModal() { closeModalEl(infoModal); }

  closeInfoBtn.addEventListener('click', closeInfoModal);
  infoBack.addEventListener('click', closeInfoModal);

  infoPlayBtn.addEventListener('click', () => {
    const id = infoPlayBtn.dataset.tmdbId;
    if (!id) { showToast('Próximamente'); return; }
    const opener = modalStack[modalStack.length - 1]?.opener;
    closeInfoModal();
    openVideoModal(id, opener);
  });

  // Keydown global
  document.addEventListener('keydown', (e) => {
    if (modalStack.length && e.key === 'Tab') {
      trapTab(modalStack[modalStack.length - 1].el, e);
      return;
    }
    if (e.key === 'Escape') {
      if (modalStack.length) {
        const top = modalStack[modalStack.length - 1].el;
        if (top === videoModal) closeVideoModal();
        else closeModalEl(top);
      } else if (searchBar && searchBar.value) {
        clearSearch();
      }
    }
  });

  /* ────────────────────────────────────────────────
     CARDS
     ──────────────────────────────────────────────── */
  function createCard(movie) {
    const title = movie.title || movie.original_title || '';
    const year = (movie.release_date || '').slice(0, 4);

    const card = document.createElement('div');
    card.className = 'movie';
    card.setAttribute('role', 'button');
    card.tabIndex = 0;
    card.dataset.tmdbId = movie.id;
    card.dataset.title = title;
    card.setAttribute('aria-label', `Reproducir ${title}`);

    const img = document.createElement('img');
    img.alt = `Póster de ${title}`;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.width = 160; img.height = 240;
    img.src = posterUrl(movie.poster_path) || PLACEHOLDER_POSTER;
    img.onerror = () => { img.src = PLACEHOLDER_POSTER; };
    card.appendChild(img);

    // Botón de información (esquina superior derecha)
    const infoBtn = document.createElement('button');
    infoBtn.type = 'button';
    infoBtn.className = 'movie-info-btn';
    infoBtn.setAttribute('aria-label', `Más información sobre ${title}`);
    infoBtn.title = 'Más información';
    infoBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" stroke-width="2.4"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="11" x2="12" y2="17"/>
        <line x1="12" y1="7" x2="12.01" y2="7"/>
      </svg>`;
    card.appendChild(infoBtn);

    const overlay = document.createElement('div');
    overlay.className = 'movie-overlay';
    overlay.innerHTML = `
      <div class="overlay-content">
        <p class="overlay-title">${escapeHtml(title)}</p>
        <div class="overlay-meta">
          <span>${escapeHtml(year || '—')}</span>
          <span class="badge-sm">HD</span>
        </div>
        <span class="overlay-play" aria-hidden="true">▶</span>
      </div>`;
    card.appendChild(overlay);

    const activate = () => openVideoModal(movie.id, card);
    const showInfo = (opener) => openInfoModal(movie.id, opener || card);

    card.addEventListener('click', activate);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
      if (e.key === 'i' || e.key === 'I') { e.preventDefault(); showInfo(card); }
    });
    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showInfo(card);
    });

    // Click en el botón de info → abrir modal sin disparar reproducción
    infoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      showInfo(infoBtn);
    });
    infoBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
    });

    return card;
  }

  /* ────────────────────────────────────────────────
     CARRUSELES + scroll infinito horizontal
     ──────────────────────────────────────────────── */
  function createCarouselSection(genre) {
    const section = document.createElement('section');
    section.className = 'carousel-section';
    section.dataset.genreId = genre.id;
    section.innerHTML = `
      <div class="section-header">
        <h2 class="section-title">
          <span class="title-accent" aria-hidden="true">|</span> ${escapeHtml(genre.name)}
        </h2>
      </div>
      <div class="carousel-wrapper">
        <button type="button" class="scroll-btn scroll-left" aria-label="Anterior">
          <svg class="scroll-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="movies"></div>
        <button type="button" class="scroll-btn scroll-right" aria-label="Siguiente">
          <svg class="scroll-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>`;

    const list = section.querySelector('.movies');
    const wrapper = section.querySelector('.carousel-wrapper');
    const btnLeft = section.querySelector('.scroll-left');
    const btnRight = section.querySelector('.scroll-right');

    // Loader inline (al final del carrusel, scroll infinito)
    const loader = document.createElement('div');
    loader.className = 'carousel-loader';
    loader.innerHTML = '<div class="carousel-loader-ring"></div>';

    // Skeletons mientras llega la primera carga
    for (let i = 0; i < 8; i++) {
      const sk = document.createElement('div');
      sk.className = 'movie-skeleton';
      list.appendChild(sk);
    }

    const state = {
      genreId: genre.id,
      page: 1,
      loading: false,
      exhausted: false,
      list, wrapper, loader,
      seen: new Set(),
      btnLeft, btnRight,
      initialized: false,
    };

    loadMoreCarousel(state, true).then(() => {
      list.querySelectorAll('.movie-skeleton').forEach(n => n.remove());
      list.appendChild(loader);
      loader.hidden = true;
      initCarouselUI(state);
      state.initialized = true;
    });

    return section;
  }

  async function loadMoreCarousel(state, isFirst = false) {
    if (state.loading || state.exhausted) return;
    state.loading = true;
    if (state.loader && !isFirst) state.loader.hidden = false;

    try {
      const data = await tmdb('/discover/movie', {
        with_genres: state.genreId,
        page: state.page,
        sort_by: 'popularity.desc',
        include_adult: 'false',
        include_video: 'false',
        region: REGION,
        'vote_count.gte': 30,
      });

      const results = (data.results || []).filter(m =>
        m.poster_path && !badMovies.has(m.id)
      );

      results.forEach(m => {
        if (!state.seen.has(m.id)) {
          state.seen.add(m.id);
          const card = createCard(m);
          if (state.loader && state.loader.parentNode === state.list) {
            state.list.insertBefore(card, state.loader);
          } else {
            state.list.appendChild(card);
          }
        }
      });

      state.page++;
      if (data.page >= data.total_pages || results.length === 0) {
        state.exhausted = true;
        if (state.loader) state.loader.hidden = true;
      }
    } catch (err) {
      console.error('TMDB carousel error:', err);
    } finally {
      state.loading = false;
      if (!isFirst && state.loader && !state.exhausted) state.loader.hidden = true;
    }
  }

  function initCarouselUI(state) {
    const { wrapper, list, btnLeft, btnRight } = state;

    const getScrollAmount = () => {
      const card = list.querySelector('.movie');
      if (!card) return 600;
      const gap = parseInt(getComputedStyle(list).gap) || 8;
      return (card.offsetWidth + gap) * 6;
    };

    const setDisabled = (btn, disabled) => {
      btn.disabled = disabled;
      btn.setAttribute('aria-hidden', disabled ? 'true' : 'false');
      btn.tabIndex = disabled ? -1 : 0;
    };

    const updateUI = () => {
      const canLeft = list.scrollLeft > 0;
      const atRightEnd = list.scrollLeft >= list.scrollWidth - list.clientWidth - 1;
      const canRight = !atRightEnd || !state.exhausted;

      setDisabled(btnLeft, !canLeft);
      setDisabled(btnRight, !canRight);

      let overflow = 'none';
      if (canLeft && canRight) overflow = 'both';
      else if (canRight)       overflow = 'right';
      else if (canLeft)        overflow = 'left';
      wrapper.setAttribute('data-overflow', overflow);

      // Trigger lazy load
      const remaining = list.scrollWidth - list.scrollLeft - list.clientWidth;
      if (remaining < 800 && !state.loading && !state.exhausted) {
        loadMoreCarousel(state).then(updateUI);
      }
    };

    btnLeft.addEventListener('click', () =>
      list.scrollBy({ left: -getScrollAmount(), behavior: 'smooth' })
    );
    btnRight.addEventListener('click', () => {
      list.scrollBy({ left: getScrollAmount(), behavior: 'smooth' });
      if (!state.exhausted) loadMoreCarousel(state).then(updateUI);
    });

    let ticking = false;
    list.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { updateUI(); ticking = false; });
    }, { passive: true });

    window.addEventListener('resize', updateUI);
    new ResizeObserver(updateUI).observe(list);

    updateUI();
  }

  function buildCatalog() {
    const catalog = $('#catalog');
    catalog.innerHTML = '';
    GENRES.forEach(genre => {
      catalog.appendChild(createCarouselSection(genre));
    });
  }

  /* ────────────────────────────────────────────────
     BANNER (trending)
     ──────────────────────────────────────────────── */
  async function initBanner() {
    const banner = $('#mainBanner');
    const content = $('#bannerContent');
    const titleEl = $('#bannerTitle');
    const descEl = $('#bannerDesc');
    const metaEl = $('#bannerMeta');
    const playBtn = $('#bannerPlayBtn');
    const infoBtn = $('#bannerInfoBtn');

    try {
      const data = await tmdb('/trending/movie/week');
      const movie = (data.results || []).find(m =>
        m.backdrop_path && m.overview && m.poster_path && !badMovies.has(m.id)
      );
      if (!movie) return;

      banner.style.backgroundImage = `url('${backdropUrl(movie.backdrop_path)}')`;
      titleEl.textContent = movie.title || movie.original_title || '';
      descEl.textContent = movie.overview || '';

      const year = (movie.release_date || '').slice(0, 4);
      metaEl.innerHTML = `
        <span class="badge badge-hd">HD</span>
        ${year ? `<span class="badge">${escapeHtml(year)}</span>` : ''}
        ${movie.vote_average ? `<span class="badge">★ ${movie.vote_average.toFixed(1)}</span>` : ''}
        <span class="badge">Tendencia</span>
      `;

      playBtn.dataset.tmdbId = movie.id;
      infoBtn.dataset.tmdbId = movie.id;

      playBtn.addEventListener('click', () => openVideoModal(movie.id, playBtn));
      infoBtn.addEventListener('click', () => openInfoModal(movie.id, infoBtn));

      content.hidden = false;
    } catch (err) {
      console.error('Banner error:', err);
      content.hidden = false;
      titleEl.textContent = 'POPOROPO';
      descEl.textContent = 'Películas gratis en HD.';
    }
  }

  /* ────────────────────────────────────────────────
     BÚSQUEDA (TMDB /search/movie)
     ──────────────────────────────────────────────── */
  const searchBar      = $('#searchBar');
  const searchClearBtn = $('#searchClear');
  const emptyMsg       = $('#searchEmpty');
  const searchTermEl   = $('#searchTerm');
  const searchArea     = $('#searchResults');
  const searchGrid     = $('#searchGrid');
  const catalog        = $('#catalog');
  const banner         = $('#mainBanner');

  let searchTimer;
  let searchAbort = null;

  function clearSearch() {
    searchBar.value = '';
    searchClearBtn.hidden = true;
    showCatalog();
    searchBar.focus();
  }

  function showCatalog() {
    banner.style.display = '';
    catalog.hidden = false;
    searchArea.hidden = true;
    searchGrid.innerHTML = '';
    emptyMsg.hidden = true;
  }

  async function runSearch(query) {
    banner.style.display = 'none';
    catalog.hidden = true;
    searchArea.hidden = false;
    emptyMsg.hidden = true;
    searchGrid.innerHTML = '<div class="search-loading"><div class="spinner-ring"></div></div>';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (searchAbort) searchAbort.abort();
    searchAbort = new AbortController();

    try {
      const url = new URL(TMDB_API + '/search/movie');
      url.searchParams.set('api_key', TMDB_KEY);
      url.searchParams.set('language', LANG);
      url.searchParams.set('query', query);
      url.searchParams.set('include_adult', 'false');
      url.searchParams.set('page', '1');

      const res = await fetch(url.toString(), { signal: searchAbort.signal });
      const data = await res.json();
      const results = (data.results || []).filter(m =>
        m.poster_path && !badMovies.has(m.id)
      );

      searchGrid.innerHTML = '';
      if (results.length === 0) {
        searchTermEl.textContent = query;
        emptyMsg.hidden = false;
      } else {
        const frag = document.createDocumentFragment();
        results.forEach(m => frag.appendChild(createCard(m)));
        searchGrid.appendChild(frag);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Search error:', err);
      searchGrid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:40px;">Error al buscar. Inténtalo de nuevo.</p>';
    }
  }

  searchBar.addEventListener('input', function () {
    searchClearBtn.hidden = !this.value;
    clearTimeout(searchTimer);
    const q = this.value.trim();
    if (!q) { showCatalog(); return; }
    searchTimer = setTimeout(() => runSearch(q), 350);
  });

  searchClearBtn.addEventListener('click', clearSearch);

  /* ────────────────────────────────────────────────
     ARRANQUE
     ──────────────────────────────────────────────── */
  initBanner();
  buildCatalog();
});
