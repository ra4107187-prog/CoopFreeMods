/**
 * Coop Free Mods — preferencias globales
 * Se carga en todas las páginas. No depende de que el HTML del navbar esté perfecto.
 */
(function () {
  'use strict';
  if (window.__cfmPrefsLoaded) return;
  window.__cfmPrefsLoaded = true;

  var TRACKS = {
    '1': '/public/bg-music.mp3',
    '2': '/public/bg-music-2.mp3',
    '3': '/public/bg-music-3.mp3'
  };

  function setPref(k, v) {
    v = String(v);
    try { localStorage.setItem(k, v); } catch (e) {}
    try {
      document.cookie = encodeURIComponent(k) + '=' + encodeURIComponent(v) +
        ';path=/;max-age=31536000;SameSite=Lax';
    } catch (e) {}
  }

  function getPref(k) {
    try {
      var v = localStorage.getItem(k);
      if (v !== null && v !== '') return v;
    } catch (e) {}
    try {
      var name = encodeURIComponent(k);
      var parts = document.cookie.split(';');
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i].trim();
        if (p.indexOf(name + '=') === 0) {
          return decodeURIComponent(p.substring(name.length + 1));
        }
      }
    } catch (e) {}
    return null;
  }

  function isOn(k) {
    return getPref(k) === '1';
  }

  function applyCursor() {
    var on = isOn('cfm_cursor');
    document.documentElement.classList.toggle('cfm-sm64-cursor', on);
    if (document.body) document.body.classList.toggle('cfm-sm64-cursor', on);

    var style = document.getElementById('cfm-cursor-css');
    if (on) {
      if (!style) {
        style = document.createElement('style');
        style.id = 'cfm-cursor-css';
        document.head.appendChild(style);
      }
      style.textContent =
        'html, body, html *, body *, a, button, input, textarea, select, label, summary, .card, .btn-red, .btn-blue, .btn-gray, .btn-like {' +
        'cursor: url("/public/cursor.png") 10 10, url("/public/cursor.png"), auto !important;}';
    } else if (style) {
      style.textContent = '';
    }
  }

  function applyListView() {
    document.documentElement.classList.toggle('cfm-list-view', isOn('cfm_list_view'));
  }

  function applyGrid() {
    var g = getPref('cfm_grid') || '3';
    var root = document.documentElement;
    root.classList.remove('cfm-grid-2', 'cfm-grid-3', 'cfm-grid-4', 'cfm-grid-5', 'cfm-grid-6', 'cfm-grid-giant');
    if (g === '2' || g === '3' || g === '4' || g === '5' || g === '6') {
      root.classList.add('cfm-grid-' + g);
    } else if (g === 'giant') {
      root.classList.add('cfm-grid-giant');
    }
  }

  function applyBgMove() {
    var root = document.documentElement;
    var on = false;
    try { on = getPref('cfm_bg_move') === '1'; } catch (e) {}
    if (on) {
      root.classList.add('cfm-bg-move');
      if (document.body) document.body.classList.add('cfm-bg-move');
    } else {
      root.classList.remove('cfm-bg-move');
      if (document.body) document.body.classList.remove('cfm-bg-move');
    }
    // Capa dedicada: más fiable que solo ::before (evita bugs de fondo estático)
    var layer = document.getElementById('cfm-bg-layer');
    if (on) {
      if (!layer) {
        layer = document.createElement('div');
        layer.id = 'cfm-bg-layer';
        layer.setAttribute('aria-hidden', 'true');
        document.body.insertBefore(layer, document.body.firstChild);
      }
      layer.className = 'cfm-bg-layer is-on';
    } else if (layer) {
      layer.className = 'cfm-bg-layer';
    }
  }

  function ensureAudio() {
    var a = document.getElementById('cfm-bg-music');
    if (!a) {
      a = document.createElement('audio');
      a.id = 'cfm-bg-music';
      a.loop = true;
      a.preload = 'auto';
      a.style.display = 'none';
      document.body.appendChild(a);
    }
    var track = getPref('cfm_music_track') || '1';
    var src = TRACKS[track] || TRACKS['1'];
    if (!a.getAttribute('data-src') || a.getAttribute('data-src') !== src) {
      a.src = src;
      a.setAttribute('data-src', src);
    }
    return a;
  }

  function tryMusic() {
    var a = ensureAudio();
    var want = isOn('cfm_music');
    var path = location.pathname || '';
    var silence = path.indexOf('/cooptube/v/') === 0 || path.indexOf('/jugar-sm64') === 0;

    if (want && !silence) {
      var t = parseFloat(getPref('cfm_music_t') || '0');
      try {
        if (!isNaN(t) && t > 0.25 && a.readyState >= 1) {
          if (!a.duration || t < a.duration - 0.4) a.currentTime = t;
        }
      } catch (e) {}

      var p = a.play();
      if (p && p.catch) {
        p.catch(function () {
          showMusicBanner();
        });
      } else {
        hideMusicBanner();
      }
    } else {
      try { setPref('cfm_music_t', String(a.currentTime || 0)); } catch (e) {}
      a.pause();
      hideMusicBanner();
    }
  }

  function showMusicBanner() {
    if (document.getElementById('cfm-music-banner')) return;
    if (!document.body) return;
    var b = document.createElement('button');
    b.id = 'cfm-music-banner';
    b.type = 'button';
    b.textContent = '▶ Tocar música';
    b.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:999999;background:#e11d48;color:#fff;border:none;border-radius:999px;padding:10px 16px;font-weight:800;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.4);font-size:13px;';
    b.onclick = function () {
      var a = ensureAudio();
      a.play().then(function () {
        hideMusicBanner();
      }).catch(function () {});
    };
    document.body.appendChild(b);
  }

  function hideMusicBanner() {
    var b = document.getElementById('cfm-music-banner');
    if (b) b.remove();
  }

  function beep() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      var ctx = window.__cfmAudioCtx || (window.__cfmAudioCtx = new Ctx());
      if (ctx.state === 'suspended') ctx.resume();
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = 880;
      g.gain.value = 0.05;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      try { g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06); } catch (e) {}
      o.stop(ctx.currentTime + 0.07);
    } catch (e) {}
  }

  function onClickSound() {
    if (!isOn('cfm_click')) return;
    try {
      var a = new Audio('/public/click.mp3');
      a.volume = 0.45;
      var p = a.play();
      if (p && p.catch) p.catch(function () { beep(); });
    } catch (e) {
      beep();
    }
  }

  function applyAll() {
    applyCursor();
    applyListView();
    applyGrid();
    applyBgMove();
    tryMusic();
  }

  document.addEventListener('click', onClickSound, true);

  setInterval(function () {
    try {
      var a = document.getElementById('cfm-bg-music');
      if (a && !a.paused) setPref('cfm_music_t', String(a.currentTime || 0));
    } catch (e) {}
  }, 1000);

  function boot() {
    applyAll();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  window.addEventListener('pageshow', applyAll);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) applyAll();
  });

  window.cfmPrefs = {
    get: getPref,
    set: setPref,
    isOn: isOn,
    applyAll: applyAll,
    tryMusic: tryMusic,
    applyCursor: applyCursor
  };
})();
/* === CFM EXTRAS: AFK video, :cfm_icon:, toasts, logros === */
(function () {
  'use strict';
  if (window.__cfmExtrasLoaded) return;
  window.__cfmExtrasLoaded = true;

  var ICON = '/public/icon.png';
  var AFK_MS = 90000; // 90s sin actividad
  var afkTimer = null;
  var afkOn = false;
  var musicWasPlaying = false;

  function $(id) { return document.getElementById(id); }

  function pauseMusic() {
    var a = $('cfm-bg-music');
    if (a && !a.paused) {
      musicWasPlaying = true;
      try { a.pause(); } catch (e) {}
    } else {
      musicWasPlaying = false;
    }
  }
  function resumeMusic() {
    if (!musicWasPlaying) return;
    var a = $('cfm-bg-music');
    if (a) try { a.play().catch(function () {}); } catch (e) {}
    musicWasPlaying = false;
  }

  function hideAfk() {
    if (!afkOn) return;
    afkOn = false;
    var ov = $('cfm-afk-overlay');
    if (ov) {
      var v = ov.querySelector('video');
      if (v) try { v.pause(); } catch (e) {}
      ov.remove();
    }
    resumeMusic();
    resetAfk();
  }

  function showAfk() {
    if (afkOn) return;
    if (document.hidden) return;
    afkOn = true;
    pauseMusic();
    var ov = document.createElement('div');
    ov.id = 'cfm-afk-overlay';
    ov.innerHTML =
      '<div class="cfm-afk-inner">' +
      '<video playsinline autoplay loop muted src="/public/easter-afk.mp4"></video>' +
      '<div class="cfm-afk-fallback">' +
      '<img src="/public/logo.png" alt="CFM" onerror="this.src=\\'/public/icon.png\\'">' +
      '<p>Estás AFK… mové el mouse para volver</p>' +
      '</div></div>';
    document.body.appendChild(ov);
    var vid = ov.querySelector('video');
    if (vid) {
      vid.muted = false;
      vid.volume = 0.7;
      vid.play().catch(function () {
        // autoplay con sonido bloqueado: deja muted + fallback visible
        vid.muted = true;
        vid.play().catch(function () {});
      });
      vid.addEventListener('error', function () {
        ov.classList.add('no-video');
      });
      // si no hay archivo, error rápido
      setTimeout(function () {
        if (vid.readyState < 2) ov.classList.add('no-video');
      }, 1500);
    }
    // cualquier movimiento/tecla/touch cierra
    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'].forEach(function (ev) {
      window.addEventListener(ev, hideAfk, { once: true, passive: true });
    });
  }

  function resetAfk() {
    if (afkTimer) clearTimeout(afkTimer);
    afkTimer = setTimeout(showAfk, AFK_MS);
  }

  ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'].forEach(function (ev) {
    window.addEventListener(ev, function () {
      if (!afkOn) resetAfk();
    }, { passive: true });
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (afkTimer) clearTimeout(afkTimer);
      hideAfk();
    } else resetAfk();
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', resetAfk);
  } else resetAfk();

  // --- :cfm_icon: en textos ---
  function iconifyNode(root) {
    if (!root) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      if (!node.nodeValue || node.nodeValue.indexOf(':cfm_icon:') === -1) return;
      if (node.parentElement && (node.parentElement.tagName === 'SCRIPT' || node.parentElement.tagName === 'STYLE')) return;
      var parts = node.nodeValue.split(':cfm_icon:');
      var frag = document.createDocumentFragment();
      parts.forEach(function (part, i) {
        if (part) frag.appendChild(document.createTextNode(part));
        if (i < parts.length - 1) {
          var img = document.createElement('img');
          img.src = ICON;
          img.alt = 'CFM';
          img.className = 'cfm-inline-icon';
          img.title = ':cfm_icon:';
          frag.appendChild(img);
        }
      });
      node.parentNode.replaceChild(frag, node);
    });
  }
  function runIconify() {
    try { iconifyNode(document.body); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', runIconify);
  else runIconify();

  // --- Modal publicado OK ---
  function showPublishOk(msg) {
    if ($('cfm-ok-modal')) return;
    var m = document.createElement('div');
    m.id = 'cfm-ok-modal';
    m.innerHTML =
      '<div class="cfm-ok-card">' +
      '<div class="cfm-ok-icon">✅</div>' +
      '<p class="cfm-ok-msg"></p>' +
      '<button type="button" class="btn-red" id="cfm-ok-btn">OK</button>' +
      '</div>';
    m.querySelector('.cfm-ok-msg').textContent = msg;
    document.body.appendChild(m);
    function close() { try { m.remove(); } catch (e) {} }
    m.querySelector('#cfm-ok-btn').onclick = close;
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
  }
  try {
    var sp = new URLSearchParams(location.search);
    var ok = sp.get('ok') || sp.get('publicado');
    if (ok) {
      var labels = {
        mod: 'Se publicó el mod correctamente',
        foro: 'Se publicó el tema del foro correctamente',
        video: 'Se publicó el video correctamente',
        tutorial: 'Se publicó el tutorial correctamente',
        novedad: 'Se publicó la novedad correctamente',
        pack: 'Se publicó el pack correctamente',
        evento: 'Se publicó el evento correctamente',
        reply: 'Respuesta publicada correctamente',
        comment: 'Comentario publicado correctamente'
      };
      var msg = labels[ok] || ('Se publicó correctamente');
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { showPublishOk(msg); });
      } else showPublishOk(msg);
      // limpiar query sin recargar feo
      try {
        sp.delete('ok'); sp.delete('publicado');
        var clean = location.pathname + (sp.toString() ? '?' + sp.toString() : '') + location.hash;
        history.replaceState(null, '', clean);
      } catch (e) {}
    }
  } catch (e) {}

  // --- Toast logros (Steam-like) ---
  function toastLogro(l) {
    var box = $('cfm-ach-stack');
    if (!box) {
      box = document.createElement('div');
      box.id = 'cfm-ach-stack';
      document.body.appendChild(box);
    }
    var el = document.createElement('div');
    el.className = 'cfm-ach-toast';
    el.innerHTML =
      '<div class="cfm-ach-ico">' + (l.icon || '🏅') + '</div>' +
      '<div><div class="cfm-ach-label">Logro desbloqueado</div>' +
      '<div class="cfm-ach-name"></div>' +
      '<div class="cfm-ach-desc"></div></div>';
    el.querySelector('.cfm-ach-name').textContent = l.nombre || l.id;
    el.querySelector('.cfm-ach-desc').textContent = l.desc || '';
    box.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () { try { el.remove(); } catch (e) {} }, 400);
    }, 4500);
  }

  function checkLogros() {
    fetch('/api/logros-mine', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.ok || !data.logros) return;
        var key = 'cfm_seen_logros_v1';
        var seen = [];
        try { seen = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) {}
        if (!Array.isArray(seen)) seen = [];
        var seenSet = {};
        seen.forEach(function (id) { seenSet[id] = true; });
        var firstRun = seen.length === 0;
        data.logros.forEach(function (l) {
          if (!l || !l.id) return;
          if (!seenSet[l.id]) {
            if (!firstRun) toastLogro(l);
            seen.push(l.id);
            seenSet[l.id] = true;
          }
        });
        // primera visita: no spamear todos, solo guardar
        try { localStorage.setItem(key, JSON.stringify(seen)); } catch (e) {}
      })
      .catch(function () {});
  }
  if (document.cookie.indexOf('usuarioSesion=') !== -1) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(checkLogros, 800); });
    else setTimeout(checkLogros, 800);
  }

  // CSS
  var st = document.createElement('style');
  st.textContent =
    '.cfm-inline-icon{height:1.15em;width:1.15em;vertical-align:-0.2em;display:inline-block;object-fit:contain;margin:0 0.1em;}' +
    '#cfm-afk-overlay{position:fixed;inset:0;z-index:2147483000;background:#000;display:flex;align-items:center;justify-content:center;}' +
    '#cfm-afk-overlay video{max-width:100%;max-height:100%;width:100%;height:100%;object-fit:contain;background:#000;}' +
    '#cfm-afk-overlay.no-video video{display:none;}' +
    '#cfm-afk-overlay .cfm-afk-fallback{display:none;flex-direction:column;align-items:center;gap:16px;color:#e5e7eb;font-family:system-ui,sans-serif;text-align:center;padding:24px;}' +
    '#cfm-afk-overlay.no-video .cfm-afk-fallback{display:flex;}' +
    '#cfm-afk-overlay .cfm-afk-fallback img{width:min(240px,70vw);}' +
    '#cfm-ok-modal{position:fixed;inset:0;z-index:2147483001;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px;}' +
    '#cfm-ok-modal .cfm-ok-card{background:#1f2430;border:1px solid #374151;border-radius:14px;padding:22px 24px;max-width:340px;width:100%;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.45);}' +
    '#cfm-ok-modal .cfm-ok-icon{font-size:36px;margin-bottom:8px;}' +
    '#cfm-ok-modal .cfm-ok-msg{color:#f3f4f6;font-size:15px;line-height:1.4;margin:0 0 16px;}' +
    '#cfm-ach-stack{position:fixed;right:16px;bottom:16px;z-index:2147483002;display:flex;flex-direction:column;gap:10px;pointer-events:none;max-width:min(320px,92vw);}' +
    '.cfm-ach-toast{display:flex;gap:12px;align-items:center;background:linear-gradient(135deg,#1e293b,#0f172a);border:1px solid #fbbf24;border-radius:10px;padding:12px 14px;color:#fff;box-shadow:0 8px 28px rgba(0,0,0,.4);opacity:0;transform:translateY(16px);transition:opacity .35s ease,transform .35s ease;}' +
    '.cfm-ach-toast.show{opacity:1;transform:translateY(0);}' +
    '.cfm-ach-ico{font-size:28px;line-height:1;}' +
    '.cfm-ach-label{font-size:11px;color:#fbbf24;font-weight:700;letter-spacing:.04em;text-transform:uppercase;}' +
    '.cfm-ach-name{font-size:14px;font-weight:800;}' +
    '.cfm-ach-desc{font-size:12px;color:#9ca3af;}';
  document.head.appendChild(st);
})();
