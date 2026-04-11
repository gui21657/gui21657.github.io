document.addEventListener('DOMContentLoaded', function () {

  /* ========================
     HEADER: transparente → oscuro al scroll
     ======================== */
  const header = document.getElementById('mainHeader');

  const handleScroll = () => {
    header.classList.toggle('scrolled', window.scrollY > 20);
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll(); // estado inicial


  /* ========================
     MODAL DE VIDEO
     ======================== */
  const modal       = document.getElementById('videoModal');
  const videoPlayer = document.getElementById('videoPlayer');
  const closeBtn    = document.getElementById('closeModal');
  const backdrop    = modal.querySelector('.modal-backdrop');

  function openModal(src) {
    videoPlayer.src = src;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('active');
    videoPlayer.src = '';
    document.body.style.overflow = '';
  }

  closeBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });


  /* ========================
     CLICK EN CARDS DE PELÍCULAS
     ======================== */
  document.querySelectorAll('.movie').forEach(card => {
    card.addEventListener('click', () => {
      const link = card.dataset.link;
      if (link) openModal(link);
    });

    // Alt text SEO
    const img = card.querySelector('img');
    if (img) img.alt = `Película: ${card.dataset.title || ''}`;
  });


  /* ========================
     BOTÓN REPRODUCIR DEL BANNER
     ======================== */
  const bannerPlayBtn = document.querySelector('.btn-play');
  if (bannerPlayBtn) {
    bannerPlayBtn.addEventListener('click', () => {
      const link = bannerPlayBtn.dataset.link;
      if (link) openModal(link);
    });
  }
  /* ========================
     CARRUSEL CON FLECHAS + BARRA DE PROGRESO (ESTILO NETFLIX)
     ======================== */
  function initCarousels() {
    document.querySelectorAll('.carousel-wrapper').forEach(wrapper => {
      const list       = wrapper.querySelector('.movies');
      const btnLeft    = wrapper.querySelector('.scroll-left');
      const btnRight   = wrapper.querySelector('.scroll-right');
      
      if (!list || !btnLeft || !btnRight) return;

      // Crear barra de progreso si no existe
      let progressContainer = wrapper.querySelector('.carousel-progress');
      if (!progressContainer) {
        progressContainer = document.createElement('div');
        progressContainer.className = 'carousel-progress';
        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        progressContainer.appendChild(progressBar);
        wrapper.appendChild(progressContainer);
      }
      const progressBar = progressContainer.querySelector('.progress-bar');

      // Calcular cantidad de desplazamiento (6 tarjetas)
      const getScrollAmount = () => {
        const firstCard = list.querySelector('.movie');
        if (!firstCard) return 600;
        const cardWidth = firstCard.offsetWidth;
        const gap = parseInt(getComputedStyle(list).gap) || 8;
        return (cardWidth + gap) * 6;
      };

      // Actualizar visibilidad de botones y barra de progreso
      const updateUI = () => {
        if (!btnLeft || !btnRight) return;
        
        const canScrollLeft = list.scrollLeft > 0;
        const canScrollRight = list.scrollLeft < list.scrollWidth - list.clientWidth - 1;
        
        btnLeft.style.display = canScrollLeft ? '' : 'none';
        btnRight.style.display = canScrollRight ? '' : 'none';
        
        // Actualizar barra de progreso
        if (progressBar) {
          const scrollPercent = (list.scrollLeft / (list.scrollWidth - list.clientWidth)) * 100;
          progressBar.style.width = Math.min(scrollPercent, 100) + '%';
        }
      };

      // Eventos de clic
      btnLeft.addEventListener('click', () => {
        list.scrollBy({ left: -getScrollAmount(), behavior: 'smooth' });
      });
      btnRight.addEventListener('click', () => {
        list.scrollBy({ left: getScrollAmount(), behavior: 'smooth' });
      });

      // Observar cambios de tamaño
      const resizeObserver = new ResizeObserver(() => updateUI());
      resizeObserver.observe(list);
      
      // Actualizar al hacer scroll
      list.addEventListener('scroll', updateUI, { passive: true });
      
      // Actualizar al redimensionar ventana
      window.addEventListener('resize', updateUI);
      
      // Llamada inicial
      updateUI();
    });
  }

  initCarousels();
  /* ========================
   BUSCADOR
   ======================== */
  const searchBar   = document.getElementById('searchBar');
  const emptyMsg    = document.getElementById('searchEmpty');
  const searchTerm  = document.getElementById('searchTerm');
  const allCards    = document.querySelectorAll('.movie');
  const allSections = document.querySelectorAll('.carousel-section');
  const banner      = document.getElementById('mainBanner');
  const contentArea = document.querySelector('.content-area');

  let searchTimer;

  searchBar.addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const query = this.value.trim().toLowerCase();

      if (!query) {
        allCards.forEach(c => c.classList.remove('hidden'));
        allSections.forEach(s => s.style.display = '');
        banner.style.display = '';
        contentArea.style.paddingTop = '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        emptyMsg.style.display = 'none';
        return;
      }

      banner.style.display = 'none';
      contentArea.style.paddingTop = 'calc(var(--header-h) + 16px)';
      window.scrollTo({ top: 0, behavior: 'smooth' });

      let totalVisible = 0;

      allSections.forEach(section => {
        const cards   = section.querySelectorAll('.movie');
        let sectionHits = 0;

        cards.forEach(card => {
          const title = (card.dataset.title || '').toLowerCase();
          const genre = (card.dataset.genre || '').toLowerCase();
          const match = title.includes(query) || genre.includes(query);
          card.classList.toggle('hidden', !match);
          if (match) sectionHits++;
        });

        section.style.display = sectionHits === 0 ? 'none' : '';
        totalVisible += sectionHits;
      });

      if (totalVisible === 0) {
        searchTerm.textContent = this.value.trim();
        emptyMsg.style.display = 'block';
        setTimeout(() => { emptyMsg.style.display = 'none'; }, 3000);
      } else {
        emptyMsg.style.display = 'none';
      }
    }, 200);
  });
/* ============================================================
   POPOROPO AD BLOCKER v3.0 - MAXIMUM STRICT
   ============================================================ */
(function () {
  'use strict';

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

  const _ac = Element.prototype.appendChild;
  Element.prototype.appendChild = function (node) {
    if (node.nodeType === 1 && isAd(node.src || node.href || '')) {
      console.warn('[AdBlock] Elemento bloqueado:', node.src || node.href);
      return node;
    }
    return _ac.call(this, node);
  };

  const _ib = Element.prototype.insertBefore;
  Element.prototype.insertBefore = function (node, ref) {
    if (node.nodeType === 1 && isAd(node.src || node.href || '')) {
      console.warn('[AdBlock] Elemento bloqueado (insertBefore):', node.src);
      return node;
    }
    return _ib.call(this, node, ref);
  };

  // ── BLOQUEAR CLICKS EN LINKS EXTERNOS ──
  const ALLOWED = ['cinepoporopo.com', 'mega.nz', 'myvidplay.com',
    'doodstream.com', 'dood.watch', 'ds2play.com', 'dooood.com',
    'dood.la', 'dood.to', 'dood.pm', 'dood.re', 'dood.wf', 'd0000d.com'];

 // ── BLOQUEAR CLICKS EN LINKS EXTERNOS ──
  document.addEventListener('click', function (e) {
    const a = e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (!href) return;

    // Permitir: anclas, rutas relativas, rutas absolutas del mismo origen
    if (href.startsWith('#') ||
        href.startsWith('/') ||
        !href.includes('://')) return; // <-- esto permite index.html, peliculas.html, etc.

    const ok = href.startsWith(window.location.origin) ||
               ALLOWED.some(d => href.includes(d));
    if (!ok) {
      e.preventDefault();
      e.stopImmediatePropagation();
      console.warn('[AdBlock] Link bloqueado:', href);
    }
  }, true);

  // ── MUTATION OBSERVER: eliminar overlays inyectados ──
  const SAFE_IDS      = new Set(['videoModal','searchEmpty','mainHeader','mainBanner','adClickBlocker']);
  const SAFE_CLASSES  = new Set(['modal','search-empty','header','banner','movie',
                                 'carousel-section','content-area','player-wrapper']);

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
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }

  console.log('[AdBlock] Poporopo AdBlock v3.0 ACTIVO ✓');
})();


/* ============================================================
   LÓGICA PRINCIPAL DEL SITIO
   ============================================================ */
document.addEventListener('DOMContentLoaded', function () {

  /* ── HEADER SCROLL ── */
  const header = document.getElementById('mainHeader');
  const handleScroll = () => header.classList.toggle('scrolled', window.scrollY > 20);
  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  /* ── MODAL DE VIDEO ── */
  const modal       = document.getElementById('videoModal');
  const videoPlayer = document.getElementById('videoPlayer');
  const closeBtn    = document.getElementById('closeModal');
  const backdrop    = modal.querySelector('.modal-backdrop');
  const blocker     = document.getElementById('adClickBlocker');

  // Asegurar sandbox ANTES de asignar src
  videoPlayer.sandbox.value = 'allow-scripts allow-same-origin allow-forms allow-presentation';
  videoPlayer.setAttribute('referrerpolicy', 'no-referrer');

  function openModal(src) {
    // Limpiar src primero, luego asignar (evita race conditions)
    videoPlayer.src = '';
    requestAnimationFrame(() => {
      videoPlayer.src = src;
    });
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Activar bloqueador de clicks en bordes del iframe (zonas de banners)
    if (blocker) {
      blocker.style.pointerEvents = 'auto';
      // Dejamos pasar clicks solo en el centro (zona del player)
      // Los bordes donde suelen estar los ads quedan bloqueados
      blocker.style.clipPath = 'polygon(0 0, 100% 0, 100% 8%, 0 8%, 0 0), ' +
                               'polygon(0 92%, 100% 92%, 100% 100%, 0 100%)';
    }
  }

  function closeModal() {
    modal.classList.remove('active');
    videoPlayer.src = '';
    document.body.style.overflow = '';
    if (blocker) blocker.style.pointerEvents = 'none';
  }

  closeBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  /* ── CARDS DE PELÍCULAS ── */
  document.querySelectorAll('.movie').forEach(card => {
    card.addEventListener('click', () => {
      const link = card.dataset.link;
      if (link) openModal(link);
    });
    const img = card.querySelector('img');
    if (img) img.alt = `Película: ${card.dataset.title || ''}`;
  });

  /* ── BOTÓN BANNER ── */
  const bannerPlayBtn = document.querySelector('.btn-play');
  if (bannerPlayBtn) {
    bannerPlayBtn.addEventListener('click', () => {
      const link = bannerPlayBtn.dataset.link;
      if (link) openModal(link);
    });
  }

  /* ── CARRUSELES ── */
  function initCarousels() {
    document.querySelectorAll('.carousel-wrapper').forEach(wrapper => {
      const list     = wrapper.querySelector('.movies');
      const btnLeft  = wrapper.querySelector('.scroll-left');
      const btnRight = wrapper.querySelector('.scroll-right');
      if (!list || !btnLeft || !btnRight) return;

      let progressContainer = wrapper.querySelector('.carousel-progress');
      if (!progressContainer) {
        progressContainer = document.createElement('div');
        progressContainer.className = 'carousel-progress';
        const bar = document.createElement('div');
        bar.className = 'progress-bar';
        progressContainer.appendChild(bar);
        wrapper.appendChild(progressContainer);
      }
      const progressBar = progressContainer.querySelector('.progress-bar');

      const getScrollAmount = () => {
        const card = list.querySelector('.movie');
        if (!card) return 600;
        return (card.offsetWidth + (parseInt(getComputedStyle(list).gap) || 8)) * 6;
      };

      const updateUI = () => {
        btnLeft.style.display  = list.scrollLeft > 0 ? '' : 'none';
        btnRight.style.display = list.scrollLeft < list.scrollWidth - list.clientWidth - 1 ? '' : 'none';
        if (progressBar) {
          const pct = (list.scrollLeft / (list.scrollWidth - list.clientWidth)) * 100;
          progressBar.style.width = Math.min(pct, 100) + '%';
        }
      };

      btnLeft.addEventListener('click',  () => list.scrollBy({ left: -getScrollAmount(), behavior: 'smooth' }));
      btnRight.addEventListener('click', () => list.scrollBy({ left:  getScrollAmount(), behavior: 'smooth' }));

      new ResizeObserver(updateUI).observe(list);
      list.addEventListener('scroll', updateUI, { passive: true });
      window.addEventListener('resize', updateUI);
      updateUI();
    });
  }

  initCarousels();

  /* ── BUSCADOR ── */
  const searchBar   = document.getElementById('searchBar');
  const emptyMsg    = document.getElementById('searchEmpty');
  const searchTermEl = document.getElementById('searchTerm');
  const allCards    = document.querySelectorAll('.movie');
  const allSections = document.querySelectorAll('.carousel-section');
  const banner      = document.getElementById('mainBanner');
  const contentArea = document.querySelector('.content-area');

  let searchTimer;
  searchBar.addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const query = this.value.trim().toLowerCase();

      if (!query) {
        allCards.forEach(c => c.classList.remove('hidden'));
        allSections.forEach(s => s.style.display = '');
        banner.style.display = '';
        contentArea.style.paddingTop = '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        emptyMsg.style.display = 'none';
        return;
      }

      banner.style.display = 'none';
      contentArea.style.paddingTop = 'calc(var(--header-h) + 16px)';
      window.scrollTo({ top: 0, behavior: 'smooth' });

      let total = 0;
      allSections.forEach(section => {
        let hits = 0;
        section.querySelectorAll('.movie').forEach(card => {
          const match = (card.dataset.title || '').toLowerCase().includes(query) ||
                        (card.dataset.genre || '').toLowerCase().includes(query);
          card.classList.toggle('hidden', !match);
          if (match) hits++;
        });
        section.style.display = hits === 0 ? 'none' : '';
        total += hits;
      });

      if (total === 0) {
        searchTermEl.textContent = this.value.trim();
        emptyMsg.style.display = 'block';
        setTimeout(() => { emptyMsg.style.display = 'none'; }, 3000);
      } else {
        emptyMsg.style.display = 'none';
      }
    }, 200);
  });
});
});
