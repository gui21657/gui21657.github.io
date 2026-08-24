/* ============================================================
   POPOROPO — SCRIPT.JS
   English UI · Google sign-in · Favorites · Donations · Settings
   Optimized for desktop, mobile, and Smart TV (LG WebOS, Tizen, etc.)
   ============================================================ */

(function () {
  'use strict';

  /* Polyfill para Smart TV antiguas (LG webOS 4 = Chromium 53 no tiene
     String.prototype.padStart). El resto del codigo se transpila a ES5
     compatible en el deploy con esbuild (target chrome53). */
  if (typeof String.prototype.padStart !== 'function') {
    String.prototype.padStart = function (targetLength, padString) {
      targetLength = targetLength >> 0;
      padString = String(typeof padString !== 'undefined' ? padString : ' ');
      if (this.length >= targetLength) return String(this);
      targetLength -= this.length;
      if (targetLength > padString.length) padString = padString.repeat(Math.ceil(targetLength / padString.length));
      return padString.slice(0, targetLength) + String(this);
    };
  }

  /* scrollTo/scrollBy/scrollIntoView con opciones (objeto) requieren
     Chromium 61+; en webOS 4 (Chromium 53) se ignoran en silencio y la
     navegacion con mando se quedaria sin scroll. Se detecta soporte y
     se cae a asignacion directa de scrollLeft/scrollTop. */
  var SCROLL_OPTS_SUPPORTED = 'scrollBehavior' in document.documentElement.style;
  function scrollToOpts(el, opts) {
    if (SCROLL_OPTS_SUPPORTED) { try { el.scrollTo(opts); return; } catch (e) {} }
    if (typeof opts.left === 'number') el.scrollLeft = opts.left;
    if (typeof opts.top === 'number') el.scrollTop = opts.top;
  }
  function scrollByOpts(el, opts) {
    if (SCROLL_OPTS_SUPPORTED) { try { el.scrollBy(opts); return; } catch (e) {} }
    if (typeof opts.left === 'number') el.scrollLeft += opts.left;
    if (typeof opts.top === 'number') el.scrollTop += opts.top;
  }
  function scrollIntoViewOpts(el, opts) {
    if (SCROLL_OPTS_SUPPORTED) { try { el.scrollIntoView(opts); return; } catch (e) {} }
    el.scrollIntoView(true);
  }

  /* ============================================================
     ⚙️  CONFIG
     ============================================================ */
  /* Las claves ya no viven en el código: config.js las recibe del
     workflow de deploy, que a su vez las lee de los GitHub Secrets. */
  const CFG = window.POPOROPO_CONFIG || {};
  const GOOGLE_CLIENT_ID = CFG.GOOGLE_CLIENT_ID || '';

  const PAYPAL_USERNAME = 'Wilfred026';
  const PAYPAL_BASE     = `https://www.paypal.me/${PAYPAL_USERNAME}`;

  /* ============================================================
     A. PLATFORM DETECTION
     ============================================================ */
  const IS_TV = !!window.__IS_TV__;
  if (IS_TV) document.documentElement.classList.add('tv-mode');

  /* ============================================================
     B. TMDB CLIENT
     ============================================================ */
  const TMDB_API_KEY = CFG.TMDB_API_KEY || '';
  const TMDB_API = 'https://api.themoviedb.org/3';

  /* Si el deploy no sustituyó los placeholders, el catálogo no carga.
     Mejor gritarlo que dejar la página en blanco sin explicación. */
  if (!TMDB_API_KEY || TMDB_API_KEY.indexOf('__') === 0) {
    console.error(
      '[POPOROPO] Falta TMDB_API_KEY. GitHub Pages debe desplegarse con ' +
      'GitHub Actions (Settings → Pages → Source: GitHub Actions) para que ' +
      'el workflow inyecte los secrets en config.js. Ver README-SETUP.md.'
    );
    document.addEventListener('DOMContentLoaded', function () {
      var b = document.createElement('p');
      b.style.cssText = 'position:fixed;z-index:99999;left:0;right:0;bottom:0;margin:0;' +
        'padding:12px 16px;background:#b20710;color:#fff;font:600 13px/1.4 sans-serif;text-align:center';
      b.textContent = 'Configuration error: TMDB API key missing. Check the deploy workflow.';
      document.body.appendChild(b);
    });
  }
  const TMDB_IMG = 'https://image.tmdb.org/t/p';
  const LANG = 'en-US';
  const REGION = 'US';

  const SUPPORTS = {
    AbortController:       typeof AbortController !== 'undefined',
    IntersectionObserver:  typeof IntersectionObserver !== 'undefined',
    ResizeObserver:        typeof ResizeObserver !== 'undefined',
    fetch:                 typeof fetch !== 'undefined'
  };

  const POSTER_SIZE   = IS_TV ? 'w154' : 'w342';
  const BACKDROP_SIZE = IS_TV ? 'w500' : 'w1280';

  const MAX_PAGES_PER_GENRE = IS_TV ? 1 : 99;
  const MAX_GENRES_VISIBLE  = IS_TV ? 6  : 16;
  const MAX_SEARCH_PAGES    = IS_TV ? 2  : 10;

  const GENRES_FULL = [
    { id: 28,    name: 'Action' },
    { id: 12,    name: 'Adventure' },
    { id: 16,    name: 'Animation' },
    { id: 35,    name: 'Comedy' },
    { id: 80,    name: 'Crime' },
    { id: 99,    name: 'Documentary' },
    { id: 18,    name: 'Drama' },
    { id: 10751, name: 'Family' },
    { id: 14,    name: 'Fantasy' },
    { id: 27,    name: 'Horror' },
    { id: 9648,  name: 'Mystery' },
    { id: 10749, name: 'Romance' },
    { id: 878,   name: 'Science Fiction' },
    { id: 53,    name: 'Thriller' },
    { id: 10752, name: 'War' },
    { id: 36,    name: 'History' }
  ];

  const GENRES = IS_TV ? GENRES_FULL.slice(0, MAX_GENRES_VISIBLE) : GENRES_FULL;

  const TV_GENRES = [
    { id: 10759, name: 'Action & Adventure' },
    { id: 16,    name: 'Animation' },
    { id: 35,    name: 'Comedy' },
    { id: 80,    name: 'Crime' },
    { id: 99,    name: 'Documentary' },
    { id: 18,    name: 'Drama' },
    { id: 10751, name: 'Family' },
    { id: 9648,  name: 'Mystery' },
    { id: 10765, name: 'Sci-Fi & Fantasy' },
    { id: 10768, name: 'War & Politics' },
    { id: 37,    name: 'Western' },
    { id: 10764, name: 'Reality' }
  ];
  const TV_GENRES_VISIBLE = IS_TV ? TV_GENRES.slice(0, MAX_GENRES_VISIBLE) : TV_GENRES;
  const MOVIE_TO_TV_GENRE = {
    28: 10759, 12: 10759, 16: 16, 35: 35, 80: 80, 99: 99,
    18: 18, 10751: 10751, 14: 10765, 27: null, 9648: 9648,
    10749: null, 878: 10765, 53: null, 10752: 10768, 36: null
  };

  /* ============================================================
     TMDB fetch
     ============================================================ */
  function tmdb(path, params, options) {
    params = params || {};
    options = options || {};

    var parts = [
      'api_key=' + encodeURIComponent(TMDB_API_KEY),
      'language=' + encodeURIComponent(LANG)
    ];
    for (var key in params) {
      if (!Object.prototype.hasOwnProperty.call(params, key)) continue;
      var v = params[key];
      if (v === undefined || v === null || v === '') continue;
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(v));
    }
    var url = TMDB_API + path + '?' + parts.join('&');

    var fetchOpts = null;
    if (options.signal && SUPPORTS.AbortController) {
      fetchOpts = { signal: options.signal };
    }

    return fetch(url, fetchOpts || undefined).then(function (res) {
      if (!res.ok) throw new Error('TMDB ' + res.status);
      return res.json();
    });
  }

  const posterUrl   = (p, size = POSTER_SIZE)   => p ? `${TMDB_IMG}/${size}${p}` : '';
  const backdropUrl = (p, size = BACKDROP_SIZE) => p ? `${TMDB_IMG}/${size}${p}` : '';

  const PLACEHOLDER_POSTER =
    'data:image/svg+xml;utf8,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 240">
        <rect width="160" height="240" fill="#222"/>
        <text x="50%" y="50%" font-family="sans-serif" font-size="14" fill="#666"
          text-anchor="middle" dominant-baseline="middle">No poster</text>
      </svg>`
    );

  /* ============================================================
     C. MAIN
     ============================================================ */
  document.addEventListener('DOMContentLoaded', function () {

    const $  = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

    function escapeHtml(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g,
        m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    }

    /* ── Header scroll ── */
    const header = $('#mainHeader');
    const handleScroll = () => header.classList.toggle('scrolled', window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    let currentView = 'home';

    /* ── Toast ── */
    const toastEl = $('#toast');
    let toastTimer;
    function showToast(msg, ms = 2400, opts = {}) {
      if (!toastEl) return;
      toastEl.textContent = msg;
      toastEl.classList.toggle('is-gold', !!opts.gold);
      toastEl.hidden = false;
      requestAnimationFrame(() => toastEl.classList.add('is-visible'));
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        toastEl.classList.remove('is-visible');
        setTimeout(() => { toastEl.hidden = true; }, 250);
      }, ms);
    }

    /* ============================================================
       BROWSER / LOCALE DETECTION
       ============================================================ */
    function detectDefaultSubtitleLang() {
      const supported = new Set(['en','es','fr','de','pt','it','ja','ko','zh','ru','ar','nl','sv','no','da','fi','pl','tr','hi','id','th']);
      try {
        const sources = [];
        if (navigator.language) sources.push(navigator.language);
        if (navigator.languages) sources.push(...navigator.languages);
        for (const lang of sources) {
          if (!lang) continue;
          const code = String(lang).toLowerCase().split('-')[0];
          if (supported.has(code)) return code;
        }
      } catch (e) {}
      return 'en';
    }
    const DETECTED_SUB_LANG = detectDefaultSubtitleLang();

    /* ============================================================
       SETTINGS
       ============================================================ */
    const SETTINGS_KEY_PREFIX = 'poporopo_settings_v1';
    const SETTINGS_KEY_GUEST  = `${SETTINGS_KEY_PREFIX}__guest`;

    const DEFAULT_SETTINGS = {
      subtitleLang: DETECTED_SUB_LANG,
      reduceMotion: false,
      showBanner: true,
      goldTheme: true,
      displayName: '',
      adultContent: false
    };

    function settingsKey() {
      const u = getCurrentUser();
      return u ? `${SETTINGS_KEY_PREFIX}__${u.sub}` : SETTINGS_KEY_GUEST;
    }

    function getSettings() {
      try {
        const raw = localStorage.getItem(settingsKey());
        const parsed = raw ? JSON.parse(raw) : {};
        return { ...DEFAULT_SETTINGS, ...parsed };
      } catch (e) { return { ...DEFAULT_SETTINGS }; }
    }

    function saveSettings(s) {
      try { localStorage.setItem(settingsKey(), JSON.stringify(s)); }
      catch (e) {}
    }

    function filterContent(items) {
      if (!items || !items.length) return [];
      const s = getSettings();
      let out = s.adultContent ? items : items.filter(item => !item.adult);
      out = out.filter(item => !isCamQuality(item) && !isLikelyUnavailable(item));
      return out;
    }

    function applySettings() {
      const s = getSettings();
      document.body.classList.toggle('reduce-motion', !!s.reduceMotion);
      const banner = $('#mainBanner');
      if (banner) banner.style.display = s.showBanner ? '' : 'none';
    }

    /* ============================================================
       AUTH
       ============================================================ */
    const USER_KEY        = 'poporopo_user_v1';
    const FAV_KEY_PREFIX  = 'poporopo_favorites_v1';
    const FAV_KEY_GUEST   = `${FAV_KEY_PREFIX}__guest`;
    const WATCHED_KEY_PREFIX = 'poporopo_watched_v1';
    const WATCHED_KEY_GUEST  = `${WATCHED_KEY_PREFIX}__guest`;
    const WATCHED_MAX     = 30;   // tope de títulos en "Recently Watched"
    const DONOR_KEY_PREFIX = 'poporopo_donor_v1';
    const DONOR_KEY_GUEST  = `${DONOR_KEY_PREFIX}__guest`;

    function getCurrentUser() {
      try {
        const raw = localStorage.getItem(USER_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    }

    function setCurrentUser(user) {
      try {
        if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
        else      localStorage.removeItem(USER_KEY);
      } catch (e) {}
    }

    function parseJwt(token) {
      try {
        const part = token.split('.')[1];
        const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
        const json = decodeURIComponent(atob(base64).split('').map(c =>
          '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        ).join(''));
        return JSON.parse(json);
      } catch (e) { return null; }
    }

    function handleGoogleCredential(response) {
      if (!response || !response.credential) return;
      const payload = parseJwt(response.credential);
      if (!payload || !payload.sub) {
        showToast("Couldn't read your account", 2000);
        return;
      }
      const user = {
        sub:        payload.sub,
        name:       payload.name || '',
        given_name: payload.given_name || '',
        email:      payload.email || '',
        picture:    payload.picture || ''
      };

      const newFavKey   = `${FAV_KEY_PREFIX}__${user.sub}`;
      const newSetKey   = `${SETTINGS_KEY_PREFIX}__${user.sub}`;
      const newDonorKey = `${DONOR_KEY_PREFIX}__${user.sub}`;
      const newWatchKey = `${WATCHED_KEY_PREFIX}__${user.sub}`;
      try {
        if (!localStorage.getItem(newFavKey)) {
          const g = localStorage.getItem(FAV_KEY_GUEST);
          if (g) { localStorage.setItem(newFavKey, g); localStorage.removeItem(FAV_KEY_GUEST); }
        }
        if (!localStorage.getItem(newSetKey)) {
          const g = localStorage.getItem(SETTINGS_KEY_GUEST);
          if (g) { localStorage.setItem(newSetKey, g); localStorage.removeItem(SETTINGS_KEY_GUEST); }
        }
        if (!localStorage.getItem(newDonorKey)) {
          const g = localStorage.getItem(DONOR_KEY_GUEST);
          if (g) { localStorage.setItem(newDonorKey, g); localStorage.removeItem(DONOR_KEY_GUEST); }
        }
        /* El historial de "Recently Watched" también viaja del invitado
           al usuario: así lo que viste antes de iniciar sesión aparece
           nada más entrar. */
        if (!localStorage.getItem(newWatchKey)) {
          const g = localStorage.getItem(WATCHED_KEY_GUEST);
          if (g) { localStorage.setItem(newWatchKey, g); localStorage.removeItem(WATCHED_KEY_GUEST); }
        }
      } catch (e) {}

      setCurrentUser(user);
      updateAuthUI();
      applySettings();
      rebuildAfterAuthChange();
      showToast(`Welcome, ${user.given_name || user.name || 'friend'}`, 2000);

      /* Canjea el mismo token de Google por una sesión de Firebase para
         que las reglas de Firestore puedan verificar quién comenta. */
      if (window.PoporopoSocial && PoporopoSocial.enabled) {
        PoporopoSocial.signIn(response.credential);
      }
    }

    function signOut() {
      if (window.google && google.accounts && google.accounts.id) {
        try { google.accounts.id.disableAutoSelect(); } catch (e) {}
      }
      setCurrentUser(null);
      updateAuthUI();
      applySettings();
      rebuildAfterAuthChange();
      if (window.PoporopoSocial && PoporopoSocial.enabled) PoporopoSocial.signOut();
      showToast('Signed out', 1800);
    }

    function makeInitialsAvatar(name) {
      const initials = String(name).trim().split(/\s+/).slice(0, 2)
        .map(s => s[0] || '').join('').toUpperCase() || '?';
      return 'data:image/svg+xml;utf8,' + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
          <rect width="64" height="64" fill="#E50914"/>
          <text x="50%" y="50%" font-family="sans-serif" font-size="26" fill="#fff"
                font-weight="700" text-anchor="middle" dominant-baseline="central">${initials}</text>
        </svg>`
      );
    }

    function getDisplayName(user) {
      if (!user) return '';
      const settings = getSettings();
      return (settings.displayName && settings.displayName.trim()) ? settings.displayName.trim() : (user.name || '');
    }

    function updateAuthUI() {
      const user = getCurrentUser();
      const signedOutEl = $('#authSignedOut');
      const signedInEl  = $('#authSignedIn');
      if (!signedOutEl || !signedInEl) return;

      if (user) {
        signedOutEl.hidden = true;
        signedInEl.hidden  = false;

        const fallback = makeInitialsAvatar(user.name || user.email || '?');
        const av  = $('#profileAvatar');
        const avL = $('#profileAvatarLg');
        if (av)  { av.src  = user.picture || fallback; av.onerror  = () => { av.src  = fallback; }; av.alt  = user.name || ''; }
        if (avL) { avL.src = user.picture || fallback; avL.onerror = () => { avL.src = fallback; }; avL.alt = user.name || ''; }

        const display = getDisplayName(user);
        $('#profileNameText').textContent = display;
        $('#profileEmail').textContent    = user.email || '';

        const donor = isDonor();
        const profileBtn = $('#profileBtn');
        const crown      = $('#profileDonorCrown');
        const donorTag   = $('#profileDonorTag');
        if (profileBtn) profileBtn.classList.toggle('is-donor', donor);
        if (crown)      crown.hidden = !donor;
        if (donorTag)   donorTag.hidden = !donor;

      } else {
        signedOutEl.hidden = false;
        signedInEl.hidden  = true;
        closeProfileMenu();
      }

      const footerThanks = $('#footerThanks');
      if (footerThanks) footerThanks.hidden = !isDonor();
    }

    function rebuildAfterAuthChange() {
      updateFavoritesSection();
      updateWatchedSection();
      document.querySelectorAll('.movie[data-media-id]').forEach(card => {
        syncFavoriteButtons(card.dataset.mediaId, card.dataset.mediaType);
      });
    }

    function clientIdConfigured() {
      return GOOGLE_CLIENT_ID &&
             !GOOGLE_CLIENT_ID.startsWith('YOUR_CLIENT_ID') &&
             GOOGLE_CLIENT_ID.endsWith('.googleusercontent.com');
    }

    let gisInitialized = false;
    let googleButtonRendered = false;

    /* Carga el script de Google Identity Services solo bajo demanda
       (primera interacción con el login). Evita ~200 KB de requests al
       cargar, los errores de consola de GSI en headless/PSI y el prompt
       de One Tap automático. */
    let gsiPromise = null;
    function loadGsiScript() {
      if (window.google && google.accounts && google.accounts.id) return Promise.resolve(true);
      if (gsiPromise) return gsiPromise;
      gsiPromise = new Promise(function (resolve) {
        const s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client';
        s.async = true;
        s.onload = function () { resolve(true); };
        s.onerror = function () { gsiPromise = null; resolve(false); };
        document.head.appendChild(s);
        setTimeout(function () { resolve(true); }, 6000);
      });
      return gsiPromise;
    }

    function showFallbackButton() {}

    function initGoogleAuth(attempts = 0) {
      if (gisInitialized) return;
      if (!clientIdConfigured()) {
        showFallbackButton('Sign-in not configured');
        return;
      }

      if (!(window.google && google.accounts && google.accounts.id)) {
        loadGsiScript().then(function (ok) {
          if (ok && window.google && google.accounts && google.accounts.id) {
            initGoogleAuth(attempts);
          } else if (attempts < 30) {
            setTimeout(function () { initGoogleAuth(attempts + 1); }, 250);
          } else {
            showFallbackButton('Sign-in not available in this browser');
          }
        });
        return;
      }

      try {
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredential,
          auto_select: true,
          cancel_on_tap_outside: true,
          use_fedcm_for_prompt: true
        });

        const buttonContainer = $('#googleSignInButton');
        if (buttonContainer && !getCurrentUser()) {
          try {
            google.accounts.id.renderButton(buttonContainer, {
              type: 'icon',
              theme: 'filled_black',
              size: 'medium',
              shape: 'circle'
            });
            googleButtonRendered = true;
          } catch (e) {}
        }

        /* Pide credencial también cuando la sesión de la app ya existe
           pero la de Firebase no. Es el caso de quien inició sesión antes
           de que existieran los comentarios: sin esto, el panel le pide
           iniciar sesión a alguien que ya la tiene. */
        const needsFirebase = window.PoporopoSocial &&
                              PoporopoSocial.enabled &&
                              !PoporopoSocial.isSignedIn();
        if (!getCurrentUser() || needsFirebase) {
          try { google.accounts.id.prompt(() => {}); } catch (e) {}
        }

        gisInitialized = true;
      } catch (e) {
        console.error('Error initializing Google auth:', e);
        showFallbackButton('Sign-in error');
      }
    }

    function triggerSignIn() {
      if (!clientIdConfigured()) {
        showToast('Sign-in not configured', 2500);
        return;
      }
      if (!gisInitialized) initGoogleAuth();
      if (!(window.google && google.accounts && google.accounts.id)) {
        showToast('Sign-in not available in this browser', 2500);
        return;
      }
      try {
        google.accounts.id.prompt();
      } catch (e) {
        showToast('Sign-in error', 2000);
      }
    }

    /* Puentes que social.js usa para pedir login y avisar al usuario
       sin tener que conocer los internos de este módulo. */
    window.PoporopoRequestSignIn = triggerSignIn;
    window.PoporopoToast = function (msg) { showToast(msg, 2400); };
    window.PoporopoAppUser = getCurrentUser;

    /* social.js pinta su propio botón de Google cuando le falta la sesión
       de Firebase. Hace falta un botón real y no solo prompt(): One Tap
       entra en enfriamiento tras unos descartes y deja de aparecer, así
       que por sí solo no es un camino fiable. */
    window.PoporopoRenderSignInButton = function (container, attempts) {
      attempts = attempts || 0;
      if (!container || !clientIdConfigured()) return false;
      if (!gisInitialized) initGoogleAuth();

      /* El script de GSI carga async: si todavía no está, reintenta en vez
         de dejar el hueco vacío para siempre. */
      if (!(window.google && google.accounts && google.accounts.id)) {
        if (attempts < 25) {
          setTimeout(function () {
            window.PoporopoRenderSignInButton(container, attempts + 1);
          }, 250);
        }
        return false;
      }
      try {
        container.innerHTML = '';
        google.accounts.id.renderButton(container, {
          type: 'standard', theme: 'filled_black',
          size: IS_TV ? 'large' : 'medium',
          text: 'signin_with', shape: 'pill'
        });
        return true;
      } catch (e) { return false; }
    };

    /* ── Profile menu ── */
    const profileBtn  = $('#profileBtn');
    const profileMenu = $('#profileMenu');
    const signOutBtn  = $('#signOutBtn');

    let profileMenuOpen = false;
    function openProfileMenu() {
      if (!profileMenu) return;
      profileMenu.hidden = false;
      if (profileBtn) profileBtn.setAttribute('aria-expanded', 'true');
      profileMenuOpen = true;
    }
    function closeProfileMenu() {
      if (!profileMenu) return;
      profileMenu.hidden = true;
      if (profileBtn) profileBtn.setAttribute('aria-expanded', 'false');
      profileMenuOpen = false;
    }
    function toggleProfileMenu() {
      profileMenuOpen ? closeProfileMenu() : openProfileMenu();
    }

    if (profileBtn) profileBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleProfileMenu(); });
    document.addEventListener('click', (e) => {
      if (profileMenuOpen && profileMenu && !profileMenu.contains(e.target) && !(profileBtn && profileBtn.contains(e.target))) {
        closeProfileMenu();
      }
    });
    if (signOutBtn) signOutBtn.addEventListener('click', () => { closeProfileMenu(); signOut(); });

    updateAuthUI();

    /* GSI se carga en la primera interacción real del usuario
       (click/teclado). OJO: NO usar 'scroll' ni 'touchstart' como gatillo:
       los audits headless (PageSpeed Insights) hacen scroll durante la
       captura y cargarían el script igualmente. */
    var authWake = function () {
      if (gisInitialized) return;
      var evs = ['pointerdown', 'keydown'];
      for (var i = 0; i < evs.length; i++) document.removeEventListener(evs[i], authWake, { capture: true });
      initGoogleAuth();
    };
    var authEvts = ['pointerdown', 'keydown'];
    for (var j = 0; j < authEvts.length; j++) document.addEventListener(authEvts[j], authWake, { capture: true, passive: true });

    /* ============================================================
       FAVORITES
       ============================================================ */
    function getFavKey() {
      const user = getCurrentUser();
      return user ? `${FAV_KEY_PREFIX}__${user.sub}` : FAV_KEY_GUEST;
    }

    function getFavorites() {
      try {
        const raw = localStorage.getItem(getFavKey());
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
      } catch (e) { return []; }
    }

    function saveFavorites(favs) {
      try { localStorage.setItem(getFavKey(), JSON.stringify(favs)); }
      catch (e) {}
    }

    function favKeyOf(item) { return `${item.id}|${item._type}`; }
    function isFavorite(id, type) {
      return getFavorites().some(f => String(f.id) === String(id) && f._type === type);
    }
    function addFavorite(item) {
      const favs = getFavorites();
      const key = favKeyOf(item);
      if (favs.some(f => favKeyOf(f) === key)) return false;
      favs.unshift({
        id: item.id, _type: item._type,
        title: item.title, name: item.name,
        original_title: item.original_title, original_name: item.original_name,
        release_date: item.release_date, first_air_date: item.first_air_date,
        poster_path: item.poster_path,
        addedAt: Date.now()
      });
      saveFavorites(favs);
      return true;
    }
    function removeFavorite(id, type) {
      const favs = getFavorites();
      const idx = favs.findIndex(f => String(f.id) === String(id) && f._type === type);
      if (idx === -1) return false;
      favs.splice(idx, 1);
      saveFavorites(favs);
      return true;
    }
    function clearFavorites() {
      saveFavorites([]);
    }

    function syncFavoriteButtons(id, type) {
      const fav = isFavorite(id, type);
      const sel = `.movie[data-media-id="${id}"][data-media-type="${type}"]`;
      document.querySelectorAll(sel).forEach(card => {
        const heart = card.querySelector('.movie-fav-btn');
        if (!heart) return;
        heart.classList.toggle('is-fav', fav);
        heart.setAttribute('aria-pressed', fav ? 'true' : 'false');
        heart.setAttribute('aria-label', fav ? 'Remove from favorites' : 'Add to favorites');
        heart.title = fav ? 'Remove from favorites' : 'Add to favorites';
      });
    }

    function handleFavoriteToggle(item, originBtn) {
      const wasFav = isFavorite(item.id, item._type);
      if (wasFav) removeFavorite(item.id, item._type);
      else        addFavorite(item);

      syncFavoriteButtons(item.id, item._type);
      updateFavoritesSection();

      if (originBtn && !wasFav) {
        originBtn.classList.remove('just-added');
        void originBtn.offsetWidth;
        originBtn.classList.add('just-added');
        setTimeout(() => originBtn.classList.remove('just-added'), 500);
      }

      showToast(wasFav ? 'Removed from Favorites' : 'Added to Favorites', 1400);
    }

    window.addEventListener('storage', (e) => {
      if (e.key === USER_KEY) {
        updateAuthUI(); rebuildAfterAuthChange(); return;
      }
      if (e.key && e.key.startsWith(FAV_KEY_PREFIX) && e.key === getFavKey()) {
        updateFavoritesSection();
        document.querySelectorAll('.movie[data-media-id]').forEach(card => {
          syncFavoriteButtons(card.dataset.mediaId, card.dataset.mediaType);
        });
      }
      if (e.key && e.key.startsWith(WATCHED_KEY_PREFIX) && e.key === watchedKey()) {
        updateWatchedSection();
      }
      if (e.key && e.key.startsWith(DONOR_KEY_PREFIX) && e.key === donorKey()) {
        updateAuthUI();
        updateSettingsUI();
      }
    });

    /* ============================================================
       WATCHED (Recently Watched)
       Mismo patrón que FAVORITES: lista en localStorage, una por
       usuario (o __guest). Un título aparece una sola vez y se mueve
       al principio cada vez que se reproduce.
       ============================================================ */
    function watchedKey() {
      const user = getCurrentUser();
      return user ? `${WATCHED_KEY_PREFIX}__${user.sub}` : WATCHED_KEY_GUEST;
    }

    function getWatched() {
      try {
        const raw = localStorage.getItem(watchedKey());
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
      } catch (e) { return []; }
    }

    function saveWatched(arr) {
      try { localStorage.setItem(watchedKey(), JSON.stringify(arr)); }
      catch (e) {}
    }

    /* Registra el título que se está reproduciendo. Se llama cuando la
       respuesta de TMDB ya trajo título y poster, para que la tarjeta
       del carrusel salga bien formada. */
    function recordWatched(item) {
      if (!item || item.id == null) return;
      const list = getWatched();
      const idx = list.findIndex(w => String(w.id) === String(item.id) && w._type === item._type);
      const entry = {
        id: item.id,
        _type: item._type,
        title: item.title,
        name: item.name,
        original_title: item.original_title,
        original_name: item.original_name,
        release_date: item.release_date,
        first_air_date: item.first_air_date,
        poster_path: item.poster_path,
        season: item.season,
        episode: item.episode,
        watchedAt: Date.now()
      };
      if (idx >= 0) list.splice(idx, 1);
      list.unshift(entry);
      saveWatched(list.slice(0, WATCHED_MAX));
      updateWatchedSection();
    }

    /* Mueve al principio el título que ya está registrado (p. ej. al
       cambiar de episodio) sin duplicarlo. Si la entrada todavía no
       existe (la respuesta de TMDB aún no llegó), no hace nada:
       recordWatched la creará cuando llegue. */
    function touchWatched(mediaId, mediaType, season, episode) {
      const list = getWatched();
      const idx = list.findIndex(w => String(w.id) === String(mediaId) && w._type === mediaType);
      if (idx === -1) return;
      const entry = list.splice(idx, 1)[0];
      entry.watchedAt = Date.now();
      if (season != null) entry.season = season;
      if (episode != null) entry.episode = episode;
      list.unshift(entry);
      saveWatched(list.slice(0, WATCHED_MAX));
      updateWatchedSection();
    }

    /* ============================================================
       DONOR STATUS
       ============================================================ */
    function donorKey() {
      const u = getCurrentUser();
      return u ? `${DONOR_KEY_PREFIX}__${u.sub}` : DONOR_KEY_GUEST;
    }

    function getDonorInfo() {
      try {
        const raw = localStorage.getItem(donorKey());
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    }

    function setDonorInfo(info) {
      try {
        if (info) localStorage.setItem(donorKey(), JSON.stringify(info));
        else      localStorage.removeItem(donorKey());
      } catch (e) {}
    }

    function isDonor() { return !!getDonorInfo(); }

    function markAsDonor(txId, displayName) {
      const info = {
        txId: String(txId).trim().toUpperCase(),
        displayName: (displayName || '').trim(),
        claimedAt: Date.now()
      };
      setDonorInfo(info);
      updateAuthUI();
      updateSettingsUI();
      return info;
    }

    /* ============================================================
       MODAL CORE
       ============================================================ */
    const videoModal      = $('#videoModal');
    const videoPlayer     = $('#videoPlayer');
    const closeVideo      = $('#closeModal');
    const videoBack       = videoModal.querySelector('.modal-backdrop');
    const playerSpin      = $('#playerSpinner');
    const adBlocker       = $('#adClickBlocker');

    const seasonSelector  = $('#seasonEpisodeSelector');
    const seasonSelect    = $('#seasonSelect');
    const episodeSelect   = $('#episodeSelect');
    const videoTitleEl    = $('#videoTitle');
    const videoInfoBtn    = $('#videoInfoBtn');

    /* El panel de likes y comentarios se monta al ABRIR el reproductor
       (ver syncSocialContent), no al cargar la página: así el botón de
       Google y su script solo se descargan cuando el usuario los va a
       usar de verdad, y los audits headless no los cargan nunca. */

    const infoModal       = $('#infoModal');
    const closeInfoBtn    = $('#closeInfoModal');
    const infoBack        = infoModal.querySelector('.modal-backdrop');
    const infoBackdropEl  = $('#infoBackdrop');
    const infoTitleEl     = $('#infoModalTitle');
    const infoYearEl      = infoModal.querySelector('.info-year');
    const infoDurationEl  = infoModal.querySelector('.info-duration');
    const infoGenreEl     = infoModal.querySelector('.info-genre');
    const infoDescEl      = infoModal.querySelector('.info-desc');
    const infoPlayBtn     = $('#infoPlayBtn');
    const infoQualityEl   = infoModal.querySelector('.info-meta .badge-hd');
    const infoCertEl      = infoModal.querySelector('.info-cert');

    let currentMediaId     = null;
    let currentMediaType   = 'movie';
    let currentSeason  = 1;
    let currentEpisode = 1;
    const modalStack = [];

    function closeAllModalsAndOpenVideo(id, type, opener) {
      while (modalStack.length) {
        const top = modalStack[modalStack.length - 1].el;
        closeModalEl(top);
      }
      document.body.style.overflow = '';
      openVideoModal(id, type, opener);
    }

    /* ============================================================
       VIDEO PLAYER (fullscreen) with compact bottom bar
       ============================================================ */
    function getEmbedUrl(id, type, season, episode, subLang) {
      const sub = subLang ? `?ds_lang=${subLang}` : '';
      if (type === 'tv' && season !== undefined && episode !== undefined)
        return `https://vidsrc.pm/embed/tv/${id}/${season}/${episode}${sub}`;
      return `https://vidsrc.pm/embed/${type}/${id}${sub}`;
    }

    /* Identificador de contenido para likes y comentarios.
       Las series se separan POR EPISODIO, no por serie completa:
         movie_550
         tv_1399_s1_e1                                            */
    function socialContentId(id, type, season, episode) {
      return type === 'tv' ? `tv_${id}_s${season}_e${episode}` : `movie_${id}`;
    }

    /* Se llama cada vez que cambia lo que se está reproduciendo. */
    function syncSocialContent() {
      if (!window.PoporopoSocial || !PoporopoSocial.enabled) return;
      if (window.PoporopoSocial.mount) window.PoporopoSocial.mount($('#socialMount'));
      if (!currentMediaId) return;
      const base = videoTitleEl.textContent || '';
      const label = currentMediaType === 'tv'
        ? `${base}${base ? ' · ' : ''}S${currentSeason} E${currentEpisode}`
        : base;
      PoporopoSocial.setContent(
        socialContentId(currentMediaId, currentMediaType, currentSeason, currentEpisode),
        label
      );
    }

    function openVideoModal(mediaId, mediaType, opener) {
      currentMediaId = mediaId;
      currentMediaType = mediaType;
      currentSeason  = 1;
      currentEpisode = 1;

      if (IS_TV) {
        unloadAllPosters();
        const catalog = $('#catalog');
        if (catalog) catalog.style.display = 'none';
        const searchArea = $('#searchResults');
        if (searchArea) searchArea.style.display = 'none';
      }

      if (adBlocker) {
        clearTimeout(adBlocker._disableTimer);
        adBlocker.classList.add('is-active');
      }

      openModal(videoModal, opener);

      const modalContent = videoModal.querySelector('.fullscreen-content');
      if (modalContent) modalContent.scrollTop = 0;

      videoTitleEl.textContent = '';
      seasonSelector.hidden = true;
      seasonSelect.innerHTML = '';
      episodeSelect.innerHTML = '';

      if (mediaType === 'movie') {
        seasonSelector.hidden = true;
      }

      const endpoint = mediaType === 'movie' ? `/movie/${mediaId}` : `/tv/${mediaId}`;
      tmdb(endpoint).then(data => {
        const title = data.title || data.name || '';
        videoTitleEl.textContent = title;
        syncSocialContent();   // el título llega tarde: refresca la etiqueta
        /* Recently Watched: registra lo que se está reproduciendo. Se hace
           aquí (cuando ya llegó el detalle de TMDB) para que el poster y
           el título de la tarjeta sean los correctos. */
        recordWatched({ ...data, id: mediaId, _type: mediaType });
      }).catch(() => {});

      if (mediaType === 'tv') {
        seasonSelector.hidden = false;
        loadSeasonData(mediaId);
      } else {
        seasonSelector.hidden = true;
        const subLang = getSettings().subtitleLang;
        videoPlayer.src = getEmbedUrl(mediaId, 'movie', undefined, undefined, subLang);
        syncSocialContent();
      }
    }

    videoInfoBtn.addEventListener('click', () => {
      if (!currentMediaId) return;
      openInfoModal(currentMediaId, currentMediaType, videoInfoBtn);
    });

    function closeVideoModal() {
      videoPlayer.src = '';
      if (adBlocker) {
        clearTimeout(adBlocker._disableTimer);
        adBlocker.classList.remove('is-active');
      }
      if (playerSpin) playerSpin.classList.remove('is-hidden');
      currentMediaId = null;
      if (window.PoporopoSocial && PoporopoSocial.enabled) PoporopoSocial.clear();
      closeModalEl(videoModal);

      if (IS_TV) {
        const catalog = $('#catalog');
        if (catalog) catalog.style.display = '';
        const searchArea = $('#searchResults');
        if (searchArea && !searchArea.hidden) searchArea.style.display = '';
        setTimeout(reloadVisiblePosters, 400);
      }
    }

    closeVideo.addEventListener('click', closeVideoModal);
    if (videoBack) videoBack.addEventListener('click', closeVideoModal);

    async function loadSeasonData(seriesId) {
      try {
        const data = await tmdb(`/tv/${seriesId}`);
        const seasons = data.seasons ? data.seasons.filter(s => s.season_number > 0) : [];

        seasonSelect.innerHTML = '';
        if (seasons.length === 0) {
          seasonSelect.innerHTML = '<option value="1">Season 1</option>';
          populateEpisodes(seriesId, 1);
          return;
        }

        seasons.forEach(season => {
          const option = document.createElement('option');
          option.value = season.season_number;
          option.textContent = `Season ${season.season_number}`;
          seasonSelect.appendChild(option);
        });

        const defaultSeason = seasons[0].season_number;
        currentSeason = defaultSeason;
        seasonSelect.value = defaultSeason;
        populateEpisodes(seriesId, defaultSeason);
      } catch (err) {
        console.error('Season load error:', err);
        seasonSelect.innerHTML = '<option value="1">Season 1</option>';
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
          option.textContent = `E${ep.episode_number}: ${ep.name || 'Untitled'}`;
          episodeSelect.appendChild(option);
        });

        if (episodes.length > 0) {
          currentEpisode = episodes[0].episode_number;
          episodeSelect.value = currentEpisode;
        } else {
          currentEpisode = 1;
        }
        const subLang = getSettings().subtitleLang;
        videoPlayer.src = getEmbedUrl(seriesId, 'tv', currentSeason, currentEpisode, subLang);
        syncSocialContent();
        touchWatched(seriesId, 'tv', currentSeason, currentEpisode);
      } catch (err) {
        console.error('Episode load error:', err);
        episodeSelect.innerHTML = '<option value="1">Episode 1</option>';
        currentEpisode = 1;
        const subLang = getSettings().subtitleLang;
        videoPlayer.src = getEmbedUrl(seriesId, 'tv', currentSeason, currentEpisode, subLang);
        syncSocialContent();
        touchWatched(seriesId, 'tv', currentSeason, currentEpisode);
      }
    }

    seasonSelect.addEventListener('change', () => {
      currentSeason = Number(seasonSelect.value);
      populateEpisodes(currentMediaId, currentSeason);
    });
    episodeSelect.addEventListener('change', () => {
      currentEpisode = Number(episodeSelect.value);
      const subLang = getSettings().subtitleLang;
      videoPlayer.src = getEmbedUrl(currentMediaId, 'tv', currentSeason, currentEpisode, subLang);
      syncSocialContent();
      touchWatched(currentMediaId, 'tv', currentSeason, currentEpisode);
    });

    videoPlayer.addEventListener('load', () => {
      if (videoPlayer.src && playerSpin) playerSpin.classList.add('is-hidden');
      if (adBlocker && adBlocker.classList.contains('is-active')) {
        clearTimeout(adBlocker._disableTimer);
        adBlocker._disableTimer = setTimeout(() => {
          adBlocker.classList.remove('is-active');
        }, 1500);
      }
    });

    /* ============================================================
       INFO MODAL (with episodes & More Like This)
       ============================================================ */
    const infoEpisodesEl = $('#infoEpisodes');
    const moreLikeThisGrid = $('#moreLikeThisGrid');
    const infoMoreLikeThis = $('#infoMoreLikeThis');

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

    async function openInfoModal(mediaId, mediaType, opener) {
      // If info modal is already open, reload content in place instead of pushing to stack
      const alreadyOpen = infoModal.classList.contains('active');
      infoTitleEl.textContent = 'Loading…';
      infoYearEl.textContent = '';
      infoDurationEl.textContent = '';
      infoGenreEl.textContent = '';
      infoRatingEl.textContent = '';
      infoDescEl.textContent = '';
      infoBackdropEl.style.backgroundImage = '';
      if (infoQualityEl) infoQualityEl.textContent = 'HD';
      if (infoCertEl) infoCertEl.hidden = true;
      infoPlayBtn.dataset.mediaId   = mediaId;
      infoPlayBtn.dataset.mediaType = mediaType;

      infoEpisodesEl.innerHTML = '';
      moreLikeThisGrid.innerHTML = '';
      infoMoreLikeThis.style.display = 'none';

      if (!alreadyOpen) {
        openModal(infoModal, opener);
      }

      try {
        const endpoint = mediaType === 'movie' ? `/movie/${mediaId}` : `/tv/${mediaId}`;
        const data = await tmdb(endpoint, {
          append_to_response: mediaType === 'movie' ? 'release_dates' : 'content_ratings'
        });
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
            ? `· ${data.number_of_seasons} season${data.number_of_seasons > 1 ? 's' : ''}` : '';
        }

        infoGenreEl.textContent = (data.genres && data.genres.length)
          ? `· ${data.genres.map(g => g.name).join(', ')}` : '';
        /* La puntuación de TMDB se quitó a propósito: ahora la señal de
           la comunidad son los likes y comentarios del propio sitio. */
        infoDescEl.textContent = data.overview || 'No description available.';
        if (data.backdrop_path) {
          infoBackdropEl.style.backgroundImage = `url('${backdropUrl(data.backdrop_path)}')`;
        }

        if (infoQualityEl) {
          infoQualityEl.textContent = qualityLabel({
            release_date: data.release_date,
            first_air_date: data.first_air_date,
            _type: mediaType
          });
        }
        const certResults = mediaType === 'movie'
          ? (data.release_dates && data.release_dates.results)
          : (data.content_ratings && data.content_ratings.results);
        const certVal = mediaType === 'movie' ? pickUsCertMovie(certResults) : pickUsCertTv(certResults);
        certCache.set(mediaId + '|' + mediaType, certVal || '');
        if (infoCertEl) {
          if (certVal) { infoCertEl.textContent = certVal; infoCertEl.hidden = false; }
          else infoCertEl.hidden = true;
        }

        if (mediaType === 'tv') {
          loadEpisodes(mediaId, data);
        }

        loadRecommendations(mediaId, mediaType);

        const modalContent = infoModal.querySelector('.info-modal-content');
        if (modalContent) modalContent.scrollTop = 0;

      } catch (err) {
        console.error('Info error:', err);
        infoTitleEl.textContent = 'Error loading';
        infoDescEl.textContent = "Couldn't fetch info. Please try again.";
      }
    }

    closeInfoBtn.addEventListener('click', () => closeModalEl(infoModal));
    infoBack.addEventListener('click', () => closeModalEl(infoModal));
    infoPlayBtn.addEventListener('click', () => {
      const id = infoPlayBtn.dataset.mediaId;
      const type = infoPlayBtn.dataset.mediaType;
      if (!id) { showToast('Coming soon'); return; }
      const topModal = modalStack[modalStack.length - 1];
      const opener = topModal ? topModal.opener : null;
      closeAllModalsAndOpenVideo(id, type, infoPlayBtn);
    });

    /* ============================================================
       EPISODES (in info modal)
       ============================================================ */
    function loadEpisodes(seriesId, seriesData) {
      const seasons = seriesData.seasons ? seriesData.seasons.filter(s => s.season_number > 0) : [];
      if (!seasons.length) {
        infoEpisodesEl.innerHTML = '<p style="color:var(--text-muted);padding:12px 0;">No episode data available.</p>';
        return;
      }

      const container = document.createElement('div');
      container.className = 'info-episodes-container';

      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.alignItems = 'center';
      header.style.gap = '16px';
      header.style.marginBottom = '12px';
      header.innerHTML = `<h3>Episodes</h3>`;

      const seasonSelectEl = document.createElement('select');
      seasonSelectEl.className = 'settings-input';
      seasonSelectEl.style.width = 'auto';
      seasonSelectEl.style.minWidth = '120px';
      seasons.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.season_number;
        opt.textContent = `Season ${s.season_number}`;
        seasonSelectEl.appendChild(opt);
      });
      header.appendChild(seasonSelectEl);
      container.appendChild(header);

      const listContainer = document.createElement('div');
      listContainer.className = 'episode-list';
      container.appendChild(listContainer);

      function renderEpisodes(seasonNumber) {
        listContainer.innerHTML = '';
        tmdb(`/tv/${seriesId}/season/${seasonNumber}`).then(data => {
          const episodes = data.episodes || [];
          if (!episodes.length) {
            listContainer.innerHTML = '<p style="color:var(--text-muted);padding:8px 0;">No episodes found.</p>';
            return;
          }
          episodes.forEach(ep => {
            const item = document.createElement('div');
            item.className = 'episode-item';
            item.innerHTML = `
              <div class="episode-info">
                <span class="episode-number">S${String(seasonNumber).padStart(2,'0')}E${String(ep.episode_number).padStart(2,'0')}</span>
                <span class="episode-name">${escapeHtml(ep.name || 'Untitled')}</span>
                ${ep.air_date ? `<span class="episode-airdate">${ep.air_date}</span>` : ''}
              </div>
              <button type="button" class="episode-play-btn" data-season="${seasonNumber}" data-episode="${ep.episode_number}">Play</button>
            `;
            listContainer.appendChild(item);
          });
          listContainer.querySelectorAll('.episode-play-btn').forEach(btn => {
            btn.addEventListener('click', () => {
              const s = Number(btn.dataset.season);
              const e = Number(btn.dataset.episode);
              closeAllModalsAndOpenVideo(seriesId, 'tv', btn);
              setTimeout(() => {
                currentSeason = s;
                currentEpisode = e;
                seasonSelect.value = s;
                episodeSelect.value = e;
                const subLang = getSettings().subtitleLang;
                videoPlayer.src = getEmbedUrl(seriesId, 'tv', s, e, subLang);
                touchWatched(seriesId, 'tv', s, e);
              }, 200);
            });
          });
        }).catch(() => {
          listContainer.innerHTML = '<p style="color:var(--text-muted);">Could not load episodes.</p>';
        });
      }

      seasonSelectEl.addEventListener('change', () => {
        renderEpisodes(Number(seasonSelectEl.value));
      });

      renderEpisodes(Number(seasonSelectEl.value));

      infoEpisodesEl.appendChild(container);
    }

    /* ============================================================
       RECOMMENDATIONS (More Like This) — Uses proven carousel logic
       Favorite & info buttons visible on hover.
       ============================================================ */
    function loadRecommendations(id, type) {
      const endpoint = type === 'movie' ? `/movie/${id}/recommendations` : `/tv/${id}/recommendations`;

      // Clear previous content
      moreLikeThisGrid.innerHTML = '';

      // Build carousel DOM structure (identical to main carousels)
      const wrapper = document.createElement('div');
      wrapper.className = 'carousel-wrapper';

      const btnLeft = document.createElement('button');
      btnLeft.type = 'button';
      btnLeft.className = 'scroll-btn scroll-left';
      btnLeft.setAttribute('aria-label', 'Previous');
      btnLeft.tabIndex = -1;
      btnLeft.innerHTML = `<svg class="scroll-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

      const moviesContainer = document.createElement('div');
      moviesContainer.className = 'movies';

      const loader = document.createElement('div');
      loader.className = 'carousel-loader';
      loader.innerHTML = '<div class="carousel-loader-ring"></div>';
      loader.hidden = true;

      const btnRight = document.createElement('button');
      btnRight.type = 'button';
      btnRight.className = 'scroll-btn scroll-right';
      btnRight.setAttribute('aria-label', 'Next');
      btnRight.tabIndex = -1;
      btnRight.innerHTML = `<svg class="scroll-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

      wrapper.appendChild(btnLeft);
      wrapper.appendChild(moviesContainer);
      wrapper.appendChild(btnRight);
      moreLikeThisGrid.appendChild(wrapper);

      // State object compatible with initCarouselUI
      const state = {
        list: moviesContainer,
        wrapper: wrapper,
        btnLeft: btnLeft,
        btnRight: btnRight,
        loader: loader,
        loading: false,
        exhausted: false,
        page: 1,
        seen: new Set(),
        genreId: null,          // not used for recs
        mode: 'all',
        loadMore: null,         // custom loader will be set
        initialized: false
      };

      // Custom loader function that fetches from recommendations endpoint
      async function loadRecPage(isFirst = false) {
        if (state.loading || state.exhausted) return;
        state.loading = true;
        if (!isFirst && state.loader) state.loader.hidden = false;

        try {
          const data = await tmdb(endpoint, { page: state.page });
          let items = data.results || [];
          // Filter only same media type
          items = items.filter(item => (item.media_type || type) === type);
          items = filterContent(items);
          // Sort by popularity
          items.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

          if (state.page === 1 && items.length === 0) {
            moreLikeThisGrid.innerHTML = '<p style="color:var(--text-muted);padding:8px 0;">No recommendations found.</p>';
            infoMoreLikeThis.style.display = '';
            return;
          }

          const results = items.filter(item => item.poster_path);
          for (const item of results) {
            const key = `${item.id}|${item._type || type}`;
            if (!state.seen.has(key)) {
              state.seen.add(key);
              // Create card with inModal flag to close modals on play
              const card = createCard({ ...item, _type: type }, { inModal: true });
              if (state.loader && state.loader.parentNode === state.list) {
                state.list.insertBefore(card, state.loader);
              } else {
                state.list.appendChild(card);
              }
            }
          }

          const totalPages = data.total_pages || 1;
          if (state.page >= totalPages) {
            state.exhausted = true;
          } else {
            state.page++;
          }

          if (state.exhausted && state.loader) state.loader.hidden = true;
          infoMoreLikeThis.style.display = '';
        } catch (err) {
          console.error('Recommendations error:', err);
          if (state.page === 1) {
            moreLikeThisGrid.innerHTML = '<p style="color:var(--text-muted);padding:8px 0;">Could not load recommendations.</p>';
            infoMoreLikeThis.style.display = '';
          }
        } finally {
          state.loading = false;
          if (!isFirst && state.loader && !state.exhausted) state.loader.hidden = true;
        }
      }

      // Assign custom loader to state
      state.loadMore = loadRecPage;

      // Add loader to end of list (cards inserted before it)
      moviesContainer.appendChild(loader);

      // Load first page, then initialize carousel UI
      loadRecPage(true).then(() => {
        initCarouselUI(state);
      });
    }

    /* ============================================================
       DONATE MODAL
       ============================================================ */
    const donateModal     = $('#donateModal');
    const closeDonateBtn  = $('#closeDonateModal');
    const donateBack      = donateModal.querySelector('.modal-backdrop');
    const donatePaypalBtn = $('#donatePaypalBtn');
    const donateCustomInp = $('#donateCustomAmount');
    const claimLinkBtn    = $('#claimDonorLinkBtn');

    let donateAmount = 5;

    function buildPaypalUrl(amount) {
      const n = Math.max(1, Math.floor(Number(amount) || 1));
      return `${PAYPAL_BASE}/${n}USD`;
    }

    function updateDonateUI() {
      donatePaypalBtn.href = buildPaypalUrl(donateAmount);
    }

    function selectAmount(amount, fromCustom) {
      donateAmount = amount;
      $$('.donate-amount-btn').forEach(b => {
        b.classList.toggle('is-selected', Number(b.dataset.amount) === amount);
      });
      const customWrap = donateCustomInp.parentElement;
      customWrap.classList.toggle('is-active', !!fromCustom);
      if (!fromCustom) donateCustomInp.value = '';
      updateDonateUI();
    }

    $$('.donate-amount-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectAmount(Number(btn.dataset.amount), false);
      });
    });

    donateCustomInp.addEventListener('input', () => {
      const v = Math.max(1, Math.floor(Number(donateCustomInp.value) || 0));
      if (v >= 1) selectAmount(v, true);
    });

    function openDonateModal(opener) {
      selectAmount(5, false);
      openModal(donateModal, opener);
    }

    closeDonateBtn.addEventListener('click', () => closeModalEl(donateModal));
    donateBack.addEventListener('click', () => closeModalEl(donateModal));

    const openDonateBtnEl = $('#openDonateBtn');
    if (openDonateBtnEl) openDonateBtnEl.addEventListener('click', (e) => openDonateModal(e.currentTarget));
    const openDonateFromMenuBtnEl = $('#openDonateFromMenuBtn');
    if (openDonateFromMenuBtnEl) openDonateFromMenuBtnEl.addEventListener('click', (e) => {
      closeProfileMenu();
      openDonateModal(e.currentTarget);
    });

    /* ── Claim donor modal ── */
    const claimModal      = $('#claimDonorModal');
    const closeClaimBtn   = $('#closeClaimDonor');
    const claimBack       = claimModal.querySelector('.modal-backdrop');
    const claimForm       = $('#claimDonorForm');
    const claimTxId       = $('#claimTxId');
    const claimDisplayInp = $('#claimDisplayName');

    function openClaimModal(opener) {
      claimTxId.value = '';
      claimDisplayInp.value = '';
      const u = getCurrentUser();
      if (u) claimDisplayInp.placeholder = u.given_name ? `${u.given_name} (default)` : 'How should we credit you?';
      openModal(claimModal, opener);
    }

    closeClaimBtn.addEventListener('click', () => closeModalEl(claimModal));
    claimBack.addEventListener('click', () => closeModalEl(claimModal));
    if (claimLinkBtn) claimLinkBtn.addEventListener('click', () => {
      closeModalEl(donateModal);
      setTimeout(() => openClaimModal(claimLinkBtn), 200);
    });

    claimForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const tx = claimTxId.value.trim();
      if (tx.length < 6) {
        showToast('Transaction ID looks too short', 2200);
        return;
      }
      const display = claimDisplayInp.value.trim();
      markAsDonor(tx, display);

      if (display) {
        const s = getSettings();
        if (!s.displayName) {
          s.displayName = display;
          saveSettings(s);
        }
      }

      closeModalEl(claimModal);
      showToast('🎉 Welcome, Supporter! Perks unlocked.', 3200, { gold: true });
      updateAuthUI();
    });

    /* ============================================================
       SETTINGS MODAL
       ============================================================ */
    const settingsModal   = $('#settingsModal');
    const closeSettings   = $('#closeSettingsModal');
    const settingsAvatar  = $('#settingsAvatar');
    const settingsName    = $('#settingsProfileName');
    const settingsEmail   = $('#settingsProfileEmail');
    const settingsSupRow  = $('#settingsSupporterRow');
    const settingsSince   = $('#settingsSupporterSince');
    const settingsDNRow   = $('#settingsDisplayNameRow');
    const settingsDNInput = $('#settingsDisplayNameInput');
    const settingsSubLang = $('#settingsSubtitleLang');
    const settingsReduce  = $('#settingsReduceMotion');
    const settingsBanner  = $('#settingsShowBanner');
    const settingsGoldRow = $('#settingsGoldThemeRow');
    const settingsGold    = $('#settingsGoldTheme');
    const settingsAdult    = $('#settingsAdultContent');
    const settingsFavCnt   = $('#settingsFavCount');
    const settingsClearF  = $('#settingsClearFavs');
    const settingsClearA  = $('#settingsClearAll');
    const settingsSignOut = $('#settingsSignOut');
    const settingsOpenDon = $('#settingsOpenDonate');

    function updateSettingsUI() {
      const user = getCurrentUser();
      const s = getSettings();
      const donor = isDonor();

      if (user) {
        const fallback = makeInitialsAvatar(user.name || user.email || '?');
        settingsAvatar.src = user.picture || fallback;
        settingsAvatar.onerror = () => { settingsAvatar.src = fallback; };
        settingsName.textContent  = getDisplayName(user);
        settingsEmail.textContent = user.email || '';
        if (settingsSignOut) settingsSignOut.style.display = '';
      } else {
        settingsAvatar.src = makeInitialsAvatar('Guest');
        settingsName.textContent  = 'Guest';
        settingsEmail.textContent = 'Not signed in';
        if (settingsSignOut) settingsSignOut.style.display = 'none';
      }

      settingsSupRow.hidden = !donor;
      if (donor) {
        const info = getDonorInfo();
        if (info && info.claimedAt) {
          const d = new Date(info.claimedAt);
          settingsSince.textContent = `· since ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        }
      }

      settingsDNRow.hidden = !donor;
      settingsDNInput.value = s.displayName || '';

      settingsSubLang.value = s.subtitleLang || 'en';
      settingsReduce.checked = !!s.reduceMotion;
      settingsBanner.checked = !!s.showBanner;
      settingsGoldRow.hidden = !donor;
      settingsGold.checked = !!s.goldTheme;
      settingsAdult.checked = !s.adultContent;
      settingsFavCnt.textContent = getFavorites().length;
    }

    function openSettingsModal(opener) {
      updateSettingsUI();
      openModal(settingsModal, opener);
    }

    closeSettings.addEventListener('click', () => closeModalEl(settingsModal));
    settingsModal.querySelector('.modal-backdrop').addEventListener('click', () => closeModalEl(settingsModal));

    const openSettingsBtnEl = $('#openSettingsBtn');
    if (openSettingsBtnEl) openSettingsBtnEl.addEventListener('click', () => {
      closeProfileMenu();
      openSettingsModal($('#profileBtn'));
    });

    settingsDNInput.addEventListener('input', () => {
      const s = getSettings();
      s.displayName = settingsDNInput.value;
      saveSettings(s);
      updateAuthUI();
    });
    settingsSubLang.addEventListener('change', () => {
      const s = getSettings();
      s.subtitleLang = settingsSubLang.value;
      saveSettings(s);
      if (currentMediaId && videoModal.classList.contains('active')) {
        const subLang = s.subtitleLang;
        if (currentMediaType === 'movie') {
          videoPlayer.src = getEmbedUrl(currentMediaId, 'movie', undefined, undefined, subLang);
        } else {
          videoPlayer.src = getEmbedUrl(currentMediaId, 'tv', currentSeason, currentEpisode, subLang);
        }
        showToast('Subtitle language updated', 1600);
      }
    });
    settingsReduce.addEventListener('change', () => {
      const s = getSettings();
      s.reduceMotion = settingsReduce.checked;
      saveSettings(s);
      applySettings();
    });
    settingsBanner.addEventListener('change', () => {
      const s = getSettings();
      s.showBanner = settingsBanner.checked;
      saveSettings(s);
      applySettings();
    });
    settingsGold.addEventListener('change', () => {
      const s = getSettings();
      s.goldTheme = settingsGold.checked;
      saveSettings(s);
    });
    settingsAdult.addEventListener('change', () => {
      const s = getSettings();
      s.adultContent = !settingsAdult.checked;
      saveSettings(s);
      buildCatalog(currentView);
      initBanner(currentView);
      refreshActiveSearch();
      showToast(
        settingsAdult.checked
          ? 'Explicit content filter on'
          : 'Explicit content filter off — adult titles may appear',
        2400,
        { gold: !settingsAdult.checked }
      );
    });
    settingsClearF.addEventListener('click', () => {
      if (!confirm('Clear all favorites on this device?')) return;
      clearFavorites();
      updateSettingsUI();
      rebuildAfterAuthChange();
      showToast('Favorites cleared', 1600);
    });
    settingsClearA.addEventListener('click', () => {
      if (!confirm('This removes settings, favorites, and supporter status from this device. Continue?')) return;
      try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('poporopo_')) keys.push(k);
        }
        keys.forEach(k => localStorage.removeItem(k));
      } catch (e) {}
      setCurrentUser(null);
      closeModalEl(settingsModal);
      applySettings();
      updateAuthUI();
      rebuildAfterAuthChange();
      showToast('Local data cleared', 1800);
    });
    settingsSignOut.addEventListener('click', () => {
      closeModalEl(settingsModal);
      signOut();
    });
    settingsOpenDon.addEventListener('click', () => {
      closeModalEl(settingsModal);
      setTimeout(() => openDonateModal($('#openDonateBtn')), 200);
    });

    /* ============================================================
       KEYBOARD HANDLER
       ============================================================ */
    document.addEventListener('keydown', (e) => {
      if (modalStack.length && e.key === 'Tab') {
        trapTab(modalStack[modalStack.length - 1].el, e);
        return;
      }

      const backKeys = ['Escape', 'Back', 'BrowserBack', 'GoBack', 'XF86Back'];
      if (backKeys.includes(e.key)) {
        if (modalStack.length) {
          const top = modalStack[modalStack.length - 1].el;
          if (top === videoModal) closeVideoModal();
          else closeModalEl(top);
          e.preventDefault();
        } else if (profileMenuOpen) {
          closeProfileMenu();
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
      if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT') return;
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
            return r.top > rect.bottom - 5 && Math.abs(r.left - rect.left) < rect.width / 2;
          });
        } else {
          const section = active.closest('.carousel-section');
          let next = section ? section.nextElementSibling : null;
          while (next && !next.classList.contains('carousel-section')) next = next.nextElementSibling;
          while (next && next.hidden) {
            next = next.nextElementSibling;
            while (next && !next.classList.contains('carousel-section')) next = next.nextElementSibling;
          }
          if (next) target = findClosestCardByLeft(next, refLeft);
        }
      } else if (e.key === 'ArrowUp') {
        const inGrid = active.closest('.search-grid');
        if (inGrid) {
          const rect = active.getBoundingClientRect();
          const candidates = [...inGrid.querySelectorAll('.movie')].reverse();
          target = candidates.find(c => {
            const r = c.getBoundingClientRect();
            return r.bottom < rect.top + 5 && Math.abs(r.left - rect.left) < rect.width / 2;
          });
        } else {
          const section = active.closest('.carousel-section');
          let prev = section ? section.previousElementSibling : null;
          while (prev && !prev.classList.contains('carousel-section')) prev = prev.previousElementSibling;
          while (prev && prev.hidden) {
            prev = prev.previousElementSibling;
            while (prev && !prev.classList.contains('carousel-section')) prev = prev.previousElementSibling;
          }
          if (prev) target = findClosestCardByLeft(prev, refLeft);
          if (!target) target = searchBar;
        }
      } else {
        preventDefault = false;
      }

      if (preventDefault && target) {
        e.preventDefault();
        if (target === searchBar) {
          searchBar.focus();
          scrollToOpts(window, { top: 0 });
        } else {
          focusCard(target);
        }
      }
    });

    /* ============================================================
       TV MEMORY MANAGEMENT
       ============================================================ */
    let imageMemObserver = null;
    function setupImageMemoryManagement() {
      if (!IS_TV) return;
      if (!SUPPORTS.IntersectionObserver) return;
      imageMemObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          const img = entry.target;
          if (entry.isIntersecting) {
            const real = img.getAttribute('data-real-src');
            if (real && (img.src.startsWith('data:') || !img.src.includes(real.slice(-30)))) {
              img.src = real;
            }
          } else {
            const real = img.getAttribute('data-real-src');
            if (real && !img.src.startsWith('data:')) {
              img.src = PLACEHOLDER_POSTER;
            }
          }
        }
      }, { rootMargin: '150px 100px 150px 100px', threshold: 0 });
    }
    function registerImageForMemory(img, realSrc) {
      if (!IS_TV || !imageMemObserver || !realSrc) return;
      img.setAttribute('data-real-src', realSrc);
      imageMemObserver.observe(img);
    }

    function unloadAllPosters() {
      document.querySelectorAll('.movie img').forEach(img => {
        let real = img.getAttribute('data-real-src');
        if (!real && img.src && !img.src.startsWith('data:')) {
          real = img.src;
          img.setAttribute('data-real-src', real);
        }
        if (real && !img.src.startsWith('data:')) {
          img.src = PLACEHOLDER_POSTER;
        }
      });
    }

    function reloadVisiblePosters() {
      const winH = window.innerHeight;
      document.querySelectorAll('.movie img[data-real-src]').forEach(img => {
        const r = img.getBoundingClientRect();
        const onScreen = r.bottom > -200 && r.top < winH + 200;
        if (onScreen && img.src.startsWith('data:')) {
          img.src = img.getAttribute('data-real-src');
        }
      });
    }

    /* ============================================================
       QUALITY + CONTENT RATING
       ============================================================ */
    const certCache = new Map();

    function isCamQuality(item) {
      const type = item._type || item.media_type;
      const dateStr = item.release_date || item.first_air_date || '';
      if (type === 'movie' && dateStr) {
        const rel = new Date(dateStr);
        if (!isNaN(rel.getTime())) {
          const days = (Date.now() - rel.getTime()) / 86400000;
          if (days >= 0 && days < 45) return true;
        }
      }
      return false;
    }
    function isLikelyUnavailable(item) {
      const dateStr = item.release_date || item.first_air_date || '';
      if (!dateStr) return true;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return true;
      if (d.getTime() > Date.now()) return true;
      return false;
    }
    function qualityLabel(item) {
      return 'HD';
    }

    function pickUsCertMovie(results) {
      if (!results || !results.length) return '';
      const order = ['US', 'GB', 'CA', 'AU'];
      for (const code of order) {
        const entry = results.find(r => r.iso_3166_1 === code);
        if (entry && entry.release_dates) {
          const withCert = entry.release_dates.find(rd => rd.certification);
          if (withCert) return withCert.certification;
        }
      }
      for (const entry of results) {
        if (entry.release_dates) {
          const withCert = entry.release_dates.find(rd => rd.certification);
          if (withCert) return withCert.certification;
        }
      }
      return '';
    }

    function pickUsCertTv(results) {
      if (!results || !results.length) return '';
      const order = ['US', 'GB', 'CA', 'AU'];
      for (const code of order) {
        const entry = results.find(r => r.iso_3166_1 === code);
        if (entry && entry.rating) return entry.rating;
      }
      for (const entry of results) {
        if (entry.rating) return entry.rating;
      }
      return '';
    }

    function fetchCertification(id, type) {
      const key = id + '|' + type;
      if (certCache.has(key)) return Promise.resolve(certCache.get(key));
      const path = type === 'movie'
        ? '/movie/' + id + '/release_dates'
        : '/tv/' + id + '/content_ratings';
      return tmdb(path).then(data => {
        const cert = type === 'movie' ? pickUsCertMovie(data.results) : pickUsCertTv(data.results);
        certCache.set(key, cert || '');
        return cert || '';
      }).catch(() => { certCache.set(key, ''); return ''; });
    }

    /* ============================================================
       CARDS
       ============================================================ */
    function createCard(item, opts) {
      opts = opts || {};
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
      card.setAttribute('aria-label', `Play ${title}`);

      const img = document.createElement('img');
      img.alt = `${title} poster`;
      img.loading = 'lazy';
      if (!IS_TV) img.decoding = 'async';
      img.width = 160; img.height = 240;
      const realSrc = posterUrl(item.poster_path);
      img.src = realSrc || PLACEHOLDER_POSTER;
      img.onerror = () => { img.src = PLACEHOLDER_POSTER; };
      card.appendChild(img);
      registerImageForMemory(img, realSrc);

      const favBtn = document.createElement('button');
      favBtn.type = 'button';
      favBtn.className = 'movie-fav-btn';
      const fav = isFavorite(item.id, item._type);
      if (fav) favBtn.classList.add('is-fav');
      favBtn.setAttribute('aria-pressed', fav ? 'true' : 'false');
      favBtn.setAttribute('aria-label', fav ? 'Remove from favorites' : 'Add to favorites');
      favBtn.title = fav ? 'Remove from favorites' : 'Add to favorites';
      favBtn.tabIndex = -1;
      favBtn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
      card.appendChild(favBtn);

      favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        handleFavoriteToggle(item, favBtn);
      });
      favBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
      });

      if (!IS_TV) {
        const infoBtn = document.createElement('button');
        infoBtn.type = 'button';
        infoBtn.className = 'movie-info-btn';
        infoBtn.setAttribute('aria-label', `More info about ${title}`);
        infoBtn.title = 'More info';
        infoBtn.tabIndex = -1;
        infoBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="12" y1="7" x2="12.01" y2="7"/></svg>`;
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

      if (!IS_TV) {
        const overlay = document.createElement('div');
        overlay.className = 'movie-overlay';
        const quality = qualityLabel(item);
        overlay.innerHTML = `
          <div class="overlay-content">
            <p class="overlay-title">${escapeHtml(title)}</p>
            <div class="overlay-meta">
              <span>${escapeHtml(year || '—')}</span>
              <span class="badge-sm">${escapeHtml(quality)}</span>
              <span class="badge-rating" hidden></span>
            </div>
            <span class="overlay-play" aria-hidden="true">▶</span>
          </div>`;
        card.appendChild(overlay);

        let ratingRequested = false;
        const loadRating = () => {
          if (ratingRequested) return;
          ratingRequested = true;
          fetchCertification(item.id, type).then(cert => {
            if (!cert) return;
            const rEl = overlay.querySelector('.badge-rating');
            if (rEl) { rEl.textContent = cert; rEl.hidden = false; }
          }).catch(() => {});
        };
        card.addEventListener('mouseenter', loadRating);
        card.addEventListener('focus', loadRating, true);
      }

      // Activation: open video (close modals if inside a modal)
      const activate = () => {
        if (opts.inModal) {
          closeAllModalsAndOpenVideo(item.id, type, card);
        } else {
          openVideoModal(item.id, type, card);
        }
      };
      const showInfo = (opener) => openInfoModal(item.id, type, opener || card);

      card.addEventListener('click', activate);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
        if (e.key === 'i' || e.key === 'I')     { e.preventDefault(); showInfo(card); }
        if (e.key === 'f' || e.key === 'F')     {
          e.preventDefault();
          handleFavoriteToggle(item, card.querySelector('.movie-fav-btn'));
        }
      });
      if (!IS_TV) {
        card.addEventListener('contextmenu', (e) => { e.preventDefault(); showInfo(card); });
      }
      return card;
    }

    /* ============================================================
       CAROUSELS
       ============================================================ */
    function createCarouselSection(genre, mediaMode) {
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
          <button type="button" class="scroll-btn scroll-left" aria-label="Previous" tabindex="-1">
            <svg class="scroll-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div class="movies"></div>
          <button type="button" class="scroll-btn scroll-right" aria-label="Next" tabindex="-1">
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
        mode: mediaMode || 'all',
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

      const observerMargin = IS_TV ? '300px' : '200px';
      var observer = null;
      if (SUPPORTS.IntersectionObserver) {
        observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              initCarousel();
              if (observer) observer.unobserve(section);
            }
          });
        }, { rootMargin: observerMargin });
        observer.observe(section);
      }

      if (genre._eager || IS_TV || !SUPPORTS.IntersectionObserver) {
        var delay = genre._delay || 0;
        if (delay > 0) setTimeout(initCarousel, delay);
        else initCarousel();
      }
      return section;
    }

    async function loadMoreCarousel(state, isFirst = false) {
      if (state.loading || state.exhausted) return;
      if (state.page > MAX_PAGES_PER_GENRE) { state.exhausted = true; return; }
      state.loading = true;
      if (state.loader && !isFirst) state.loader.hidden = false;

      const includeAdult = getSettings().adultContent ? 'true' : 'false';
      const mode = state.mode || 'all';
      const wantMovie = (mode === 'all' || mode === 'movie');
      const tvGenre = mode === 'tv' ? state.genreId : MOVIE_TO_TV_GENRE[state.genreId];
      const wantTv = (mode === 'tv') || (mode === 'all' && tvGenre != null);

      try {
        const [movieData, tvData] = await Promise.all([
          wantMovie ? tmdb('/discover/movie', {
            with_genres: state.genreId, page: state.page,
            sort_by: 'popularity.desc', 'vote_count.gte': 30, region: REGION,
            include_adult: includeAdult
          }) : Promise.resolve(null),
          wantTv ? tmdb('/discover/tv', {
            with_genres: tvGenre, page: state.page,
            sort_by: 'popularity.desc', 'vote_count.gte': 30, region: REGION,
            include_adult: includeAdult
          }) : Promise.resolve(null)
        ]);

        let items = [];
        if (movieData && movieData.results) items.push(...movieData.results.map(m => ({ ...m, _type: 'movie' })));
        if (tvData && tvData.results)       items.push(...tvData.results.map(t => ({ ...t, _type: 'tv' })));
        items = filterContent(items);
        items.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

        if (IS_TV) items = items.slice(0, 10);

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

        const movieExhausted = !wantMovie || !movieData || movieData.page >= movieData.total_pages || !(movieData.results && movieData.results.length);
        const tvExhausted    = !wantTv    || !tvData    || tvData.page    >= tvData.total_pages    || !(tvData.results && tvData.results.length);
        if (movieExhausted && tvExhausted) state.exhausted = true;
        else {
          state.page++;
          if (state.page > MAX_PAGES_PER_GENRE) state.exhausted = true;
        }

        if (state.exhausted && state.loader) state.loader.hidden = true;
        catalogLoadOK = true;
      } catch (err) {
        console.error('TMDB carousel error:', err);
        /* Reintento transitorio con backoff (1s, 2s): en Smart TV el WiFi
           suele ser debil y un fallo momentaneo no debe dejar la fila
           vacia. Acotado a 3 intentos: nada de bucles infinitos. */
        state.failures = (state.failures || 0) + 1;
        if (state.failures < 3) {
          state.loading = false;
          await new Promise(r => setTimeout(r, 1000 * state.failures));
          try { await loadMoreCarousel(state, isFirst); } catch (e2) {}
          return;
        }
        catalogLoadFailures++;
        /* CRÍTICO: sin exhausted, updateUI() ve la lista vacía (scrollWidth 0),
           entra en `remaining < 800` y reintenta TMDB en un bucle infinito.
           La página nunca llega a network-idle y Lighthouse/PageSpeed
           abortan el run con NO_LCP ("page stopped responding"). */
        state.exhausted = true;
        maybeShowLoadError();
      } finally {
        state.loading = false;
        if (!isFirst && state.loader && !state.exhausted) state.loader.hidden = true;
      }
    }

    function initCarouselUI(state) {
      const { wrapper, list, btnLeft, btnRight } = state;
      // Support pluggable loader; fallback to loadMoreCarousel
      const loadFn = state.loadMore || loadMoreCarousel;

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
        btn.tabIndex = -1;
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
          loadFn(state).then(updateUI);
        }
      };

      btnLeft.addEventListener('click', () =>
        scrollByOpts(list, { left: -getScrollAmount() })
      );
      btnRight.addEventListener('click', () => {
        scrollByOpts(list, { left: getScrollAmount() });
        if (!state.exhausted) loadFn(state).then(updateUI);
      });

      let ticking = false;
      list.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => { updateUI(); ticking = false; });
      }, { passive: true });

      window.addEventListener('resize', updateUI);
      if (!IS_TV && 'ResizeObserver' in window) new ResizeObserver(updateUI).observe(list);

      updateUI();
    }

    /* Cáscara común de los carruseles alimentados desde localStorage
       (favoritos / recientes): misma estructura que los carruseles de
       géneros, pero sin paginación (exhausted siempre) y con los datos
       en el propio estado. La sección nace oculta; la función update
       correspondiente decide cuándo mostrarla. */
    function createLocalCarouselShell(sectionClass, sectionId, title) {
      const section = document.createElement('section');
      section.className = 'carousel-section ' + sectionClass;
      section.id = sectionId;
      section.hidden = true;
      section.innerHTML = `
        <div class="section-header">
          <h2 class="section-title">
            <span class="title-accent" aria-hidden="true">|</span> ${title || ''}
          </h2>
        </div>
        <div class="carousel-wrapper">
          <button type="button" class="scroll-btn scroll-left" aria-label="Previous" tabindex="-1">
            <svg class="scroll-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div class="movies"></div>
          <button type="button" class="scroll-btn scroll-right" aria-label="Next" tabindex="-1">
            <svg class="scroll-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>`;
      const state = {
        list:     section.querySelector('.movies'),
        wrapper:  section.querySelector('.carousel-wrapper'),
        btnLeft:  section.querySelector('.scroll-left'),
        btnRight: section.querySelector('.scroll-right'),
        loader:   null,
        loading:  false,
        exhausted: true,
        page: 999,
        seen: new Set(),
      };
      initCarouselUI(state);
      section._localState = state;
      return { section, state };
    }

    function createFavoritesSection(kind, title) {
      kind = kind || 'all';
      const { section, state } = createLocalCarouselShell('favorites-section', 'favoritesSection_' + kind, title || 'Favorites');
      section.dataset.favKind = kind;
      section._favState = state; /* compat: updateFavoritesSection usa _favState */
      return section;
    }

    /* "Recently Watched" va SIEMPRE primero en el catálogo, pero solo es
       visible tras iniciar sesión (updateWatchedSection lo decide). */
    function createWatchedSection(title) {
      const { section } = createLocalCarouselShell('watched-section', 'watchedSection', title || 'Recently Watched');
      return section;
    }

    function updateFavoritesSection() {
      const sections = document.querySelectorAll('.favorites-section');
      if (!sections.length) return;
      const favs = getFavorites();
      sections.forEach(section => {
        const kind = section.dataset.favKind || 'all';
        const list = section.querySelector('.movies');
        const items = kind === 'all' ? favs : favs.filter(f => f._type === kind);
        if (items.length === 0) {
          section.hidden = true;
          list.innerHTML = '';
          if (section._favState) section._favState.seen = new Set();
          return;
        }
        section.hidden = false;
        const state = section._favState;
        list.innerHTML = '';
        if (state) state.seen = new Set();
        items.forEach(fav => {
          const card = createCard(fav);
          list.appendChild(card);
          if (state) state.seen.add(`${fav.id}|${fav._type}`);
        });
        list.dispatchEvent(new Event('scroll'));
      });
    }

    function updateWatchedSection() {
      const sections = document.querySelectorAll('.watched-section');
      if (!sections.length) return;
      /* Requisito: la fila solo existe DESPUÉS de iniciar sesión. Los
         invitados no la ven aunque tengan historial local (su historial
         se migra a la cuenta al entrar). */
      const user = getCurrentUser();
      const items = user ? getWatched() : [];
      sections.forEach(section => {
        const list = section.querySelector('.movies');
        if (items.length === 0) {
          section.hidden = true;
          list.innerHTML = '';
          if (section._localState) section._localState.seen = new Set();
          return;
        }
        section.hidden = false;
        const state = section._localState;
        list.innerHTML = '';
        if (state) state.seen = new Set();
        items.forEach(item => {
          const card = createCard(item);
          list.appendChild(card);
          if (state) state.seen.add(`${item.id}|${item._type}`);
        });
        list.dispatchEvent(new Event('scroll'));
      });
    }

    function buildCatalog(view) {
      view = view || currentView;
      const catalog = $('#catalog');
      catalog.innerHTML = '';
      /* Recently Watched es el PRIMER carrusel, incluso antes que los
         favoritos. Nace oculto y updateWatchedSection lo muestra solo
         cuando hay sesión iniciada y hay historial. */
      catalog.appendChild(createWatchedSection('Recently Watched'));
      if (view === 'movie') {
        catalog.appendChild(createFavoritesSection('movie', 'Favorite Movies'));
      } else if (view === 'tv') {
        catalog.appendChild(createFavoritesSection('tv', 'Favorite Series'));
      } else {
        catalog.appendChild(createFavoritesSection('movie', 'Favorite Movies'));
        catalog.appendChild(createFavoritesSection('tv', 'Favorite Series'));
      }
      const mode = view === 'movie' ? 'movie' : (view === 'tv' ? 'tv' : 'all');
      const genreList = view === 'tv' ? TV_GENRES_VISIBLE : GENRES;
      genreList.forEach((genre, i) => {
        const g = {
          ...genre,
          _eager: i < 2,
          _delay: IS_TV ? i * 300 : 0
        };
        catalog.appendChild(createCarouselSection(g, mode));
      });
      updateFavoritesSection();
      updateWatchedSection();
    }

    let catalogLoadOK = false;
    let catalogLoadFailures = 0;
    let loadErrorShown = false;

    function maybeShowLoadError() {
      if (loadErrorShown || catalogLoadOK) return;
      if (catalogLoadFailures < 3) return;
      loadErrorShown = true;
      const catalog = $('#catalog');
      if (!catalog) return;
      catalog.innerHTML =
        '<div class="load-error">' +
          '<h2>We couldn\u2019t load the catalog</h2>' +
          '<p>Check your internet connection and try again. ' +
          'On older Smart TVs, please make sure your browser is up to date.</p>' +
          '<button type="button" class="btn btn-play" id="reloadBtn">Reload</button>' +
        '</div>';
      const rb = $('#reloadBtn');
      if (rb) rb.addEventListener('click', () => { location.reload(); });
    }

    /* ============================================================
       BANNER
       ============================================================ */
    async function initBanner(view) {
      view = view || currentView;
      const banner   = $('#mainBanner');
      const content  = $('#bannerContent');
      const titleEl  = $('#bannerTitle');
      const descEl   = $('#bannerDesc');
      const metaEl   = $('#bannerMeta');
      const playBtn  = $('#bannerPlayBtn');
      const infoBtn  = $('#bannerInfoBtn');

      try {
        let endpoint = '/trending/all/week';
        if (view === 'movie') endpoint = '/trending/movie/week';
        else if (view === 'tv') endpoint = '/trending/tv/week';
        const data = await tmdb(endpoint);
        const safe = filterContent(data.results || []);
        const item = safe.find(i =>
          i.backdrop_path && i.overview && i.poster_path && i.media_type !== 'person'
        );
        if (!item) return;

        const mediaType = item.media_type || (view === 'tv' ? 'tv' : 'movie');
        const title = item.title || item.name || '';
        banner.style.backgroundImage = `url('${backdropUrl(item.backdrop_path)}')`;
        titleEl.textContent = title;
        descEl.textContent  = item.overview || '';

        const year = (item.release_date || item.first_air_date || '').slice(0, 4);
        const quality = qualityLabel({ ...item, _type: mediaType });
        metaEl.innerHTML = `
          <span class="badge badge-hd">${escapeHtml(quality)}</span>
          <span class="badge badge-cert" id="bannerCert" hidden></span>
          ${year ? `<span class="badge">${escapeHtml(year)}</span>` : ''}
          <span class="badge">Trending</span>
        `;
        fetchCertification(item.id, mediaType).then(cert => {
          const cEl = $('#bannerCert');
          if (cEl && cert) { cEl.textContent = cert; cEl.hidden = false; }
        }).catch(() => {});

        playBtn.dataset.mediaId   = item.id;
        playBtn.dataset.mediaType = mediaType;
        infoBtn.dataset.mediaId   = item.id;
        infoBtn.dataset.mediaType = mediaType;

        playBtn.onclick = () => openVideoModal(item.id, mediaType, playBtn);
        infoBtn.onclick = () => openInfoModal(item.id, mediaType, infoBtn);

        const btns = $('#bannerButtons');
        if (btns) btns.hidden = false;
        content.hidden = false;
      } catch (err) {
        console.error('Banner error:', err);
        content.hidden = false;
        titleEl.textContent = 'POPOROPO';
        descEl.textContent  = 'Free HD movies and TV shows.';
      }
    }

    /* ============================================================
       SEARCH
       ============================================================ */
    const searchBar      = $('#searchBar');
    const searchClearBtn = $('#searchClear');
    const emptyMsg       = $('#searchEmpty');
    const searchTermEl   = $('#searchTerm');
    const searchArea     = $('#searchResults');
    const searchGrid     = $('#searchGrid');
    const catalogEl      = $('#catalog');
    const bannerEl       = $('#mainBanner');

    const SEARCH_DEBOUNCE = 250;

    let searchTimer = null;
    let searchAbort = null;
    let searchToken = 0;
    let lastQuery   = '';   // query whose results are currently on screen

    function makeAbortController() {
      if (SUPPORTS.AbortController) return new AbortController();
      return { signal: undefined, abort: function () {} };
    }

    /* Drop a queued debounce AND any request already in flight. Bumping the
       token is what stops a late response from repainting the grid or
       flashing the "no results" pill once the user has moved on. */
    function cancelPendingSearch() {
      clearTimeout(searchTimer);
      searchTimer = null;
      searchToken++;
      if (searchAbort) { searchAbort.abort(); searchAbort = null; }
      lastQuery = '';
    }

    function clearSearch() {
      searchBar.value = '';
      searchClearBtn.hidden = true;
      showCatalog();
      searchBar.focus();
    }

    function showCatalog() {
      cancelPendingSearch();
      const s = getSettings();
      bannerEl.style.display = s.showBanner ? '' : 'none';
      catalogEl.hidden = false;
      searchArea.hidden = true;
      searchGrid.innerHTML = '';
      emptyMsg.hidden = true;
    }

    async function runSearch(query) {
      const q = query.toLowerCase().trim();
      if (!q) { showCatalog(); return; }
      // Typing a trailing space (or re-pressing Enter) must not refetch and
      // wipe the results that are already on screen.
      if (q === lastQuery) return;

      clearTimeout(searchTimer);
      searchTimer = null;
      if (searchAbort) searchAbort.abort();
      searchAbort = makeAbortController();
      const signal  = searchAbort.signal;
      const myToken = ++searchToken;
      lastQuery = q;

      bannerEl.style.display = 'none';
      catalogEl.hidden = true;
      searchArea.hidden = false;
      emptyMsg.hidden = true;
      searchGrid.innerHTML = '<div class="search-loading"><div class="spinner-ring"></div></div>';
      scrollToOpts(window, { top: 0 });

      const includeAdult = getSettings().adultContent ? 'true' : 'false';
      try {
        // Kick off the person lookup alongside the title search instead of
        // waiting for the title pages to finish first.
        const personPromise = searchByPerson(query, includeAdult, signal);

        const first = await tmdb('/search/multi', { query, include_adult: includeAdult, page: 1 }, { signal });
        if (myToken !== searchToken) return;
        let raw = (first.results || []).slice();
        const totalPages = Math.min(first.total_pages || 1, MAX_SEARCH_PAGES);
        if (totalPages > 1) {
          const nums = [];
          for (let p = 2; p <= totalPages; p++) nums.push(p);
          const more = await Promise.all(nums.map(p =>
            tmdb('/search/multi', { query, include_adult: includeAdult, page: p }, { signal }).catch(() => null)
          ));
          if (myToken !== searchToken) return;
          more.forEach(d => { if (d && d.results) raw = raw.concat(d.results); });
        }
        const personItems = await personPromise;
        if (myToken !== searchToken) return;
        const merged = [];
        raw.forEach(item => {
          if ((item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path) {
            merged.push({ ...item, _type: item.media_type });
          }
        });
        personItems.forEach(item => merged.push(item));
        const byKey = new Map();
        for (const it of merged) {
          const key = it.id + '|' + it._type;
          const prev = byKey.get(key);
          if (!prev) byKey.set(key, it);
          else if (it._personRole === 'director' && prev._personRole !== 'director') byKey.set(key, it);
        }
        let results = filterContent([...byKey.values()]);
        results.sort((a, b) => {
          const ta = (a.title || a.name || '').toLowerCase();
          const tb = (b.title || b.name || '').toLowerCase();
          if (ta === q && tb !== q) return -1;
          if (tb === q && ta !== q) return 1;
          const aStarts = ta.startsWith(q), bStarts = tb.startsWith(q);
          if (aStarts && !bStarts) return -1;
          if (bStarts && !aStarts) return 1;
          const aDir = a._personRole === 'director', bDir = b._personRole === 'director';
          if (aDir && !bDir) return -1;
          if (bDir && !aDir) return 1;
          const aHas = ta.includes(q), bHas = tb.includes(q);
          if (aHas && !bHas) return -1;
          if (bHas && !aHas) return 1;
          return (b.popularity || 0) - (a.popularity || 0);
        });
        if (IS_TV) results = results.slice(0, 60);
        if (myToken !== searchToken) return;
        searchGrid.innerHTML = '';
        if (results.length === 0) {
          searchTermEl.textContent = query;
          emptyMsg.hidden = false;
        } else {
          emptyMsg.hidden = true;
          renderSearchResults(results, myToken);
        }
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        if (myToken !== searchToken) return;
        console.error('Search error:', err);
        // Let the same query be retried after a failure.
        lastQuery = '';
        searchGrid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:40px;">Search error. Please try again.</p>';
      }
    }

    function searchByPerson(query, includeAdult, signal) {
      const q = query.toLowerCase().trim();
      if (q.length < 3) return Promise.resolve([]);
      return tmdb('/search/person', { query, include_adult: includeAdult, page: 1 }, { signal })
        .then(data => {
          const people = (data.results || []).filter(p => (p.popularity || 0) > 1);
          const strong = people.filter(p => {
            const n = (p.name || '').toLowerCase();
            const words = n.split(/\s+/);
            return n === q || n.startsWith(q) || words.some(w => w === q) ||
                   (q.indexOf(' ') !== -1 && n.indexOf(q) !== -1);
          });
          strong.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
          const picks = strong.slice(0, 2);
          if (!picks.length) return [];
          return Promise.all(picks.map(p =>
            tmdb('/person/' + p.id + '/combined_credits', null, { signal }).catch(() => null)
          )).then(arr => {
            const items = [];
            arr.forEach(c => {
              if (!c) return;
              const combined = [];
              (c.crew || []).forEach(x => { if (x.job === 'Director') combined.push({ ...x, _personRole: 'director' }); });
              (c.cast || []).forEach(x => combined.push({ ...x, _personRole: 'cast' }));
              combined.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
              combined.slice(0, 40).forEach(x => {
                if ((x.media_type === 'movie' || x.media_type === 'tv') && x.poster_path) {
                  items.push({ ...x, _type: x.media_type });
                }
              });
            });
            return items;
          });
        })
        .catch(() => []);
    }

    function renderSearchResults(results, token) {
      searchGrid.innerHTML = '';
      let i = 0;
      const CHUNK = 40;
      const step = () => {
        if (token !== searchToken) return;
        const frag = document.createDocumentFragment();
        const end = Math.min(i + CHUNK, results.length);
        for (; i < end; i++) frag.appendChild(createCard(results[i]));
        searchGrid.appendChild(frag);
        if (i < results.length) (window.requestAnimationFrame || window.setTimeout)(step);
        else if (IS_TV) {
          const firstCard = searchGrid.querySelector('.movie');
          if (firstCard) setTimeout(() => firstCard.focus(), 100);
        }
      };
      step();
    }

    searchBar.addEventListener('input', function () {
      searchClearBtn.hidden = !this.value;
      clearTimeout(searchTimer);
      searchTimer = null;
      const q = this.value.trim();
      if (!q) { showCatalog(); return; }
      if (q.toLowerCase() === lastQuery) return;
      searchTimer = setTimeout(() => runSearch(q), SEARCH_DEBOUNCE);
    });

    // Enter commits straight away instead of waiting out the debounce, and
    // drops focus so the on-screen keyboard gets out of the way.
    searchBar.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      clearTimeout(searchTimer);
      searchTimer = null;
      const q = this.value.trim();
      if (!q) { showCatalog(); return; }
      runSearch(q);
      this.blur();
    });

    searchClearBtn.addEventListener('click', clearSearch);

    /* The explicit-content filter applies to search as well as browsing, so
       re-run whatever is on screen when it changes. */
    function refreshActiveSearch() {
      if (searchArea.hidden || !lastQuery) return;
      const q = lastQuery;
      lastQuery = '';
      runSearch(q);
    }

    /* ============================================================
       KEYBOARD NAV HELPERS
       ============================================================ */
    function scrollCardIntoView(card) {
      if (!card) return;
      const carousel = card.parentElement;
      if (!carousel || !carousel.classList.contains('movies')) {
        scrollIntoViewOpts(card, { behavior: IS_TV ? 'auto' : 'smooth', block: 'center', inline: 'nearest' });
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
        scrollToOpts(carousel, { left: targetScroll });
      }
      const winH = window.innerHeight;
      if (rRect.top < 80 || rRect.bottom > winH - 60) {
        const y = window.scrollY + rRect.top - (winH * 0.35);
        scrollToOpts(window, { top: Math.max(0, y) });
      }
    }

    function focusCard(card) {
      if (!card) return;
      try { card.focus({ preventScroll: true }); } catch (e) { card.focus(); }
      scrollCardIntoView(card);
    }

    function findClosestCardByLeft(carousel, refLeft) {
      if (!carousel) return null;
      const cards = [...carousel.querySelectorAll('.movie')];
      if (cards.length === 0) return null;
      let best = cards[0]; let bestDiff = Infinity;
      for (const c of cards) {
        const r = c.getBoundingClientRect();
        const diff = Math.abs(r.left - refLeft);
        if (diff < bestDiff) { bestDiff = diff; best = c; }
      }
      return best;
    }

    function maybeLoadMoreInCarousel(card) {
      const section = card ? card.closest('.carousel-section') : null;
      if (!section) return;
      const list = section.querySelector('.movies');
      if (!list) return;
      const remaining = list.scrollWidth - list.scrollLeft - list.clientWidth;
      if (remaining < 800) list.dispatchEvent(new Event('scroll'));
    }

    function autoFocusFirstCard() {
      if (!IS_TV) return;
      let attempts = 0;
      const tryFocus = () => {
        attempts++;
        const sections = document.querySelectorAll('.carousel-section:not([hidden])');
        let firstCard = null;
        for (const sec of sections) {
          firstCard = sec.querySelector('.movie');
          if (firstCard) break;
        }
        if (firstCard) focusCard(firstCard);
        else if (attempts < 30) setTimeout(tryFocus, 250);
      };
      setTimeout(tryFocus, 600);
    }

    /* ============================================================
       VIEW ROUTING
       ============================================================ */
    function viewFromHash() {
      const h = (location.hash || '').toLowerCase();
      if (h.indexOf('movie') !== -1) return 'movie';
      if (h.indexOf('series') !== -1 || h.indexOf('shows') !== -1 || h === '#tv') return 'tv';
      return 'home';
    }
    function setActiveNav(view) {
      $$('.nav-link').forEach(a => a.classList.toggle('active', a.dataset.view === view));
    }
    function setView(view) {
      currentView = view;
      setActiveNav(view);
      if (searchBar) searchBar.value = '';
      if (searchClearBtn) searchClearBtn.hidden = true;
      showCatalog();
      initBanner(view);
      buildCatalog(view);
      scrollToOpts(window, { top: 0 });
    }
    window.addEventListener('hashchange', () => setView(viewFromHash()));

    /* ============================================================
       BOOT
       ============================================================ */
    applySettings();
    setupImageMemoryManagement();
    currentView = viewFromHash();
    setActiveNav(currentView);
    initBanner(currentView);
    buildCatalog(currentView);
    autoFocusFirstCard();

    if (IS_TV) {
      setInterval(() => {
        const imgs = document.querySelectorAll('.movie img[data-real-src]');
        const winH = window.innerHeight;
        imgs.forEach(img => {
          const r = img.getBoundingClientRect();
          if (Math.abs(r.top) > winH * 3 || Math.abs(r.bottom) > winH * 3) {
            if (!img.src.startsWith('data:')) img.src = PLACEHOLDER_POSTER;
          }
        });
      }, 8000);
    }

    /* Deep link ?watch=movie-550 / ?watch=tv-1399
       Es la puerta de entrada desde las páginas por título que genera
       scripts/generate-sitemap.mjs para el sitemap. */
    (function handleWatchParam() {
      const m = /[?&]watch=(movie|tv)-(\d+)/.exec(location.search || '');
      if (!m) return;
      const type = m[1], id = Number(m[2]);
      // Deja que el catálogo pinte primero para que el modal tenga a dónde volver.
      setTimeout(() => { try { openVideoModal(id, type, null); } catch (e) {} }, 300);
    })();

    window.__POPOROPO__ = {
      version: '2.2.1',
      isDonor, getCurrentUser, getSettings, getFavorites, getWatched
    };
  });

})();
