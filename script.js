/* ============================================================
   POPOROPO — SCRIPT.JS
   Sections:
     A. AdBlocker (IIFE) — bloqueo de window.open, redirects,
        inserción de scripts/iframes de ads, mutation observer.
     B. Lógica principal del sitio (un solo DOMContentLoaded):
        1. Header scroll
        2. Toast helper
        3. Modales (video + info) con focus trap + ARIA
        4. Cards de películas (teclado + click + sin link)
        5. Botones del banner (Reproducir / Más info)
        6. Carruseles (6 cards/scroll, gradientes data-overflow)
        7. Buscador (normalización de acentos, botón limpiar)
   ============================================================ */


/* ============================================================
   A. ADBLOCKER (IIFE)
   ============================================================
   Para añadir nuevos dominios permitidos (p. ej. archive.org),
   edita la constante ALLOWED_DOMAINS abajo.
   ============================================================ */
(function () {
  'use strict';

  // ── Dominios permitidos para clicks en links externos ─────
  // Añadir aquí cualquier nuevo proveedor de embeds. Ejemplo futuro:
  //   'archive.org'
  const ALLOWED_DOMAINS = [
    'cinepoporopo.com',
    'mega.nz',
    'drive.google.com',
    'docs.google.com',
    // 'archive.org', // futuro
    // Legacy DoodStream — descomenta si vuelves a usarlos:
    // 'myvidplay.com', 'doodstream.com', 'dood.watch', 'ds2play.com',
    // 'dooood.com', 'dood.la', 'dood.to', 'dood.pm', 'dood.re',
    // 'dood.wf', 'd0000d.com',
  ];

  // ── Dominios de ads conocidos ─────────────────────────────
  const AD_DOMAINS = [
    'doubleclick.net','googlesyndication.com','adnxs.com','popads.net',
    'popcash.net','exoclick.com','trafficjunky.net','adsterra.com',
    'propellerads.com','hilltopads.net','trafficstars.com','clickadu.com',
    'yllix.com','pushground.com','evadav.com','richpush.co','mgid.com',
    'taboola.com','outbrain.com','revcontent.com','adcash.com','juicyads.com',
    'plugrush.com','bidvertiser.com','zeropark.com','adskeeper.com',
    'shorte.st','adf.ly','linkvertise.com','ouo.io','pu.sh','doodstream.icu'
  ];

  function isAd(src) {
    return src && AD_DOMAINS.some(d => src.includes(d));
  }

  // ── BLOQUEO TOTAL window.open ──
  window.open = function () {
    console.warn('[AdBlock] window.open bloqueado');
    return { closed: true, close() {}, focus() {}, document: { write() {}, close() {} } };
  };

  // ── BLOQUEO DE REDIRECCIONES ──
  try {
    window.location.replace = function () { console.warn('[AdBlock] location.replace bloqueado'); };
    window.location.assign  = function () { console.warn('[AdBlock] location.assign bloqueado'); };
  } catch (e) {}

  try {
    Object.defineProperty(window, 'top',    { get: () => window });
    Object.defineProperty(window, 'parent', { get: () => window });
  } catch (e) {}

  // ── BLOQUEAR setTimeout/setInterval con strings de redirección ──
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

  // ── BLOQUEAR CREACIÓN DE ELEMENTOS DE ADS ──
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

  // ── BLOQUEAR CLICKS EN LINKS EXTERNOS ──
  document.addEventListener('click', function (e) {
    const a = e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (!href) return;

    // Permitir: anclas, rutas relativas, rutas absolutas del mismo origen
    if (href.startsWith('#') || href.startsWith('/') || !href.includes('://')) return;

    const ok = href.startsWith(window.location.origin) ||
               ALLOWED_DOMAINS.some(d => href.includes(d));
    if (!ok) {
      e.preventDefault();
      e.stopImmediatePropagation();
      console.warn('[AdBlock] Link bloqueado:', href);
    }
  }, true);

  // ── MUTATION OBSERVER: eliminar overlays inyectados ──
  const SAFE_IDS = new Set([
    'videoModal','infoModal','searchEmpty','mainHeader','mainBanner',
    'adClickBlocker','playerSpinner','toast','searchClear'
  ]);
  const SAFE_CLASSES = new Set([
    'modal','search-empty','header','banner','movie',
    'carousel-section','content-area','player-wrapper',
    'info-modal','toast','blocker-strip'
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
          console.warn('[AdBlock] Nodo eliminado:', node.tagName, node.id, [...node.classList].join(' '));
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

  console.log('[AdBlock] Poporopo AdBlock v3.1 ACTIVO ✓');
})();


/* ============================================================
   B. LÓGICA PRINCIPAL — UN SOLO DOMContentLoaded
   ============================================================ */
document.addEventListener('DOMContentLoaded', function () {

  /* ── Helper: normaliza texto (sin acentos, lowercase) ── */
  const normalize = (s) => (s || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();


  /* ────────────────────────────────────────────────
     1. HEADER SCROLL
     ──────────────────────────────────────────────── */
  const header = document.getElementById('mainHeader');
  const handleScroll = () => header.classList.toggle('scrolled', window.scrollY > 20);
  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();


  /* ────────────────────────────────────────────────
     2. TOAST HELPER
     ──────────────────────────────────────────────── */
  const toastEl = document.getElementById('toast');
  let toastTimer;
  function showToast(msg, ms = 2200) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.hidden = false;
    // permite que el browser pinte antes de añadir la clase
    requestAnimationFrame(() => toastEl.classList.add('is-visible'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('is-visible');
      setTimeout(() => { toastEl.hidden = true; }, 250);
    }, ms);
  }


  /* ────────────────────────────────────────────────
     3. MODALES (Video + Info) — focus trap + ARIA
     ──────────────────────────────────────────────── */
  const videoModal   = document.getElementById('videoModal');
  const videoPlayer  = document.getElementById('videoPlayer');
  const closeVideo   = document.getElementById('closeModal');
  const videoBack    = videoModal.querySelector('.modal-backdrop');
  const playerSpin   = document.getElementById('playerSpinner');
  const adBlocker    = document.getElementById('adClickBlocker');

  const infoModal       = document.getElementById('infoModal');
  const closeInfoBtn    = document.getElementById('closeInfoModal');
  const infoBack        = infoModal.querySelector('.modal-backdrop');
  const infoTitleEl     = document.getElementById('infoModalTitle');
  const infoYearEl      = infoModal.querySelector('.info-year');
  const infoDurationEl  = infoModal.querySelector('.info-duration');
  const infoGenreEl     = infoModal.querySelector('.info-genre');
  const infoDescEl      = infoModal.querySelector('.info-desc');
  const infoPlayBtn     = document.getElementById('infoPlayBtn');

  // Configuración del iframe (sandbox eliminado; Mega y Drive lo rechazan)
  // referrerpolicy ya está en el HTML; no se reasigna aquí.

  // Pila de modales abiertos para focus trap y restauración de foco
  const modalStack = [];

  function getFocusable(container) {
    return [...container.querySelectorAll(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input, select, textarea, iframe'
    )].filter(el => !el.hasAttribute('hidden') && el.offsetParent !== null);
  }

  function trapTab(modalEl, e) {
    if (e.key !== 'Tab') return;
    const focusable = getFocusable(modalEl);
    if (!focusable.length) { e.preventDefault(); return; }
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      last.focus(); e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus(); e.preventDefault();
    }
  }

  function openModal(modalEl, opener) {
    modalEl.classList.add('active');
    modalEl.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    modalStack.push({ el: modalEl, opener: opener || document.activeElement });

    // Foco al primer elemento focuseable
    const f = getFocusable(modalEl);
    if (f.length) f[0].focus();
  }

  function closeModalEl(modalEl) {
    modalEl.classList.remove('active');
    modalEl.setAttribute('aria-hidden', 'true');

    // Limpia la pila y restaura foco
    const idx = modalStack.findIndex(m => m.el === modalEl);
    let opener = null;
    if (idx >= 0) {
      opener = modalStack[idx].opener;
      modalStack.splice(idx, 1);
    }
    if (modalStack.length === 0) document.body.style.overflow = '';
    if (opener && typeof opener.focus === 'function') {
      try { opener.focus(); } catch (e) {}
    }
  }

  // ── Video modal ────────────────────────────────
  function openVideoModal(src, opener) {
    if (playerSpin) playerSpin.classList.remove('is-hidden');
    // Limpiar y reasignar en siguiente frame para forzar el load event
    videoPlayer.src = '';
    requestAnimationFrame(() => { videoPlayer.src = src; });

    if (adBlocker) adBlocker.classList.add('is-active');
    openModal(videoModal, opener);
  }
  function closeVideoModal() {
    videoPlayer.src = '';
    if (adBlocker) adBlocker.classList.remove('is-active');
    if (playerSpin) playerSpin.classList.remove('is-hidden'); // listo para la próxima vez
    closeModalEl(videoModal);
  }

  videoPlayer.addEventListener('load', () => {
    // Solo ocultar si tiene un src real
    if (videoPlayer.src && playerSpin) playerSpin.classList.add('is-hidden');
  });

  closeVideo.addEventListener('click', closeVideoModal);
  videoBack.addEventListener('click', closeVideoModal);

  // ── Info modal ─────────────────────────────────
  let infoCurrentLink = '';
  function openInfoModal(data, opener) {
    infoTitleEl.textContent    = data.title || '';
    infoYearEl.textContent     = data.year ? `· ${data.year}` : '';
    infoDurationEl.textContent = data.duration ? `· ${data.duration}` : '';
    infoGenreEl.textContent    = data.genre ? `· ${data.genre}` : '';
    infoDescEl.textContent     = data.desc || 'Sin descripción disponible.';
    infoCurrentLink = data.link || '';
    infoPlayBtn.disabled = !infoCurrentLink;
    infoPlayBtn.style.opacity = infoCurrentLink ? '' : '0.5';
    openModal(infoModal, opener);
  }
  function closeInfoModal() { closeModalEl(infoModal); }

  closeInfoBtn.addEventListener('click', closeInfoModal);
  infoBack.addEventListener('click', closeInfoModal);
  infoPlayBtn.addEventListener('click', () => {
    if (!infoCurrentLink) {
      showToast('Próximamente');
      return;
    }
    const opener = modalStack[modalStack.length - 1]?.opener;
    closeInfoModal();
    openVideoModal(infoCurrentLink, opener);
  });

  // ── Keydown global: Escape + focus trap ────────
  document.addEventListener('keydown', (e) => {
    // Focus trap en el modal más reciente
    if (modalStack.length && e.key === 'Tab') {
      trapTab(modalStack[modalStack.length - 1].el, e);
      return;
    }

    if (e.key === 'Escape') {
      if (modalStack.length) {
        // cerrar el más reciente
        closeModalEl(modalStack[modalStack.length - 1].el);
        // limpiar src si era el video
        if (videoPlayer.src) videoPlayer.src = '';
        if (adBlocker) adBlocker.classList.remove('is-active');
      } else if (searchBar && searchBar.value) {
        // Si no hay modal abierto pero el buscador tiene texto → limpiarlo
        clearSearch();
      }
    }
  });


  /* ────────────────────────────────────────────────
     4. CARDS DE PELÍCULAS (click + teclado)
     ──────────────────────────────────────────────── */
  document.querySelectorAll('.movie').forEach(card => {
    const link = card.dataset.link;
    if (!link) card.classList.add('is-disabled');

    const activate = () => {
      if (link) {
        openVideoModal(link, card);
      } else {
        showToast(`"${card.dataset.title || 'Esta película'}" — Próximamente`);
      }
    };

    card.addEventListener('click', activate);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate();
      }
    });
  });


  /* ────────────────────────────────────────────────
     5. BOTONES DEL BANNER
     ──────────────────────────────────────────────── */
  const bannerPlayBtn = document.querySelector('.banner .btn-play');
  const bannerInfoBtn = document.getElementById('bannerInfoBtn');

  if (bannerPlayBtn) {
    bannerPlayBtn.addEventListener('click', () => {
      const link = bannerPlayBtn.dataset.link;
      if (link) openVideoModal(link, bannerPlayBtn);
      else showToast('Próximamente');
    });
  }

  if (bannerInfoBtn && bannerPlayBtn) {
    bannerInfoBtn.addEventListener('click', () => {
      openInfoModal({
        title:    bannerPlayBtn.dataset.title || 'Oppenheimer',
        year:     bannerPlayBtn.dataset.year || '2023',
        duration: bannerPlayBtn.dataset.duration || '3h 01m',
        genre:    bannerPlayBtn.dataset.genre || 'Drama',
        desc:     bannerPlayBtn.dataset.desc || '',
        link:     bannerPlayBtn.dataset.link || ''
      }, bannerInfoBtn);
    });
  }


  /* ── Banner trailer estilo Netflix ─────────────── */
  (function initBannerTrailer() {
    const wrap = document.getElementById('bannerVideo');
    if (!wrap) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const videoEl = document.getElementById('bannerVideoEl');
    const ytMount = document.getElementById('bannerYtMount');
    const delay   = parseInt(wrap.dataset.delay) || 3000;

    const mp4Src = videoEl && videoEl.dataset.src;
    const ytId   = wrap.dataset.ytId;
    const ytStart = parseInt(wrap.dataset.ytStart) || 0;
    const ytEnd   = parseInt(wrap.dataset.ytEnd) || 0;

    let started = false;
    function reveal() { wrap.classList.add('is-playing'); }
    function hide()   { wrap.classList.remove('is-playing'); }

    setTimeout(() => {
      if (started) return;
      started = true;

      // Si hay MP4, prioridad para él
      if (mp4Src) {
        videoEl.src = mp4Src;
        videoEl.play().then(reveal).catch(() => loadYouTube());
        return;
      }
      loadYouTube();
    }, delay);

    function loadYouTube() {
      if (!ytId || !ytMount) return;

      // Crear iframe con la IFrame API de YouTube (autoplay silencioso + bucle)
      const iframe = document.createElement('iframe');
      const params = new URLSearchParams({
        autoplay: '1',
        mute: '1',
        controls: '0',
        loop: '1',
        playlist: ytId,
        playsinline: '1',
        modestbranding: '1',
        rel: '0',
        iv_load_policy: '3',
        disablekb: '1',
        fs: '0',
        cc_load_policy: '0',
        showinfo: '0'
      });
      if (ytStart) params.set('start', ytStart);
      if (ytEnd) params.set('end', ytEnd);
      iframe.src = `https://www.youtube-nocookie.com/embed/${ytId}?${params.toString()}`;
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.setAttribute('tabindex', '-1');
      ytMount.appendChild(iframe);
      // Damos un pequeño margen para que comience la reproducción
      setTimeout(reveal, 800);
    }

    // Pausar/ocultar al abrir cualquier modal (no compite con el reproductor)
    const observerModal = new MutationObserver(() => {
      const anyOpen = document.querySelector('.modal.active');
      if (anyOpen) hide();
      else if (started) reveal();
    });
    document.querySelectorAll('.modal').forEach(m => {
      observerModal.observe(m, { attributes: true, attributeFilter: ['class'] });
    });

    // Si el usuario hace scroll lejos del banner, ocultar (ahorra recursos)
    let visible = true;
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!started) return;
      if (visible) reveal(); else hide();
    }, { threshold: 0.15 });
    io.observe(wrap);
  })();


  /* ────────────────────────────────────────────────
     6. CARRUSELES — 6 cards / click, gradientes
     ──────────────────────────────────────────────── */
  function initCarousels() {
    document.querySelectorAll('.carousel-wrapper').forEach(wrapper => {
      const list     = wrapper.querySelector('.movies');
      const btnLeft  = wrapper.querySelector('.scroll-left');
      const btnRight = wrapper.querySelector('.scroll-right');
      if (!list || !btnLeft || !btnRight) return;

      const getScrollAmount = () => {
        const card = list.querySelector('.movie:not(.hidden)');
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
        const canLeft  = list.scrollLeft > 0;
        const canRight = list.scrollLeft < list.scrollWidth - list.clientWidth - 1;

        setDisabled(btnLeft,  !canLeft);
        setDisabled(btnRight, !canRight);

        // Atributo data-overflow para los gradientes laterales
        let overflow = 'none';
        if (canLeft && canRight)      overflow = 'both';
        else if (canRight)            overflow = 'right';
        else if (canLeft)             overflow = 'left';
        wrapper.setAttribute('data-overflow', overflow);
      };

      btnLeft.addEventListener('click',  () => list.scrollBy({ left: -getScrollAmount(), behavior: 'smooth' }));
      btnRight.addEventListener('click', () => list.scrollBy({ left:  getScrollAmount(), behavior: 'smooth' }));

      const ro = new ResizeObserver(updateUI);
      ro.observe(list);
      list.addEventListener('scroll', updateUI, { passive: true });
      window.addEventListener('resize', updateUI);

      updateUI();
    });
  }
  initCarousels();


  /* ────────────────────────────────────────────────
     7. BUSCADOR (con normalización + botón limpiar)
     ──────────────────────────────────────────────── */
  const searchBar     = document.getElementById('searchBar');
  const searchClearBtn = document.getElementById('searchClear');
  const emptyMsg      = document.getElementById('searchEmpty');
  const searchTermEl  = document.getElementById('searchTerm');
  const allCards      = document.querySelectorAll('.movie');
  const allSections   = document.querySelectorAll('.carousel-section');
  const banner        = document.getElementById('mainBanner');
  const contentArea   = document.querySelector('.content-area');

  // Pre-normalizar título y género una sola vez
  allCards.forEach(card => {
    card.dataset._titleNorm = normalize(card.dataset.title);
    card.dataset._genreNorm = normalize(card.dataset.genre);
  });

  function clearSearch() {
    searchBar.value = '';
    searchClearBtn.hidden = true;
    allCards.forEach(c => c.classList.remove('hidden'));
    allSections.forEach(s => s.classList.remove('is-hidden'));
    banner.style.display = '';
    contentArea.style.paddingTop = '';
    emptyMsg.hidden = true;
    searchBar.focus();
  }

  function runSearch(rawQuery) {
    const query = normalize(rawQuery);

    if (!query) {
      allCards.forEach(c => c.classList.remove('hidden'));
      allSections.forEach(s => s.classList.remove('is-hidden'));
      banner.style.display = '';
      contentArea.style.paddingTop = '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      emptyMsg.hidden = true;
      return;
    }

    banner.style.display = 'none';
    contentArea.style.paddingTop = 'calc(var(--header-h) + 16px)';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    let total = 0;
    allSections.forEach(section => {
      let hits = 0;
      section.querySelectorAll('.movie').forEach(card => {
        const match = card.dataset._titleNorm.includes(query) ||
                      card.dataset._genreNorm.includes(query);
        card.classList.toggle('hidden', !match);
        if (match) hits++;
      });
      section.classList.toggle('is-hidden', hits === 0);
      total += hits;
    });

    if (total === 0) {
      searchTermEl.textContent = rawQuery.trim();
      emptyMsg.hidden = false;
    } else {
      emptyMsg.hidden = true;
    }
  }

  let searchTimer;
  searchBar.addEventListener('input', function () {
    searchClearBtn.hidden = !this.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => runSearch(this.value), 200);
  });

  searchClearBtn.addEventListener('click', clearSearch);
});
