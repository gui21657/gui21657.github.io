/* ============================================================
   POPOROPO — SCRIPT.JS
   Optimizado para Smart TVs LG (WebOS) viejas + móvil + desktop
   ============================================================
   Cambios clave para TV (activos solo si IS_TV === true):
   - Imágenes 55% más pequeñas (w154 en vez de w342)
   - Backdrops 75% menos pesados (w780 en vez de original)
   - Solo se carga 1 carrusel a la vez al hacer scroll
   - Las imágenes fuera de la pantalla se DESCARGAN de memoria
   - Sin animaciones de hover (las controla el CSS .tv-mode)
   - Auto-focus en primera card al cargar (control remoto listo)
   - Flechas izq/der dentro del carrusel, arriba/abajo entre carruseles
   - Auto-scroll suave del carrusel cuando el foco sale del viewport
   - El carrusel carga más cards solo cuando el foco se acerca al final
   ============================================================ */

   (function () {
    'use strict';
  
    /* ============================================================
       A. DETECCIÓN DE PLATAFORMA
       ============================================================ */
    const IS_TV = !!window.__IS_TV__;
  
    // Forzar sin TV: ?tv=0   |   Forzar TV: ?tv=1
    if (IS_TV) {
      document.documentElement.classList.add('tv-mode');
    }
  
    /* ============================================================
       B. TMDB CLIENT
       ============================================================ */
    const TMDB_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI1ZjQxZTE2MzE2ZjE0NTIxMjJmZTRkMmMxMjM0YjA2OCIsIm5iZiI6MTc3ODAyNTg0MS45MTIsInN1YiI6IjY5ZmE4NTcxNzk1ZGNmMzY2NDFkMmI2OCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.VMAdawqdcOr-KzZ1LzBxJIV1bqujwEnIyXUj6lqrcYo';
    const TMDB_API = 'https://api.themoviedb.org/3';
    const TMDB_IMG = 'https://image.tmdb.org/t/p';
    const LANG = 'es-ES';
    const REGION = 'GT';
  
    // Imágenes mucho más pequeñas en TV: ahorro de RAM enorme
    const POSTER_SIZE   = IS_TV ? 'w154' : 'w342';
    const BACKDROP_SIZE = IS_TV ? 'w780' : 'original';
  
    // En TV cargamos menos items por página, así el DOM no crece tanto
    const MAX_PAGES_PER_GENRE = IS_TV ? 1 : 99; // casi sin tope en escritorio
    const MAX_GENRES_VISIBLE  = IS_TV ? 6  : 16; // resto se carga a demanda
  
    const GENRES_FULL = [
      { id: 28,    name: 'Acción' },
      { id: 12,    name: 'Aventura' },
      { id: 16,    name: 'Animación' },
      { id: 35,    name: 'Comedia' },
      { id: 80,    name: 'Crimen' },
      { id: 99,    name: 'Documental' },
      { id: 18,    name: 'Drama' },
      { id: 10751, name: 'Familia' },
      { id: 14,    name: 'Fantasía' },
      { id: 27,    name: 'Terror' },
      { id: 9648,  name: 'Misterio' },
      { id: 10749, name: 'Romance' },
      { id: 878,   name: 'Ciencia ficción' },
      { id: 53,    name: 'Suspense' },
      { id: 10752, name: 'Bélica' },
      { id: 36,    name: 'Historia' }
    ];
  
    const GENRES = IS_TV ? GENRES_FULL.slice(0, MAX_GENRES_VISIBLE) : GENRES_FULL;
  
    async function tmdb(path, params = {}, options = {}) {
      const url = new URL(TMDB_API + path);
      url.searchParams.set('language', LANG);
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
      }
      const res = await fetch(url.toString(), {
        signal: options.signal,
        headers: {
          'Authorization': `Bearer ${TMDB_ACCESS_TOKEN}`,
          'Content-Type': 'application/json;charset=utf-8'
        }
      });
      if (!res.ok) throw new Error('TMDB ' + res.status);
      return res.json();
    }
  
    const posterUrl   = (p, size = POSTER_SIZE)   => p ? `${TMDB_IMG}/${size}${p}` : '';
    const backdropUrl = (p, size = BACKDROP_SIZE) => p ? `${TMDB_IMG}/${size}${p}` : '';
  
    const PLACEHOLDER_POSTER =
      'data:image/svg+xml;utf8,' + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 240">
          <rect width="160" height="240" fill="#222"/>
          <text x="50%" y="50%" font-family="sans-serif" font-size="14" fill="#666"
            text-anchor="middle" dominant-baseline="middle">Sin póster</text>
        </svg>`
      );
  
    /* ============================================================
       C. EMBED SERVERS
       ============================================================ */
    const EMBED_SERVERS = [
      {
        name: 'Vidsrc.pm',
        short: '1',
        url: (id, type, season, episode) => {
          if (type === 'tv' && season !== undefined && episode !== undefined) {
            return `https://vidsrc.pm/embed/tv/${id}/${season}/${episode}`;
          }
          return `https://vidsrc.pm/embed/${type}/${id}`;
        }
      },
      {
        name: 'Vidsrc.me',
        short: '2',
        url: (id, type, season, episode) => {
          if (type === 'tv' && season !== undefined && episode !== undefined) {
            return `https://vidsrc.me/embed/tv/${id}/${season}/${episode}`;
          }
          return `https://vidsrc.me/embed/${type}/${id}`;
        }
      }
    ];
  
    /* ============================================================
       D. MAIN
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
      function showToast(msg, ms = 2400) {
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
         MODALES
         ──────────────────────────────────────────────── */
      const videoModal      = $('#videoModal');
      const videoPlayer     = $('#videoPlayer');
      const closeVideo      = $('#closeModal');
      const videoBack       = videoModal.querySelector('.modal-backdrop');
      const playerSpin      = $('#playerSpinner');
      const adBlocker       = $('#adClickBlocker');
  
      const serverBar       = $('#serverBar');
      const serverContainer = $('#serverButtonsContainer');
      const seasonSelector  = $('#seasonEpisodeSelector');
      const seasonSelect    = $('#seasonSelect');
      const episodeSelect   = $('#episodeSelect');
  
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
  
      let currentMediaId   = null;
      let currentMediaType = 'movie';
      let currentServerIndex = 0;
      let currentSeason  = 1;
      let currentEpisode = 1;
      const modalStack = [];
  
      /* ── Botones de servidores ── */
      if (serverContainer) {
        serverContainer.innerHTML = '';
        EMBED_SERVERS.forEach((srv, idx) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'server-btn';
          btn.dataset.server = idx;
          btn.setAttribute('role', 'tab');
          btn.setAttribute('aria-selected', 'false');
          btn.setAttribute('aria-label', srv.name);
          btn.title = srv.name;
          btn.textContent = srv.short;
          serverContainer.appendChild(btn);
        });
      }
  
      const getServerButtons = () => $$('.server-btn', videoModal);
  
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
  
      /* ────────────────────────────────────────────────
         CARGA DE SERVIDOR
         ──────────────────────────────────────────────── */
      function loadServer(serverIndex) {
        if (!currentMediaId || serverIndex < 0 || serverIndex >= EMBED_SERVERS.length) return;
        currentServerIndex = serverIndex;
  
        if (currentMediaType === 'movie') {
          updateServerSelectorUI();
        }
  
        if (playerSpin) playerSpin.classList.remove('is-hidden');
        const embedUrl = EMBED_SERVERS[serverIndex].url(
          currentMediaId,
          currentMediaType,
          currentMediaType === 'tv' ? currentSeason  : undefined,
          currentMediaType === 'tv' ? currentEpisode : undefined
        );
        videoPlayer.src = embedUrl;
      }
  
      function updateServerSelectorUI() {
        getServerButtons().forEach(btn => {
          const idx = Number(btn.dataset.server);
          const isActive = idx === currentServerIndex;
          btn.classList.toggle('is-active', isActive);
          btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
          btn.title = EMBED_SERVERS[idx].name;
        });
      }
  
      serverContainer?.addEventListener('click', (e) => {
        const btn = e.target.closest('.server-btn');
        if (!btn) return;
        const idx = Number(btn.dataset.server);
        if (idx === currentServerIndex || !currentMediaId) return;
        showToast(`Cambiando a ${EMBED_SERVERS[idx].name}…`, 1500);
        loadServer(idx);
      });
  
      videoPlayer.addEventListener('load', () => {
        if (videoPlayer.src && playerSpin) playerSpin.classList.add('is-hidden');
      });
  
      /* ── Abrir modal de video ── */
      function openVideoModal(mediaId, mediaType, opener) {
        currentMediaId = mediaId;
        currentMediaType = mediaType;
        currentServerIndex = 0;
        currentSeason  = 1;
        currentEpisode = 1;
  
        if (adBlocker) adBlocker.classList.add('is-active');
        openModal(videoModal, opener);
  
        if (mediaType === 'tv') {
          serverBar.hidden = true;
          seasonSelector.hidden = false;
          loadSeasonData(mediaId);
        } else {
          serverBar.hidden = false;
          seasonSelector.hidden = true;
          loadServer(0);
        }
      }
  
      function closeVideoModal() {
        videoPlayer.src = '';
        if (adBlocker) adBlocker.classList.remove('is-active');
        if (playerSpin) playerSpin.classList.remove('is-hidden');
        currentMediaId = null;
        closeModalEl(videoModal);
      }
  
      closeVideo.addEventListener('click', closeVideoModal);
      videoBack.addEventListener('click', closeVideoModal);
  
      /* ── Temporadas / episodios ── */
      async function loadSeasonData(seriesId) {
        try {
          const data = await tmdb(`/tv/${seriesId}`);
          const seasons = data.seasons
            ? data.seasons.filter(s => s.season_number > 0)
            : [];
  
          seasonSelect.innerHTML = '';
          if (seasons.length === 0) {
            seasonSelect.innerHTML = '<option value="1">Temporada 1</option>';
            populateEpisodes(seriesId, 1);
            return;
          }
  
          seasons.forEach(season => {
            const option = document.createElement('option');
            option.value = season.season_number;
            option.textContent = `Temporada ${season.season_number}`;
            seasonSelect.appendChild(option);
          });
  
          const defaultSeason = seasons[0].season_number;
          currentSeason = defaultSeason;
          seasonSelect.value = defaultSeason;
          populateEpisodes(seriesId, defaultSeason);
        } catch (err) {
          console.error('Error cargando temporadas:', err);
          seasonSelect.innerHTML = '<option value="1">Temporada 1</option>';
          populateEpisodes(seriesId, 1);
        }
      }
  
      async function populateEpisodes(seriesId, seasonNumber) {
        try {
          const data = await tmdb(`/tv/${seriesId}/season/${seasonNumber}`);
          const episodes = data.episodes || [];
  
          episodeSelect.innerHTML = '';
          episodes.forEach(ep => {
            const option = document.createElement('option');
            option.value = ep.episode_number;
            option.textContent = `Episodio ${ep.episode_number}: ${ep.name || 'Sin título'}`;
            episodeSelect.appendChild(option);
          });
  
          if (episodes.length > 0) {
            currentEpisode = episodes[0].episode_number;
            episodeSelect.value = currentEpisode;
          } else {
            currentEpisode = 1;
          }
  
          loadServer(currentServerIndex);
        } catch (err) {
          console.error('Error cargando episodios:', err);
          episodeSelect.innerHTML = '<option value="1">Episodio 1</option>';
          currentEpisode = 1;
          loadServer(currentServerIndex);
        }
      }
  
      seasonSelect.addEventListener('change', () => {
        currentSeason = Number(seasonSelect.value);
        populateEpisodes(currentMediaId, currentSeason);
      });
  
      episodeSelect.addEventListener('change', () => {
        currentEpisode = Number(episodeSelect.value);
        loadServer(currentServerIndex);
      });
  
      /* ── Info modal ── */
      async function openInfoModal(mediaId, mediaType, opener) {
        infoTitleEl.textContent = 'Cargando…';
        infoYearEl.textContent = '';
        infoDurationEl.textContent = '';
        infoGenreEl.textContent = '';
        infoRatingEl.textContent = '';
        infoDescEl.textContent = '';
        infoBackdropEl.style.backgroundImage = '';
        infoPlayBtn.dataset.mediaId   = mediaId;
        infoPlayBtn.dataset.mediaType = mediaType;
  
        openModal(infoModal, opener);
  
        try {
          const endpoint = mediaType === 'movie' ? `/movie/${mediaId}` : `/tv/${mediaId}`;
          const data = await tmdb(endpoint);
          const title = data.title || data.name || '';
          infoTitleEl.textContent = title || data.original_title || data.original_name || '';
          const year = (data.release_date || data.first_air_date || '').slice(0, 4);
          infoYearEl.textContent = year ? `· ${year}` : '';
  
          if (mediaType === 'movie') {
            const h = Math.floor((data.runtime || 0) / 60);
            const m = (data.runtime || 0) % 60;
            infoDurationEl.textContent = data.runtime ? `· ${h}h ${m}m` : '';
          } else {
            infoDurationEl.textContent = data.number_of_seasons
              ? `· ${data.number_of_seasons} temporada(s)`
              : '';
          }
  
          infoGenreEl.textContent = data.genres?.length
            ? `· ${data.genres.map(g => g.name).join(', ')}`
            : '';
          infoRatingEl.textContent = data.vote_average
            ? `· ★ ${data.vote_average.toFixed(1)}`
            : '';
          infoDescEl.textContent = data.overview || 'Sin descripción disponible.';
          if (data.backdrop_path) {
            infoBackdropEl.style.backgroundImage = `url('${backdropUrl(data.backdrop_path)}')`;
          }
        } catch (err) {
          console.error('Info error:', err);
          infoTitleEl.textContent = 'Error al cargar';
          infoDescEl.textContent = 'No se pudo obtener la información. Intenta de nuevo.';
        }
      }
  
      function closeInfoModal() { closeModalEl(infoModal); }
  
      closeInfoBtn.addEventListener('click', closeInfoModal);
      infoBack.addEventListener('click', closeInfoModal);
  
      infoPlayBtn.addEventListener('click', () => {
        const id = infoPlayBtn.dataset.mediaId;
        const type = infoPlayBtn.dataset.mediaType;
        if (!id) { showToast('Próximamente'); return; }
        const opener = modalStack[modalStack.length - 1]?.opener;
        closeInfoModal();
        openVideoModal(id, type, opener);
      });
  
      /* ────────────────────────────────────────────────
         GESTIÓN DE MEMORIA DE IMÁGENES (TV)
         ──────────────────────────────────────────────── */
      /* En TV descargamos las imágenes que están muy lejos del viewport.
         Esto es lo que más ahorra RAM en LG WebOS antiguo. */
      let imageMemObserver = null;
  
      function setupImageMemoryManagement() {
        if (!IS_TV) return;
        if (!('IntersectionObserver' in window)) return;
  
        imageMemObserver = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            const img = entry.target;
            if (entry.isIntersecting) {
              // Volvió al viewport: restaurar src si lo habíamos sacado
              const real = img.getAttribute('data-real-src');
              if (real && (img.src.startsWith('data:') || !img.src.includes(real.slice(-30)))) {
                img.src = real;
              }
            } else {
              // Si sigue fuera y muy lejos, descargar
              const real = img.getAttribute('data-real-src');
              if (real && !img.src.startsWith('data:')) {
                img.src = PLACEHOLDER_POSTER;
              }
            }
          }
        }, {
          rootMargin: '600px 200px 600px 200px',
          threshold: 0
        });
      }
  
      function registerImageForMemory(img, realSrc) {
        if (!IS_TV || !imageMemObserver || !realSrc) return;
        img.setAttribute('data-real-src', realSrc);
        imageMemObserver.observe(img);
      }
  
      /* ────────────────────────────────────────────────
         CARDS
         ──────────────────────────────────────────────── */
      function createCard(item) {
        const title = item.title || item.name || item.original_title || item.original_name || '';
        const year  = (item.release_date || item.first_air_date || '').slice(0, 4);
        const type  = item._type;
  
        const card = document.createElement('div');
        card.className = 'movie';
        card.setAttribute('role', 'button');
        card.tabIndex = 0;
        card.dataset.mediaId   = item.id;
        card.dataset.mediaType = type;
        card.dataset.title     = title;
        card.setAttribute('aria-label', `Reproducir ${title}`);
  
        const img = document.createElement('img');
        img.alt = `Póster de ${title}`;
        img.loading = 'lazy';
        // Quitamos decoding="async" en TV: en webkits viejos puede causar leaks
        if (!IS_TV) img.decoding = 'async';
        img.width = 160; img.height = 240;
        const realSrc = posterUrl(item.poster_path);
        img.src = realSrc || PLACEHOLDER_POSTER;
        img.onerror = () => { img.src = PLACEHOLDER_POSTER; };
        card.appendChild(img);
  
        // Registrar para gestión de memoria en TV
        registerImageForMemory(img, realSrc);
  
        // Botón de info: solo en NO-TV (en TV se accede con tecla "i" si se quiere)
        if (!IS_TV) {
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
  
          infoBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            openInfoModal(item.id, type, infoBtn);
          });
          infoBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
          });
        }
  
        // Overlay solo en NO-TV (en TV se quita por CSS y aquí no lo creamos)
        if (!IS_TV) {
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
        }
  
        const activate = () => openVideoModal(item.id, type, card);
        const showInfo = (opener) => openInfoModal(item.id, type, opener || card);
  
        card.addEventListener('click', activate);
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
          if (e.key === 'i' || e.key === 'I')     { e.preventDefault(); showInfo(card); }
        });
        if (!IS_TV) {
          card.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showInfo(card);
          });
        }
  
        return card;
      }
  
      /* ────────────────────────────────────────────────
         CARRUSELES
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
            <button type="button" class="scroll-btn scroll-left" aria-label="Anterior" tabindex="-1">
              <svg class="scroll-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <div class="movies"></div>
            <button type="button" class="scroll-btn scroll-right" aria-label="Siguiente" tabindex="-1">
              <svg class="scroll-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>`;
  
        const list     = section.querySelector('.movies');
        const wrapper  = section.querySelector('.carousel-wrapper');
        const btnLeft  = section.querySelector('.scroll-left');
        const btnRight = section.querySelector('.scroll-right');
  
        const loader = document.createElement('div');
        loader.className = 'carousel-loader';
        loader.innerHTML = '<div class="carousel-loader-ring"></div>';
        loader.hidden = true;
  
        // En TV: menos skeletons (4 vs 8) para no abusar
        const skCount = IS_TV ? 4 : 8;
        for (let i = 0; i < skCount; i++) {
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
  
        const initCarousel = async () => {
          if (state.initialized) return;
          state.initialized = true;
          await loadMoreCarousel(state, true);
          list.querySelectorAll('.movie-skeleton').forEach(n => n.remove());
          list.appendChild(loader);
          loader.hidden = true;
          initCarouselUI(state);
        };
  
        // En TV usamos un margen mucho más estricto para no cargar de más
        const observerMargin = IS_TV ? '100px' : '200px';
  
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              initCarousel();
              observer.unobserve(section);
            }
          });
        }, { rootMargin: observerMargin });
  
        observer.observe(section);
  
        // Si es uno de los primeros 2 carruseles, lo cargamos ya (mejor UX inicial)
        if (genre._eager) {
          initCarousel();
        }
  
        return section;
      }
  
      async function loadMoreCarousel(state, isFirst = false) {
        if (state.loading || state.exhausted) return;
        if (state.page > MAX_PAGES_PER_GENRE) { state.exhausted = true; return; }
        state.loading = true;
        if (state.loader && !isFirst) state.loader.hidden = false;
  
        try {
          const [movieData, tvData] = await Promise.all([
            tmdb('/discover/movie', {
              with_genres: state.genreId,
              page: state.page,
              sort_by: 'popularity.desc',
              'vote_count.gte': 30,
              region: REGION,
            }),
            tmdb('/discover/tv', {
              with_genres: state.genreId,
              page: state.page,
              sort_by: 'popularity.desc',
              'vote_count.gte': 30,
              region: REGION,
            })
          ]);
  
          let items = [];
          if (movieData.results) {
            items.push(...movieData.results.map(m => ({ ...m, _type: 'movie' })));
          }
          if (tvData.results) {
            items.push(...tvData.results.map(t => ({ ...t, _type: 'tv' })));
          }
          items.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  
          // En TV limitamos a 16 items por carrusel: suficiente y ligero
          if (IS_TV) items = items.slice(0, 16);
  
          const results = items.filter(item => item.poster_path);
  
          for (const item of results) {
            const key = `${item.id}|${item._type}`;
            if (!state.seen.has(key)) {
              state.seen.add(key);
              const card = createCard(item);
              if (state.loader && state.loader.parentNode === state.list) {
                state.list.insertBefore(card, state.loader);
              } else {
                state.list.appendChild(card);
              }
            }
          }
  
          const movieExhausted = movieData.page >= movieData.total_pages || !movieData.results?.length;
          const tvExhausted    = tvData.page    >= tvData.total_pages    || !tvData.results?.length;
          if (movieExhausted && tvExhausted) {
            state.exhausted = true;
          } else {
            state.page++;
            if (state.page > MAX_PAGES_PER_GENRE) state.exhausted = true;
          }
  
          if (state.exhausted && state.loader) state.loader.hidden = true;
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
          const visibleCount = window.innerWidth < 768 ? 3 : (IS_TV ? 4 : 6);
          return (card.offsetWidth + gap) * visibleCount;
        };
  
        const setDisabled = (btn, disabled) => {
          btn.disabled = disabled;
          btn.setAttribute('aria-hidden', disabled ? 'true' : 'false');
          btn.tabIndex = -1; // Nunca son tab-stop, ni en TV
        };
  
        const updateUI = () => {
          const canLeft = list.scrollLeft > 0;
          const atRightEnd = list.scrollLeft >= list.scrollWidth - list.clientWidth - 1;
          const canRight = !atRightEnd || !state.exhausted;
  
          setDisabled(btnLeft,  !canLeft);
          setDisabled(btnRight, !canRight);
  
          let overflow = 'none';
          if (canLeft && canRight) overflow = 'both';
          else if (canRight)       overflow = 'right';
          else if (canLeft)        overflow = 'left';
          wrapper.setAttribute('data-overflow', overflow);
  
          const remaining = list.scrollWidth - list.scrollLeft - list.clientWidth;
          if (remaining < 800 && !state.loading && !state.exhausted) {
            loadMoreCarousel(state).then(updateUI);
          }
        };
  
        btnLeft.addEventListener('click', () =>
          list.scrollBy({ left: -getScrollAmount(), behavior: IS_TV ? 'auto' : 'smooth' })
        );
        btnRight.addEventListener('click', () => {
          list.scrollBy({ left: getScrollAmount(), behavior: IS_TV ? 'auto' : 'smooth' });
          if (!state.exhausted) loadMoreCarousel(state).then(updateUI);
        });
  
        let ticking = false;
        list.addEventListener('scroll', () => {
          if (ticking) return;
          ticking = true;
          requestAnimationFrame(() => { updateUI(); ticking = false; });
        }, { passive: true });
  
        window.addEventListener('resize', updateUI);
        // Solo usamos ResizeObserver en NO-TV (en TVs viejas puede causar overhead)
        if (!IS_TV && 'ResizeObserver' in window) {
          new ResizeObserver(updateUI).observe(list);
        }
  
        updateUI();
      }
  
      function buildCatalog() {
        const catalog = $('#catalog');
        catalog.innerHTML = '';
        // Primeros 2 géneros: carga inmediata (mejor UX inicial)
        GENRES.forEach((genre, i) => {
          const g = { ...genre, _eager: i < 2 };
          catalog.appendChild(createCarouselSection(g));
        });
      }
  
      /* ────────────────────────────────────────────────
         BANNER
         ──────────────────────────────────────────────── */
      async function initBanner() {
        const banner   = $('#mainBanner');
        const content  = $('#bannerContent');
        const titleEl  = $('#bannerTitle');
        const descEl   = $('#bannerDesc');
        const metaEl   = $('#bannerMeta');
        const playBtn  = $('#bannerPlayBtn');
        const infoBtn  = $('#bannerInfoBtn');
  
        try {
          const data = await tmdb('/trending/all/week');
          const item = (data.results || []).find(i =>
            i.backdrop_path && i.overview && i.poster_path && i.media_type !== 'person'
          );
          if (!item) return;
  
          const title = item.title || item.name || '';
          banner.style.backgroundImage = `url('${backdropUrl(item.backdrop_path)}')`;
          titleEl.textContent = title;
          descEl.textContent  = item.overview || '';
  
          const year = (item.release_date || item.first_air_date || '').slice(0, 4);
          metaEl.innerHTML = `
            <span class="badge badge-hd">HD</span>
            ${year ? `<span class="badge">${escapeHtml(year)}</span>` : ''}
            ${item.vote_average ? `<span class="badge">★ ${item.vote_average.toFixed(1)}</span>` : ''}
            <span class="badge">Tendencia</span>
          `;
  
          playBtn.dataset.mediaId   = item.id;
          playBtn.dataset.mediaType = item.media_type;
          infoBtn.dataset.mediaId   = item.id;
          infoBtn.dataset.mediaType = item.media_type;
  
          playBtn.addEventListener('click', () =>
            openVideoModal(item.id, item.media_type, playBtn)
          );
          infoBtn.addEventListener('click', () =>
            openInfoModal(item.id, item.media_type, infoBtn)
          );
  
          content.hidden = false;
        } catch (err) {
          console.error('Banner error:', err);
          content.hidden = false;
          titleEl.textContent = 'POPOROPO';
          descEl.textContent  = 'Películas y series gratis en HD.';
        }
      }
  
      /* ────────────────────────────────────────────────
         BÚSQUEDA
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
        window.scrollTo({ top: 0, behavior: IS_TV ? 'auto' : 'smooth' });
  
        if (searchAbort) searchAbort.abort();
        searchAbort = new AbortController();
  
        try {
          const data = await tmdb('/search/multi', {
            query,
            include_adult: 'false',
            page: '1',
          }, { signal: searchAbort.signal });
  
          let results = (data.results || [])
            .filter(item => item.media_type !== 'person' && item.poster_path)
            .map(item => ({ ...item, _type: item.media_type }));
  
          // En TV limitamos a 30 resultados de búsqueda (suficiente)
          if (IS_TV) results = results.slice(0, 30);
  
          searchGrid.innerHTML = '';
          if (results.length === 0) {
            searchTermEl.textContent = query;
            emptyMsg.hidden = false;
          } else {
            const frag = document.createDocumentFragment();
            results.forEach(item => frag.appendChild(createCard(item)));
            searchGrid.appendChild(frag);
            // Foco en el primer resultado para TV
            if (IS_TV) {
              const firstCard = searchGrid.querySelector('.movie');
              if (firstCard) setTimeout(() => firstCard.focus(), 100);
            }
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
         NAVEGACIÓN CON FLECHAS — modo control remoto
         ────────────────────────────────────────────────
         En TV mejoramos:
         - Auto-foco en la primera card al cargar
         - Flechas izq/der: dentro del carrusel, con auto-scroll
         - Flechas arriba/abajo: cambia de carrusel,
           intenta mantener la posición horizontal
         - Si el foco llega cerca del final, dispara carga de más
         - Backspace / tecla "Atrás" del control: cierra modal
         ──────────────────────────────────────────────── */
  
      function scrollCardIntoView(card) {
        if (!card) return;
        const carousel = card.parentElement;
        if (!carousel || !carousel.classList.contains('movies')) {
          // Probablemente está en el grid de búsqueda; scroll vertical normal
          card.scrollIntoView({ behavior: IS_TV ? 'auto' : 'smooth', block: 'center', inline: 'nearest' });
          return;
        }
        const cRect = carousel.getBoundingClientRect();
        const rRect = card.getBoundingClientRect();
        const PAD = 80;
  
        let targetScroll = carousel.scrollLeft;
        if (rRect.left < cRect.left + PAD) {
          targetScroll = carousel.scrollLeft - (cRect.left + PAD - rRect.left);
        } else if (rRect.right > cRect.right - PAD) {
          targetScroll = carousel.scrollLeft + (rRect.right - (cRect.right - PAD));
        }
  
        if (targetScroll !== carousel.scrollLeft) {
          carousel.scrollTo({ left: targetScroll, behavior: IS_TV ? 'auto' : 'smooth' });
        }
  
        // Vertical: asegurar que la card se ve completa
        const winH = window.innerHeight;
        if (rRect.top < 80 || rRect.bottom > winH - 60) {
          const y = window.scrollY + rRect.top - (winH * 0.35);
          window.scrollTo({ top: Math.max(0, y), behavior: IS_TV ? 'auto' : 'smooth' });
        }
      }
  
      function focusCard(card) {
        if (!card) return;
        try { card.focus({ preventScroll: true }); }
        catch (e) { card.focus(); }
        scrollCardIntoView(card);
      }
  
      function getCarouselOfCard(card) {
        return card?.closest('.carousel-section') || null;
      }
  
      function findClosestCardByLeft(carousel, refLeft) {
        if (!carousel) return null;
        const cards = [...carousel.querySelectorAll('.movie')];
        if (cards.length === 0) return null;
        let best = cards[0];
        let bestDiff = Infinity;
        for (const c of cards) {
          const r = c.getBoundingClientRect();
          const diff = Math.abs(r.left - refLeft);
          if (diff < bestDiff) { bestDiff = diff; best = c; }
        }
        return best;
      }
  
      function maybeLoadMoreInCarousel(card) {
        // Si estamos cerca del final del carrusel, cargar más
        const section = card?.closest('.carousel-section');
        if (!section) return;
        const list = section.querySelector('.movies');
        if (!list) return;
        const remaining = list.scrollWidth - list.scrollLeft - list.clientWidth;
        if (remaining < 800) {
          // El propio listener de scroll lo dispara; aquí forzamos un nudge
          list.dispatchEvent(new Event('scroll'));
        }
      }
  
      document.addEventListener('keydown', (e) => {
        // Manejar tab-trap dentro de modales abiertos
        if (modalStack.length && e.key === 'Tab') {
          trapTab(modalStack[modalStack.length - 1].el, e);
          return;
        }
  
        // ESC / Backspace / Atrás del control remoto: cerrar modal
        const backKeys = ['Escape', 'Back', 'BrowserBack', 'GoBack', 'XF86Back'];
        if (backKeys.includes(e.key)) {
          if (modalStack.length) {
            const top = modalStack[modalStack.length - 1].el;
            if (top === videoModal) closeVideoModal();
            else closeModalEl(top);
            e.preventDefault();
          } else if (searchBar && searchBar.value) {
            clearSearch();
            e.preventDefault();
          }
          return;
        }
  
        if (modalStack.length > 0) return;
        const active = document.activeElement;
        if (!active) return;
  
        // Si el foco está en input de búsqueda, no manejar flechas
        if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT') {
          return;
        }
  
        // Solo manejamos flechas si el foco está en una card
        if (!active.classList || !active.classList.contains('movie')) return;
  
        const refLeft = active.getBoundingClientRect().left;
        let target = null;
        let preventDefault = true;
  
        if (e.key === 'ArrowRight') {
          target = active.nextElementSibling;
          while (target && !target.classList.contains('movie')) target = target.nextElementSibling;
          if (target) maybeLoadMoreInCarousel(active);
  
        } else if (e.key === 'ArrowLeft') {
          target = active.previousElementSibling;
          while (target && !target.classList.contains('movie')) target = target.previousElementSibling;
  
        } else if (e.key === 'ArrowDown') {
          const inGrid = active.closest('.search-grid');
          if (inGrid) {
            const rect = active.getBoundingClientRect();
            const candidates = [...inGrid.querySelectorAll('.movie')];
            target = candidates.find(c => {
              const r = c.getBoundingClientRect();
              return r.top > rect.bottom - 5 &&
                     Math.abs(r.left - rect.left) < rect.width / 2;
            });
          } else {
            // Buscar el siguiente carrusel y enfocar la card más cercana horizontalmente
            const section = active.closest('.carousel-section');
            let next = section?.nextElementSibling;
            while (next && !next.classList.contains('carousel-section')) next = next.nextElementSibling;
            if (next) target = findClosestCardByLeft(next, refLeft);
          }
  
        } else if (e.key === 'ArrowUp') {
          const inGrid = active.closest('.search-grid');
          if (inGrid) {
            const rect = active.getBoundingClientRect();
            const candidates = [...inGrid.querySelectorAll('.movie')].reverse();
            target = candidates.find(c => {
              const r = c.getBoundingClientRect();
              return r.bottom < rect.top + 5 &&
                     Math.abs(r.left - rect.left) < rect.width / 2;
            });
          } else {
            const section = active.closest('.carousel-section');
            let prev = section?.previousElementSibling;
            while (prev && !prev.classList.contains('carousel-section')) prev = prev.previousElementSibling;
            if (prev) target = findClosestCardByLeft(prev, refLeft);
            // Si no hay carrusel arriba, foco al input de búsqueda
            if (!target) target = searchBar;
          }
  
        } else {
          preventDefault = false;
        }
  
        if (preventDefault && target) {
          e.preventDefault();
          if (target === searchBar) {
            searchBar.focus();
            window.scrollTo({ top: 0, behavior: IS_TV ? 'auto' : 'smooth' });
          } else {
            focusCard(target);
          }
        }
      });
  
      /* ── Auto-foco inicial en TV: primera card visible ── */
      function autoFocusFirstCard() {
        if (!IS_TV) return;
        // Esperar a que el primer carrusel tenga al menos una card
        let attempts = 0;
        const tryFocus = () => {
          attempts++;
          const firstCard = document.querySelector('.carousel-section .movie');
          if (firstCard) {
            focusCard(firstCard);
          } else if (attempts < 30) {
            setTimeout(tryFocus, 250);
          }
        };
        // Esperar un poco para que carguen las primeras cards
        setTimeout(tryFocus, 600);
      }
  
      /* ────────────────────────────────────────────────
         ARRANQUE
         ──────────────────────────────────────────────── */
      setupImageMemoryManagement();
      initBanner();
      buildCatalog();
      autoFocusFirstCard();
  
      // Limpieza periódica en TV: forzar GC liberando referencias
      if (IS_TV) {
        setInterval(() => {
          // Limpiar imágenes muy lejanas que el observer aún no haya descargado
          const imgs = document.querySelectorAll('.movie img[data-real-src]');
          const winH = window.innerHeight;
          imgs.forEach(img => {
            const r = img.getBoundingClientRect();
            // Si la imagen está a más de 3 pantallas de distancia
            if (Math.abs(r.top) > winH * 3 || Math.abs(r.bottom) > winH * 3) {
              if (!img.src.startsWith('data:')) {
                img.src = PLACEHOLDER_POSTER;
              }
            }
          });
        }, 8000);
      }
    });
  
  })();
