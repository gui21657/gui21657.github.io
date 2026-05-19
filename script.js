/* ============================================================
   POPOROPO — SCRIPT.JS
   English UI · Google sign-in · Favorites · Donations · Settings
   Optimized for desktop, mobile, and Smart TV (LG WebOS, Tizen, etc.)
   ============================================================ */

(function () {
  'use strict';

  /* ============================================================
     ⚙️  CONFIG
     ============================================================ */
  const GOOGLE_CLIENT_ID =
    '810778080237-n4771dlmqes5h66jll7khffcf2vp1ntm.apps.googleusercontent.com';

  const PAYPAL_USERNAME = 'Wilfred026';
  const PAYPAL_BASE     = `https://www.paypal.me/${PAYPAL_USERNAME}`;

  /* ============================================================
     A. PLATFORM DETECTION
     ============================================================ */
  const IS_TV = !!window.__IS_TV__;
  if (IS_TV) document.documentElement.classList.add('tv-mode');

  /* ============================================================
     B. TMDB CLIENT
     ============================================================
     We use the v3 API key as a query parameter (NOT the v4 Bearer
     token in a header). This is deliberately less "modern":
       - No Authorization header  → no CORS preflight (OPTIONS).
       - No fetch options at all  → maximally compatible with old
         Smart-TV browsers (WebOS 4.x, Tizen 4.x, Android TV 7+).
     The Bearer flow triggers a preflight that several TV browsers
     either reject or stall on, which is the #1 reason a TV ends up
     with empty carousels.
     ============================================================ */
  const TMDB_API_KEY = '5f41e16316f1452122fe4d2c1234b068';
  const TMDB_API = 'https://api.themoviedb.org/3';
  const TMDB_IMG = 'https://image.tmdb.org/t/p';
  const LANG = 'en-US';
  const REGION = 'US';

  // Feature detection — used everywhere we'd otherwise hit a TypeError
  // on an old TV browser.
  const SUPPORTS = {
    AbortController:       typeof AbortController !== 'undefined',
    IntersectionObserver:  typeof IntersectionObserver !== 'undefined',
    ResizeObserver:        typeof ResizeObserver !== 'undefined',
    fetch:                 typeof fetch !== 'undefined'
  };

  const POSTER_SIZE   = IS_TV ? 'w154' : 'w342';
  const BACKDROP_SIZE = IS_TV ? 'w780' : 'original';

  const MAX_PAGES_PER_GENRE = IS_TV ? 1 : 99;
  const MAX_GENRES_VISIBLE  = IS_TV ? 6  : 16;

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

  /* ============================================================
     TMDB fetch — manual URL construction, no headers, no preflight.
     If the TV browser lacks AbortController, we silently skip the
     signal so the call still works.
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
     C. EMBED SERVERS
     ============================================================ */
  const EMBED_SERVERS = [
    {
      name: 'Vidsrc.pm', short: '1',
      url: (id, type, season, episode, subLang) => {
        const sub = subLang ? `?ds_lang=${subLang}` : '';
        if (type === 'tv' && season !== undefined && episode !== undefined)
          return `https://vidsrc.pm/embed/tv/${id}/${season}/${episode}${sub}`;
        return `https://vidsrc.pm/embed/${type}/${id}${sub}`;
      }
    },
    {
      name: 'Vidsrc.me', short: '2',
      url: (id, type, season, episode, subLang) => {
        const sub = subLang ? `?ds_lang=${subLang}` : '';
        if (type === 'tv' && season !== undefined && episode !== undefined)
          return `https://vidsrc.me/embed/tv/${id}/${season}/${episode}${sub}`;
        return `https://vidsrc.me/embed/${type}/${id}${sub}`;
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
      return String(s == null ? '' : s).replace(/[&<>"']/g,
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
      // Subtitle codes that vidsrc accepts via the `ds_lang` parameter.
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
      defaultServer: 0,
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

    /* ============================================================
       CONTENT FILTER (used everywhere we receive TMDB results)
       ============================================================
       TMDB's `/discover/tv`, `/trending/*` and a few other endpoints
       do NOT accept the `include_adult` query param, so adult titles
       can leak through if we don't filter the results client-side.
       This helper is the single source of truth for that filter.
       ============================================================ */
    function filterContent(items) {
      if (!items || !items.length) return [];
      const s = getSettings();
      if (s.adultContent) return items;
      return items.filter(item => !item.adult);
    }

    function applySettings() {
      const s = getSettings();
      document.body.classList.toggle('reduce-motion', !!s.reduceMotion);
      // Banner visibility
      const banner = $('#mainBanner');
      if (banner) banner.style.display = s.showBanner ? '' : 'none';
    }

    /* ============================================================
       AUTH (Google Identity Services)
       ============================================================ */
    const USER_KEY        = 'poporopo_user_v1';
    const FAV_KEY_PREFIX  = 'poporopo_favorites_v1';
    const FAV_KEY_GUEST   = `${FAV_KEY_PREFIX}__guest`;
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

      // Migrate guest data to user account on first sign-in
      const newFavKey   = `${FAV_KEY_PREFIX}__${user.sub}`;
      const newSetKey   = `${SETTINGS_KEY_PREFIX}__${user.sub}`;
      const newDonorKey = `${DONOR_KEY_PREFIX}__${user.sub}`;
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
      } catch (e) {}

      setCurrentUser(user);
      updateAuthUI();
      applySettings();
      rebuildAfterAuthChange();
      showToast(`Welcome, ${user.given_name || user.name || 'friend'}`, 2000);
    }

    function signOut() {
      if (window.google && google.accounts && google.accounts.id) {
        try { google.accounts.id.disableAutoSelect(); } catch (e) {}
      }
      setCurrentUser(null);
      updateAuthUI();
      applySettings();
      rebuildAfterAuthChange();
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

        // Donor visuals
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

      // Footer thanks (anyone can be a donor — even as guest)
      const footerThanks = $('#footerThanks');
      if (footerThanks) footerThanks.hidden = !isDonor();
    }

    function rebuildAfterAuthChange() {
      updateFavoritesSection();
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

    function showFallbackButton() {
      // Fallback button was removed — if Google's button doesn't render, no sign-in shown.
    }

    function initGoogleAuth(attempts = 0) {
      if (gisInitialized) return;
      if (!clientIdConfigured()) {
        showFallbackButton('Sign-in not configured');
        return;
      }

      if (!(window.google && google.accounts && google.accounts.id)) {
        if (attempts >= 30) {
          showFallbackButton('Sign-in not available in this browser');
          return;
        }
        setTimeout(() => initGoogleAuth(attempts + 1), 200);
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

        // Render the official Google button (icon only — just the G circle)
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
          } catch (e) {
            console.warn('Could not render Google button:', e);
          }
        }

        // Try One Tap silently (swallow errors — FedCM origin issues etc.)
        if (!getCurrentUser()) {
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

    /* ── Profile menu ── */
    const profileBtn  = $('#profileBtn');
    const profileMenu = $('#profileMenu');
    const signOutBtn  = $('#signOutBtn');
    const signInFallback = null; // fallback button removed

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
    initGoogleAuth();

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

    // Cross-tab sync
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
      if (e.key && e.key.startsWith(DONOR_KEY_PREFIX) && e.key === donorKey()) {
        updateAuthUI();
        updateSettingsUI();
      }
    });

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

    let currentMediaId     = null;
    let currentMediaType   = 'movie';
    let currentServerIndex = 0;
    let currentSeason  = 1;
    let currentEpisode = 1;
    const modalStack = [];

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

    /* ============================================================
       VIDEO PLAYER
       ============================================================ */
    function loadServer(serverIndex) {
      if (!currentMediaId || serverIndex < 0 || serverIndex >= EMBED_SERVERS.length) return;
      currentServerIndex = serverIndex;
      if (currentMediaType === 'movie') updateServerSelectorUI();
      if (playerSpin) playerSpin.classList.remove('is-hidden');
      const subLang = getSettings().subtitleLang;
      const embedUrl = EMBED_SERVERS[serverIndex].url(
        currentMediaId,
        currentMediaType,
        currentMediaType === 'tv' ? currentSeason  : undefined,
        currentMediaType === 'tv' ? currentEpisode : undefined,
        subLang
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

    if (serverContainer) serverContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.server-btn');
      if (!btn) return;
      const idx = Number(btn.dataset.server);
      if (idx === currentServerIndex || !currentMediaId) return;
      showToast(`Switching to ${EMBED_SERVERS[idx].name}…`, 1500);
      loadServer(idx);
    });

    videoPlayer.addEventListener('load', () => {
      if (videoPlayer.src && playerSpin) playerSpin.classList.add('is-hidden');
      // Tear the ad-click blocker down quickly so the iframe's native
      // controls (seek bar, fullscreen, etc.) regain full pointer access.
      if (adBlocker && adBlocker.classList.contains('is-active')) {
        clearTimeout(adBlocker._disableTimer);
        adBlocker._disableTimer = setTimeout(() => {
          adBlocker.classList.remove('is-active');
        }, 1500);
      }
    });

    function openVideoModal(mediaId, mediaType, opener) {
      currentMediaId = mediaId;
      currentMediaType = mediaType;
      currentServerIndex = getSettings().defaultServer || 0;
      if (currentServerIndex >= EMBED_SERVERS.length) currentServerIndex = 0;
      currentSeason  = 1;
      currentEpisode = 1;

      // On TV, free as much memory as we can before the iframe loads.
      // The catalog can stay in DOM but loses its image data + render.
      if (IS_TV) {
        unloadAllPosters();
        const catalog = $('#catalog');
        if (catalog) catalog.style.display = 'none';
        const searchArea = $('#searchResults');
        if (searchArea) searchArea.style.display = 'none';
      }

      // Re-arm the ad-click blocker for the first 1.5 seconds after load.
      if (adBlocker) {
        clearTimeout(adBlocker._disableTimer);
        adBlocker.classList.add('is-active');
      }
      openModal(videoModal, opener);

      if (mediaType === 'tv') {
        serverBar.hidden = true;
        seasonSelector.hidden = false;
        loadSeasonData(mediaId);
      } else {
        serverBar.hidden = false;
        seasonSelector.hidden = true;
        loadServer(currentServerIndex);
      }
    }

    function closeVideoModal() {
      videoPlayer.src = '';
      if (adBlocker) {
        clearTimeout(adBlocker._disableTimer);
        adBlocker.classList.remove('is-active');
      }
      if (playerSpin) playerSpin.classList.remove('is-hidden');
      currentMediaId = null;
      closeModalEl(videoModal);

      // Restore the catalog and bring back posters that are on screen.
      if (IS_TV) {
        const catalog = $('#catalog');
        if (catalog) catalog.style.display = '';
        const searchArea = $('#searchResults');
        if (searchArea && !searchArea.hidden) searchArea.style.display = '';
        // Slight delay so the iframe has time to actually unload first.
        setTimeout(reloadVisiblePosters, 400);
      }
    }

    closeVideo.addEventListener('click', closeVideoModal);
    videoBack.addEventListener('click', closeVideoModal);

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
          option.textContent = `Episode ${ep.episode_number}: ${ep.name || 'Untitled'}`;
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
        console.error('Episode load error:', err);
        episodeSelect.innerHTML = '<option value="1">Episode 1</option>';
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
      infoTitleEl.textContent = 'Loading…';
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
            ? `· ${data.number_of_seasons} season${data.number_of_seasons > 1 ? 's' : ''}` : '';
        }

        infoGenreEl.textContent = (data.genres && data.genres.length)
          ? `· ${data.genres.map(g => g.name).join(', ')}` : '';
        infoRatingEl.textContent = data.vote_average
          ? `· ★ ${data.vote_average.toFixed(1)}` : '';
        infoDescEl.textContent = data.overview || 'No description available.';
        if (data.backdrop_path) {
          infoBackdropEl.style.backgroundImage = `url('${backdropUrl(data.backdrop_path)}')`;
        }
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
      closeModalEl(infoModal);
      openVideoModal(id, type, opener);
    });

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

      // If user has set a custom display name in settings, leave it; else use claim name
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
    const settingsDefSrv  = $('#settingsDefaultServer');
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

      // Profile
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

      // Supporter
      settingsSupRow.hidden = !donor;
      if (donor) {
        const info = getDonorInfo();
        if (info && info.claimedAt) {
          const d = new Date(info.claimedAt);
          settingsSince.textContent = `· since ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        }
      }

      // Display name (donor only)
      settingsDNRow.hidden = !donor;
      settingsDNInput.value = s.displayName || '';

      // Playback
      settingsDefSrv.value = String(s.defaultServer == null ? 0 : s.defaultServer);
      settingsSubLang.value = s.subtitleLang || 'en';

      // Appearance
      settingsReduce.checked = !!s.reduceMotion;
      settingsBanner.checked = !!s.showBanner;
      settingsGoldRow.hidden = !donor;
      settingsGold.checked = !!s.goldTheme;

      // Content
      settingsAdult.checked = !!s.adultContent;

      // Data
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
    settingsDefSrv.addEventListener('change', () => {
      const s = getSettings();
      s.defaultServer = Number(settingsDefSrv.value);
      saveSettings(s);
    });
    settingsSubLang.addEventListener('change', () => {
      const s = getSettings();
      s.subtitleLang = settingsSubLang.value;
      saveSettings(s);
      // If the video player is currently open, reload the current server
      // so the new subtitle language takes effect immediately.
      if (currentMediaId && videoModal.classList.contains('active')) {
        loadServer(currentServerIndex);
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
      s.adultContent = settingsAdult.checked;
      saveSettings(s);
      // Rebuild the catalog and banner in place so the new filter
      // takes effect immediately — no manual refresh needed.
      buildCatalog();
      initBanner();
      showToast(
        settingsAdult.checked ? 'Adult content enabled (18+)' : 'Adult content hidden',
        2200,
        { gold: settingsAdult.checked }
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
        // Remove all poporopo_* keys
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
       KEYBOARD HANDLER (Escape, focus trap, remote nav)
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
          window.scrollTo({ top: 0, behavior: IS_TV ? 'auto' : 'smooth' });
        } else {
          focusCard(target);
        }
      }
    });

    /* ============================================================
       TV MEMORY MANAGEMENT
       ============================================================
       LG WebOS gives the browser a tight RAM budget (200-500 MB).
       Decoded images alone can blow past that, especially once a
       vidsrc iframe with its video stream and ads is loaded on top.
       So on TV we:
         1. Observe each poster image with a SHORT rootMargin so
            anything more than ~1 screen away gets swapped for a
            tiny data-URL placeholder.
         2. When the video modal opens, ALL non-visible posters are
            force-unloaded, AND the catalog gets display:none so
            the renderer can drop its layer cache.
         3. When the modal closes we re-attach the catalog and let
            the IntersectionObserver bring back what's on screen.
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
      // Called when we're about to load something heavy (video iframe).
      // Strips every poster image down to a tiny data-URL so the
      // browser can free their decoded bitmaps.
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
      // Called when we close the heavy view. Restore posters that are
      // currently on (or near) the screen; the rest stay as placeholders
      // and get reloaded individually by the IntersectionObserver.
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
       CARDS
       ============================================================ */
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

      // Favorite (heart) button
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

      // Info button (non-TV)
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

      // Overlay (non-TV)
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

      // Fallback / eager paths:
      //   - On TV always init (TVs sometimes throttle or mis-fire IO,
      //     so we'd rather just load the 6 sections up front).
      //   - If IntersectionObserver isn't available at all, init now.
      //   - Otherwise honour the explicit _eager flag (first 2 sections).
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

      try {
        const [movieData, tvData] = await Promise.all([
          tmdb('/discover/movie', {
            with_genres: state.genreId, page: state.page,
            sort_by: 'popularity.desc', 'vote_count.gte': 30, region: REGION,
            include_adult: includeAdult
          }),
          tmdb('/discover/tv', {
            with_genres: state.genreId, page: state.page,
            sort_by: 'popularity.desc', 'vote_count.gte': 30, region: REGION,
            include_adult: includeAdult
          })
        ]);

        let items = [];
        if (movieData.results) items.push(...movieData.results.map(m => ({ ...m, _type: 'movie' })));
        if (tvData.results)    items.push(...tvData.results.map(t => ({ ...t, _type: 'tv' })));
        // Client-side adult filter (TMDB's /discover/tv ignores include_adult).
        items = filterContent(items);
        items.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

        if (IS_TV) items = items.slice(0, 10);  // tighter cap on TV (memory budget)

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

        const movieExhausted = movieData.page >= movieData.total_pages || !(movieData.results && movieData.results.length);
        const tvExhausted    = tvData.page    >= tvData.total_pages    || !(tvData.results && tvData.results.length);
        if (movieExhausted && tvExhausted) state.exhausted = true;
        else {
          state.page++;
          if (state.page > MAX_PAGES_PER_GENRE) state.exhausted = true;
        }

        if (state.exhausted && state.loader) state.loader.hidden = true;
        catalogLoadOK = true;
      } catch (err) {
        console.error('TMDB carousel error:', err);
        // Surface a visible error if EVERY initial carousel fails
        // (typically: network/CORS issue on an old TV browser).
        catalogLoadFailures++;
        maybeShowLoadError();
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
      if (!IS_TV && 'ResizeObserver' in window) new ResizeObserver(updateUI).observe(list);

      updateUI();
    }

    /* ── Favorites carousel ── */
    function createFavoritesSection() {
      const section = document.createElement('section');
      section.className = 'carousel-section favorites-section';
      section.id = 'favoritesSection';
      section.hidden = true;
      section.innerHTML = `
        <div class="section-header">
          <h2 class="section-title">
            <span class="title-accent" aria-hidden="true">|</span> Favorites
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
      section._favState = state;
      return section;
    }

    function updateFavoritesSection() {
      const section = document.getElementById('favoritesSection');
      if (!section) return;
      const favs = getFavorites();
      const list = section.querySelector('.movies');

      if (favs.length === 0) {
        section.hidden = true;
        list.innerHTML = '';
        if (section._favState) section._favState.seen = new Set();
        return;
      }
      section.hidden = false;
      const state = section._favState;
      list.innerHTML = '';
      if (state) state.seen = new Set();

      favs.forEach(fav => {
        const card = createCard(fav);
        list.appendChild(card);
        if (state) state.seen.add(`${fav.id}|${fav._type}`);
      });

      list.dispatchEvent(new Event('scroll'));
    }

    function buildCatalog() {
      const catalog = $('#catalog');
      catalog.innerHTML = '';
      catalog.appendChild(createFavoritesSection());
      GENRES.forEach((genre, i) => {
        // On TV we eager-init everything but STAGGER the network calls
        // (300 ms apart) so a weak TV browser doesn't get hit with 6
        // simultaneous fetches that could timeout or starve.
        const g = {
          ...genre,
          _eager: i < 2,
          _delay: IS_TV ? i * 300 : 0
        };
        catalog.appendChild(createCarouselSection(g));
      });
      updateFavoritesSection();
    }

    let catalogLoadOK = false;
    let catalogLoadFailures = 0;
    let loadErrorShown = false;

    function maybeShowLoadError() {
      // Only show the error UI if we've had several failures AND no
      // section has successfully loaded yet. Once any data comes back,
      // we never tell the user the catalog failed.
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
        // Banner uses /trending which doesn't honour include_adult — filter client-side.
        const safe = filterContent(data.results || []);
        const item = safe.find(i =>
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
          <span class="badge">Trending</span>
        `;

        playBtn.dataset.mediaId   = item.id;
        playBtn.dataset.mediaType = item.media_type;
        infoBtn.dataset.mediaId   = item.id;
        infoBtn.dataset.mediaType = item.media_type;

        playBtn.addEventListener('click', () => openVideoModal(item.id, item.media_type, playBtn));
        infoBtn.addEventListener('click', () => openInfoModal(item.id, item.media_type, infoBtn));

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

    let searchTimer;
    let searchAbort = null;

    function makeAbortController() {
      if (SUPPORTS.AbortController) return new AbortController();
      // No-op fallback so the rest of the search code can stay simple.
      return { signal: undefined, abort: function () {} };
    }

    function clearSearch() {
      searchBar.value = '';
      searchClearBtn.hidden = true;
      showCatalog();
      searchBar.focus();
    }

    function showCatalog() {
      const s = getSettings();
      bannerEl.style.display = s.showBanner ? '' : 'none';
      catalogEl.hidden = false;
      searchArea.hidden = true;
      searchGrid.innerHTML = '';
      emptyMsg.hidden = true;
    }

    async function runSearch(query) {
      bannerEl.style.display = 'none';
      catalogEl.hidden = true;
      searchArea.hidden = false;
      emptyMsg.hidden = true;
      searchGrid.innerHTML = '<div class="search-loading"><div class="spinner-ring"></div></div>';
      window.scrollTo({ top: 0, behavior: IS_TV ? 'auto' : 'smooth' });

      if (searchAbort) searchAbort.abort();
      searchAbort = makeAbortController();

      const includeAdult = getSettings().adultContent ? 'true' : 'false';
      try {
        const data = await tmdb('/search/multi', {
          query, include_adult: includeAdult, page: '1',
        }, { signal: searchAbort.signal });

        let results = (data.results || [])
          .filter(item => item.media_type !== 'person' && item.poster_path)
          .map(item => ({ ...item, _type: item.media_type }));

        // Defence in depth + smarter ordering
        results = filterContent(results);

        const q = query.toLowerCase().trim();
        results.sort((a, b) => {
          const ta = (a.title || a.name || '').toLowerCase();
          const tb = (b.title || b.name || '').toLowerCase();
          // 1. Exact title match wins
          if (ta === q && tb !== q) return -1;
          if (tb === q && ta !== q) return 1;
          // 2. Then titles that START with the query
          const aStarts = ta.startsWith(q);
          const bStarts = tb.startsWith(q);
          if (aStarts && !bStarts) return -1;
          if (bStarts && !aStarts) return 1;
          // 3. Then titles that CONTAIN the query
          const aHas = ta.includes(q);
          const bHas = tb.includes(q);
          if (aHas && !bHas) return -1;
          if (bHas && !aHas) return 1;
          // 4. Fall back to popularity
          return (b.popularity || 0) - (a.popularity || 0);
        });

        if (IS_TV) results = results.slice(0, 30);

        searchGrid.innerHTML = '';
        if (results.length === 0) {
          searchTermEl.textContent = query;
          emptyMsg.hidden = false;
        } else {
          const frag = document.createDocumentFragment();
          results.forEach(item => frag.appendChild(createCard(item)));
          searchGrid.appendChild(frag);
          if (IS_TV) {
            const firstCard = searchGrid.querySelector('.movie');
            if (firstCard) setTimeout(() => firstCard.focus(), 100);
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Search error:', err);
        searchGrid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:40px;">Search error. Please try again.</p>';
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

    /* ============================================================
       KEYBOARD NAV HELPERS (remote)
       ============================================================ */
    function scrollCardIntoView(card) {
      if (!card) return;
      const carousel = card.parentElement;
      if (!carousel || !carousel.classList.contains('movies')) {
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
      const winH = window.innerHeight;
      if (rRect.top < 80 || rRect.bottom > winH - 60) {
        const y = window.scrollY + rRect.top - (winH * 0.35);
        window.scrollTo({ top: Math.max(0, y), behavior: IS_TV ? 'auto' : 'smooth' });
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
       BOOT
       ============================================================ */
    applySettings();
    setupImageMemoryManagement();
    initBanner();
    buildCatalog();
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

    // Expose for debugging
    window.__POPOROPO__ = {
      version: '2.0.0',
      isDonor, getCurrentUser, getSettings, getFavorites
    };
  });

})();
