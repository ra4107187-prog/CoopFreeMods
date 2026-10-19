/**
 * Coop Free Mods — preferencias globales
 * Se carga en todas las páginas. No depende de que el HTML del navbar esté perfecto.
 */
(function () {
  'use strict';
  if (window.__cfmPrefsLoaded) return;
  window.__cfmPrefsLoaded = true;

  /* early nostalgia */
  try {
    var _n = null;
    try { _n = localStorage.getItem('cfm_nostalgia'); } catch (e) {}
    if (_n === '1') document.documentElement.classList.add('cfm-nostalgia');
  } catch (e) {}

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
      // CSS inyectado: no depende de styles.js
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

  function applyNostalgia() {
    var on = isOn('cfm_nostalgia');
    document.documentElement.classList.toggle('cfm-nostalgia', on);
    if (document.body) document.body.classList.toggle('cfm-nostalgia', on);
  }

  function ensureAudio() {
    var a = document.getElementById('cfm-bg-music');
    if (!a) {
      a = document.createElement('audio');
      a.id = 'cfm-bg-music';
      a.loop = true;
      a.preload = 'auto';
      a.volume = 0.35;
      (document.body || document.documentElement).appendChild(a);
    }
    var track = getPref('cfm_music_track') || '1';
    var src = TRACKS[track] || TRACKS['1'];
    var file = src.split('/').pop();
    var cur = a.getAttribute('src') || a.src || '';
    if (!cur || cur.indexOf(file) === -1) {
      a.src = src;
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
    if (!isOn('cfm_music')) return;
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
    applyNostalgia();
    tryMusic();
  }

  // Click sound
  document.addEventListener('click', onClickSound, true);

  // Guardar tiempo de música
  setInterval(function () {
    try {
      var a = document.getElementById('cfm-bg-music');
      if (a && !a.paused) setPref('cfm_music_t', String(a.currentTime || 0));
    } catch (e) {}
  }, 1000);

  // Boot
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

  // API para la página de config
  window.cfmPrefs = {
    get: getPref,
    set: setPref,
    isOn: isOn,
    applyAll: applyAll,
    tryMusic: tryMusic,
    applyCursor: applyCursor
  };
})();
