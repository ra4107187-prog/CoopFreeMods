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
      if (file.mimetype && file.mimetype.startsWith('image/')) return cb(null, true);
      return cb(new Error('Solo imagenes'));
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
    <span style="color:white;font-size:14px;">Hola,
      <a href="/user/${escapeHtml(sesion.name)}" style="color:white;font-weight:bold;text-decoration:none;">${escapeHtml(sesion.name)}</a>${modBadge}
    </span>
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
    <div class="brand"><a href="/"><img src="/public/logo.png" class="brand-logo" alt="Logo"></a></div>
    <div class="nav-links">
      <a href="/">Inicio</a>
      <a href="/mods">Mods</a>
      <a href="/top">⭐ Top 10</a>
      <a href="/foros">💬 Foros</a>
      <a href="/como-instalar">📖 Cómo instalar</a>
      ${mid}
      ${extra || ''}
      ${authLinks(sesion, nNotif || 0)}
    </div>
  </div>`;
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
              <p class="home-lead" style="font-size:14px;color:#9ca3af;">Proyecto iniciado por @Ellos (them) y continuado por la comunidad. Los mods se guardan en la nube y no se pierden al reiniciar.</p>
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
        </div>
      </div>
    </body></html>`);
  } catch (e) {
    console.error(e);
    res.status(500).send('Error');
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
      const t = !buscarTexto || mod.titulo.toLowerCase().includes(buscarTexto) || mod.descripcion.toLowerCase().includes(buscarTexto);
      const c = buscarCategoria === 'Todas' || mod.categoria === buscarCategoria;
      const v = buscarVersion === 'Todas' || mod.version === buscarVersion;
      return t && c && v;
    });
    const pg = paginateList(mods, req.query.page, 30);
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="icon" href="/public/icon.png" type="image/png"><title>Mods | Coop Free Mods</title>${estilosCSS}</head><body>
      ${navbar(sesion, nNotif)}
      <div class="main-container">
        <form action="/mods" method="GET" class="filter-bar">
          <input type="text" name="buscar" placeholder="Buscar mods..." value="${escapeHtml(req.query.buscar || '')}">
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
      <div class="discord-float-wrap">
        <a href="/discord" target="_blank" rel="noopener" class="discord-float" title="Unite al Discord">Discord</a>
      </div>
    </body></html>`);
  } catch (err) {
    console.error(err);
    res.status(500).send('<p class="error-msg">Error al cargar mods.</p>');
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
  } catch (e) { console.error(e); res.status(500).send('Error'); }
});

app.get('/favoritos', async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.name) return res.redirect('/login');
  const nNotif = await countNotif(sesion.name);
  const { data } = await supabase.from('mods').select('*').order('likes', { ascending: false });
  const mods = (data || []).map(mapMod).filter(m => (m.usuariosLike || []).includes(sesion.name));
  const pg = paginateList(mods, req.query.page, 30);
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="icon" href="/public/icon.png" type="image/png"><title>Favoritos | Coop Free Mods</title>${estilosCSS}</head><body>
    ${navbar(sesion, nNotif)}
    <div class="main-container"><h2>⭐ Mis favoritos (mods que me gustaron)</h2>
    <p style="color:#9ca3af;">${pg.total} mods · Página ${pg.page} de ${pg.totalPages}</p>
    <div class="grid">${renderModCards(pg.slice, sesion)}</div>
    ${renderPagination('/favoritos', pg.page, pg.totalPages)}
    </div></body></html>`);
});

app.get('/mis-mods', async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.name) return res.redirect('/login');
  const nNotif = await countNotif(sesion.name);
  const { data } = await supabase.from('mods').select('*').eq('autor', sesion.name).order('id', { ascending: false });
  const mods = (data || []).map(mapMod);
  const pg = paginateList(mods, req.query.page, 30);
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="icon" href="/public/icon.png" type="image/png"><title>Mis mods | Coop Free Mods</title>${estilosCSS}</head><body>
    ${navbar(sesion, nNotif)}
    <div class="main-container"><h2>📦 Mods publicados por mí</h2>
    <p style="color:#9ca3af;">${pg.total} mods · Página ${pg.page} de ${pg.totalPages}</p>
    <div class="grid">${renderModCards(pg.slice, sesion)}</div>
    ${renderPagination('/mis-mods', pg.page, pg.totalPages)}
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
    if (error || !data) return res.status(404).send('<h1>Mod no encontrado</h1>');
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
  } catch (e) { console.error(e); res.status(500).send('Error'); }
});

app.get('/delete-mod/:id', async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.name) return res.redirect('/login');
  const { data } = await supabase.from('mods').select('*').eq('id', parseInt(req.params.id)).single();
  if (!data) return res.redirect('/');
  if (data.autor !== sesion.name && !sesion.esMod) return res.send('Sin permisos.');
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
  if (c.usuario !== sesion.name && !sesion.esMod) return res.send('Sin permisos.');
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
      </div>
    </body></html>`);
  } catch (e) { console.error(e); res.status(500).send('Error'); }
});

app.get('/ban/:username', async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.esMod) return res.send('Solo moderadores.');
  if (req.params.username === MODERADOR) return res.send('No.');
  await supabase.from('usuarios').update({ banneado: true }).eq('usuario', req.params.username);
  res.redirect('/user/' + req.params.username);
});
app.get('/unban/:username', async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.esMod) return res.send('Solo moderadores.');
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
  if (sesion.banneado) return res.send('Cuenta baneada.');
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
        <input type="url" name="linkExterno" placeholder="https://drive.google.com/...">
        <p style="color:#9ca3af;font-size:12px;margin:-8px 0 12px;">Podés subir archivo, poner un link, o ambos. Hace falta al menos uno. Si el archivo pesa mucho y Vercel falla, usá solo el link.</p>
        <label>Capturas (hasta 4):</label>
        <input type="file" name="imagenesMod" accept="image/*" multiple>
        <button type="submit" class="btn-red" style="width:100%;">Publicar</button>
      </form>
    </div></body></html>`);
});

app.post('/publish', upload.fields([{ name: 'archivoMod', maxCount: 1 }, { name: 'imagenesMod', maxCount: 4 }]), async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.name || sesion.banneado) return res.redirect('/login');
  if (!rateLimit('publish:' + sesion.name, 3000)) return res.send('Espera un momento antes de publicar de nuevo. <a href="/publish">Volver</a>');
  try {
    const arc = req.files && req.files['archivoMod'] && req.files['archivoMod'][0];
    const imgs = (req.files && req.files['imagenesMod']) || [];
    const linkExterno = (req.body.linkExterno || '').trim();
    if (!arc && !linkExterno) {
      return res.send('Subí un archivo o poné un link de descarga. <a href="/publish">Volver</a>');
    }
    if (linkExterno && !/^https?:\/\//i.test(linkExterno)) {
      return res.send('El link debe empezar con http:// o https://. <a href="/publish">Volver</a>');
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
    res.status(500).send('Error: ' + e.message + ' <a href="/publish">Volver</a>');
  }
});

app.get('/edit-mod/:id', async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.name) return res.redirect('/login');
  const { data } = await supabase.from('mods').select('*').eq('id', parseInt(req.params.id)).single();
  const mod = mapMod(data);
  if (!mod || mod.autor !== sesion.name) return res.send('Sin permisos.');
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
  if (!mod || mod.autor !== sesion.name) return res.send('Sin permisos.');
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
    if (!mod || !mod.archivoPath) return res.status(404).send('No encontrado');
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
    res.status(500).send('Error al descargar');
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
    if (password.length < 6) return res.send('La contraseña debe tener al menos 6 caracteres. <a href="/register">Volver</a>');
    if (!usuario || usuario.length < 3) return res.send('Usuario inválido. <a href="/register">Volver</a>');
    const { data: existing } = await supabase.from('usuarios').select('id').eq('usuario', usuario).single();
    if (existing) return res.send('Ese usuario ya existe. <a href="/register">Volver</a>');
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
    if (!u) return res.send('Usuario o contraseña incorrectos. <a href="/login">Volver</a>');
    if (u.banneado) return res.send('Cuenta baneada. <a href="/">Inicio</a>');
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
        <a href="/" class="btn-red">Volver al inicio</a>
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
        <h2>1. Tené el juego base</h2>
        <p>Necesitás <b>SM64 Co-op DX</b> o <b>SM64 EX Co-op</b> ya instalado y funcionando en tu PC.</p>
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
        2. Abrí la carpeta del juego Co-op (donde está el ejecutable)<br>
        3. Buscá la carpeta de mods (suele llamarse <b>mods</b>, <b>dynos</b> o similar según el tipo)<br>
        4. Copiá ahí la carpeta o los archivos del mod<br>
        5. Reiniciá el juego si ya estaba abierto</p>
        <p style="color:#9ca3af;font-size:13px;margin-top:12px;">Cada mod puede traer un README con pasos exactos. Leelo si viene incluido.</p>
      </div>

      <div class="info-box">
        <h2>4. Según el tipo de mod</h2>
        <p>• <b>Character Select / Dynos</b> — suelen ir en carpetas de personajes o dynos<br>
        • <b>Movesets / Modifiers / Gamemodes</b> — a menudo en mods o scripts<br>
        • <b>Resources</b> — scripts LUA u otros recursos<br>
        • <b>Hangouts / Romhack</b> — pueden requerir pasos extra (leé la descripción del mod)</p>
      </div>

      <div class="info-box">
        <h2>5. Problemas frecuentes</h2>
        <p>• <b>No aparece el mod</b> — revisá que esté en la carpeta correcta y reiniciá el juego<br>
        • <b>El juego crashea</b> — probá sin otros mods, o mirá si es solo DX / solo EX / DX+EX<br>
        • <b>Archivo dañado</b> — volvé a descargarlo desde la web<br>
        • <b>Duda con un mod concreto</b> — comentá en la página del mod o preguntá en Discord</p>
      </div>

      <div class="info-box">
        <h2>Consejo</h2>
        <p>En la ficha de cada mod mirá <b>Versión</b> (DX, EX o DX + EX) y <b>Categoría</b> para saber si es compatible con tu juego y dónde va el archivo.</p>
      </div>

      <p style="text-align:center;margin:30px 0;">
        <a href="/" class="btn-red">Ver mods</a>
        <a href="/top" class="btn-blue" style="margin-left:10px;">Top 10</a>
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
  if (req.body.website) return res.status(400).send('Bot detectado.');
  if (req.body.human !== '1') return res.send('Marcá la casilla. <a href="/discord">Volver</a>');
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
    let q = supabase.from('foro_temas').select('*').order('fijado', { ascending: false }).order('updated_at', { ascending: false }).limit(100);
    if (cat !== 'Todas') q = q.eq('categoria', cat);
    const { data, error } = await q;
    if (error) throw error;
    const temas = data || [];
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
          <select name="categoria">${catOpts}</select>
          <button type="submit" class="btn-blue">Filtrar</button>
        </form>
        ${rows}
      </div>
    </body></html>`);
  } catch (e) {
    console.error(e);
    res.status(500).send('Error en foros. ¿Ejecutaste el SQL de foros en Supabase? <a href="/">Inicio</a>');
  }
});

app.get('/foros/nuevo', async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.name) return res.redirect('/login');
  if (sesion.banneado) return res.send('Cuenta baneada.');
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
  if (!rateLimit('foro-nuevo:' + sesion.name, 5000)) return res.send('Espera un momento. <a href="/foros">Volver</a>');
  const titulo = (req.body.titulo || '').trim();
  const contenido = (req.body.contenido || '').trim();
  const categoria = FORO_CATEGORIAS.includes(req.body.categoria) ? req.body.categoria : 'General';
  if (titulo.length < 3 || contenido.length < 3) return res.send('Título y mensaje muy cortos. <a href="/foros/nuevo">Volver</a>');
  const { data, error } = await supabase.from('foro_temas').insert({
    titulo, contenido, autor: sesion.name, categoria, vistas: 0
  }).select('id').single();
  if (error) { console.error(error); return res.status(500).send('Error al crear tema.'); }
  res.redirect('/foros/tema/' + data.id);
});

app.get('/foros/tema/:id', async (req, res) => {
  try {
    const sesion = await getSesion(req);
    const nNotif = await countNotif(sesion.name);
    const id = parseInt(req.params.id);
    const { data: tema, error } = await supabase.from('foro_temas').select('*').eq('id', id).single();
    if (error || !tema) return res.status(404).send('Tema no encontrado. <a href="/foros">Foros</a>');
    // Contar visita 1 vez por sesión (cookie)
    const seenKey = 'foro_visto_' + id;
    if (!req.cookies || !req.cookies[seenKey]) {
      await supabase.from('foro_temas').update({ vistas: (tema.vistas || 0) + 1 }).eq('id', id);
      tema.vistas = (tema.vistas || 0) + 1;
      res.cookie(seenKey, '1', { maxAge: 1000 * 60 * 60 * 12, httpOnly: true, sameSite: 'lax' });
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
              <p style="color:#9ca3af;font-size:13px;margin:0;">por <a href="/user/${escapeHtml(tema.autor)}" class="author">@${escapeHtml(tema.autor)}</a> · ${fecha} · 👁 ${(tema.vistas||0)+1}</p>
            </div>
            <div>${modBtns}</div>
          </div>
          <p style="margin-top:16px;color:#ced4da;">${escapeHtml(tema.contenido)}</p>
        </div>
        <div class="info-box"><h2>Respuestas (${(respuestas||[]).length})</h2>${repsHtml}</div>
        <div class="info-box"><h2>Responder</h2>${replyBox}</div>
      </div>
    </body></html>`);
  } catch (e) { console.error(e); res.status(500).send('Error'); }
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
  if (tema.autor !== sesion.name && !sesion.esMod) return res.send('Sin permisos.');
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
  if (r.autor !== sesion.name && !sesion.esMod) return res.send('Sin permisos.');
  await supabase.from('foro_respuestas').delete().eq('id', id);
  res.redirect('/foros/tema/' + (temaId || r.tema_id));
});

app.get('/foros/pin/:id', async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.esMod) return res.send('Solo moderadores.');
  const id = parseInt(req.params.id);
  const { data: tema } = await supabase.from('foro_temas').select('fijado').eq('id', id).single();
  if (tema) await supabase.from('foro_temas').update({ fijado: !tema.fijado }).eq('id', id);
  res.redirect('/foros/tema/' + id);
});

app.get('/foros/cerrar/:id', async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.esMod) return res.send('Solo moderadores.');
  const id = parseInt(req.params.id);
  const { data: tema } = await supabase.from('foro_temas').select('cerrado').eq('id', id).single();
  if (tema) await supabase.from('foro_temas').update({ cerrado: !tema.cerrado }).eq('id', id);
  res.redirect('/foros/tema/' + id);
});


module.exports = app;
if (require.main === module) {
  app.listen(PORT, () => console.log('Local http://localhost:' + PORT));
}
