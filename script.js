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
   POPOROPO AD BLOCKER v2.0 - STRICT MODE
   Optimizado para DoodStream y plataformas de embed similares
   ============================================================ */

(function () {
  'use strict';

  // ── Dominios de video permitidos (solo estos pueden cargar en iframes) ──
  const ALLOWED_EMBED_DOMAINS = [
    'mega.nz',
    'myvidplay.com',
    'dood.watch',
    'doodstream.com',
    'ds2play.com',      // dominios alternativos de DoodStream
    'dooood.com',
    'd0000d.com',
    'dood.la',
    'dood.to',
    'dood.pm',
    'dood.re',
    'dood.wf'
  ];

  // ── Dominios de publicidad conocidos ──
  const AD_DOMAINS = [
    'doubleclick.net', 'googlesyndication.com', 'adnxs.com',
    'outbrain.com', 'taboola.com', 'popads.net', 'popcash.net',
    'trafficjunky.net', 'exoclick.com', 'juicyads.com', 'plugrush.com',
    'hilltopads.net', 'propellerads.com', 'adsterra.com', 'trafficstars.com',
    'clickadu.com', 'revcontent.com', 'mgid.com', 'adskeeper.com',
    'adspyglass.com', 'eroadvertising.com', 'adcash.com', 'bidvertiser.com',
    'yllix.com', 'pushground.com', 'richpush.co', 'evadav.com',
    'zeropark.com', 'datpush.com', 'pushpush.net', 'pu.sh',
    'doodstream.icu', 'ads.dood', 'vidads', 'adbull',
    'go2ads', 'shorte.st', 'adf.ly', 'linkvertise', 'ouo.io'
  ];

  // ════════════════════════════════════════════
  // 1. BLOQUEO TOTAL DE window.open
  // ════════════════════════════════════════════
  const _originalOpen = window.open;
  window.open = function () {
    console.warn('[AdBlock] window.open bloqueado');
    return {
      closed: true,
      close: () => {},
      focus: () => {},
      document: { write: () => {}, close: () => {} }
    };
  };

  // ════════════════════════════════════════════
  // 2. BLOQUEO DE REDIRECCIONES (el más importante para DoodStream)
  // ════════════════════════════════════════════

  // Congela window.location para que nadie pueda cambiarlo
  const _location = window.location;

  ['href', 'replace', 'assign'].forEach(method => {
    try {
      if (method === 'href') {
        Object.defineProperty(window.location, 'href', {
          set: function (url) {
            // Solo permite cambios de URL si vienen de acción directa del usuario en botones del sitio
            if (_isUserAction()) {
              _location.href = url;
            } else {
              console.warn('[AdBlock] Redirección href bloqueada:', url);
            }
          },
          get: function () { return _location.href; }
        });
      }
    } catch (e) {}
  });

  // Bloquear location.replace y location.assign
  try {
    window.location.replace = function (url) {
      console.warn('[AdBlock] location.replace bloqueado:', url);
    };
    window.location.assign = function (url) {
      console.warn('[AdBlock] location.assign bloqueado:', url);
    };
  } catch (e) {}

  // Bloquear top/parent frame hijacking (cuando el iframe intenta salir del frame)
  try {
    Object.defineProperty(window, 'top', {
      get: function () { return window; }
    });
    Object.defineProperty(window, 'parent', {
      get: function () { return window; }
    });
  } catch (e) {}

  // Bloquear history manipulation desde contextos no autorizados
  const _pushState = history.pushState.bind(history);
  const _replaceState = history.replaceState.bind(history);
  history.pushState = function (...args) {
    if (!_isTrustedContext()) return;
    return _pushState(...args);
  };
  history.replaceState = function (...args) {
    if (!_isTrustedContext()) return;
    return _replaceState(...args);
  };

  function _isUserAction() {
    const el = document.activeElement;
    if (!el) return false;
    return el.classList.contains('btn-play') ||
           el.classList.contains('overlay-play') ||
           el.classList.contains('btn') ||
           el.closest?.('.modal-content') !== null;
  }

  function _isTrustedContext() {
    const el = document.activeElement;
    return el && el.tagName !== 'IFRAME' && el.tagName !== 'BODY';
  }

  // ════════════════════════════════════════════
  // 3. BLOQUEO DE EVENTOS DE CLICK NO DESEADOS
  // ════════════════════════════════════════════
  document.addEventListener('click', function (e) {
    const anchor = e.target.closest('a');
    if (!anchor) return;

    const href = anchor.getAttribute('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('javascript:void')) return;

    const isInternal = href.startsWith(window.location.origin) ||
                       href.startsWith('/') ||
                       href === '#';
    
    const isAllowed = ALLOWED_EMBED_DOMAINS.some(d => href.includes(d));

    if (!isInternal && !isAllowed) {
      e.preventDefault();
      e.stopImmediatePropagation();
      console.warn('[AdBlock] Click externo bloqueado:', href);
    }
  }, true);

  // Bloquear clicks que usen setTimeout para esquivar el bloqueador
  const _setTimeout = window.setTimeout;
  window.setTimeout = function (fn, delay, ...args) {
    // Bloquear timeouts muy cortos de redirección (truco común en DoodStream)
    if (typeof fn === 'string' && fn.includes('location')) {
      console.warn('[AdBlock] setTimeout con redirección bloqueado');
      return 0;
    }
    return _setTimeout.call(window, fn, delay, ...args);
  };

  // ════════════════════════════════════════════
  // 4. BLOQUEO DE INYECCIÓN DE SCRIPTS Y IFRAMES DE ADS
  // ════════════════════════════════════════════
  function isAdSource(src) {
    if (!src) return false;
    return AD_DOMAINS.some(d => src.includes(d));
  }

  const _appendChild = Element.prototype.appendChild;
  Element.prototype.appendChild = function (node) {
    if (node.nodeType === 1) {
      const src = node.src || node.href || '';
      if ((node.tagName === 'SCRIPT' || node.tagName === 'IFRAME' || node.tagName === 'LINK') && isAdSource(src)) {
        console.warn('[AdBlock] Elemento ad bloqueado (appendChild):', src);
        return node;
      }
    }
    return _appendChild.call(this, node);
  };

  const _insertBefore = Element.prototype.insertBefore;
  Element.prototype.insertBefore = function (node, ref) {
    if (node.nodeType === 1) {
      const src = node.src || node.href || '';
      if ((node.tagName === 'SCRIPT' || node.tagName === 'IFRAME') && isAdSource(src)) {
        console.warn('[AdBlock] Elemento ad bloqueado (insertBefore):', src);
        return node;
      }
    }
    return _insertBefore.call(this, node, ref);
  };

  // ════════════════════════════════════════════
  // 5. MUTATION OBSERVER - ELIMINA OVERLAYS Y POPUPS INYECTADOS
  // ════════════════════════════════════════════
  const PROTECTED_IDS = ['videoModal', 'searchEmpty', 'mainHeader', 'mainBanner'];
  const PROTECTED_CLASSES = ['modal', 'search-empty', 'header', 'banner', 'movie', 'carousel-section', 'content-area'];

  const observer = new MutationObserver((mutations) => {
    mutations.forEach(({ addedNodes }) => {
      addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;

        // Saltar elementos protegidos del sitio
        if (PROTECTED_IDS.includes(node.id)) return;
        if (PROTECTED_CLASSES.some(c => node.classList?.contains(c))) return;

        const style = node.style || {};
        const computed = window.getComputedStyle(node);

        const isFixedOverlay = (
          style.position === 'fixed' || computed.position === 'fixed' ||
          style.position === 'absolute' || computed.position === 'absolute'
        ) && (
          parseInt(style.zIndex || computed.zIndex) > 1000
        );

        const looksLikeAd = (
          (node.src && isAdSource(node.src)) ||
          node.id?.match(/ad|pop|overlay|banner/i) ||
          node.className?.match?.(/ad|pop|overlay|sponsor/i) ||
          (node.tagName === 'IFRAME' && !ALLOWED_EMBED_DOMAINS.some(d => (node.src || '').includes(d)))
        );

        if (isFixedOverlay || looksLikeAd) {
          node.remove();
          console.warn('[AdBlock] Nodo sospechoso eliminado:', node.tagName, node.id || node.className);
        }
      });
    });
  });

  // Iniciar observer cuando el DOM esté listo
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    });
  }

  // ════════════════════════════════════════════
  // 6. SANDBOX EN IFRAMES - SOLO AL ABRIRLOS EN EL MODAL
  //    Agrega restricciones al iframe del modal
  // ════════════════════════════════════════════
  document.addEventListener('DOMContentLoaded', () => {
    const videoPlayer = document.getElementById('videoPlayer');
    if (videoPlayer) {
      // allow-scripts: necesario para reproducir el video
      // allow-same-origin: necesario para DoodStream
      // NO se incluye allow-popups ni allow-top-navigation
      videoPlayer.setAttribute('sandbox',
        'allow-scripts allow-same-origin allow-forms allow-presentation'
      );
      videoPlayer.setAttribute('referrerpolicy', 'no-referrer');
      videoPlayer.setAttribute('loading', 'lazy');
    }
  });

  console.log('[AdBlock] Poporopo AdBlock v2.0 activo ✓');

})();

});
