const express = require('express');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const path = require('path');
const bcrypt = require('bcryptjs');
const { supabase } = require('./lib/supabase');
const { estilosCSS } = require('./lib/styles');

const app = express();
const PORT = process.env.PORT || 3000;
const MODERADOR = 'SuperAaron64';
const recentActions = new Map();
function rateLimit(key, ms = 2000) {
  const now = Date.now();
  const last = recentActions.get(key) || 0;
  if (now - last < ms) return false;
  recentActions.set(key, now);
  return true;
}
function paginateList(items, page, perPage = 30) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const p = Math.min(Math.max(1, parseInt(page) || 1), totalPages);
  const start = (p - 1) * perPage;
  return { page: p, totalPages, total, slice: items.slice(start, start + perPage) };
}
function renderPagination(baseUrl, page, totalPages, query = {}) {
  if (totalPages <= 1) return '';
  const q = Object.entries(query).filter(([k,v]) => v && k !== 'page').map(([k,v]) => k + '=' + encodeURIComponent(v)).join('&');
  const link = (n, label, disabled) => disabled
    ? `<span style="padding:6px 12px;color:#6b7280;">${label}</span>`
    : `<a href="${baseUrl}?page=${n}${q ? '&' + q : ''}" style="padding:6px 12px;color:#93c5fd;text-decoration:none;font-weight:bold;">${label}</a>`;
  let nums = '';
  for (let i = 1; i <= totalPages; i++) {
    if (i === page) nums += `<span style="padding:6px 10px;background:#2563eb;color:white;border-radius:6px;margin:0 2px;">${i}</span>`;
    else if (i === 1 || i === totalPages || Math.abs(i - page) <= 2) nums += link(i, String(i), false);
    else if (Math.abs(i - page) === 3) nums += `<span style="color:#6b7280;">…</span>`;
  }
  return `<div style="display:flex;justify-content:center;align-items:center;gap:6px;margin:30px 0;flex-wrap:wrap;">
    ${link(page - 1, '← Anterior', page <= 1)}
    ${nums}
    ${link(page + 1, 'Siguiente →', page >= totalPages)}
  </div>`;
}


app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());
app.use('/public', express.static(path.join(__dirname, 'public')));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'archivoMod') {
      const ext = path.extname(file.originalname).toLowerCase();
      if (['.zip', '.7z', '.rar', '.lua'].includes(ext)) return cb(null, true);
      return cb(new Error('Solo .zip, .7z, .rar o .lua'));
    }
    if (file.fieldname === 'imagenesMod') {
      const ext = path.extname(file.originalname).toLowerCase();
      const okExt = ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext);
      const okMime = file.mimetype && ['image/png','image/jpeg','image/jpg','image/webp','image/gif'].includes(file.mimetype);
      if (okExt || okMime) return cb(null, true);
      return cb(new Error('Solo capturas PNG, JPG, JPEG, WebP o GIF'));
    }
    cb(null, true);
  }
});

function cleanText(str) {
  return escapeHtml(String(str || '')).replace(/\r\n|\r|\n/g, ' ').replace(/\s{2,}/g, ' ').trim();
}
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function isMod(user) { return user === MODERADOR; }

const COOPTUBE_CATS = ['Tutoriales', 'Showcase', 'Gameplay', 'Speedrun', 'Mods', 'Lua / código', 'Noticias', 'Otros'];

function extractYoutubeId(url) {
  if (!url) return null;
  try {
    const u = new URL(String(url).trim());
    const h = u.hostname.replace(/^www\./, '').toLowerCase();
    if (h === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (h === 'youtube.com' || h === 'm.youtube.com' || h === 'music.youtube.com') {
      if (u.pathname.startsWith('/shorts/')) {
        const id = u.pathname.split('/')[2];
        return id && /^[\w-]{11}$/.test(id) ? id : null;
      }
      if (u.pathname.startsWith('/embed/')) {
        const id = u.pathname.split('/')[2];
        return id && /^[\w-]{11}$/.test(id) ? id : null;
      }
      if (u.pathname.startsWith('/live/')) {
        const id = u.pathname.split('/')[2];
        return id && /^[\w-]{11}$/.test(id) ? id : null;
      }
      const v = u.searchParams.get('v');
      return v && /^[\w-]{11}$/.test(v) ? v : null;
    }
  } catch (e) {}
  return null;
}
function youtubeThumb(id) {
  return 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg';
}
function mapVideo(row) {
  if (!row) return null;
  return {
    id: row.id,
    titulo: row.titulo,
    descripcion: row.descripcion || '',
    autor: row.autor,
    youtubeId: row.youtube_id,
    categoria: row.categoria || 'Otros',
    modUrl: row.mod_url || null,
    thumbnail: row.thumbnail_url || null,
    vistas: row.vistas || 0,
    created_at: row.created_at
  };
}
function isAllowedImageUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    return true;
  } catch (e) { return false; }
}
function isAllowedModPageUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    // prefer our site /mod/ID but allow any https link to a mod page
    return true;
  } catch (e) { return false; }
}

function isAllowedModLink(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const h = u.hostname.toLowerCase().replace(/^www\./, '');
    const allowed = [
      'drive.google.com', 'docs.google.com',
      'mediafire.com', 'www.mediafire.com',
      'mega.nz', 'mega.io'
    ];
    return allowed.some(d => h === d || h.endsWith('.' + d));
  } catch (e) { return false; }
}

function mapMod(row) {
  if (!row) return null;
  return {
    id: row.id, titulo: row.titulo, descripcion: row.descripcion, autor: row.autor,
    version: row.version, categoria: row.categoria, nombreArchivoReal: row.nombre_archivo_real,
    archivoPath: row.archivo_path, rutasImagenes: row.rutas_imagenes || [],
    descargas: row.descargas || 0, likes: row.likes || 0, usuariosLike: row.usuarios_like || [],
    comentarios: row.comentarios || [], historialActualizaciones: row.historial_actualizaciones || [],
    fechaCreacion: row.fecha_creacion, pesoArchivo: row.peso_archivo
  };
}
function mapUser(row) {
  if (!row) return null;
  return {
    usuario: row.usuario, descripcion: row.descripcion, fechaRegistro: row.fecha_registro,
    seguidores: row.seguidores || [], banneado: !!row.banneado
  };
}
async function uploadToStorage(bucket, filePath, buffer, contentType) {
  const { error } = await supabase.storage.from(bucket).upload(filePath, buffer, { contentType, upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}
async function crearNotif(usuario, tipo, mensaje, link) {
  try {
    await supabase.from('notificaciones').insert({ usuario, tipo, mensaje, link: link || '/', leido: false });
  } catch (e) { console.error('notif', e); }
}
async function countNotif(usuario) {
  if (!usuario) return 0;
  const { count } = await supabase.from('notificaciones').select('*', { count: 'exact', head: true }).eq('usuario', usuario).eq('leido', false);
  return count || 0;
}
async function getSesion(req) {
  const name = req.cookies.usuarioSesion || null;
  if (!name) return { name: null, banneado: false, esMod: false };
  const { data } = await supabase.from('usuarios').select('usuario,banneado').eq('usuario', name).single();
  if (!data) return { name: null, banneado: false, esMod: false };
  return { name: data.usuario, banneado: !!data.banneado, esMod: isMod(data.usuario) };
}
function authLinks(sesion, nNotif) {
  if (!sesion.name) {
    return `<a href="/login" style="color:#ced4da;text-decoration:none;font-size:14px;">Entrar</a>
    <a href="/register" class="btn-red">Registrarse</a>`;
  }
  const modBadge = sesion.esMod ? `<span class="mod-badge">MOD</span>` : '';
  return `<a href="/publish" class="btn-red">+ Publicar mod</a>
    <a href="/user/${escapeHtml(sesion.name)}" style="color:white;font-weight:bold;text-decoration:none;font-size:14px;">${escapeHtml(sesion.name)}</a>${modBadge}
    <a href="/logout" style="color:#9ca3af;">Salir</a>`;
}
function leftUserLinks(sesion, nNotif) {
  if (!sesion.name) return '';
  const dot = nNotif > 0 ? `<span class="notif-dot"></span>` : '';
  return `<a href="/mis-mods">Mis mods</a>
    <a href="/favoritos">Favoritos</a>
    <a href="/notificaciones" class="notif-bell" title="${nNotif > 0 ? nNotif + ' sin leer' : 'Notificaciones'}">🔔${dot}</a>`;
}
function navbar(sesion, nNotif, extra) {
  const mid = sesion.name ? leftUserLinks(sesion, nNotif || 0) : '';
  return `<div class="navbar">
    <div class="navbar-row navbar-row-main">
      <div class="brand"><a href="/"><img src="/public/logo.png" class="brand-logo" alt="Logo"></a></div>
      <div class="nav-links nav-links-main">
        <a href="/">Inicio</a>
        <a href="/mods">Mods</a>
        <a href="/top">⭐ Top 10</a>
        <a href="/foros">💬 Foros</a>
        <a href="/como-instalar">📖 Cómo instalar</a>
        <a href="/config">⚙️ Config</a>
        ${mid}
        ${extra || ''}
        ${authLinks(sesion, nNotif || 0)}
      </div>
    </div>
    <div class="navbar-row navbar-row-sub">
      <div class="nav-links nav-links-sub">
        <a href="/usuarios">👥 Usuarios</a>
        <a href="/novedades">📰 Novedades</a>
        <a href="/cooptube">📺 CoopTube</a>
        <a href="/ia-mods">🍄 ToadCode</a>
        <a href="/discord">Discord</a>
      </div>
    </div>
  </div>
  <script>
  (function(){
    try {
      var c = localStorage.getItem('cfm_cursor') === '1';
      var m = localStorage.getItem('cfm_music') === '1';
      var lv = localStorage.getItem('cfm_list_view') === '1';
      var clk = localStorage.getItem('cfm_click') === '1';
      if (c) document.documentElement.classList.add('cfm-sm64-cursor');
      else document.documentElement.classList.remove('cfm-sm64-cursor');
      if (lv) document.documentElement.classList.add('cfm-list-view');
      else document.documentElement.classList.remove('cfm-list-view');
      // Sonido al hacer click
      if (!window.__cfmClickBound) {
        window.__cfmClickBound = true;
        document.addEventListener('click', function() {
          try {
            if (localStorage.getItem('cfm_click') !== '1') return;
            var a = new Audio('/public/click.mp3');
            a.volume = 0.45;
            a.play().catch(function(){});
          } catch (e) {}
        }, true);
      }


      var audio = document.getElementById('cfm-bg-music');
      if (!audio) {
        audio = document.createElement('audio');
        audio.id = 'cfm-bg-music';
        audio.loop = true;
        audio.preload = 'auto';
        audio.src = '/public/bg-music.mp3';
        audio.volume = 0.35;
        document.body.appendChild(audio);
      }

      // Continuar desde donde iba (no reiniciar al cambiar de página)
      var saved = parseFloat(localStorage.getItem('cfm_music_t') || '0');
      function seekSaved() {
        try {
          if (!isNaN(saved) && saved > 0.25) {
            var dur = audio.duration;
            if (!dur || isNaN(dur) || saved < dur - 0.4) audio.currentTime = saved;
          }
        } catch (e) {}
      }
      audio.addEventListener('loadedmetadata', seekSaved);
      audio.addEventListener('canplay', function once() { seekSaved(); audio.removeEventListener('canplay', once); });
      seekSaved();

      function saveTime() {
        try {
          if (audio) localStorage.setItem('cfm_music_t', String(audio.currentTime || 0));
        } catch (e) {}
      }
      setInterval(saveTime, 800);
      document.addEventListener('visibilitychange', function(){ if (document.hidden) saveTime(); });
      window.addEventListener('pagehide', saveTime);
      window.addEventListener('beforeunload', saveTime);

      // En CoopTube (página de video) siempre silenciar fondo
      var onVideo = location.pathname.indexOf("/cooptube/v/") === 0;
      if (m && !onVideo) {
        seekSaved();
        var pr = audio.play();
        if (pr && pr.catch) pr.catch(function(){});
      } else {
        audio.pause();
        saveTime();
      }
    } catch(e) {}
  })();
  </script>`;
}
function renderModCards(mods, sesion) {
  if (!mods.length) return '<p style="color:#9ca3af;grid-column:1/-1;text-align:center;padding:40px;">No se encontraron mods.</p>';
  return mods.map(mod => {
    const numCom = (mod.comentarios || []).filter(c => !c.parentId).length;
    const foto = mod.rutasImagenes && mod.rutasImagenes[0];
    const img = foto ? `<img src="${escapeHtml(foto)}">` : '<div style="color:#555;font-size:40px;">📦</div>';
    return `<div class="card" style="position:relative;">
      <a href="/mod/${mod.id}" style="text-decoration:none;color:inherit;display:block;flex:1;">
        <div class="card-img-box">${img}</div>
        <div class="card-content" style="padding-bottom:8px;">
          <div class="tags"><span class="tag-version">${escapeHtml(mod.version)}</span><span class="tag-category">${escapeHtml(mod.categoria)}</span></div>
          <h3 style="color:white;margin:0 0 10px 0;">${escapeHtml(mod.titulo)}</h3>
          <p>${escapeHtml(mod.descripcion)}</p>
        </div>
      </a>
      <div class="card-footer" style="padding:12px 15px;margin:0;">
        <span>por <a href="/user/${escapeHtml(mod.autor)}" class="author">@${escapeHtml(mod.autor)}</a></span>
        <div style="display:flex;gap:10px;align-items:center;color:#9ca3af;font-size:12px;pointer-events:none;">
          <span title="Descargas">⬇️ ${mod.descargas || 0}</span>
          <span title="Comentarios">💬 ${numCom}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}


function pageError(res, status, titulo, mensaje, sesion, nNotif) {
  const nav = (sesion && typeof navbar === 'function') ? navbar(sesion, nNotif || 0) : '';
  res.status(status || 500).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/public/icon.png" type="image/png"><title>${titulo || 'Error'} | Coop Free Mods</title>${estilosCSS}</head><body>
    ${nav}
    <div class="main-container" style="max-width:560px;">
      <div class="form-box" style="margin-top:40px;text-align:center;">
        <h1 style="color:white;margin:0 0 12px 0;">${titulo || 'Error'}</h1>
        <p style="color:#9ca3af;margin:0 0 24px 0;">${mensaje || 'Algo salió mal.'}</p>
        <a href="/" class="btn-red">Inicio</a>
        <a href="/mods" class="btn-blue" style="margin-left:8px;">Mods</a>
      </div>
    </div>
  </body></html>`);
}


// ---------- RUTAS ----------

app.get('/', async (req, res) => {
  try {
    const sesion = await getSesion(req);
    const nNotif = await countNotif(sesion.name);
    const { data: allMods } = await supabase.from('mods').select('*').order('id', { ascending: false }).limit(100);
    const mods = (allMods || []).map(mapMod);
    const recientes = mods.slice(0, 5);
    const top3 = [...mods].sort((a, b) => (b.descargas || 0) - (a.descargas || 0)).slice(0, 3);
    let forosPop = [];
    let forosRec = [];
    try {
      const { data: temas } = await supabase.from('foro_temas').select('*').order('updated_at', { ascending: false }).limit(30);
      const lista = temas || [];
      forosRec = lista.slice(0, 5);
      forosPop = [...lista].sort((a, b) => (b.vistas || 0) - (a.vistas || 0)).slice(0, 5);
    } catch (e) { console.error('foros home', e); }
    const cats = ['Character Select','Dynos','Hangouts / Romhack','Gamemodes','Movesets','Modifiers','Administrative / Utility','Resources','Otros'];
    const catHtml = cats.map(c =>
      `<a href="/mods?categoria=${encodeURIComponent(c)}" class="home-cat">${escapeHtml(c)}</a>`
    ).join('');
    const miniMod = (m) => {
      const foto = m.rutasImagenes && m.rutasImagenes[0];
      const img = foto ? `<img src="${escapeHtml(foto)}" alt="">` : '<div class="home-mod-ph">📦</div>';
      return `<a href="/mod/${m.id}" class="home-mod-row">
        <div class="home-mod-thumb">${img}</div>
        <div>
          <div class="home-mod-title">${escapeHtml(m.titulo)}</div>
          <div class="home-mod-meta">@${escapeHtml(m.autor)} · ⬇️ ${m.descargas || 0}</div>
        </div>
      </a>`;
    };
    const miniForo = (f) =>
      `<a href="/foros/tema/${f.id}" class="home-foro-row">
        <span class="home-foro-title">${escapeHtml(f.titulo)}</span>
        <span class="home-foro-meta">@${escapeHtml(f.autor)} · 👁 ${f.vistas || 0}</span>
      </a>`;
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="icon" href="/public/icon.png" type="image/png"><title>Inicio | Coop Free Mods</title>${estilosCSS}</head><body>
      ${navbar(sesion, nNotif)}
      <div class="main-container home-page">
        <div class="home-grid">
          <div class="home-main">
            <div class="home-hero">
              <h1>Bienvenido a <span class="home-accent">Coop Free Mods</span></h1>
              <p class="home-lead">La biblioteca comunitaria de mods gratis para <b>SM64 Co-op DX</b>, <b>SM64 EX Co-op</b> y <b>DX + EX</b>. Descargá, publicá y compartí personajes, dynos, hangouts, gamemodes y más.</p>
              <p class="home-lead" style="font-size:14px;color:#9ca3af;">Proyecto iniciado por @Ellos (them) y continuado por @SuperAaron64. Los mods se guardan en la nube y no se pierden al reiniciar.</p>
            </div>
            <div class="home-section">
              <h2>🆕 Mods más recientes</h2>
              <div class="home-list">${recientes.map(miniMod).join('') || '<p style="color:#9ca3af;">Aún no hay mods.</p>'}</div>
            </div>
            <div class="home-section">
              <h2>💬 Foros recientes</h2>
              <div class="home-list">${forosRec.map(miniForo).join('') || '<p style="color:#9ca3af;">Sin temas aún.</p>'}</div>
            </div>
          </div>
          <aside class="home-side">
            <div class="home-side-box">
              <h3>📁 Categorías</h3>
              <div class="home-cats">${catHtml}</div>
            </div>
            <div class="home-side-box">
              <h3>🏆 Top 3 descargas</h3>
              <div class="home-list">${top3.map(miniMod).join('') || '<p style="color:#9ca3af;">—</p>'}</div>
            </div>
            <div class="home-side-box">
              <h3>🔥 Foros populares</h3>
              <div class="home-list">${forosPop.map(miniForo).join('') || '<p style="color:#9ca3af;">—</p>'}</div>
            </div>
          </aside>
        </div>
        <div class="home-cta">
          <a href="/mods" class="btn-red">Ver Mods</a>
          <a href="/top" class="btn-blue">Top 10</a>
          <a href="/foros" class="btn-blue">Foros</a>
          <a href="/como-instalar" class="btn-gray" style="padding:10px 16px;font-size:14px;">Cómo instalar</a>
          <a href="/discord" class="discord-float" style="margin:0;">Discord</a>
          <button type="button" id="cfm-egg-zone" aria-label="egg" style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;margin-left:6px;padding:0;border:1px solid #374151;border-radius:8px;background:#1f2937;color:#4b5563;font-size:16px;line-height:1;cursor:pointer;vertical-align:middle;">·</button>
          <a href="/jugar-sm64" id="cfm-egg-sm64" style="display:none;margin:0;background:#e11d48;color:#fff !important;font-weight:800;padding:12px 16px;border-radius:999px;text-decoration:none;box-shadow:0 6px 20px rgba(225,29,72,0.45);">🍄 Jugar SM64</a>
        </div>
        <script>
        (function(){
          var zone = document.getElementById('cfm-egg-zone');
          var btn = document.getElementById('cfm-egg-sm64');
          if (!zone || !btn) return;
          function reveal() {
            try { localStorage.setItem('cfm_egg_sm64', '1'); } catch(e) {}
            btn.style.display = 'inline-block';
            zone.style.display = 'none';
          }
          try {
            if (localStorage.getItem('cfm_egg_sm64') === '1') reveal();
          } catch(e) {}
          var last = 0;
          zone.addEventListener('dblclick', function(e) {
            e.preventDefault(); e.stopPropagation(); reveal();
          });
          zone.addEventListener('click', function(e) {
            e.preventDefault(); e.stopPropagation();
            var now = Date.now();
            if (now - last < 600) { last = 0; reveal(); }
            else last = now;
          });
          var lastTouch = 0;
          zone.addEventListener('touchend', function(e) {
            var now = Date.now();
            if (now - lastTouch < 600) { lastTouch = 0; e.preventDefault(); reveal(); }
            else lastTouch = now;
          }, {passive:false});
        })();
        </script>
      </div>
    </body></html>`);
  } catch (e) {
    console.error(e);
    pageError(res, 500, 'Error', 'No se pudo cargar la página.', sesion, nNotif);
  }
});


app.get('/mods', async (req, res) => {
  try {
    const sesion = await getSesion(req);
    const nNotif = await countNotif(sesion.name);
    const buscarTexto = (req.query.buscar || '').toLowerCase();
    const buscarCategoria = req.query.categoria || 'Todas';
    const buscarVersion = req.query.version || 'Todas';
    const { data, error } = await supabase.from('mods').select('*').order('id', { ascending: false });
    if (error) throw error;
    let mods = (data || []).map(mapMod).filter(mod => {
      const q = buscarTexto;
      const byId = q && /^\d+$/.test(q) && String(mod.id) === q;
      const byText = !q || byId || (mod.titulo || '').toLowerCase().includes(q) || (mod.descripcion || '').toLowerCase().includes(q) || (mod.autor || '').toLowerCase().includes(q);
      const c = buscarCategoria === 'Todas' || mod.categoria === buscarCategoria;
      const v = buscarVersion === 'Todas' || mod.version === buscarVersion;
      return byText && c && v;
    });
    // Si buscan un ID exacto y hay 1 resultado, ir directo al mod (el link sigue siendo /mod/id)
    if (/^\d+$/.test(buscarTexto) && mods.length === 1) {
      return res.redirect('/mod/' + mods[0].id);
    }
    const pg = paginateList(mods, req.query.page, 30);
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="icon" href="/public/icon.png" type="image/png"><title>Mods | Coop Free Mods</title>${estilosCSS}</head><body>
      ${navbar(sesion, nNotif)}
      <div class="main-container">
        <form action="/mods" method="GET" class="filter-bar">
          <input type="text" name="buscar" placeholder="Buscar mods o ID..." value="${escapeHtml(req.query.buscar || '')}">
          <select name="version">
            <option value="Todas">Todas las versiones</option>
            <option value="SM64 Co-op DX" ${buscarVersion==='SM64 Co-op DX'?'selected':''}>SM64 Co-op DX</option>
            <option value="SM64 EX Co-op" ${buscarVersion==='SM64 EX Co-op'?'selected':''}>SM64 EX Co-op</option>
            <option value="DX + EX" ${buscarVersion==='DX + EX'?'selected':''}>DX + EX</option>
          </select>
          <select name="categoria">
            <option value="Todas">Todas las categorías</option>
            <option value="Character Select" ${buscarCategoria==='Character Select'?'selected':''}>Character Select</option>
            <option value="Dynos" ${buscarCategoria==='Dynos'?'selected':''}>Dynos</option>
            <option value="Hangouts / Romhack" ${buscarCategoria==='Hangouts / Romhack'?'selected':''}>Hangouts / Romhack</option>
            <option value="Gamemodes" ${buscarCategoria==='Gamemodes'?'selected':''}>Gamemodes</option>
            <option value="Movesets" ${buscarCategoria==='Movesets'?'selected':''}>Movesets</option>
            <option value="Modifiers" ${buscarCategoria==='Modifiers'?'selected':''}>Modifiers</option>
            <option value="Administrative / Utility" ${buscarCategoria==='Administrative / Utility'?'selected':''}>Administrative / Utility</option>
            <option value="Resources" ${buscarCategoria==='Resources'?'selected':''}>Resources</option>
            <option value="Otros" ${buscarCategoria==='Otros'?'selected':''}>Otros</option>
          </select>
          <button type="submit" class="btn-blue">Filtrar</button>
        </form>
        <p style="color:#9ca3af;margin-bottom:20px;font-weight:bold;">${pg.total} mods encontrados · Página ${pg.page} de ${pg.totalPages}</p>
        <div class="grid">${renderModCards(pg.slice, sesion)}</div>
        ${renderPagination('/mods', pg.page, pg.totalPages, { buscar: req.query.buscar || '', version: buscarVersion === 'Todas' ? '' : buscarVersion, categoria: buscarCategoria === 'Todas' ? '' : buscarCategoria })}
      </div>
    </body></html>`);
  } catch (err) {
    console.error(err);
    pageError(res, 500, 'Error', 'No se pudieron cargar los mods.', sesion, nNotif);
  }
});

app.get('/top', async (req, res) => {
  try {
    const sesion = await getSesion(req);
    const nNotif = await countNotif(sesion.name);
    const buscarCategoria = req.query.categoria || 'Todas';
    const buscarVersion = req.query.version || 'Todas';
    const { data } = await supabase.from('mods').select('*').order('descargas', { ascending: false }).limit(50);
    let mods = (data || []).map(mapMod).filter(m => {
      return (buscarCategoria === 'Todas' || m.categoria === buscarCategoria) && (buscarVersion === 'Todas' || m.version === buscarVersion);
    }).slice(0, 10);
    let tarjetas = mods.map((mod, i) => {
      const foto = mod.rutasImagenes && mod.rutasImagenes[0];
      const img = foto ? `<img src="${escapeHtml(foto)}">` : '<div style="color:#555;font-size:40px;">📦</div>';
      return `<div class="card" style="position:relative;">
        <a href="/mod/${mod.id}" style="text-decoration:none;color:inherit;display:block;flex:1;">
          <div class="card-img-box">${img}</div>
          <div class="card-content">
            <div style="margin-bottom:10px;"><span class="top-badge">#${i+1}</span><span class="tag-version">${escapeHtml(mod.version)}</span></div>
            <h3 style="color:white;">${escapeHtml(mod.titulo)}</h3>
            
          </div>
        </a>
        <div class="card-footer" style="padding:12px 15px;margin:0;">
          <span>por <a href="/user/${escapeHtml(mod.autor)}" class="author">@${escapeHtml(mod.autor)}</a></span>
          <span style="pointer-events:none;">⬇️ ${mod.descargas || 0}</span>
        </div>
      </div>`;
    }).join('') || '<p style="color:#9ca3af;grid-column:1/-1;text-align:center;padding:40px;">Sin datos.</p>';
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="icon" href="/public/icon.png" type="image/png"><title>Top 10 | Coop Free Mods</title>${estilosCSS}</head><body>
      ${navbar(sesion, nNotif)}
      <div class="main-container">
        <h2>🏆 Top 10 Mods más Descargados</h2>
        <form action="/top" method="GET" class="filter-bar">
          <select name="version">
            <option value="Todas">Todas las versiones</option>
            <option value="SM64 Co-op DX" ${buscarVersion==='SM64 Co-op DX'?'selected':''}>SM64 Co-op DX</option>
            <option value="SM64 EX Co-op" ${buscarVersion==='SM64 EX Co-op'?'selected':''}>SM64 EX Co-op</option>
            <option value="DX + EX" ${buscarVersion==='DX + EX'?'selected':''}>DX + EX</option>
          </select>
          <select name="categoria">
            <option value="Todas">Todas las categorías</option>
            <option value="Character Select" ${buscarCategoria==='Character Select'?'selected':''}>Character Select</option>
            <option value="Dynos" ${buscarCategoria==='Dynos'?'selected':''}>Dynos</option>
            <option value="Hangouts / Romhack" ${buscarCategoria==='Hangouts / Romhack'?'selected':''}>Hangouts / Romhack</option>
            <option value="Gamemodes" ${buscarCategoria==='Gamemodes'?'selected':''}>Gamemodes</option>
            <option value="Movesets" ${buscarCategoria==='Movesets'?'selected':''}>Movesets</option>
            <option value="Modifiers" ${buscarCategoria==='Modifiers'?'selected':''}>Modifiers</option>
            <option value="Administrative / Utility" ${buscarCategoria==='Administrative / Utility'?'selected':''}>Administrative / Utility</option>
            <option value="Resources" ${buscarCategoria==='Resources'?'selected':''}>Resources</option>
            <option value="Otros" ${buscarCategoria==='Otros'?'selected':''}>Otros</option>
          </select>
          <button type="submit" class="btn-blue">Filtrar</button>
        </form>
        <div class="grid">${tarjetas}</div>
      </div>
    </body></html>`);
  } catch (e) { console.error(e); pageError(res, 500, 'Error', 'No se pudo cargar la página.', sesion, nNotif); }
});

app.get('/favoritos', async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.name) return res.redirect('/login');
  const nNotif = await countNotif(sesion.name);
  const { data } = await supabase.from('mods').select('*').order('likes', { ascending: false });
  const mods = (data || []).map(mapMod).filter(m => (m.usuariosLike || []).includes(sesion.name));
  let vids = [];
  try {
    const { data: vdata } = await supabase.from('videos').select('*').order('likes', { ascending: false }).limit(200);
    vids = (vdata || []).map(mapVideo).filter(v => v && (v.usuariosLike || []).includes(sesion.name));
  } catch (e) {}
  // combinar: videos primero luego mods en grid
  const comboHtml = renderVideoCards(vids) + (mods.length ? renderModCards(mods, sesion) : (vids.length ? '' : renderModCards([], sesion)));
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="icon" href="/public/icon.png" type="image/png"><title>Favoritos | Coop Free Mods</title>${estilosCSS}</head><body>
    ${navbar(sesion, nNotif)}
    <div class="main-container"><h2>⭐ Mis favoritos</h2>
    <p style="color:#9ca3af;font-size:13px;">Mods y videos a los que les diste like.</p>
    <div class="grid">${comboHtml}</div>
    </div></body></html>`);
});

app.get('/mis-mods', async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.name) return res.redirect('/login');
  const nNotif = await countNotif(sesion.name);
  const { data } = await supabase.from('mods').select('*').eq('autor', sesion.name).order('id', { ascending: false });
  const mods = (data || []).map(mapMod);
  let vids = [];
  try {
    const { data: vdata } = await supabase.from('videos').select('*').eq('autor', sesion.name).order('created_at', { ascending: false }).limit(100);
    vids = (vdata || []).map(mapVideo).filter(Boolean);
  } catch (e) {}
  const pg = paginateList(mods, req.query.page, 30);
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="icon" href="/public/icon.png" type="image/png"><title>Mis mods | Coop Free Mods</title>${estilosCSS}</head><body>
    ${navbar(sesion, nNotif)}
    <div class="main-container">
      <h2>📦 Mis mods</h2>
      <div class="grid">${renderModCards(pg.slice, sesion)}</div>
      ${renderPagination('/mis-mods', pg.page, pg.totalPages)}
      <h2 style="margin-top:28px;">📺 Mis videos <span style="color:#9ca3af;font-size:14px;font-weight:600;">(video)</span></h2>
      <div class="grid">${vids.length ? renderVideoCards(vids) : '<p style="color:#9ca3af;">No publicaste videos en CoopTube todavía.</p>'}</div>
    </div></body></html>`);
});

app.get('/notificaciones', async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.name) return res.redirect('/login');
  const { data } = await supabase.from('notificaciones').select('*').eq('usuario', sesion.name).order('created_at', { ascending: false }).limit(50);
  await supabase.from('notificaciones').update({ leido: true }).eq('usuario', sesion.name).eq('leido', false);
  const items = (data || []).map(n => `<div class="notif-item ${n.leido?'':'unread'}">
    <a href="${escapeHtml(n.link)}" style="color:#ced4da;text-decoration:none;">${escapeHtml(n.mensaje)}</a>
    <div style="font-size:11px;color:#6b7280;margin-top:4px;">${escapeHtml(n.tipo)} · ${new Date(n.created_at).toLocaleString('es-ES')}</div>
  </div>`).join('') || '<p style="color:#9ca3af;">No hay notificaciones.</p>';
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="icon" href="/public/icon.png" type="image/png"><title>Notificaciones | Coop Free Mods</title>${estilosCSS}</head><body>
    ${navbar(sesion, 0)}
    <div class="main-container"><h2>🔔 Notificaciones</h2>${items}</div></body></html>`);
});

app.get('/mod/:id', async (req, res) => {
  try {
    const sesion = await getSesion(req);
    const nNotif = await countNotif(sesion.name);
    const { data, error } = await supabase.from('mods').select('*').eq('id', parseInt(req.params.id)).single();
    if (error || !data) return pageError(res, 404, 'Mod no encontrado', 'Ese mod no existe o fue eliminado.', sesion, nNotif);
    const mod = mapMod(data);
    const fotos = (mod.rutasImagenes || []).map(u => u ? `<div class="mod-gallery-preview"><img src="${escapeHtml(u)}"></div>` : '').join('');
    let updates = (mod.historialActualizaciones || []).map(up =>
      `<div class="changelog-item"><b>${escapeHtml(up.version)}</b> (${escapeHtml(up.fecha)}):<br>${escapeHtml(up.notas)}</div>`
    ).join('') || '<p style="color:#9ca3af;font-size:13px;">Sin actualizaciones.</p>';

    const comments = mod.comentarios || [];
    const roots = comments.filter(c => !c.parentId);
    const repliesOf = id => comments.filter(c => c.parentId === id);
    const canDelComment = (c) => sesion.name && (c.usuario === sesion.name || sesion.esMod);
    let comentariosHTML = roots.map(c => {
      const del = canDelComment(c) ? `<a href="/delete-comment/${mod.id}/${encodeURIComponent(c.id)}" class="btn-delete" onclick="return confirm('¿Borrar comentario?')">Eliminar</a>` : '';
      const replyForm = sesion.name && !sesion.banneado
        ? `<details style="margin-top:8px;">
            <summary class="btn-gray" style="display:inline-block;list-style:none;cursor:pointer;">Responder</summary>
            <form action="/reply/${mod.id}/${encodeURIComponent(c.id)}" method="POST" style="margin-top:8px;">
              <textarea name="ctext" rows="2" placeholder="Escribe tu respuesta..." required minlength="1" style="margin-bottom:6px;font-size:13px;"></textarea>
              <button type="submit" class="btn-gray">Enviar respuesta</button>
            </form>
          </details>` : '';
      const replies = repliesOf(c.id).map(r => {
        const delR = canDelComment(r) ? `<a href="/delete-comment/${mod.id}/${encodeURIComponent(r.id)}" class="btn-delete">Eliminar</a>` : '';
        return `<div class="comment-reply"><a href="/user/${escapeHtml(r.usuario)}" class="author" style="font-size:12px;">@${escapeHtml(r.usuario)}</a> ${delR}
          <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">${cleanText(r.texto)}</p></div>`;
      }).join('');
      return `<div class="comment-box"><a href="/user/${escapeHtml(c.usuario)}" class="author">@${escapeHtml(c.usuario)}</a> ${del}
        <p style="margin:5px 0 0;font-size:14px;color:#ced4da;">${cleanText(c.texto)}</p>${replies}${replyForm}</div>`;
    }).join('') || '<p style="color:#9ca3af;">No hay comentarios.</p>';

    const canEdit = sesion.name === mod.autor;
    const canDelete = canEdit || sesion.esMod;
    const bEdit = canEdit ? `<a href="/edit-mod/${mod.id}" class="btn-blue" style="font-size:13px;padding:6px 12px;">✏️ Editar</a>` : '';
    const bDel = canDelete ? `<a href="/delete-mod/${mod.id}" class="btn-delete" style="padding:8px 12px;" onclick="return confirm('¿Eliminar este mod?')">🗑️ Eliminar mod</a>` : '';
    const cajaCom = (sesion.name && !sesion.banneado)
      ? `<form action="/comment/${mod.id}" method="POST"><textarea name="ctext" placeholder="Escribe un comentario..." rows="2" required minlength="1"></textarea><button type="submit" class="btn-blue">💬 Comentar</button></form>`
      : sesion.banneado ? '<p style="color:#f87171;">Cuenta baneada: no puedes comentar.</p>'
      : '<p><a href="/login" style="color:#ff3333;">Inicia sesión</a> para comentar.</p>';

    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="icon" href="/public/icon.png" type="image/png"><title>${escapeHtml(mod.titulo)} | Coop Free Mods</title>${estilosCSS}</head><body>
      ${navbar(sesion, nNotif)}
      <div class="main-container">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap;gap:15px;">
          <div><h1 style="color:white;">${escapeHtml(mod.titulo)}</h1>
            <p style="margin:0;color:#9ca3af;">Creado por <a href="/user/${escapeHtml(mod.autor)}" class="author">@${escapeHtml(mod.autor)}</a></p></div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
            <a href="/download/${mod.id}" class="btn-red" style="font-size:16px;padding:12px 25px;">⬇️ Descargar</a>
            <a href="/like/${mod.id}" class="${(sesion.name && mod.usuariosLike.includes(sesion.name)) ? 'btn-like active' : 'btn-like'}" style="font-size:16px;padding:10px 16px;background:#1f2937;border-radius:8px;border:1px solid #374151;">⭐ ${(sesion.name && mod.usuariosLike.includes(sesion.name)) ? 'Quitar like' : 'Like'} (${mod.likes})</a>
            ${bEdit}${bDel}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:25px;">
          <div class="info-box"><h2>Descripción</h2><p>${escapeHtml(mod.descripcion)}</p>${fotos}</div>
          <div>
            <div class="info-box"><h2>Detalles</h2>
              <table class="meta-table">
                <tr><td>Versión:</td><td>${escapeHtml(mod.version)}</td></tr>
                <tr><td>Categoría:</td><td>${escapeHtml(mod.categoria)}</td></tr>
                <tr><td>Publicado:</td><td>${escapeHtml(mod.fechaCreacion||'')}</td></tr>
                <tr><td>Peso:</td><td>${escapeHtml(mod.pesoArchivo||'')}</td></tr>
                <tr><td>Descargas:</td><td>${mod.descargas}</td></tr>
                <tr><td>Likes:</td><td>${mod.likes}</td></tr>
              </table>
            </div>
            <div class="info-box"><h2>🔄 Historial</h2>${updates}</div>
          </div>
        </div>
        <div class="info-box" style="margin-top:25px;"><h2>💬 Comentarios</h2>
          <div style="margin-bottom:20px;">${comentariosHTML}</div>${cajaCom}
        </div>
      </div>
    </body></html>`);
  } catch (e) { console.error(e); pageError(res, 500, 'Error', 'No se pudo cargar la página.', sesion, nNotif); }
});

app.get('/delete-mod/:id', async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.name) return res.redirect('/login');
  const { data } = await supabase.from('mods').select('*').eq('id', parseInt(req.params.id)).single();
  if (!data) return res.redirect('/');
  if (data.autor !== sesion.name && !sesion.esMod) return pageError(res, 403, 'Sin permisos', 'No tenés permiso para hacer eso.', sesion, 0);
  if (data.archivo_path) {
    try { await supabase.storage.from('mods-files').remove([data.archivo_path]); } catch(e){}
  }
  await supabase.from('mods').delete().eq('id', data.id);
  res.redirect('/');
});

app.get('/delete-comment/:modId/:commentId', async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.name) return res.redirect('/login');
  const modId = parseInt(req.params.modId);
  const { data } = await supabase.from('mods').select('*').eq('id', modId).single();
  if (!data) return res.redirect('/');
  let comentarios = data.comentarios || [];
  const c = comentarios.find(x => x.id === req.params.commentId);
  if (!c) return res.redirect('/mod/' + modId);
  if (c.usuario !== sesion.name && !sesion.esMod) return pageError(res, 403, 'Sin permisos', 'No tenés permiso para hacer eso.', sesion, 0);
  // borrar comentario y sus respuestas
  comentarios = comentarios.filter(x => x.id !== req.params.commentId && x.parentId !== req.params.commentId);
  await supabase.from('mods').update({ comentarios }).eq('id', modId);
  res.redirect('/mod/' + modId);
});

app.post('/reply/:modId/:parentId', async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.name || sesion.banneado) return res.redirect('/login');
  if (!rateLimit('reply:' + sesion.name + ':' + req.params.modId, 2000)) return res.redirect('/mod/' + req.params.modId);
  const modId = parseInt(req.params.modId);
  const { data } = await supabase.from('mods').select('*').eq('id', modId).single();
  if (!data) return res.redirect('/');
  const comentarios = data.comentarios || [];
  const parent = comentarios.find(c => c.id === req.params.parentId);
  const nuevo = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    usuario: sesion.name, texto: req.body.ctext || '', parentId: req.params.parentId, fecha: new Date().toISOString()
  };
  comentarios.push(nuevo);
  await supabase.from('mods').update({ comentarios }).eq('id', modId);
  if (parent && parent.usuario !== sesion.name) {
    await crearNotif(parent.usuario, 'respuesta', `@${sesion.name} respondió tu comentario en "${data.titulo}"`, `/mod/${modId}`);
  }
  if (data.autor !== sesion.name) {
    await crearNotif(data.autor, 'comentario', `@${sesion.name} comentó en tu mod "${data.titulo}"`, `/mod/${modId}`);
  }
  res.redirect('/mod/' + modId);
});

app.get('/user/:username', async (req, res) => {
  try {
    const sesion = await getSesion(req);
    const nNotif = await countNotif(sesion.name);
    const username = req.params.username;
    let { data: userRow } = await supabase.from('usuarios').select('*').eq('usuario', username).single();
    const user = userRow ? mapUser(userRow) : { usuario: username, descripcion: 'Usuario', fechaRegistro: '—', seguidores: [], banneado: false };
    const { data: modsData } = await supabase.from('mods').select('*').eq('autor', username).order('id', { ascending: false });
    const userMods = (modsData || []).map(mapMod);
    let userVideos = [];
    try {
      const { data: vids } = await supabase.from('videos').select('*').eq('autor', username).order('created_at', { ascending: false }).limit(30);
      userVideos = (vids || []).map(mapVideo).filter(Boolean);
    } catch (e) {}
    let bFollow = '';
    if (sesion.name && sesion.name !== user.usuario) {
      const ya = (user.seguidores || []).includes(sesion.name);
      bFollow = `<a href="/follow/${escapeHtml(user.usuario)}" class="btn-red" style="background:${ya?'#4b5563':'#ff3333'};">${ya?'Unfollow':'Seguir'}</a>`;
    }
    let bMod = '';
    if (sesion.esMod && user.usuario !== MODERADOR) {
      bMod = user.banneado
        ? `<a href="/unban/${escapeHtml(user.usuario)}" class="btn-green">Desbanear</a>`
        : `<a href="/ban/${escapeHtml(user.usuario)}" class="btn-delete" style="padding:8px 12px;" onclick="return confirm('¿Banear cuenta?')">Banear</a>`;
    }
    const banTag = user.banneado ? '<span class="banned-badge">BANEADO</span>' : '';
    const modTag = isMod(user.usuario) ? '<span class="mod-badge">MODERADOR</span>' : '';
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="icon" href="/public/icon.png" type="image/png"><title>@${escapeHtml(user.usuario)} | Coop Free Mods</title>${estilosCSS}</head><body>
      ${navbar(sesion, nNotif)}
      <div class="main-container">
        <div class="profile-header">
          <div>
            <h1 style="margin:0;color:white;">@${escapeHtml(user.usuario)} ${modTag} ${banTag}</h1>
            <p style="color:#ced4da;margin:10px 0;">${escapeHtml(user.descripcion)}</p>
            <p style="color:#9ca3af;font-size:12px;margin:0;">Desde el ${escapeHtml(user.fechaRegistro)} · 👥 ${(user.seguidores||[]).length} seguidores</p>
          </div>
          <div style="display:flex;gap:10px;">${bFollow}${bMod}</div>
        </div>
        <h2>📦 Mods de este usuario</h2>
        <div class="grid">${renderModCards(userMods, sesion)}</div>
        <h2 style="margin-top:28px;">📺 Videos en CoopTube <span style="color:#9ca3af;font-size:14px;font-weight:600;">(video)</span></h2>
        <div class="grid">${userVideos.length ? renderVideoCards(userVideos) : '<p style="color:#9ca3af;">Este usuario aún no publicó videos.</p>'}</div>
      </div>
    </body></html>`);
  } catch (e) { console.error(e); pageError(res, 500, 'Error', 'No se pudo cargar la página.', sesion, nNotif); }
});

app.get('/ban/:username', async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.esMod) return pageError(res, 403, 'Solo moderadores', 'Esta acción es solo para moderadores.', sesion, 0);
  if (req.params.username === MODERADOR) return pageError(res, 403, 'No permitido', 'No se puede realizar esta acción.', sesion, 0);
  await supabase.from('usuarios').update({ banneado: true }).eq('usuario', req.params.username);
  res.redirect('/user/' + req.params.username);
});
app.get('/unban/:username', async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.esMod) return pageError(res, 403, 'Solo moderadores', 'Esta acción es solo para moderadores.', sesion, 0);
  await supabase.from('usuarios').update({ banneado: false }).eq('usuario', req.params.username);
  res.redirect('/user/' + req.params.username);
});

app.get('/follow/:username', async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.name) return res.redirect('/login');
  const targetName = req.params.username;
  if (targetName === sesion.name) return res.redirect('/user/' + targetName);
  let { data: target } = await supabase.from('usuarios').select('*').eq('usuario', targetName).single();
  if (!target) {
    await supabase.from('usuarios').insert({
      usuario: targetName, password: '!', descripcion: 'Creador',
      fecha_registro: new Date().toLocaleDateString('es-ES'), seguidores: [sesion.name]
    });
    await crearNotif(targetName, 'seguidor', `@${sesion.name} empezó a seguirte`, `/user/${sesion.name}`);
  } else {
    let seg = target.seguidores || [];
    const idx = seg.indexOf(sesion.name);
    if (idx === -1) {
      seg.push(sesion.name);
      await crearNotif(targetName, 'seguidor', `@${sesion.name} empezó a seguirte`, `/user/${sesion.name}`);
    } else {
      seg.splice(idx, 1);
    }
    await supabase.from('usuarios').update({ seguidores: seg }).eq('usuario', targetName);
  }
  res.redirect('/user/' + targetName);
});

app.get('/publish', async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.name) return res.redirect('/login');
  if (sesion.banneado) return pageError(res, 403, 'Cuenta baneada', 'Tu cuenta está baneada.', sesion, 0);
  const nNotif = await countNotif(sesion.name);
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="icon" href="/public/icon.png" type="image/png"><title>Publicar | Coop Free Mods</title>${estilosCSS}</head><body>
    ${navbar(sesion, nNotif)}
    <div class="form-box"><h2>🚀 Publicar Mod</h2>
      <form action="/publish" method="POST" enctype="multipart/form-data">
        <label>Nombre:</label><input type="text" name="titulo" required>
        <label>Versión:</label><select name="version"><option value="SM64 Co-op DX">SM64 Co-op DX</option><option value="SM64 EX Co-op">SM64 EX Co-op</option><option value="DX + EX">DX + EX</option></select>
        <label>Categoría:</label><select name="categoria">
          <option value="Character Select">Character Select</option>
          <option value="Dynos">Dynos</option>
          <option value="Hangouts / Romhack">Hangouts / Romhack</option>
          <option value="Gamemodes">Gamemodes</option>
          <option value="Movesets">Movesets</option>
          <option value="Modifiers">Modifiers</option>
          <option value="Administrative / Utility">Administrative / Utility</option>
          <option value="Resources">Resources</option>
          <option value="Otros">Otros</option>
        </select>
        <label>Descripción:</label><textarea name="descripcion" required></textarea>
        <label>Archivo (.zip / .lua, máx 10 MB) — opcional si ponés link:</label>
        <input type="file" name="archivoMod">
        <label>Link de descarga externo (opcional):</label>
        <input type="url" name="linkExterno" placeholder="https://drive.google.com/... o mediafire / mega">
        <p style="color:#9ca3af;font-size:12px;margin:-8px 0 12px;">Link opcional solo de Google Drive, MediaFire o MEGA. Hace falta archivo o link. Capturas: PNG, JPG, WebP o GIF.</p>
        <label>Capturas (hasta 4, PNG/JPG/WebP/GIF):</label>
        <input type="file" name="imagenesMod" accept=".png,.jpg,.jpeg,.webp,.gif,image/png,image/jpeg,image/webp,image/gif" multiple>
        <button type="submit" class="btn-red" style="width:100%;">Publicar</button>
      </form>
    </div></body></html>`);
});

app.post('/publish', upload.fields([{ name: 'archivoMod', maxCount: 1 }, { name: 'imagenesMod', maxCount: 4 }]), async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.name || sesion.banneado) return res.redirect('/login');
  if (!rateLimit('publish:' + sesion.name, 3000)) return pageError(res, 429, 'Demasiado rápido', 'Esperá un momento antes de publicar de nuevo.', sesion, 0);
  try {
    const arc = req.files && req.files['archivoMod'] && req.files['archivoMod'][0];
    const imgs = (req.files && req.files['imagenesMod']) || [];
    const linkExterno = (req.body.linkExterno || '').trim();
    if (!arc && !linkExterno) {
      return pageError(res, 400, 'Falta archivo o link', 'Subí un archivo o un link de Drive / MediaFire / MEGA.', sesion, 0);
    }
    if (linkExterno && !isAllowedModLink(linkExterno)) {
      return pageError(res, 400, 'Link no permitido', 'Solo se aceptan links de Google Drive, MediaFire o MEGA.', sesion, 0);
    }
    const ts = Date.now();
    let filePath = '';
    let nombreReal = '';
    let peso = 'Link externo';
    // Preferimos archivo si hay; si no, el link
    if (arc) {
      filePath = `${sesion.name}/${ts}-${arc.originalname}`;
      await uploadToStorage('mods-files', filePath, arc.buffer, arc.mimetype || 'application/octet-stream');
      nombreReal = arc.originalname;
      peso = (arc.size / (1024 * 1024)).toFixed(1) + ' MB';
    } else {
      filePath = linkExterno;
      nombreReal = 'link-externo';
    }
    const rutas = [];
    const maxImgs = Math.min(imgs.length, 4);
    for (let i = 0; i < maxImgs; i++) {
      const img = imgs[i];
      const p = `${sesion.name}/${ts}-img${i}-${img.originalname}`;
      rutas.push(await uploadToStorage('mods-images', p, img.buffer, img.mimetype));
    }
    const { error } = await supabase.from('mods').insert({
      titulo: req.body.titulo, descripcion: req.body.descripcion, autor: sesion.name,
      version: req.body.version, categoria: req.body.categoria,
      nombre_archivo_real: nombreReal, archivo_path: filePath, rutas_imagenes: rutas,
      descargas: 0, likes: 0, usuarios_like: [], comentarios: [], historial_actualizaciones: [],
      fecha_creacion: new Date().toLocaleDateString('es-ES'),
      peso_archivo: peso
    });
    if (error) throw error;
    res.redirect('/mods');
  } catch (e) {
    console.error(e);
    pageError(res, 500, 'Error al publicar', escapeHtml(e.message || 'Error desconocido'), sesion, 0);
  }
});

app.get('/edit-mod/:id', async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.name) return res.redirect('/login');
  const { data } = await supabase.from('mods').select('*').eq('id', parseInt(req.params.id)).single();
  const mod = mapMod(data);
  if (!mod || mod.autor !== sesion.name) return pageError(res, 403, 'Sin permisos', 'No tenés permiso para hacer eso.', sesion, 0);
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="icon" href="/public/icon.png" type="image/png"><title>Editar | Coop Free Mods</title>${estilosCSS}</head><body>
    <div class="form-box"><h2>✏️ Editar mod</h2>
      <form action="/edit-mod/${mod.id}" method="POST" enctype="multipart/form-data">
        <label>Título:</label><input type="text" name="titulo" value="${escapeHtml(mod.titulo)}" required>
        <label>Descripción:</label><textarea name="descripcion" required>${escapeHtml(mod.descripcion)}</textarea>
        <label>Nuevo archivo (opcional):</label><input type="file" name="archivoMod">
        <label>Notas update:</label><input type="text" name="notasUpdate">
        <button type="submit" class="btn-blue" style="width:100%;">Guardar</button>
      </form>
    </div></body></html>`);
});

app.post('/edit-mod/:id', upload.fields([{ name: 'archivoMod', maxCount: 1 }]), async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.name) return res.redirect('/login');
  const { data } = await supabase.from('mods').select('*').eq('id', parseInt(req.params.id)).single();
  const mod = mapMod(data);
  if (!mod || mod.autor !== sesion.name) return pageError(res, 403, 'Sin permisos', 'No tenés permiso para hacer eso.', sesion, 0);
  const update = { titulo: req.body.titulo, descripcion: req.body.descripcion };
  if (req.files['archivoMod'] && req.files['archivoMod'][0]) {
    const file = req.files['archivoMod'][0];
    const filePath = `${sesion.name}/${Date.now()}-${file.originalname}`;
    await uploadToStorage('mods-files', filePath, file.buffer, file.mimetype || 'application/octet-stream');
    update.nombre_archivo_real = file.originalname;
    update.archivo_path = filePath;
    update.peso_archivo = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
    const hist = mod.historialActualizaciones || [];
    hist.push({ version: 'Update ' + (hist.length + 1), fecha: new Date().toLocaleDateString('es-ES'), notas: req.body.notasUpdate || 'Update' });
    update.historial_actualizaciones = hist;
  }
  await supabase.from('mods').update(update).eq('id', mod.id);
  res.redirect('/mod/' + mod.id);
});

app.get('/download/:id', async (req, res) => {
  try {
    const { data } = await supabase.from('mods').select('*').eq('id', parseInt(req.params.id)).single();
    const mod = mapMod(data);
    if (!mod || !mod.archivoPath) return pageError(res, 404, 'No encontrado', 'Ese recurso no existe.', await getSesion(req), 0);
    await supabase.from('mods').update({ descargas: (mod.descargas || 0) + 1 }).eq('id', mod.id);

    // Link externo
    if (/^https?:\/\//i.test(mod.archivoPath)) {
      return res.redirect(mod.archivoPath);
    }

    const ext = path.extname(mod.archivoPath) || path.extname(data.nombre_archivo_real || '') || '.zip';
    let base = (mod.titulo || data.nombre_archivo_real || 'mod')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100) || 'mod';
    if (/^\d+$/.test(base)) base = 'mod-' + base;
    const filename = base + (ext.startsWith('.') ? ext : '.' + ext);

    const { data: fileData, error } = await supabase.storage.from('mods-files').download(mod.archivoPath);
    if (error || !fileData) {
      const { data: urlData } = supabase.storage.from('mods-files').getPublicUrl(mod.archivoPath);
      return res.redirect(urlData.publicUrl);
    }
    const buf = Buffer.from(await fileData.arrayBuffer());
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader('Content-Length', buf.length);
    res.send(buf);
  } catch (e) {
    console.error(e);
    pageError(res, 500, 'Error al descargar', 'No se pudo descargar el archivo.', null, 0);
  }
});

app.get('/like/:id', async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.name) return res.redirect('/login');
  const { data } = await supabase.from('mods').select('*').eq('id', parseInt(req.params.id)).single();
  if (!data) return res.redirect('/');
  let likes = data.likes || 0;
  let usuariosLike = data.usuarios_like || [];
  const idx = usuariosLike.indexOf(sesion.name);
  if (idx === -1) {
    likes++; usuariosLike.push(sesion.name);
    if (data.autor !== sesion.name) {
      await crearNotif(data.autor, 'like', `@${sesion.name} dio like a "${data.titulo}"`, `/mod/${data.id}`);
    }
  } else {
    likes--; usuariosLike.splice(idx, 1);
  }
  await supabase.from('mods').update({ likes, usuarios_like: usuariosLike }).eq('id', data.id);
  res.redirect(req.headers.referer || '/');
});

app.post('/comment/:id', async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.name || sesion.banneado) return res.redirect('/login');
  if (!rateLimit('comment:' + sesion.name + ':' + req.params.id, 2000)) return res.redirect('/mod/' + req.params.id);
  const { data } = await supabase.from('mods').select('*').eq('id', parseInt(req.params.id)).single();
  if (data) {
    const comentarios = data.comentarios || [];
    comentarios.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      usuario: sesion.name, texto: req.body.ctext, parentId: null, fecha: new Date().toISOString()
    });
    await supabase.from('mods').update({ comentarios }).eq('id', data.id);
    if (data.autor !== sesion.name) {
      await crearNotif(data.autor, 'comentario', `@${sesion.name} comentó en "${data.titulo}"`, `/mod/${data.id}`);
    }
  }
  res.redirect('/mod/' + req.params.id);
});

app.get('/register', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="icon" href="/public/icon.png" type="image/png">${estilosCSS}</head><body>
    <div class="form-box"><h2>Crear cuenta</h2>
      <form action="/register" method="POST">
        <label>Usuario:</label><input type="text" name="usuario" required pattern="[a-zA-Z0-9_\\-]{3,20}" title="3-20 caracteres">
        <label>Descripción:</label><input type="text" name="descripcion" required>
        <label>Contraseña (mín. 6 caracteres):</label><input type="password" name="password" required minlength="6">
        <button type="submit" class="btn-red" style="width:100%;">Registrarme</button>
      </form>
      <p style="text-align:center;margin-top:15px;"><a href="/login" style="color:#93c5fd;">¿Ya tienes cuenta?</a></p>
    </div></body></html>`);
});

app.post('/register', async (req, res) => {
  try {
    const usuario = (req.body.usuario || '').trim();
    const password = req.body.password || '';
    if (password.length < 6) return pageError(res, 400, 'Contraseña corta', 'La contraseña debe tener al menos 6 caracteres.', null, 0);
    if (!usuario || usuario.length < 3) return pageError(res, 400, 'Usuario inválido', 'Elegí un nombre de usuario válido.', null, 0);
    const { data: existing } = await supabase.from('usuarios').select('id').eq('usuario', usuario).single();
    if (existing) return pageError(res, 400, 'Usuario existente', 'Ese nombre ya está registrado.', null, 0);
    const hash = await bcrypt.hash(password, 10);
    const { error } = await supabase.from('usuarios').insert({
      usuario, password: hash, descripcion: req.body.descripcion || 'Desarrollador',
      fecha_registro: new Date().toLocaleDateString('es-ES'), seguidores: [], banneado: false
    });
    if (error) throw error;
    res.cookie('usuarioSesion', usuario, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.redirect('/');
  } catch (e) { console.error(e); res.send('Error al registrar. <a href="/register">Volver</a>'); }
});

app.get('/login', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="icon" href="/public/icon.png" type="image/png">${estilosCSS}</head><body>
    <div class="form-box"><h2>Iniciar sesión</h2>
      <form action="/login" method="POST">
        <label>Usuario:</label><input type="text" name="usuario" required>
        <label>Contraseña:</label><input type="password" name="password" required>
        <button type="submit" class="btn-red" style="width:100%;">Ingresar</button>
      </form>
      <p style="text-align:center;margin-top:15px;"><a href="/register" style="color:#93c5fd;">Crear cuenta</a></p>
    </div></body></html>`);
});

app.post('/login', async (req, res) => {
  try {
    const { data: u } = await supabase.from('usuarios').select('*').eq('usuario', req.body.usuario).single();
    if (!u) return pageError(res, 401, 'Datos incorrectos', 'Usuario o contraseña incorrectos.', null, 0);
    if (u.banneado) return pageError(res, 403, 'Cuenta baneada', 'Tu cuenta está baneada.', null, 0);
    let ok = false;
    if (u.password && u.password.startsWith('$2')) ok = await bcrypt.compare(req.body.password, u.password);
    else {
      ok = u.password === req.body.password;
      if (ok) {
        const hash = await bcrypt.hash(req.body.password, 10);
        await supabase.from('usuarios').update({ password: hash }).eq('id', u.id);
      }
    }
    if (ok) {
      res.cookie('usuarioSesion', u.usuario, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
      res.redirect('/');
    } else res.send('Usuario o contraseña incorrectos. <a href="/login">Volver</a>');
  } catch (e) { res.send('Error. <a href="/login">Volver</a>'); }
});


app.get('/info-disabled', async (req, res) => {
  const sesion = await getSesion(req);
  const nNotif = await countNotif(sesion.name);
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="icon" href="/public/icon.png" type="image/png"><title>Información | Coop Free Mods</title>${estilosCSS}</head><body>
    ${navbar(sesion, nNotif)}
    <div class="main-container" style="max-width:800px;">
      <h1 style="color:white;margin-bottom:8px;">ℹ️ Sobre Coop Free Mods</h1>
      <p style="color:#9ca3af;margin-bottom:28px;">Mods gratis para SM64 Co-op DX, SM64 EX Co-op y DX + EX.</p>

      <div class="info-box">
        <h2>¿Qué es esto?</h2>
        <p>Coop Free Mods es una biblioteca comunitaria donde podés <b>buscar, descargar y publicar</b> mods para Super Mario 64 Co-op (DX y EX). Registro gratis, likes, comentarios, favoritos y perfiles de creadores.</p>
      </div>

      <div class="info-box">
        <h2>Origen del proyecto</h2>
        <p>El proyecto fue <b>iniciado por @Ellos (them)</b>. Más adelante se discontinuó el hosting original (túnel Cloudflare) y se dejó continuar a la comunidad.</p>
        <p>Esta versión mantiene la idea original y suma persistencia en la nube (Vercel + Supabase), notificaciones, moderación, paginación y más herramientas para la comunidad.</p>
      </div>

      <div class="info-box">
        <h2>Versiones soportadas</h2>
        <p>• <b>SM64 Co-op DX</b><br>
        • <b>SM64 EX Co-op</b><br>
        • <b>DX + EX</b> (compatible con ambas)</p>
      </div>

      <div class="info-box">
        <h2>Categorías</h2>
        <p>Character Select · Dynos · Hangouts / Romhack · Gamemodes · Movesets · Modifiers · Administrative / Utility · Resources · Otros</p>
      </div>

      <div class="info-box">
        <h2>Cómo publicar</h2>
        <p>1. Registrate o iniciá sesión<br>
        2. Tocá <b>+ Publicar mod</b><br>
        3. Completá nombre, versión, categoría y descripción<br>
        4. Subí el archivo (.zip / .lua, máx. 10 MB) y capturas opcionales<br>
        5. Publicá — el mod queda guardado de forma permanente</p>
      </div>

      <div class="info-box">
        <h2>Reglas básicas</h2>
        <p>• No subas contenido malicioso ni spam<br>
        • Respetá a otros usuarios en comentarios<br>
        • Los mods deben ser relevantes para SM64 Co-op<br>
        • Un moderador puede eliminar contenido o banear cuentas que rompan las reglas</p>
      </div>

      <div class="info-box">
        <h2>Créditos</h2>
        <p>💡 Idea y versión original: <a href="/user/Ellos" class="author">@Ellos (them)</a><br>
        🛠️ Continuación y mejoras: comunidad · SuperAaron64 y colaboradores<br>
        ☁️ Hosting actual: Vercel + Supabase</p>
      </div>

      <p style="text-align:center;margin:30px 0;">
        <a href="https://notan127.github.io/SM64-PC-Port-WebGL/classic/" target="_blank" rel="noopener" class="btn-blue">Abrir en pestaña nueva</a>
        <a href="/" class="btn-red" style="margin-left:8px;">Volver al inicio</a>
        <a href="/register" class="btn-blue" style="margin-left:10px;">Crear cuenta</a>
      </p>
    </div>
  </body></html>`);
});



app.get('/como-instalar', async (req, res) => {
  const sesion = await getSesion(req);
  const nNotif = await countNotif(sesion.name);
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="icon" href="/public/icon.png" type="image/png"><title>Cómo instalar | Coop Free Mods</title>${estilosCSS}</head><body>
    ${navbar(sesion, nNotif)}
    <div class="main-container" style="max-width:800px;">
      <h1 style="color:white;margin-bottom:8px;">📖 Cómo instalar mods</h1>
      <p style="color:#9ca3af;margin-bottom:28px;">Guía rápida para usar los mods de SM64 Co-op DX y SM64 EX Co-op.</p>

      <div class="info-box">
        <h2>1. Tenér el juego base</h2>
        <p>Necesitás <b>SM64 Co-op DX</b> o <b>SM64 EX Co-op</b> ya instalado y funcionando en tu PC o Android.</p>
        <p>Si aún no lo tenés, buscá la versión oficial de la comunidad (Discord / GitHub del proyecto co-op).</p>
      </div>

      <div class="info-box">
        <h2>2. Descargá el mod desde esta web</h2>
        <p>1. Entrá a un mod desde el inicio o el Top 10<br>
        2. Tocá el botón rojo <b>⬇️ Descargar</b><br>
        3. Guardá el archivo <b>.zip</b> (o .lua) en una carpeta que recuerdes</p>
      </div>

      <div class="info-box">
        <h2>3. Instalación típica (archivo .zip)</h2>
        <p>1. Descomprimí el .zip (clic derecho → Extraer)<br>
        2. Abrí la carpeta del juego Co-op (donde está el ejecutable o en Android Ex Coop: com.owokitty.sm64excoop, Coop Dx: com.maniscat2.sm64coopdx)<br>
        3. Buscá la carpeta de mods (suele llamarse <b>mods</b>, <b>dynos</b> o similar según el tipo)<br>
        4. Copiá ahí la carpeta o los archivos del mod<br>
        5. Reiniciá el juego si ya estaba abierto</p>
        <p style="color:#9ca3af;font-size:13px;margin-top:12px;">Cada mod puede traer un README con pasos exactos. Leelo si viene incluido.</p>
      </div>

      <div class="info-box">
        <h2>4. Problemas frecuentes</h2>
        <p>• <b>No aparece el mod</b> — revisá que esté en la carpeta correcta y reiniciá el juego<br>
        • <b>El juego crashea</b> — probá sin otros mods, o mirá si es solo DX / solo EX / DX+EX<br>
        • <b>Archivo dañado</b> — volvé a descargarlo desde la web<br>
        • <b>Duda con un mod concreto</b> — comentá en la página del mod o preguntá en Discord</p>
      </div>

      <div class="info-box">
        <h2>Consejo</h2>
        <p>En la ficha de cada mod mirá <b>Versión</b> (DX, EX o DX + EX) y <b>Categoría</b> para saber si es compatible con tu juego y dónde va el archivo.</p>
      </div>

      <p style="text-align:center;margin:30px 0;display:flex;flex-wrap:wrap;gap:10px;justify-content:center;">
        <a href="/mods" class="btn-red">Ver mods</a>
        <a href="/top" class="btn-blue">Top 10</a>
        <a href="/discord" class="discord-float" style="margin:0;">Discord</a>
      </p>
    </div>
  </body></html>`);
});



const DISCORD_INVITE = 'https://discord.gg/RAbR6xBpcR';

app.get('/discord', async (req, res) => {
  const sesion = await getSesion(req);
  const nNotif = await countNotif(sesion.name);
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/public/icon.png" type="image/png"><title>Discord | Coop Free Mods</title>${estilosCSS}</head><body>
    ${navbar(sesion, nNotif)}
    <div class="main-container" style="max-width:480px;">
      <div class="form-box" style="margin-top:30px;">
        <h2 style="text-align:center;color:white;">Discord de Coop Free Mods</h2>
        <p style="text-align:center;color:#9ca3af;font-size:14px;">Marcá la casilla para continuar (ayuda a filtrar bots básicos).</p>
        <form action="/discord" method="POST" style="text-align:center;position:relative;">
          <label style="display:flex;align-items:center;gap:10px;justify-content:center;margin:16px 0;color:#ced4da;cursor:pointer;">
            <input type="checkbox" name="human" value="1" required style="width:auto;margin:0;">
            Confirmo que no soy un bot
          </label>
          <input type="text" name="website" value="" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;opacity:0;height:0;width:0;" aria-hidden="true">
          <button type="submit" class="btn-blue" style="background:#5865F2;width:100%;padding:12px;">Entrar al Discord</button>
        </form>
        <p style="text-align:center;margin-top:16px;"><a href="/" style="color:#93c5fd;">← Volver al inicio</a></p>
      </div>
    </div>
  </body></html>`);
});

app.post('/discord', async (req, res) => {
  if (req.body.website) return pageError(res, 400, 'Bot detectado', 'La verificación falló.', null, 0);
  if (req.body.human !== '1') return pageError(res, 400, 'Verificación', 'Marcá la casilla para continuar al Discord.', null, 0);
  res.redirect(DISCORD_INVITE);
});



app.get('/logout', (req, res) => { res.clearCookie('usuarioSesion'); res.redirect('/'); });


// ---------- FOROS ----------
const FORO_CATEGORIAS = ['General','Mods y ayuda','Character Select','Dynos','Hangouts / Romhack','Gamemodes','Sugerencias','Off-topic'];

app.get('/foros', async (req, res) => {
  try {
    const sesion = await getSesion(req);
    const nNotif = await countNotif(sesion.name);
    const cat = req.query.categoria || 'Todas';
    const buscarForo = String(req.query.buscar || '').trim().toLowerCase();
    let q = supabase.from('foro_temas').select('*').order('fijado', { ascending: false }).order('updated_at', { ascending: false }).limit(200);
    if (cat !== 'Todas') q = q.eq('categoria', cat);
    const { data, error } = await q;
    if (error) throw error;
    let temas = data || [];
    if (buscarForo) {
      temas = temas.filter(tm => {
        if (/^\d+$/.test(buscarForo) && String(tm.id) === buscarForo) return true;
        return (tm.titulo || '').toLowerCase().includes(buscarForo) || (tm.autor || '').toLowerCase().includes(buscarForo);
      });
      if (/^\d+$/.test(buscarForo) && temas.length === 1) {
        return res.redirect('/foros/tema/' + temas[0].id);
      }
    }
    // count replies
    const ids = temas.map(x => x.id);
    let counts = {};
    if (ids.length) {
      const { data: reps } = await supabase.from('foro_respuestas').select('tema_id').in('tema_id', ids);
      (reps || []).forEach(r => { counts[r.tema_id] = (counts[r.tema_id] || 0) + 1; });
    }
    const catOpts = ['Todas', ...FORO_CATEGORIAS].map(c =>
      `<option value="${escapeHtml(c)}" ${cat===c?'selected':''}>${escapeHtml(c)}</option>`
    ).join('');
    const rows = temas.map(tm => {
      const n = counts[tm.id] || 0;
      const pin = tm.fijado ? '📌 ' : '';
      const closed = tm.cerrado ? '🔒 ' : '';
      const fecha = tm.updated_at ? new Date(tm.updated_at).toLocaleDateString('es-ES') : '';
      return `<a href="/foros/tema/${tm.id}" style="display:block;text-decoration:none;color:inherit;">
        <div class="comment-box" style="display:flex;justify-content:space-between;align-items:center;gap:12px;transition:transform 0.15s;">
          <div style="flex:1;min-width:0;">
            <div style="font-weight:bold;color:white;margin-bottom:4px;">${pin}${closed}${escapeHtml(tm.titulo)}</div>
            <div style="font-size:12px;color:#9ca3af;">
              <span class="tag-category">${escapeHtml(tm.categoria)}</span>
              · por <span class="author">@${escapeHtml(tm.autor)}</span>
              · ${fecha}
            </div>
          </div>
          <div style="text-align:right;font-size:12px;color:#9ca3af;white-space:nowrap;">
            💬 ${n}<br>👁 ${tm.vistas || 0}
          </div>
        </div>
      </a>`;
    }).join('') || '<p style="color:#9ca3af;text-align:center;padding:40px;">No hay temas todavía. ¡Sé el primero!</p>';
    const newBtn = sesion.name && !sesion.banneado
      ? `<a href="/foros/nuevo" class="btn-red">+ Nuevo tema</a>`
      : `<a href="/login" class="btn-red">Entrar para publicar</a>`;
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="icon" href="/public/icon.png" type="image/png"><title>Foros | Coop Free Mods</title>${estilosCSS}</head><body>
      ${navbar(sesion, nNotif)}
      <div class="main-container">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
          <h2 style="margin:0;">💬 Foros de la comunidad</h2>
          ${newBtn}
        </div>
        <form method="GET" action="/foros" class="filter-bar" style="margin-bottom:20px;">
          <input type="text" name="buscar" placeholder="Buscar tema o ID..." value="${escapeHtml(req.query.buscar || "")}">
          <select name="categoria">${catOpts}</select>
          <button type="submit" class="btn-blue">Filtrar</button>
        </form>
        ${rows}
      </div>
    </body></html>`);
  } catch (e) {
    console.error(e);
    pageError(res, 500, 'Error en foros', 'No se pudieron cargar los foros. ¿Ejecutaste el SQL de foros en Supabase?', sesion, nNotif);
  }
});

app.get('/foros/nuevo', async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.name) return res.redirect('/login');
  if (sesion.banneado) return pageError(res, 403, 'Cuenta baneada', 'Tu cuenta está baneada.', sesion, 0);
  const nNotif = await countNotif(sesion.name);
  const opts = FORO_CATEGORIAS.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="icon" href="/public/icon.png" type="image/png"><title>Nuevo tema | Coop Free Mods</title>${estilosCSS}</head><body>
    ${navbar(sesion, nNotif)}
    <div class="form-box"><h2>✏️ Nuevo tema</h2>
      <form action="/foros/nuevo" method="POST">
        <label>Título:</label><input type="text" name="titulo" required maxlength="120" minlength="3">
        <label>Categoría:</label><select name="categoria">${opts}</select>
        <label>Mensaje:</label><textarea name="contenido" rows="6" required minlength="3"></textarea>
        <button type="submit" class="btn-red" style="width:100%;">Publicar tema</button>
      </form>
      <p style="text-align:center;margin-top:12px;"><a href="/foros" style="color:#93c5fd;">← Volver a foros</a></p>
    </div>
  </body></html>`);
});

app.post('/foros/nuevo', async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.name || sesion.banneado) return res.redirect('/login');
  if (!rateLimit('foro-nuevo:' + sesion.name, 5000)) return pageError(res, 429, 'Demasiado rápido', 'Esperá un momento e intentá de nuevo.', sesion, 0);
  const titulo = (req.body.titulo || '').trim();
  const contenido = (req.body.contenido || '').trim();
  const categoria = FORO_CATEGORIAS.includes(req.body.categoria) ? req.body.categoria : 'General';
  if (titulo.length < 3 || contenido.length < 3) return pageError(res, 400, 'Datos incompletos', 'Título y mensaje deben tener al menos 3 caracteres.', sesion, 0);
  const { data, error } = await supabase.from('foro_temas').insert({
    titulo, contenido, autor: sesion.name, categoria, vistas: 0
  }).select('id').single();
  if (error) { console.error(error); return pageError(res, 500, 'Error', 'No se pudo crear el tema.', sesion, 0); }
  res.redirect('/foros/tema/' + data.id);
});

app.get('/foros/tema/:id', async (req, res) => {
  try {
    const sesion = await getSesion(req);
    const nNotif = await countNotif(sesion.name);
    const id = parseInt(req.params.id);
    const { data: tema, error } = await supabase.from('foro_temas').select('*').eq('id', id).single();
    if (error || !tema) return pageError(res, 404, 'Tema no encontrado', 'Ese tema no existe o fue eliminado.', sesion, nNotif);
    // Contar visita 1 vez por día (cookie lista de ids)
    let vistos = [];
    try {
      vistos = JSON.parse(req.cookies.foro_vistos || '[]');
      if (!Array.isArray(vistos)) vistos = [];
    } catch (e) { vistos = []; }
    if (!vistos.includes(id)) {
      const nuevas = (tema.vistas || 0) + 1;
      await supabase.from('foro_temas').update({ vistas: nuevas }).eq('id', id);
      tema.vistas = nuevas;
      vistos.push(id);
      if (vistos.length > 80) vistos = vistos.slice(-80);
      res.cookie('foro_vistos', JSON.stringify(vistos), {
        maxAge: 1000 * 60 * 60 * 24,
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: !!process.env.VERCEL
      });
    }
    const { data: respuestas } = await supabase.from('foro_respuestas').select('*').eq('tema_id', id).order('created_at', { ascending: true });
    const canMod = sesion.esMod;
    const canDelTema = sesion.name === tema.autor || canMod;
    let modBtns = '';
    if (canMod) {
      modBtns += `<a href="/foros/pin/${id}" class="btn-gray">${tema.fijado ? 'Desfijar' : 'Fijar'}</a> `;
      modBtns += `<a href="/foros/cerrar/${id}" class="btn-gray">${tema.cerrado ? 'Abrir' : 'Cerrar'}</a> `;
    }
    if (canDelTema) modBtns += `<a href="/foros/borrar-tema/${id}" class="btn-delete" onclick="return confirm('¿Borrar tema y respuestas?')">Eliminar tema</a>`;
    const fecha = tema.created_at ? new Date(tema.created_at).toLocaleString('es-ES') : '';
    const allR = respuestas || [];
    const roots = allR.filter(r => !r.parent_id);
    const childrenOf = (pid) => allR.filter(r => r.parent_id === pid);
    const renderResp = (r, isChild) => {
      const canDel = sesion.name === r.autor || canMod;
      const del = canDel ? `<a href="/foros/borrar-resp/${r.id}?tema=${id}" class="btn-delete" style="float:right;">Eliminar</a>` : '';
      const rf = r.created_at ? new Date(r.created_at).toLocaleString('es-ES') : '';
      const subReply = (sesion.name && !sesion.banneado && !tema.cerrado)
        ? `<details style="margin-top:8px;">
            <summary class="btn-gray" style="display:inline-block;cursor:pointer;list-style:none;font-size:12px;">Responder</summary>
            <form action="/foros/responder/${id}" method="POST" style="margin-top:8px;">
              <input type="hidden" name="parent_id" value="${r.id}">
              <textarea name="contenido" rows="2" required minlength="1" placeholder="Escribe una respuesta..." style="font-size:13px;margin-bottom:6px;"></textarea>
              <button type="submit" class="btn-gray">Enviar</button>
            </form>
          </details>` : '';
      const kids = childrenOf(r.id).map(c => renderResp(c, true)).join('');
      const boxClass = isChild ? 'comment-reply' : 'comment-box';
      const font = isChild ? 'font-size:12px;color:#9ca3af;' : 'color:#ced4da;';
      return `<div class="${boxClass}">
        ${del}
        <a href="/user/${escapeHtml(r.autor)}" class="author" style="${isChild ? 'font-size:12px;' : ''}">@${escapeHtml(r.autor)}</a>
        <span style="font-size:11px;color:#6b7280;margin-left:8px;">${rf}</span>
        <p style="margin:8px 0 0;${font}">${cleanText(r.contenido)}</p>
        ${subReply}
        ${kids}
      </div>`;
    };
    const repsHtml = roots.map(r => renderResp(r, false)).join('') || '<p style="color:#9ca3af;">No hay respuestas aún.</p>';
    let replyBox = '';
    if (tema.cerrado) replyBox = '<p style="color:#f87171;">Este tema está cerrado.</p>';
    else if (sesion.name && !sesion.banneado) {
      replyBox = `<form action="/foros/responder/${id}" method="POST">
        <textarea name="contenido" rows="3" required minlength="1" placeholder="Escribe una respuesta..."></textarea>
        <button type="submit" class="btn-blue">Responder</button>
      </form>`;
    } else replyBox = '<p><a href="/login" style="color:#ff3333;">Inicia sesión</a> para responder.</p>';
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="icon" href="/public/icon.png" type="image/png"><title>${escapeHtml(tema.titulo)} | Coop Free Mods</title>${estilosCSS}</head><body>
      ${navbar(sesion, nNotif)}
      <div class="main-container">
        <p><a href="/foros" style="color:#93c5fd;">← Foros</a></p>
        <div class="info-box">
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;">
            <div>
              <span class="tag-category">${escapeHtml(tema.categoria)}</span>
              ${tema.fijado ? '<span class="top-badge">Fijado</span>' : ''}
              ${tema.cerrado ? '<span class="banned-badge">Cerrado</span>' : ''}
              <h1 style="color:white;margin:10px 0;">${escapeHtml(tema.titulo)}</h1>
              <p style="color:#9ca3af;font-size:13px;margin:0;">por <a href="/user/${escapeHtml(tema.autor)}" class="author">@${escapeHtml(tema.autor)}</a> · ${fecha} · 👁 ${tema.vistas || 0}</p>
            </div>
            <div>${modBtns}</div>
          </div>
          <p style="margin-top:16px;color:#ced4da;">${escapeHtml(tema.contenido)}</p>
        </div>
        <div class="info-box"><h2>Respuestas (${(respuestas||[]).length})</h2>${repsHtml}</div>
        <div class="info-box"><h2>Responder</h2>${replyBox}</div>
      </div>
    </body></html>`);
  } catch (e) { console.error(e); pageError(res, 500, 'Error', 'No se pudo cargar la página.', sesion, nNotif); }
});

app.post('/foros/responder/:id', async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.name || sesion.banneado) return res.redirect('/login');
  const id = parseInt(req.params.id);
  if (!rateLimit('foro-resp:' + sesion.name + ':' + id, 2500)) return res.redirect('/foros/tema/' + id);
  const contenido = (req.body.contenido || '').trim();
  if (!contenido) return res.redirect('/foros/tema/' + id);
  const { data: tema } = await supabase.from('foro_temas').select('*').eq('id', id).single();
  if (!tema || tema.cerrado) return res.redirect('/foros/tema/' + id);
  let parentId = req.body.parent_id ? parseInt(req.body.parent_id) : null;
  if (parentId && isNaN(parentId)) parentId = null;
  const row = { tema_id: id, autor: sesion.name, contenido };
  if (parentId) row.parent_id = parentId;
  await supabase.from('foro_respuestas').insert(row);
  await supabase.from('foro_temas').update({ updated_at: new Date().toISOString() }).eq('id', id);
  if (tema.autor !== sesion.name) {
    await crearNotif(tema.autor, 'foro', `@${sesion.name} respondió en "${tema.titulo}"`, `/foros/tema/${id}`);
  }
  if (parentId) {
    const { data: parent } = await supabase.from('foro_respuestas').select('autor').eq('id', parentId).single();
    if (parent && parent.autor !== sesion.name && parent.autor !== tema.autor) {
      await crearNotif(parent.autor, 'foro', `@${sesion.name} respondió a tu mensaje en "${tema.titulo}"`, `/foros/tema/${id}`);
    }
  }
  res.redirect('/foros/tema/' + id);
});

app.get('/foros/borrar-tema/:id', async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.name) return res.redirect('/login');
  const id = parseInt(req.params.id);
  const { data: tema } = await supabase.from('foro_temas').select('*').eq('id', id).single();
  if (!tema) return res.redirect('/foros');
  if (tema.autor !== sesion.name && !sesion.esMod) return pageError(res, 403, 'Sin permisos', 'No tenés permiso para hacer eso.', sesion, 0);
  await supabase.from('foro_respuestas').delete().eq('tema_id', id);
  await supabase.from('foro_temas').delete().eq('id', id);
  res.redirect('/foros');
});

app.get('/foros/borrar-resp/:id', async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.name) return res.redirect('/login');
  const id = parseInt(req.params.id);
  const temaId = req.query.tema;
  const { data: r } = await supabase.from('foro_respuestas').select('*').eq('id', id).single();
  if (!r) return res.redirect('/foros');
  if (r.autor !== sesion.name && !sesion.esMod) return pageError(res, 403, 'Sin permisos', 'No tenés permiso para hacer eso.', sesion, 0);
  await supabase.from('foro_respuestas').delete().eq('id', id);
  res.redirect('/foros/tema/' + (temaId || r.tema_id));
});

app.get('/foros/pin/:id', async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.esMod) return pageError(res, 403, 'Solo moderadores', 'Esta acción es solo para moderadores.', sesion, 0);
  const id = parseInt(req.params.id);
  const { data: tema } = await supabase.from('foro_temas').select('fijado').eq('id', id).single();
  if (tema) await supabase.from('foro_temas').update({ fijado: !tema.fijado }).eq('id', id);
  res.redirect('/foros/tema/' + id);
});

app.get('/foros/cerrar/:id', async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.esMod) return pageError(res, 403, 'Solo moderadores', 'Esta acción es solo para moderadores.', sesion, 0);
  const id = parseInt(req.params.id);
  const { data: tema } = await supabase.from('foro_temas').select('cerrado').eq('id', id).single();
  if (tema) await supabase.from('foro_temas').update({ cerrado: !tema.cerrado }).eq('id', id);
  res.redirect('/foros/tema/' + id);
});




app.get('/jugar-sm64', async (req, res) => {
  const sesion = await getSesion(req);
  const nNotif = await countNotif(sesion.name);
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/public/icon.png" type="image/png"><title>Jugar SM64 | Coop Free Mods</title>${estilosCSS}
  <style>
    body.sm64-page { margin: 0; background: #000; overflow: hidden; }
    #sm64App {
      display: flex; flex-direction: column; width: 100%; height: 100vh;
      background: #000;
    }
    .sm64-bar {
      display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
      padding: 10px 14px; background: rgba(15,17,21,0.96);
      border-bottom: 2px solid #ff3333; position: relative; z-index: 30;
      flex-shrink: 0;
    }
    .sm64-bar a, .sm64-bar button {
      font-weight: 700; font-size: 13px; border-radius: 8px; border: none; cursor: pointer;
      padding: 8px 12px; text-decoration: none; pointer-events: auto;
    }
    .sm64-bar .btn-fs { background: #2563eb; color: white; }
    .sm64-bar .btn-back { background: #374151; color: #e5e7eb; }
    .sm64-controls-mini { color: #9ca3af; font-size: 12px; margin-left: auto; }
    .sm64-frame-wrap {
      position: relative; flex: 1; min-height: 0; width: 100%; background: #000;
    }
    .sm64-frame {
      width: 100%; height: 100%; border: 0; display: block; background: #000;
    }
    /* En fullscreen solo el juego: botón flotante para salir */
    #sm64ExitFs {
      display: none; position: fixed; top: 12px; right: 12px; z-index: 99999;
      background: rgba(15,17,21,0.92); color: #fff; border: 2px solid #ff3333;
      border-radius: 8px; padding: 10px 14px; font-weight: 800; font-size: 13px; cursor: pointer;
    }
    .sm64-frame-wrap:fullscreen #sm64ExitFs,
    .sm64-frame-wrap:-webkit-full-screen #sm64ExitFs {
      display: block;
    }
    .sm64-frame-wrap:fullscreen,
    .sm64-frame-wrap:-webkit-full-screen {
      width: 100vw; height: 100vh; background: #000;
    }
    .sm64-frame-wrap:fullscreen .sm64-frame,
    .sm64-frame-wrap:-webkit-full-screen .sm64-frame {
      width: 100%; height: 100%;
    }
  </style>
  </head><body class="sm64-page">
    <div id="sm64App">
      <div class="sm64-bar">
        <a href="/" class="btn-back">← Inicio</a>
        <button type="button" class="btn-fs" id="btnFullscreen">⛶ Pantalla completa</button>
        <span class="sm64-controls-mini">WASD · A:X · B:C · Z:Espacio · Start:Enter · Cámara:flechas</span>
      </div>
      <div class="sm64-frame-wrap" id="sm64Wrap">
        <button type="button" id="sm64ExitFs">✕ Salir pantalla completa</button>
        <iframe class="sm64-frame" id="sm64Frame" src="/public/sm64/index.html" title="SM64" allow="fullscreen; gamepad *; autoplay" allowfullscreen tabindex="0"></iframe>
      </div>
    </div>
    <script>
    (function(){
      try {
        localStorage.setItem('cfm_egg_sm64', '1');
        localStorage.setItem('cfm_music', '0');
        var audio = document.getElementById('cfm-bg-music');
        if (audio) audio.pause();
      } catch(e) {}
      var wrap = document.getElementById('sm64Wrap');
      var frame = document.getElementById('sm64Frame');
      var btn = document.getElementById('btnFullscreen');
      var exitBtn = document.getElementById('sm64ExitFs');
      function isFs() {
        return document.fullscreenElement || document.webkitFullscreenElement;
      }
      function focusGame() {
        try {
          if (frame) {
            frame.focus();
            if (frame.contentWindow) frame.contentWindow.focus();
          }
        } catch (e) {}
      }
      function goFS() {
        if (isFs()) {
          if (document.exitFullscreen) document.exitFullscreen();
          else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
          return;
        }
        // Solo el área del juego → el iframe recibe teclado/ratón
        if (wrap.requestFullscreen) wrap.requestFullscreen();
        else if (wrap.webkitRequestFullscreen) wrap.webkitRequestFullscreen();
        else if (frame.requestFullscreen) frame.requestFullscreen();
      }
      function onFsChange() {
        var fs = isFs();
        btn.textContent = fs ? '✕ Salir pantalla completa' : '⛶ Pantalla completa';
        if (exitBtn) exitBtn.style.display = fs ? 'block' : 'none';
        if (fs) setTimeout(focusGame, 150);
        else setTimeout(focusGame, 50);
      }
      document.addEventListener('fullscreenchange', onFsChange);
      document.addEventListener('webkitfullscreenchange', onFsChange);
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        goFS();
      });
      if (exitBtn) exitBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      });
      // Clic en el juego → foco al iframe
      wrap.addEventListener('click', function() { focusGame(); });
      frame.addEventListener('load', function() { focusGame(); });
    })();
    </script>
  </body></html>`);
});




app.get('/config', async (req, res) => {
  const sesion = await getSesion(req);
  const nNotif = await countNotif(sesion.name);
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="icon" href="/public/icon.png" type="image/png"><title>Configuración | Coop Free Mods</title>${estilosCSS}</head><body>
    ${navbar(sesion, nNotif)}
    <div class="main-container" style="max-width:560px;">
      <div class="form-box" style="margin-top:24px;">
        <h2 style="color:white;margin-top:0;">⚙️ Configuración</h2>
        <p style="color:#9ca3af;font-size:14px;">Opciones especiales en <b>tu navegador</b> (no afectan a otros usuarios).</p>

        <label class="config-row">
          <span>
            <b style="color:white;">Cursor SM64</b><br>
            <span style="color:#9ca3af;font-size:13px;">Cambia el cursor por uno estilo Super Mario 64 (la punta del PNG debe estar arriba a la izquierda).</span>
          </span>
          <input type="checkbox" id="optCursor" style="width:auto;transform:scale(1.3);">
        </label>

        <label class="config-row">
          <span>
            <b style="color:white;">Música de fondo</b><br>
            <span style="color:#9ca3af;font-size:13px;">Reproduce música mientras navegás (podés pausarla cuando quieras).</span>
          </span>
          <input type="checkbox" id="optMusic" style="width:auto;transform:scale(1.3);">
        </label>

        <label class="config-row">
          <span>
            <b style="color:white;">Vista en lista</b><br>
            <span style="color:#9ca3af;font-size:13px;">Mostrar los mods en filas compactas en lugar de tarjetas grandes.</span>
          </span>
          <input type="checkbox" id="optList" style="width:auto;transform:scale(1.3);">
        </label>

        <label class="config-row">
          <span>
            <b style="color:white;">Sonido al hacer click</b><br>
            <span style="color:#9ca3af;font-size:13px;">Reproduce un sonido cada vez que hacés click en la página.</span>
          </span>
          <input type="checkbox" id="optClick" style="width:auto;transform:scale(1.3);">
        </label>

        <p style="color:#6b7280;font-size:12px;margin-top:20px;">Si la música no suena, el navegador bloqueó el autoplay: activá la opción y hacé un clic en la página. Archivos opcionales: <code>public/cursor.png</code>, <code>public/bg-music.mp3</code> y <code>public/click.mp3</code>.</p>
        <p style="text-align:center;margin-top:20px;"><a href="/" class="btn-red">Volver al inicio</a></p>
      </div>
    </div>
    <script>
    (function(){
      var cur = document.getElementById('optCursor');
      var mus = document.getElementById('optMusic');
      var lst = document.getElementById('optList');
      var clk = document.getElementById('optClick');
      cur.checked = localStorage.getItem('cfm_cursor') === '1';
      mus.checked = localStorage.getItem('cfm_music') === '1';
      lst.checked = localStorage.getItem('cfm_list_view') === '1';
      clk.checked = localStorage.getItem('cfm_click') === '1';
      function apply(){
        localStorage.setItem('cfm_cursor', cur.checked ? '1' : '0');
        localStorage.setItem('cfm_music', mus.checked ? '1' : '0');
        localStorage.setItem('cfm_list_view', lst.checked ? '1' : '0');
        localStorage.setItem('cfm_click', clk.checked ? '1' : '0');
        if (cur.checked) document.documentElement.classList.add('cfm-sm64-cursor');
        else document.documentElement.classList.remove('cfm-sm64-cursor');
        if (lst.checked) document.documentElement.classList.add('cfm-list-view');
        else document.documentElement.classList.remove('cfm-list-view');
        if (clk.checked) {
          try { var t = new Audio('/public/click.mp3'); t.volume = 0.45; t.play().catch(function(){}); } catch(e) {}
        }
        var audio = document.getElementById('cfm-bg-music');
        if (!audio) {
          audio = document.createElement('audio');
          audio.id = 'cfm-bg-music';
          audio.loop = true;
          audio.src = '/public/bg-music.mp3';
          audio.volume = 0.35;
          document.body.appendChild(audio);
        }
        if (mus.checked) {
          var p = audio.play();
          if (p && p.catch) p.catch(function(){ alert('El navegador bloqueó la música. Hacé clic en la página e intentá de nuevo.'); });
        } else {
          audio.pause();
        }
      }
      cur.addEventListener('change', apply);
      mus.addEventListener('change', apply);
      lst.addEventListener('change', apply);
      clk.addEventListener('change', apply);
    })();
    </script>
  </body></html>`);
});



app.get('/ia-mods', async (req, res) => {
  const sesion = await getSesion(req);
  const nNotif = await countNotif(sesion.name);
  const page = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/public/icon.png" type="image/png"><title>ToadCode | Coop Free Mods</title>${estilosCSS}
  <style>
    
    .ia-layout { display: flex; gap: 12px; align-items: stretch; }
    .ia-history {
      width: 180px; flex-shrink: 0; background: rgba(31,35,43,0.95);
      border: 1px solid #2d3139; border-radius: 12px; padding: 10px; max-height: min(70vh, 640px);
      overflow-y: auto; display: flex; flex-direction: column; gap: 8px;
    }
    .ia-history-head { display: flex; justify-content: space-between; align-items: center; color: #e5e7eb; font-size: 13px; }
    .ia-history-list { display: flex; flex-direction: column; gap: 6px; }
    .ia-hist-item {
      text-align: left; background: #161920; border: 1px solid #374151; color: #ced4da;
      border-radius: 8px; padding: 8px 10px; font-size: 12px; cursor: pointer; width: 100%;
    }
    .ia-hist-item:hover, .ia-hist-item.active { border-color: #e11d48; color: #fff; }
    .ia-hist-item .ia-hist-date { color: #6b7280; font-size: 10px; display: block; margin-top: 4px; }
    .ia-main { flex: 1; min-width: 0; }
    @media (max-width: 700px) {
      .ia-layout { flex-direction: column; }
      .ia-history { width: 100%; max-height: 140px; }
    }

    .ia-wrap { max-width: 920px; margin: 20px auto 40px; padding: 0 14px; }
    .ia-chat { background: rgba(31,35,43,0.95); border: 1px solid #2d3139; border-radius: 12px; height: min(70vh, 640px); overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
    .ia-msg { max-width: 92%; padding: 10px 12px; border-radius: 10px; font-size: 14px; line-height: 1.5; word-break: break-word; }
    .ia-msg.user { align-self: flex-end; background: #2563eb; color: white; white-space: pre-wrap; }
    .ia-msg.bot { align-self: flex-start; background: #1f2937; color: #e5e7eb; border: 1px solid #374151; }
    .ia-msg.sys { align-self: center; background: transparent; color: #9ca3af; font-size: 12px; }
    .ia-msg.bot .ia-name { color: #fbbf24; font-weight: 800; font-size: 12px; margin-bottom: 6px; }
    .ia-msg.bot h3, .ia-msg.bot h4 { color: #fff; margin: 10px 0 6px 0; font-size: 14px; }
    .ia-msg.bot ul { margin: 6px 0 8px 1.2em; padding: 0; }
    .ia-msg.bot li { margin: 3px 0; }
    .ia-msg.bot code { background: #0f1115; color: #93c5fd; padding: 1px 5px; border-radius: 4px; font-family: ui-monospace, Consolas, monospace; font-size: 12px; }
    .ia-msg.bot pre { background: #0b0d10; border: 1px solid #374151; border-radius: 8px; padding: 10px 12px; overflow-x: auto; margin: 8px 0; }
    .ia-code-wrap { position: relative; margin: 8px 0; }
    .ia-copy-btn {
      position: absolute; top: 6px; right: 6px; z-index: 2;
      background: #2563eb; color: #fff; border: none; border-radius: 6px;
      font-size: 11px; font-weight: 700; padding: 4px 8px; cursor: pointer;
    }
    .ia-copy-btn:hover { background: #1d4ed8; }
    .ia-copy-btn.copied { background: #16a34a; }

    .ia-table-wrap { overflow-x: auto; margin: 10px 0; }
    .ia-msg.bot table { border-collapse: collapse; width: 100%; font-size: 12px; }
    .ia-msg.bot th, .ia-msg.bot td { border: 1px solid #374151; padding: 7px 9px; text-align: left; vertical-align: top; }
    .ia-msg.bot th { background: #111827; color: #fbbf24; }
    .ia-msg.bot td { color: #e5e7eb; }
    .ia-hr { border: none; border-top: 1px solid #374151; margin: 12px 0; }
    .ia-msg.bot p { margin: 0 0 8px 0; }

    .ia-msg.bot pre { margin-top: 0; padding-top: 28px; }

    .ia-msg.bot pre code { background: none; padding: 0; color: #e5e7eb; display: block; white-space: pre; }
    .ia-msg.bot strong { color: #fff; }
    .ia-form { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
    .ia-form textarea { width: 100%; box-sizing: border-box; min-height: 72px; }
    .ia-form textarea { flex: 1; min-height: 48px; max-height: 120px; resize: vertical; background: #161920; color: white; border: 1px solid #374151; border-radius: 8px; padding: 10px; font-family: inherit; }
  </style></head><body>
    ${navbar(sesion, nNotif)}
    <div class="ia-wrap">
      <h1 style="color:white;margin:0 0 6px 0;">🍄 ToadCode</h1>
      <p style="color:#9ca3af;font-size:14px;margin:0 0 14px 0;">Ayuda con <b>Lua / mods</b> de SM64 Co-op y con <b>dudas de esta web</b> (top mods, categorías, etc.).</p>
      <div class="ia-layout">
        <aside class="ia-history" id="iaHistoryPanel">
          <div class="ia-history-head">
            <b>Historial</b>
            <button type="button" id="iaNewChat" class="btn-gray" style="padding:4px 8px;font-size:11px;">+ Nuevo</button>
          </div>
          <div id="iaHistoryList" class="ia-history-list"></div>
        </aside>
        <div class="ia-main">
      <div class="ia-chat" id="iaChat"><div class="ia-msg sys">¡Hola! Soy <b style="color:#fbbf24;">ToadCode</b>. Preguntame por Lua, mods, o por la web (ej: ¿cuál es el mod más descargado?).</div></div>
      <form class="ia-form" id="iaForm">
        <div id="iaAttachList" style="display:none;flex-wrap:wrap;gap:6px;margin-bottom:8px;"></div>
        <textarea id="iaInput" placeholder="Pregunta sobre Lua / mods / la web..." maxlength="4000"></textarea>
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
          <label class="btn-gray" style="padding:8px 12px;cursor:pointer;margin:0;">
            📎 Adjuntar
            <input type="file" id="iaFile" accept=".lua,.txt,.md,.json,.c,.h,.xml,.csv" multiple style="display:none;">
          </label>
          <button type="button" class="btn-gray" id="iaClearMem" title="Borra el historial guardado">🧹 Olvidar chat</button>
          <button type="submit" class="btn-red" id="iaSend" style="margin-left:auto;">Enviar</button>
        </div>
        <p style="color:#6b7280;font-size:11px;margin:8px 0 0 0;">Archivos de texto (Lua, txt…) · máx. 80 KB c/u · la memoria se guarda en este navegador</p>
      </form>
      <p style="text-align:center;margin-top:14px;"><a href="/" class="btn-blue">← Volver al inicio</a></p>
        </div>
      </div>
    </div>
    <script src="/public/toadcode-chat.js"></script>
  </body></html>`;
  res.send(page);
});



app.post('/api/ia-mods', express.json({ limit: '256kb' }), async (req, res) => {
  try {
    const messages = Array.isArray(req.body && req.body.messages) ? req.body.messages : [];
    if (!messages.length) return res.status(400).json({ error: 'Mensaje vacío' });

    // Datos en vivo de la web para responder dudas del sitio
    let siteCtx = '';
    try {
      const { data: mods } = await supabase.from('mods').select('id,titulo,autor,categoria,version,descargas,likes').order('descargas', { ascending: false }).limit(200);
      const { count: nUsers } = await supabase.from('usuarios').select('*', { count: 'exact', head: true });
      const { count: nForos } = await supabase.from('foro_temas').select('*', { count: 'exact', head: true });
      const lista = mods || [];
      const totalMods = lista.length;
      const totalDesc = lista.reduce((s, m) => s + (m.descargas || 0), 0);
      const top = lista.slice(0, 5).map((m, i) => (i + 1) + '. "' + (m.titulo || '') + '" por @' + (m.autor || '') + ' — ' + (m.descargas || 0) + ' descargas').join('\n');
      const cats = {};
      lista.forEach(m => { const c = m.categoria || 'Otros'; cats[c] = (cats[c] || 0) + 1; });
      const catList = Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([c, n]) => c + ' (' + n + ')').join(', ');
      const vers = {};
      lista.forEach(m => { const v = m.version || '?'; vers[v] = (vers[v] || 0) + 1; });
      const verList = Object.entries(vers).map(([v, n]) => v + ' (' + n + ')').join(', ');
      siteCtx = [
        'DATOS ACTUALES DE LA WEB (usá estos números si preguntan por la web):',
        '- Nombre del sitio: Coop Free Mods',
        '- Qué es: repositorio / comunidad gratuita de mods para Super Mario 64 Co-op (DX, EX, DX+EX). Se pueden publicar, descargar, comentar, foros, favoritos, likes.',
        '- URL aproximada: coop-free-mods.vercel.app',
        '- Mods listados (muestra): ' + totalMods,
        '- Usuarios registrados (aprox): ' + (nUsers || 0),
        '- Temas de foro (aprox): ' + (nForos || 0),
        '- Descargas sumadas (muestra top): ' + totalDesc,
        '- Top mods más descargados:\n' + (top || 'sin datos'),
        '- Categorías y cantidad: ' + (catList || 'sin datos'),
        '- Versiones: ' + (verList || 'sin datos'),
        '- Secciones de la web: Inicio, Mods, Top 10, Foros, Cómo instalar, Config, Usuarios, Novedades, CoopTube (videos YouTube), ToadCode (este chat), Discord, Mis mods, Favoritos, Notificaciones.',
        '- ToadCode: asistente de la web (Lua/mods + dudas del sitio).',
        '- Moderador principal: SuperAaron64.'
      ].join('\n');
    } catch (e) {
      siteCtx = 'No se pudieron cargar stats en vivo. Coop Free Mods es un sitio de mods gratis para SM64 Co-op DX/EX.';
    }

    const system = {
      role: 'system',
      content: [
        'Tu nombre es ToadCode, asistente oficial de Coop Free Mods.',
        'Podés ayudar con DOS cosas:',
        '1) Código Lua y mods de SM64 Co-op (DX, EX, DX+EX): hooks, personajes, dynos, gamemodes, movesets, UI, etc.',
        '2) Dudas sobre ESTA web: qué es Coop Free Mods, categorías, top descargas, secciones, cómo publicar, cómo instalar, Discord, etc. Usá los DATOS ACTUALES de abajo; no inventes cifras.',
        'Si preguntan algo que no sea Lua/mods de Co-op NI la web Coop Free Mods, respondé breve que solo cubrís eso.',
        'Respondé en español, claro. En código Lua: bloques ```lua COMPLETOS (con end), sin cortar. Priorizá código completo si el script es largo.',
        'El usuario puede adjuntar archivos de código: analizalos y corregilos. Tenés historial de la conversación: usá esa memoria para no repetir ni olvidar contexto previo.',
        'Markdown simple. Sin HTML.',
        '',
        siteCtx
      ].join('\n')
    };
    // Preferir Gemini Flash; luego Groq / xAI
    const apiKey = String(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GROQ_API_KEY || process.env.XAI_API_KEY || process.env.OPENAI_API_KEY || '').trim();
    if (!apiKey) {
      return res.status(503).json({
        error: 'La IA no está configurada. En Vercel agregá GEMINI_API_KEY (Google AI Studio).'
      });
    }
    // ---- Llamada a IA (Gemini nativo + fallback Groq) ----
    async function callGeminiNative(key, modelId, msgs) {
      const cleanKey = String(key || '').trim();
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(modelId) + ':generateContent';
      const contents = [];
      let systemText = '';
      for (const m of msgs) {
        if (m.role === 'system') {
          systemText += (systemText ? '\n' : '') + m.content;
          continue;
        }
        contents.push({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: String(m.content || '') }]
        });
      }
      // Gemini exige que el primer content sea "user"
      if (contents.length && contents[0].role !== 'user') {
        contents.unshift({ role: 'user', parts: [{ text: '(continuar)' }] });
      }
      const body = {
        contents,
        generationConfig: { temperature: 0.4, maxOutputTokens: 4096 }
      };
      if (systemText) {
        body.systemInstruction = { parts: [{ text: systemText }] };
      }
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': cleanKey
        },
        body: JSON.stringify(body)
      });
      const data = await r.json().catch(() => ({}));
      return { r, data, mdl: modelId };
    }

    async function listGeminiModels(key) {
      const cleanKey = String(key || '').trim();
      const url = 'https://generativelanguage.googleapis.com/v1beta/models';
      const r = await fetch(url, {
        headers: { 'x-goog-api-key': cleanKey }
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return { ok: false, status: r.status, data, names: [] };
      const names = (data.models || [])
        .map(m => (m.name || '').replace(/^models\//, ''))
        .filter(n => n && /flash|pro|gemma/i.test(n) && !/embed|tts|image|audio|live/i.test(n));
      return { ok: true, status: r.status, data, names };
    }

    async function callOpenAICompat(url, key, mdl, msgs) {
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + key
        },
        body: JSON.stringify({
          model: mdl,
          messages: msgs,
          temperature: 0.4,
          max_tokens: 4096
        })
      });
      const data = await r.json().catch(() => ({}));
      return { r, data, mdl };
    }

    const allMsgs = [system, ...messages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').slice(0, 8000)
    }))];

    let r, data, usedModel;
    const gemKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    if (gemKey) {
      const primary = String(process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim();
      let alts = [primary, 'gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-pro'];
      // Descubrir modelos reales de la key
      try {
        const listed = await listGeminiModels(gemKey);
        if (listed.ok && listed.names.length) {
          alts = [primary].concat(listed.names.filter(n => n !== primary));
        } else if (!listed.ok) {
          // key inválida o API no habilitada
          r = { ok: false, status: listed.status };
          data = listed.data;
          usedModel = 'listModels';
        }
      } catch (e) { console.error('listModels', e); }
      const tried = new Set();
      for (const mdl of alts) {
        if (!mdl || tried.has(mdl)) continue;
        tried.add(mdl);
        const out = await callGeminiNative(gemKey, mdl, allMsgs);
        r = out.r; data = out.data; usedModel = mdl;
        if (out.r.ok && data.candidates && data.candidates[0]) break;
        // seguir probando en 404
        if (out.r.status && ![404, 429, 503].includes(out.r.status) && out.r.status !== 400) break;
      }
    } else if (groqKey || String(apiKey).startsWith('gsk_')) {
      const out = await callOpenAICompat(
        'https://api.groq.com/openai/v1/chat/completions',
        groqKey || apiKey,
        process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        allMsgs
      );
      r = out.r; data = out.data; usedModel = out.mdl;
    } else if (process.env.XAI_API_KEY) {
      const out = await callOpenAICompat(
        'https://api.x.ai/v1/chat/completions',
        process.env.XAI_API_KEY,
        process.env.XAI_MODEL || 'grok-2-latest',
        allMsgs
      );
      r = out.r; data = out.data; usedModel = out.mdl;
    } else {
      const out = await callOpenAICompat(
        'https://api.openai.com/v1/chat/completions',
        apiKey,
        process.env.OPENAI_MODEL || 'gpt-4o-mini',
        allMsgs
      );
      r = out.r; data = out.data; usedModel = out.mdl;
    }

    // Fallback Groq si Gemini falla
    if (r && !r.ok && gemKey && groqKey && [404, 429, 503, 502].includes(r.status)) {
      const out = await callOpenAICompat(
        'https://api.groq.com/openai/v1/chat/completions',
        groqKey,
        process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        allMsgs
      );
      if (out.r.ok) {
        r = out.r; data = out.data; usedModel = out.mdl + ' (fallback Groq)';
      }
    }

    // Extraer respuesta (Gemini nativo o OpenAI-compat)
    let reply = '';
    if (data && data.candidates && data.candidates[0] && data.candidates[0].content) {
      const parts = data.candidates[0].content.parts || [];
      reply = parts.map(p => p.text || '').join('');
    } else if (data && data.choices && data.choices[0] && data.choices[0].message) {
      reply = data.choices[0].message.content || '';
    }

    if (!r || !r.ok || !reply) {
      console.error('ia error', usedModel, r && r.status, data);
      let msg = 'Error de la API de IA';
      if (data && data.error) {
        if (typeof data.error === 'string') msg = data.error;
        else if (data.error.message) msg = data.error.message;
        else if (data.error.status) msg = String(data.error.status);
      } else if (data && data.message) msg = data.message;
      else if (!reply && r && r.ok) msg = 'Respuesta vacía del modelo';
      msg = String(msg).slice(0, 300);
      const st = r ? r.status : 0;
      if (st === 503) msg = 'Gemini saturado (503). Probá en unos minutos o configurá GROQ_API_KEY.';
      if (st === 404) msg = 'Modelo/API no encontrado (404). Revisá que GEMINI_API_KEY sea de AI Studio (empieza con AIza) y que Generative Language API esté activa. Probá GEMINI_MODEL=gemini-2.0-flash';
      if (st === 400 && /API key/i.test(msg)) msg = 'API key de Gemini inválida. Regenerá la key en aistudio.google.com';
      if (st === 403) msg = 'Sin permiso (403). Activá Generative Language API en Google Cloud o regenerá la key.';
      return res.status(502).json({
        error: msg + ' (modelo: ' + (usedModel || '?') + ', status: ' + st + ')'
      });
    }
    res.json({ reply: reply || '(vacío)' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error interno de IA' });
  }
});










app.get('/usuarios', async (req, res) => {
  const sesion = await getSesion(req);
  const nNotif = await countNotif(sesion.name);
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const perPage = 30;
    let { data: users, error } = await supabase.from('usuarios').select('id,usuario,descripcion,fecha_registro,seguidores,banneado').order('fecha_registro', { ascending: false }).limit(500);
    if (error) throw error;
    users = users || [];
    if (q) users = users.filter(u => {
      if (/^\d+$/.test(q) && String(u.id) === q) return true;
      return (u.usuario || '').toLowerCase().includes(q) || (u.descripcion || '').toLowerCase().includes(q);
    });
    if (/^\d+$/.test(q) && users.length === 1) {
      return res.redirect('/user/' + encodeURIComponent(users[0].usuario));
    }
    const total = users.length;
    const pages = Math.max(1, Math.ceil(total / perPage));
    const slice = users.slice((page - 1) * perPage, page * perPage);

    // mod counts
    const { data: mods } = await supabase.from('mods').select('autor');
    const counts = {};
    (mods || []).forEach(m => { counts[m.autor] = (counts[m.autor] || 0) + 1; });

    const rows = slice.map(u => {
      const seg = (u.seguidores || []).length;
      const nMods = counts[u.usuario] || 0;
      const ban = u.banneado ? ' <span style="color:#f87171;font-size:11px;">baneado</span>' : '';
      const modB = isMod(u.usuario) ? ' <span class="mod-badge">MOD</span>' : '';
      const desc = escapeHtml((u.descripcion || '').slice(0, 80));
      let fecha = '';
      try {
        const d = new Date(u.fecha_registro);
        if (!isNaN(d)) fecha = d.toLocaleDateString('es-AR');
      } catch (e) {}
      return `<a href="/user/${escapeHtml(u.usuario)}" class="user-row">
        <div class="user-row-main">
          <span class="user-row-name">@${escapeHtml(u.usuario)}${modB}${ban}</span>
          ${desc ? `<span class="user-row-desc">${desc}</span>` : ''}
        </div>
        <div class="user-row-meta">
          <span>${nMods} mods</span>
          <span>${seg} seguidores</span>
          <span>${escapeHtml(fecha)}</span>
        </div>
      </a>`;
    }).join('') || '<p style="color:#9ca3af;text-align:center;">No hay usuarios.</p>';

    let pag = '';
    if (pages > 1) {
      pag = '<div class="pagination">';
      for (let i = 1; i <= pages; i++) {
        const active = i === page ? ' style="background:#e11d48;"' : '';
        pag += `<a href="/usuarios?q=${encodeURIComponent(q)}&page=${i}" class="btn-gray" style="padding:6px 10px;font-size:13px;${i===page?'background:#e11d48;color:#fff;':''}">${i}</a> `;
      }
      pag += '</div>';
    }

    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/public/icon.png" type="image/png"><title>Usuarios | Coop Free Mods</title>${estilosCSS}
    <style>
      .user-row {
        display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px;
        background: rgba(31,35,43,0.95); border: 1px solid #2d3139; border-radius: 10px;
        padding: 12px 14px; margin-bottom: 8px; text-decoration: none; color: inherit;
        transition: transform 0.15s, border-color 0.15s;
      }
      .user-row:hover { transform: translateY(-2px); border-color: #e11d48; }
      .user-row-main { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; }
      .user-row-name { color: #fff; font-weight: 700; font-size: 15px; }
      .user-row-desc { color: #9ca3af; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .user-row-meta { display: flex; flex-wrap: wrap; gap: 12px; color: #6b7280; font-size: 12px; }
      .pagination { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-top: 16px; }
    </style>
    </head><body>
      ${navbar(sesion, nNotif)}
      <div class="main-container">
        <h1 style="color:white;margin:0 0 8px 0;">👥 Usuarios</h1>
        <p style="color:#9ca3af;margin:0 0 14px 0;">${total} usuario${total===1?'':'s'}</p>
        <form method="GET" action="/usuarios" class="filters" style="margin-bottom:16px;">
          <input type="text" name="q" value="${escapeHtml(q)}" placeholder="Buscar usuario o ID..." style="max-width:280px;">
          <button type="submit" class="btn-blue">Buscar</button>
        </form>
        <div>${rows}</div>
        ${pag}
      </div>
    </body></html>`);
  } catch (e) {
    console.error(e);
    pageError(res, 500, 'Error', 'No se pudieron cargar los usuarios.', sesion, nNotif);
  }
});


// ---------- NOVEDADES ----------
app.get('/novedades', async (req, res) => {
  const sesion = await getSesion(req);
  const nNotif = await countNotif(sesion.name);
  try {
    const { data: rows, error } = await supabase
      .from('novedades')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    const list = rows || [];
    const items = list.map((n) => {
      let fecha = '';
      try {
        const d = new Date(n.created_at);
        if (!isNaN(d)) fecha = d.toLocaleDateString('es-AR') + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      } catch (e) {}
      const del = sesion.esMod
        ? `<a href="/novedades/borrar/${n.id}" class="btn-delete" onclick="return confirm('¿Borrar esta novedad?');">Borrar</a>`
        : '';
      return `<article class="nov-card">
        <div class="nov-head">
          <h2>${escapeHtml(n.titulo)}</h2>
          <span class="nov-meta">por @${escapeHtml(n.autor || 'mod')} · ${escapeHtml(fecha)}</span>
        </div>
        <div class="nov-body">${escapeHtml(n.contenido).replace(/\n/g, '<br>')}</div>
        ${del ? `<div style="margin-top:10px;">${del}</div>` : ''}
      </article>`;
    }).join('') || `<p style="color:#9ca3af;text-align:center;">Todavía no hay novedades.</p>`;

    const newBtn = sesion.esMod
      ? `<a href="/novedades/nueva" class="btn-red">+ Nueva novedad</a>`
      : '';

    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/public/icon.png" type="image/png"><title>Novedades | Coop Free Mods</title>${estilosCSS}
    <style>
      .nov-card {
        background: rgba(31,35,43,0.95); border: 1px solid #2d3139; border-radius: 12px;
        padding: 18px 20px; margin-bottom: 14px;
      }
      .nov-head h2 { color: #fff; margin: 0 0 6px 0; font-size: 1.15rem; }
      .nov-meta { color: #9ca3af; font-size: 12px; }
      .nov-body { color: #e5e7eb; margin-top: 12px; line-height: 1.55; font-size: 14px; }
    </style>
    </head><body>
      ${navbar(sesion, nNotif)}
      <div class="main-container" style="max-width:720px;">
        <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;">
          <h1 style="color:white;margin:0;">📰 Novedades</h1>
          ${newBtn}
        </div>
        <p style="color:#9ca3af;margin:0 0 18px 0;font-size:14px;">Cambios y anuncios de Coop Free Mods. Solo los moderadores pueden publicar.</p>
        ${items}
      </div>
    </body></html>`);
  } catch (e) {
    console.error(e);
    pageError(res, 500, 'Error', 'No se pudieron cargar las novedades. ¿Creaste la tabla en Supabase?', sesion, nNotif);
  }
});

app.get('/novedades/nueva', async (req, res) => {
  const sesion = await getSesion(req);
  const nNotif = await countNotif(sesion.name);
  if (!sesion.name) return res.redirect('/login');
  if (!sesion.esMod) return pageError(res, 403, 'Solo moderadores', 'Solo los moderadores pueden crear novedades.', sesion, nNotif);
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/public/icon.png" type="image/png"><title>Nueva novedad | Coop Free Mods</title>${estilosCSS}</head><body>
    ${navbar(sesion, nNotif)}
    <div class="form-box">
      <h2>📰 Nueva novedad</h2>
      <p style="color:#9ca3af;font-size:13px;">Se notificará a <b>todos</b> los usuarios registrados.</p>
      <form action="/novedades/nueva" method="POST">
        <label>Título</label>
        <input type="text" name="titulo" required maxlength="120" placeholder="Ej: Nueva sección ToadCode">
        <label>Contenido</label>
        <textarea name="contenido" required maxlength="4000" rows="8" placeholder="Contá qué cambió..."></textarea>
        <button type="submit" class="btn-red" style="width:100%;">Publicar y notificar a todos</button>
      </form>
      <p style="text-align:center;margin-top:14px;"><a href="/novedades" class="btn-blue">Cancelar</a></p>
    </div>
  </body></html>`);
});

app.post('/novedades/nueva', async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.name) return res.redirect('/login');
  if (!sesion.esMod) return pageError(res, 403, 'Solo moderadores', 'Solo los moderadores pueden crear novedades.', sesion, 0);
  if (!rateLimit('novedad:' + sesion.name, 5000)) {
    return pageError(res, 429, 'Demasiado rápido', 'Esperá un momento.', sesion, 0);
  }
  const titulo = cleanText(req.body.titulo || '').slice(0, 120);
  const contenido = String(req.body.contenido || '').trim().slice(0, 8000);
  if (titulo.length < 3 || contenido.length < 3) {
    return pageError(res, 400, 'Datos incompletos', 'Título y contenido muy cortos.', sesion, 0);
  }
  try {
    const { data: nov, error } = await supabase.from('novedades').insert({
      titulo,
      contenido,
      autor: sesion.name
    }).select('id').single();
    if (error) throw error;

    const { data: users } = await supabase.from('usuarios').select('usuario');
    const link = '/novedades';
    const mensaje = 'Nueva novedad: ' + titulo;
    if (users && users.length) {
      const batch = users
        .filter((u) => u.usuario && u.usuario !== sesion.name)
        .map((u) => ({
          usuario: u.usuario,
          tipo: 'novedad',
          mensaje,
          link,
          leido: false
        }));
      for (let i = 0; i < batch.length; i += 100) {
        const chunk = batch.slice(i, i + 100);
        if (chunk.length) {
          const { error: nErr } = await supabase.from('notificaciones').insert(chunk);
          if (nErr) console.error('notif batch', nErr);
        }
      }
    }
    res.redirect('/novedades');
  } catch (e) {
    console.error(e);
    pageError(res, 500, 'Error', 'No se pudo publicar. ¿Existe la tabla novedades en Supabase?', sesion, 0);
  }
});

app.get('/novedades/borrar/:id', async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.esMod) return pageError(res, 403, 'Solo moderadores', 'No tenés permiso.', sesion, 0);
  const id = parseInt(req.params.id, 10);
  if (!id) return res.redirect('/novedades');
  await supabase.from('novedades').delete().eq('id', id);
  res.redirect('/novedades');
});


// ---------- COOPTUBE ----------
app.get('/cooptube', async (req, res) => {
  const sesion = await getSesion(req);
  const nNotif = await countNotif(sesion.name);
  try {
    const buscar = String(req.query.buscar || '').trim().toLowerCase();
    const cat = req.query.categoria || 'Todas';
    const { data, error } = await supabase.from('videos').select('*').order('created_at', { ascending: false }).limit(300);
    if (error) throw error;
    let list = (data || []).map(mapVideo).filter(Boolean);
    if (buscar) {
      list = list.filter(v => {
        if (/^\d+$/.test(buscar) && String(v.id) === buscar) return true;
        return (v.titulo || '').toLowerCase().includes(buscar)
          || (v.descripcion || '').toLowerCase().includes(buscar)
          || (v.autor || '').toLowerCase().includes(buscar)
          || (v.youtubeId || '').toLowerCase() === buscar;
      });
      if (/^\d+$/.test(buscar) && list.length === 1) {
        return res.redirect('/cooptube/v/' + list[0].id);
      }
    }
    if (cat !== 'Todas') list = list.filter(v => v.categoria === cat);
    const pg = paginateList(list, req.query.page, 30);
    const catOpts = ['Todas', ...COOPTUBE_CATS].map(c =>
      `<option value="${escapeHtml(c)}" ${cat===c?'selected':''}>${escapeHtml(c)}</option>`
    ).join('');
    const cards = pg.slice.map(v => {
      const thumb = v.thumbnail || youtubeThumb(v.youtubeId);
      return `<div class="card" style="position:relative;">
        <a href="/cooptube/v/${v.id}" style="text-decoration:none;color:inherit;display:block;flex:1;">
          <div class="card-img-box" style="position:relative;">
            <img src="${escapeHtml(thumb)}" alt="" style="width:100%;height:100%;object-fit:cover;">
            <span style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,0.75);color:#fff;font-size:11px;padding:2px 6px;border-radius:4px;">▶ YouTube</span>
          </div>
          <div class="card-content" style="padding-bottom:8px;">
            <div class="tags">
              <span class="tag-category">${escapeHtml(v.categoria)}</span>
            </div>
            <h3 style="color:white;margin:0 0 10px 0;">${escapeHtml(v.titulo)}</h3>
            <p>${escapeHtml((v.descripcion || '').slice(0, 120))}</p>
          </div>
        </a>
        <div class="card-footer" style="padding:12px 15px;margin:0;">
          <span>por <a href="/user/${escapeHtml(v.autor)}" class="author">@${escapeHtml(v.autor)}</a></span>
          <span style="color:#9ca3af;font-size:12px;">👁 ${v.vistas || 0} · ⭐ ${v.likes || 0}</span>
        </div>
      </div>`;
    }).join('') || '<p style="color:#9ca3af;grid-column:1/-1;text-align:center;padding:40px;">No hay videos todavía. ¡Publicá el primero!</p>';

    const pubBtn = sesion.name && !sesion.banneado
      ? `<a href="/cooptube/publicar" class="btn-red">+ Publicar video</a>`
      : `<a href="/login" class="btn-red">Entrar para publicar</a>`;

    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/public/icon.png" type="image/png"><title>CoopTube | Coop Free Mods</title>${estilosCSS}</head><body>
      ${navbar(sesion, nNotif)}
      <div class="main-container">
        <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;">
          <div>
            <h1 style="color:white;margin:0;">📺 CoopTube</h1>
            <p style="color:#9ca3af;margin:6px 0 0 0;font-size:14px;">Videos de la comunidad SM64 Co-op · solo enlaces de YouTube</p>
          </div>
          ${pubBtn}
        </div>
        <form action="/cooptube" method="GET" class="filter-bar">
          <input type="text" name="buscar" placeholder="Buscar video o ID..." value="${escapeHtml(req.query.buscar || '')}">
          <select name="categoria">${catOpts}</select>
          <button type="submit" class="btn-blue">Filtrar</button>
        </form>
        <div class="grid">${cards}</div>
        ${renderPagination('/cooptube', pg.page, pg.totalPages, { buscar: req.query.buscar || '', categoria: cat === 'Todas' ? '' : cat })}
      </div>
    </body></html>`);
  } catch (e) {
    console.error(e);
    pageError(res, 500, 'Error', 'No se pudo cargar CoopTube. ¿Creaste la tabla videos en Supabase?', sesion, nNotif);
  }
});

app.get('/cooptube/publicar', async (req, res) => {
  const sesion = await getSesion(req);
  const nNotif = await countNotif(sesion.name);
  if (!sesion.name) return res.redirect('/login');
  if (sesion.banneado) return pageError(res, 403, 'Cuenta baneada', 'No podés publicar.', sesion, nNotif);
  const catOpts = COOPTUBE_CATS.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/public/icon.png" type="image/png"><title>Publicar video | CoopTube</title>${estilosCSS}</head><body>
    ${navbar(sesion, nNotif)}
    <div class="form-box">
      <h2>📺 Publicar en CoopTube</h2>
      <p style="color:#9ca3af;font-size:13px;">Solo se aceptan <b>enlaces de YouTube</b> (video o Short). El video se reproduce en la web.</p>
      <form action="/cooptube/publicar" method="POST">
        <label>Título</label>
        <input type="text" name="titulo" required maxlength="120" placeholder="Ej: Cómo instalar un mod en Co-op DX">
        <label>Enlace de YouTube</label>
        <input type="url" name="url" required placeholder="https://www.youtube.com/watch?v=... o /shorts/...">
        <label>Descripción</label>
        <textarea name="descripcion" maxlength="2000" rows="4" placeholder="De qué trata el video..."></textarea>
        <label>Categoría</label>
        <select name="categoria">${catOpts}</select>
        <label>Enlace del mod (opcional)</label>
        <input type="url" name="mod_url" placeholder="https://coop-free-mods.vercel.app/mod/12">
        <label>Miniatura (opcional, URL de imagen)</label>
        <input type="url" name="thumbnail_url" placeholder="https://...jpg — si vacío, usa la de YouTube">
        <button type="submit" class="btn-red" style="width:100%;">Publicar video</button>
      </form>
      <p style="text-align:center;margin-top:14px;"><a href="/cooptube" class="btn-blue">Cancelar</a></p>
    </div>
  </body></html>`);
});

app.post('/cooptube/publicar', async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.name) return res.redirect('/login');
  if (sesion.banneado) return pageError(res, 403, 'Cuenta baneada', 'No podés publicar.', sesion, 0);
  if (!rateLimit('cooptube:' + sesion.name, 4000)) {
    return pageError(res, 429, 'Demasiado rápido', 'Esperá un momento.', sesion, 0);
  }
  const titulo = cleanText(req.body.titulo || '').slice(0, 120);
  const descripcion = cleanText(req.body.descripcion || '').slice(0, 2000);
  const categoria = COOPTUBE_CATS.includes(req.body.categoria) ? req.body.categoria : 'Otros';
  const ytId = extractYoutubeId(req.body.url || '');
  let modUrl = String(req.body.mod_url || '').trim();
  if (modUrl && !isAllowedModPageUrl(modUrl)) modUrl = '';
  if (!modUrl) modUrl = null;
  let thumbUrl = String(req.body.thumbnail_url || '').trim();
  if (thumbUrl && !isAllowedImageUrl(thumbUrl)) {
    return pageError(res, 400, 'Miniatura inválida', 'La miniatura debe ser una URL http/https de imagen.', sesion, 0);
  }
  if (!thumbUrl) thumbUrl = null;
  if (titulo.length < 3) return pageError(res, 400, 'Título corto', 'Poné un título válido.', sesion, 0);
  if (!ytId) return pageError(res, 400, 'Link inválido', 'Solo se aceptan enlaces de YouTube (watch, shorts, youtu.be).', sesion, 0);
  try {
    const { data: row, error } = await supabase.from('videos').insert({
      titulo,
      descripcion,
      autor: sesion.name,
      youtube_id: ytId,
      categoria,
      mod_url: modUrl,
      thumbnail_url: thumbUrl,
      vistas: 0,
      likes: 0,
      usuarios_like: []
    }).select('id').single();
    if (error) throw error;
    res.redirect('/cooptube/v/' + row.id);
  } catch (e) {
    console.error(e);
    pageError(res, 500, 'Error', 'No se pudo publicar. ¿Existe la tabla videos en Supabase?', sesion, 0);
  }
});

app.get('/cooptube/v/:id', async (req, res) => {
  const sesion = await getSesion(req);
  const nNotif = await countNotif(sesion.name);
  const id = parseInt(req.params.id, 10);
  if (!id) return pageError(res, 404, 'No encontrado', 'Video inválido.', sesion, nNotif);
  try {
    const { data, error } = await supabase.from('videos').select('*').eq('id', id).single();
    if (error || !data) return pageError(res, 404, 'No encontrado', 'Ese video no existe.', sesion, nNotif);
    const v = mapVideo(data);
    // 1 visita por día por video (cookie), evita spam al entrar/salir
    let vistos = [];
    try {
      vistos = JSON.parse(req.cookies.video_vistos || '[]');
      if (!Array.isArray(vistos)) vistos = [];
    } catch (e) { vistos = []; }
    if (!vistos.includes(id)) {
      try {
        const nuevas = (v.vistas || 0) + 1;
        await supabase.from('videos').update({ vistas: nuevas }).eq('id', id);
        v.vistas = nuevas;
        vistos.push(id);
        if (vistos.length > 100) vistos = vistos.slice(-100);
        res.cookie('video_vistos', JSON.stringify(vistos), {
          maxAge: 1000 * 60 * 60 * 24,
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: !!process.env.VERCEL
        });
      } catch (e) {}
    }

    const { data: moreData } = await supabase.from('videos').select('*').neq('id', id).order('created_at', { ascending: false }).limit(12);
    const more = (moreData || []).map(mapVideo).filter(Boolean);

    let modLink = '';
    if (v.modUrl) {
      modLink = `<p style="margin:12px 0;"><a href="${escapeHtml(v.modUrl)}" class="btn-blue" rel="noopener">📦 Ver mod relacionado</a></p>`;
    }
    const del = (sesion.name === v.autor || sesion.esMod)
      ? `<a href="/cooptube/borrar/${v.id}" class="btn-delete" onclick="return confirm('¿Borrar este video?');">Borrar video</a>`
      : '';
    let fecha = '';
    try {
      const d = new Date(v.created_at);
      if (!isNaN(d)) fecha = d.toLocaleDateString('es-AR');
    } catch (e) {}
    const embed = 'https://www.youtube.com/embed/' + encodeURIComponent(v.youtubeId) + '?rel=0&modestbranding=1';
    const side = more.map(m => {
      const th = m.thumbnail || youtubeThumb(m.youtubeId);
      return `<a href="/cooptube/v/${m.id}" class="ct-side-item">
        <img src="${escapeHtml(th)}" alt="">
        <div>
          <div class="ct-side-title">${escapeHtml(m.titulo)}</div>
          <div class="ct-side-meta">@${escapeHtml(m.autor)} · 👁 ${m.vistas || 0}</div>
        </div>
      </a>`;
    }).join('') || '<p style="color:#6b7280;font-size:13px;">No hay más videos.</p>';

    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/public/icon.png" type="image/png"><title>${escapeHtml(v.titulo)} | CoopTube</title>${estilosCSS}
    <style>
      .ct-layout { display: flex; gap: 20px; align-items: flex-start; max-width: 1100px; margin: 0 auto; }
      .ct-main { flex: 1; min-width: 0; max-width: 720px; }
      .ct-side { width: 320px; flex-shrink: 0; display: flex; flex-direction: column; gap: 10px; }
      .ct-player {
        position: relative; width: 100%; max-width: 640px;
        aspect-ratio: 16/9; background: #000; border-radius: 10px; overflow: hidden;
        border: 1px solid #2d3139;
      }
      .ct-player iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
      .ct-side-item {
        display: flex; gap: 10px; text-decoration: none; color: inherit;
        background: rgba(31,35,43,0.95); border: 1px solid #2d3139; border-radius: 10px;
        padding: 8px; transition: border-color 0.15s;
      }
      .ct-side-item:hover { border-color: #e11d48; }
      .ct-side-item img { width: 120px; height: 68px; object-fit: cover; border-radius: 6px; flex-shrink: 0; background: #111; }
      .ct-side-title { color: #fff; font-size: 13px; font-weight: 700; line-height: 1.3; margin-bottom: 4px; }
      .ct-side-meta { color: #9ca3af; font-size: 11px; }
      @media (max-width: 900px) {
        .ct-layout { flex-direction: column; }
        .ct-side { width: 100%; }
        .ct-main { max-width: 100%; }
        .ct-player { max-width: 100%; }
      }
    </style>
    </head><body>
      ${navbar(sesion, nNotif)}
      <div class="main-container" style="max-width:1100px;">
        <div class="ct-layout">
          <div class="ct-main">
            <div class="ct-player">
              <iframe src="${embed}" title="${escapeHtml(v.titulo)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe>
            </div>
            <h1 style="color:white;margin:14px 0 8px 0;font-size:1.25rem;">${escapeHtml(v.titulo)}</h1>
            <div style="color:#9ca3af;font-size:13px;margin-bottom:12px;display:flex;flex-wrap:wrap;align-items:center;gap:10px;">
              <span>
                <span class="tag-category">${escapeHtml(v.categoria)}</span>
                · por <a href="/user/${escapeHtml(v.autor)}" class="author">@${escapeHtml(v.autor)}</a>
                · 👁 ${v.vistas || 0}
                · ⭐ ${v.likes || 0}
                ${fecha ? ' · ' + escapeHtml(fecha) : ''}
              </span>
              ${sesion.name
                ? `<a href="/like-video/${v.id}" class="btn-like ${(v.usuariosLike || []).includes(sesion.name) ? 'active' : ''}" style="font-size:13px;padding:6px 12px;background:#1f2937;border-radius:8px;border:1px solid #374151;text-decoration:none;color:#fff;">${(v.usuariosLike || []).includes(sesion.name) ? '★ Quitar like' : '☆ Like'} (${v.likes || 0})</a>`
                : `<a href="/login" class="btn-like" style="font-size:13px;padding:6px 12px;">☆ Like</a>`}
            </div>
            ${modLink}
            <div style="background:rgba(31,35,43,0.95);border:1px solid #2d3139;border-radius:12px;padding:16px;color:#e5e7eb;line-height:1.5;">
              ${escapeHtml(v.descripcion || 'Sin descripción.').replace(/\n/g, '<br>')}
            </div>
            ${del ? `<div style="margin-top:16px;">${del}</div>` : ''}
          </div>
          <aside class="ct-side">
            <div style="color:#fff;font-weight:800;font-size:14px;margin-bottom:4px;">Más videos</div>
            ${side}
          </aside>
        </div>
      </div>
      <script>
      (function(){
        function stopMusic() {
          try {
            var a = document.getElementById('cfm-bg-music');
            if (a) a.pause();
          } catch (e) {}
        }
        stopMusic();
        setTimeout(stopMusic, 300);
        setTimeout(stopMusic, 1000);
        setTimeout(stopMusic, 2000);
      })();
      </script>
    </body></html>`);
  } catch (e) {
    console.error(e);
    pageError(res, 500, 'Error', 'No se pudo cargar el video.', sesion, nNotif);
  }
});


app.get('/like-video/:id', async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.name) return res.redirect('/login');
  const id = parseInt(req.params.id, 10);
  if (!id) return res.redirect('/cooptube');
  const { data } = await supabase.from('videos').select('*').eq('id', id).single();
  if (!data) return res.redirect('/cooptube');
  let likes = data.likes || 0;
  let usuariosLike = data.usuarios_like || [];
  if (!Array.isArray(usuariosLike)) usuariosLike = [];
  const idx = usuariosLike.indexOf(sesion.name);
  if (idx === -1) {
    likes++;
    usuariosLike.push(sesion.name);
    if (data.autor !== sesion.name) {
      await crearNotif(data.autor, 'like', `@${sesion.name} dio like a tu video "${data.titulo}"`, `/cooptube/v/${id}`);
    }
  } else {
    likes = Math.max(0, likes - 1);
    usuariosLike.splice(idx, 1);
  }
  await supabase.from('videos').update({ likes, usuarios_like: usuariosLike }).eq('id', id);
  res.redirect('/cooptube/v/' + id);
});

app.get('/cooptube/borrar/:id'
, async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.name) return res.redirect('/login');
  const id = parseInt(req.params.id, 10);
  if (!id) return res.redirect('/cooptube');
  const { data } = await supabase.from('videos').select('autor').eq('id', id).single();
  if (!data) return res.redirect('/cooptube');
  if (data.autor !== sesion.name && !sesion.esMod) {
    return pageError(res, 403, 'Sin permisos', 'No podés borrar este video.', sesion, 0);
  }
  await supabase.from('videos').delete().eq('id', id);
  res.redirect('/cooptube');
});


app.use(async (req, res) => {
  try {
    const sesion = await getSesion(req);
    const nNotif = await countNotif(sesion.name);
    pageError(res, 404, 'Página no encontrada', 'No existe: ' + escapeHtml(req.path), sesion, nNotif);
  } catch (e) {
    pageError(res, 404, 'Página no encontrada', 'La ruta no existe.', null, 0);
  }
});

module.exports = app;
if (require.main === module) {
  app.listen(PORT, () => console.log('Local http://localhost:' + PORT));
}
