/* ============================================================
   POPOROPO — SOCIAL.JS
   Likes (solo like, sin dislike) y comentarios por título/episodio.

   Sin SDK de Firebase: habla directo con las APIs REST de
   Identity Toolkit y Cloud Firestore usando fetch. Esto mantiene el
   peso bajo y funciona en navegadores viejos de Smart TV
   (WebOS / Tizen) que no soportan módulos ES.

   Solo usuarios con sesión iniciada pueden comentar o dar like.
   Cualquiera puede leer. Eso se garantiza en firestore.rules,
   no aquí — el cliente nunca es la frontera de seguridad.
   ============================================================ */

(function () {
  'use strict';

  var CFG        = window.POPOROPO_CONFIG || {};
  var PROJECT_ID = CFG.FIREBASE_PROJECT_ID || '';
  var FB_KEY     = CFG.FIREBASE_API_KEY || '';

  /* Si el deploy no inyectó la config, el módulo se apaga solo y el
     sitio sigue funcionando igual que antes. */
  var ENABLED = !!(PROJECT_ID && FB_KEY &&
                   PROJECT_ID.indexOf('__') !== 0 && FB_KEY.indexOf('__') !== 0);

  var FS   = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID +
             '/databases/(default)/documents';
  var IDP  = 'https://identitytoolkit.googleapis.com/v1';
  var TOKEN_URL = 'https://securetoken.googleapis.com/v1/token?key=' + FB_KEY;

  var MAX_COMMENT_LEN = 1000;
  var PAGE_SIZE       = 50;
  var SESSION_KEY     = 'poporopo_fb_session';

  /* ============================================================
     UTILIDADES
     ============================================================ */
  function $(sel, root) { return (root || document).querySelector(sel); }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function docId() {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var out = '';
    for (var i = 0; i < 20; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
    return out;
  }

  function relTime(iso) {
    if (!iso) return '';
    var then = new Date(iso).getTime();
    if (isNaN(then)) return '';
    var s = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (s < 60)     return 'just now';
    var units = [['year', 31536000], ['month', 2592000], ['week', 604800],
                 ['day', 86400], ['hour', 3600], ['minute', 60]];
    for (var i = 0; i < units.length; i++) {
      var n = Math.floor(s / units[i][1]);
      if (n >= 1) return n + ' ' + units[i][0] + (n > 1 ? 's' : '') + ' ago';
    }
    return 'just now';
  }

  function compactNum(n) {
    n = Number(n) || 0;
    if (n < 1000) return String(n);
    if (n < 1000000) return (n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, '') + 'K';
    return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }

  /* --- Conversión de/hacia el formato de valores de Firestore --- */
  function toFields(obj) {
    var fields = {};
    for (var k in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
      var v = obj[k];
      if (typeof v === 'string')       fields[k] = { stringValue: v };
      else if (typeof v === 'number')  fields[k] = { integerValue: String(v) };
      else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
      else if (v === null)             fields[k] = { nullValue: null };
    }
    return fields;
  }

  function fromFields(fields) {
    var out = {};
    if (!fields) return out;
    for (var k in fields) {
      if (!Object.prototype.hasOwnProperty.call(fields, k)) continue;
      var v = fields[k];
      if ('stringValue' in v)         out[k] = v.stringValue;
      else if ('integerValue' in v)   out[k] = Number(v.integerValue);
      else if ('booleanValue' in v)   out[k] = v.booleanValue;
      else if ('timestampValue' in v) out[k] = v.timestampValue;
      else if ('nullValue' in v)      out[k] = null;
    }
    return out;
  }

  /* ============================================================
     AUTENTICACIÓN (Identity Toolkit REST)
     ============================================================ */
  var session = null;   // { uid, idToken, refreshToken, expiresAt, name, picture }
  var authListeners = [];

  function loadSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      return (s && s.refreshToken) ? s : null;
    } catch (e) { return null; }
  }

  function saveSession(s) {
    session = s;
    try {
      if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else   localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
    for (var i = 0; i < authListeners.length; i++) {
      try { authListeners[i](s); } catch (e) {}
    }
  }

  /* Canjea el ID token de Google Identity Services por una sesión de
     Firebase. Así reutilizamos el login que el sitio ya tiene. */
  function signInWithGoogleIdToken(googleIdToken) {
    if (!ENABLED || !googleIdToken) return Promise.resolve(null);
    return fetch(IDP + '/accounts:signInWithIdp?key=' + FB_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postBody: 'id_token=' + encodeURIComponent(googleIdToken) +
                  '&providerId=google.com',
        requestUri: window.location.origin,
        returnSecureToken: true,
        returnIdpCredential: true
      })
    }).then(function (r) {
      if (!r.ok) throw new Error('signInWithIdp ' + r.status);
      return r.json();
    }).then(function (d) {
      saveSession({
        uid:          d.localId,
        idToken:      d.idToken,
        refreshToken: d.refreshToken,
        expiresAt:    Date.now() + (Number(d.expiresIn || 3600) - 60) * 1000,
        name:         d.displayName || d.fullName || '',
        picture:      d.photoUrl || ''
      });
      return session;
    }).catch(function (e) {
      if (window.console) console.warn('[social] sign-in failed', e);
      return null;
    });
  }

  function refreshToken() {
    if (!session || !session.refreshToken) return Promise.resolve(null);
    return fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=refresh_token&refresh_token=' +
            encodeURIComponent(session.refreshToken)
    }).then(function (r) {
      if (!r.ok) throw new Error('refresh ' + r.status);
      return r.json();
    }).then(function (d) {
      saveSession({
        uid:          d.user_id || session.uid,
        idToken:      d.id_token,
        refreshToken: d.refresh_token,
        expiresAt:    Date.now() + (Number(d.expires_in || 3600) - 60) * 1000,
        name:         session.name,
        picture:      session.picture
      });
      return session;
    }).catch(function () { saveSession(null); return null; });
  }

  /* Devuelve un idToken vigente, renovándolo si está por vencer. */
  function freshToken() {
    if (!session) return Promise.resolve(null);
    if (Date.now() < session.expiresAt) return Promise.resolve(session.idToken);
    return refreshToken().then(function (s) { return s ? s.idToken : null; });
  }

  function signOut() { saveSession(null); }

  function isSignedIn() { return !!session; }

  /* ============================================================
     CLIENTE FIRESTORE (REST)
     ============================================================ */
  function fsFetch(path, opts, needsAuth) {
    opts = opts || {};
    var run = needsAuth ? freshToken() : Promise.resolve(null);
    return run.then(function (token) {
      var headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = 'Bearer ' + token;
      return fetch(FS + path, {
        method:  opts.method || 'GET',
        headers: headers,
        body:    opts.body ? JSON.stringify(opts.body) : undefined
      });
    });
  }

  /* --- LIKES --------------------------------------------------
     Un documento por usuario en /likes/{contentId}/users/{uid}.
     El conteo sale de una aggregation query, así que no hay
     contador que se pueda manipular desde el cliente.           */

  function likeCount(contentId) {
    return fetch(FS + '/likes/' + encodeURIComponent(contentId) +
                 ':runAggregationQuery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredAggregationQuery: {
          structuredQuery: { from: [{ collectionId: 'users' }] },
          aggregations: [{ alias: 'total', count: {} }]
        }
      })
    }).then(function (r) {
      if (!r.ok) return 0;
      return r.json();
    }).then(function (rows) {
      if (!rows || !rows.length) return 0;
      for (var i = 0; i < rows.length; i++) {
        var res = rows[i] && rows[i].result;
        if (res && res.aggregateFields && res.aggregateFields.total) {
          return Number(res.aggregateFields.total.integerValue || 0);
        }
      }
      return 0;
    }).catch(function () { return 0; });
  }

  function hasLiked(contentId) {
    if (!session) return Promise.resolve(false);
    return fsFetch('/likes/' + encodeURIComponent(contentId) +
                   '/users/' + encodeURIComponent(session.uid), {}, true)
      .then(function (r) { return r.ok; })
      .catch(function () { return false; });
  }

  function setLike(contentId, liked) {
    if (!session) return Promise.reject(new Error('auth required'));
    var path = '/likes/' + encodeURIComponent(contentId) +
               '/users/' + encodeURIComponent(session.uid);
    if (!liked) return fsFetch(path, { method: 'DELETE' }, true);
    return fsFetch(path, {
      method: 'PATCH',
      body: { fields: toFields({ uid: session.uid }) }
    }, true);
  }

  /* --- COMENTARIOS -------------------------------------------- */

  function listComments(contentId) {
    var path = '/comments/' + encodeURIComponent(contentId) + '/items' +
               '?pageSize=' + PAGE_SIZE + '&orderBy=' +
               encodeURIComponent('createdAt desc');
    return fsFetch(path, {}, false)
      .then(function (r) { return r.ok ? r.json() : { documents: [] }; })
      .then(function (d) {
        var docs = (d && d.documents) || [];
        return docs.map(function (doc) {
          var data = fromFields(doc.fields);
          data.id = doc.name.split('/').pop();
          return data;
        });
      })
      .catch(function () { return []; });
  }

  function addComment(contentId, text) {
    if (!session) return Promise.reject(new Error('auth required'));
    text = String(text || '').trim().slice(0, MAX_COMMENT_LEN);
    if (!text) return Promise.reject(new Error('empty'));

    var name = 'projects/' + PROJECT_ID + '/databases/(default)/documents' +
               '/comments/' + contentId + '/items/' + docId();

    /* :commit con transform deja que el servidor ponga createdAt, así
       nadie puede falsear la fecha para quedar arriba en la lista. */
    return fsFetch(':commit', {
      method: 'POST',
      body: {
        writes: [{
          update: {
            name: name,
            fields: toFields({
              uid:     session.uid,
              name:    session.name || 'Anonymous',
              picture: session.picture || '',
              text:    text
            })
          },
          currentDocument: { exists: false },
          updateTransforms: [{
            fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME'
          }]
        }]
      }
    }, true).then(function (r) {
      if (!r.ok) return r.text().then(function (t) {
        throw new Error('addComment ' + r.status + ' ' + t);
      });
      return true;
    });
  }

  function deleteComment(contentId, commentId) {
    if (!session) return Promise.reject(new Error('auth required'));
    return fsFetch('/comments/' + encodeURIComponent(contentId) +
                   '/items/' + encodeURIComponent(commentId),
                   { method: 'DELETE' }, true);
  }

  /* ============================================================
     INTERFAZ
     ============================================================ */
  var root = null;          // contenedor .social-panel
  var currentContent = null;
  var currentLabel   = '';
  var liked = false;
  var busy  = false;

  function avatarFor(name, url) {
    if (url) return '<img class="cmt-avatar" src="' + escapeHtml(url) +
                    '" alt="" loading="lazy" referrerpolicy="no-referrer">';
    var initials = String(name || '?').trim().split(/\s+/).slice(0, 2)
      .map(function (w) { return w.charAt(0); }).join('').toUpperCase() || '?';
    return '<span class="cmt-avatar cmt-avatar-fallback" aria-hidden="true">' +
           escapeHtml(initials) + '</span>';
  }

  function buildPanel() {
    var el = document.createElement('section');
    el.className = 'social-panel';
    el.id = 'socialPanel';
    el.setAttribute('aria-label', 'Likes and comments');
    el.innerHTML = [
      '<div class="social-actions">',
      '  <button type="button" class="like-btn" id="likeBtn" aria-pressed="false">',
      '    <svg class="like-icon" width="22" height="22" viewBox="0 0 24 24" fill="none"',
      '         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
      '      <path d="M7 10v12"/>',
      '      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>',
      '    </svg>',
      '    <span class="like-count" id="likeCount">0</span>',
      '  </button>',
      '  <p class="social-hint" id="socialHint" hidden>Sign in to like and comment</p>',
      '</div>',
      '<div class="comments-block">',
      '  <h3 class="comments-heading">',
      '    <span id="commentsCount">0</span> Comments',
      '    <span class="comments-context" id="commentsContext"></span>',
      '  </h3>',
      '  <form class="comment-form" id="commentForm">',
      '    <textarea id="commentInput" class="comment-input" rows="1" maxlength="' + MAX_COMMENT_LEN + '"',
      '              placeholder="Add a comment…" aria-label="Add a comment"></textarea>',
      '    <div class="comment-form-actions">',
      '      <span class="comment-counter" id="commentCounter"></span>',
      '      <button type="button" class="btn-ghost" id="commentCancel">Cancel</button>',
      '      <button type="submit" class="btn-comment" id="commentSubmit" disabled>Comment</button>',
      '    </div>',
      '  </form>',
      '  <p class="comments-empty" id="commentsEmpty" hidden>No comments yet. Be the first.</p>',
      '  <div class="comments-list" id="commentsList"></div>',
      '</div>'
    ].join('\n');
    return el;
  }

  function renderComments(items) {
    var list  = $('#commentsList', root);
    var empty = $('#commentsEmpty', root);
    var count = $('#commentsCount', root);
    if (!list) return;

    if (count) count.textContent = compactNum(items.length);
    if (empty) empty.hidden = items.length > 0;

    list.innerHTML = items.map(function (c) {
      var mine = session && c.uid === session.uid;
      return '' +
        '<article class="comment" data-id="' + escapeHtml(c.id) + '">' +
          avatarFor(c.name, c.picture) +
          '<div class="comment-body">' +
            '<p class="comment-head">' +
              '<span class="comment-author">' + escapeHtml(c.name || 'Anonymous') + '</span>' +
              '<time class="comment-time">' + escapeHtml(relTime(c.createdAt)) + '</time>' +
            '</p>' +
            '<p class="comment-text">' + escapeHtml(c.text) + '</p>' +
          '</div>' +
          (mine ? '<button type="button" class="comment-delete" data-id="' +
                  escapeHtml(c.id) + '" aria-label="Delete your comment">Delete</button>' : '') +
        '</article>';
    }).join('');
  }

  /* Deja claro que los comentarios son de ESTE episodio, no de la serie. */
  function updateContextLabel() {
    var el = $('#commentsContext', root);
    if (el) el.textContent = currentLabel ? 'on ' + currentLabel : '';
  }

  function refreshAuthUI() {
    if (!root) return;
    var signedIn = isSignedIn();
    var form  = $('#commentForm', root);
    var input = $('#commentInput', root);
    var hint  = $('#socialHint', root);
    var like  = $('#likeBtn', root);

    if (hint)  hint.hidden = signedIn;
    if (form)  form.classList.toggle('is-locked', !signedIn);
    if (input) {
      input.disabled = !signedIn;
      input.placeholder = signedIn ? 'Add a comment…' : 'Sign in to comment';
    }
    if (like) like.classList.toggle('is-locked', !signedIn);
  }

  function refreshLikeUI(count) {
    var btn = $('#likeBtn', root);
    var cnt = $('#likeCount', root);
    if (cnt && typeof count === 'number') cnt.textContent = compactNum(count);
    if (btn) {
      btn.classList.toggle('is-liked', liked);
      btn.setAttribute('aria-pressed', liked ? 'true' : 'false');
      btn.setAttribute('aria-label', (liked ? 'Unlike ' : 'Like ') + (currentLabel || 'this'));
    }
  }

  /* Carga likes + comentarios del contenido activo. */
  function load() {
    if (!root || !currentContent) return;
    var target = currentContent;

    likeCount(target).then(function (n) {
      if (target !== currentContent) return;   // el usuario ya cambió de episodio
      refreshLikeUI(n);
    });

    hasLiked(target).then(function (v) {
      if (target !== currentContent) return;
      liked = v;
      refreshLikeUI();
    });

    listComments(target).then(function (items) {
      if (target !== currentContent) return;
      renderComments(items);
    });
  }

  function onLikeClick() {
    if (busy) return;
    if (!isSignedIn()) {
      if (window.PoporopoRequestSignIn) window.PoporopoRequestSignIn();
      return;
    }
    busy = true;
    var target = currentContent;
    var next   = !liked;

    /* Optimista: pinta el cambio ya y lo corrige si el servidor falla. */
    liked = next;
    var cnt = $('#likeCount', root);
    var shown = cnt ? (parseInt(cnt.textContent.replace(/[^\d]/g, ''), 10) || 0) : 0;
    refreshLikeUI(Math.max(0, shown + (next ? 1 : -1)));

    setLike(target, next)
      .then(function () { return likeCount(target); })
      .then(function (n) { if (target === currentContent) refreshLikeUI(n); })
      .catch(function () {
        if (target !== currentContent) return;
        liked = !next;
        refreshLikeUI(shown);
      })
      .then(function () { busy = false; });
  }

  function onSubmit(e) {
    if (e) e.preventDefault();
    if (busy || !isSignedIn()) return;
    var input = $('#commentInput', root);
    var text  = input ? input.value.trim() : '';
    if (!text) return;

    busy = true;
    var btn = $('#commentSubmit', root);
    if (btn) btn.disabled = true;
    var target = currentContent;

    addComment(target, text).then(function () {
      if (input) { input.value = ''; autoGrow(input); }
      updateCounter();
      return listComments(target);
    }).then(function (items) {
      if (target === currentContent) renderComments(items);
    }).catch(function () {
      if (window.PoporopoToast) window.PoporopoToast("Couldn't post your comment");
    }).then(function () {
      busy = false;
      if (btn) btn.disabled = !(input && input.value.trim());
    });
  }

  function onListClick(e) {
    var del = e.target.closest && e.target.closest('.comment-delete');
    if (!del) return;
    var id = del.getAttribute('data-id');
    if (!id || busy) return;
    busy = true;
    var target = currentContent;
    deleteComment(target, id)
      .then(function () { return listComments(target); })
      .then(function (items) { if (target === currentContent) renderComments(items); })
      .catch(function () {})
      .then(function () { busy = false; });
  }

  function autoGrow(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }

  function updateCounter() {
    var input = $('#commentInput', root);
    var cEl   = $('#commentCounter', root);
    var btn   = $('#commentSubmit', root);
    var len   = input ? input.value.trim().length : 0;
    if (btn) btn.disabled = !len;
    if (cEl) {
      var raw = input ? input.value.length : 0;
      cEl.textContent = raw > MAX_COMMENT_LEN - 100
        ? raw + '/' + MAX_COMMENT_LEN : '';
    }
  }

  function wire() {
    var likeBtn = $('#likeBtn', root);
    var form    = $('#commentForm', root);
    var input   = $('#commentInput', root);
    var cancel  = $('#commentCancel', root);
    var list    = $('#commentsList', root);

    if (likeBtn) likeBtn.addEventListener('click', onLikeClick);
    if (form)    form.addEventListener('submit', onSubmit);
    if (list)    list.addEventListener('click', onListClick);
    if (cancel)  cancel.addEventListener('click', function () {
      if (input) { input.value = ''; autoGrow(input); updateCounter(); input.blur(); }
    });
    if (input) {
      input.addEventListener('input', function () { autoGrow(input); updateCounter(); });
      /* Ctrl/Cmd+Enter envía; Enter solo salta línea. */
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onSubmit(); }
        e.stopPropagation();   // que las flechas no muevan el foco del modo TV
      });
    }
  }

  /* ============================================================
     API PÚBLICA (la consume script.js)
     ============================================================ */
  var api = {
    enabled: ENABLED,

    /* Monta el panel dentro de un contenedor del DOM. */
    mount: function (container) {
      if (!ENABLED || !container || root) return;
      root = buildPanel();
      container.appendChild(root);
      wire();
      refreshAuthUI();
    },

    /* Cambia el contenido activo. contentId debe ser único por
       película o por episodio:
         movie_550
         tv_1399_s1_e1                                        */
    setContent: function (contentId, label) {
      if (!ENABLED || !root) return;

      /* El título de TMDB llega después de abrir el reproductor, así que
         la etiqueta se refresca siempre, aunque el contenido no cambie. */
      currentLabel = label || '';
      updateContextLabel();

      if (contentId === currentContent) return;
      currentContent = contentId;
      liked = false;
      refreshLikeUI(0);
      renderComments([]);
      var input = $('#commentInput', root);
      if (input) { input.value = ''; autoGrow(input); }
      updateCounter();
      load();
    },

    clear: function () {
      currentContent = null;
      currentLabel = '';
      liked = false;
      if (root) { refreshLikeUI(0); renderComments([]); updateContextLabel(); }
    },

    /* Puentes con el login de Google que ya existe en script.js */
    signIn:  signInWithGoogleIdToken,
    signOut: signOut,

    onAuthChange: function (fn) {
      if (typeof fn === 'function') authListeners.push(fn);
    },

    isSignedIn: isSignedIn
  };

  /* Restaura la sesión guardada y refresca el token al arrancar. */
  if (ENABLED) {
    session = loadSession();
    if (session) {
      refreshToken().then(function () {
        refreshAuthUI();
        if (currentContent) load();
      });
    }
    authListeners.push(function () {
      refreshAuthUI();
      if (currentContent) load();
    });
  }

  window.PoporopoSocial = api;
})();
