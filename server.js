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
    <span style="color:#9ca3af;font-size:14px;">Hola,
      <a href="/user/${escapeHtml(sesion.name)}" style="color:white;font-weight:bold;text-decoration:none;">${escapeHtml(sesion.name)}</a>${modBadge}
    </span>
    <a href="/logout" style="color:#9ca3af;">Salir</a>`;
}
function leftUserLinks(sesion, nNotif) {
  if (!sesion.name) return '';
  const badge = nNotif > 0 ? `<span class="notif-badge">${nNotif}</span>` : '';
  return `<a href="/mis-mods">Mis mods</a>
    <a href="/favoritos">Favoritos</a>
    <a href="/notificaciones">🔔${badge}</a>`;
}
function navbar(sesion, nNotif, extra) {
  const mid = sesion.name ? leftUserLinks(sesion, nNotif || 0) : '';
  return `<div class="navbar">
    <div class="brand"><a href="/"><img src="/public/logo.png" class="brand-logo" alt="Logo"></a></div>
    <div class="nav-links">
      <a href="/">Inicio</a>
      <a href="/top">⭐ Top 10</a>
      ${mid}
      ${extra || ''}
      ${authLinks(sesion, nNotif || 0)}
    </div>
  </div>`;
}
function renderModCards(mods, sesion) {
  if (!mods.length) return '<p style="color:#9ca3af;grid-column:1/-1;text-align:center;padding:40px;">No se encontraron mods.</p>';
  return mods.map(mod => {
    const yaLike = sesion.name ? mod.usuariosLike.includes(sesion.name) : false;
    const claseLike = yaLike ? 'btn-like active' : 'btn-like';
    const numCom = (mod.comentarios || []).filter(c => !c.parentId).length;
    const foto = mod.rutasImagenes && mod.rutasImagenes[0];
    const img = foto ? `<img src="${escapeHtml(foto)}">` : '<div style="color:#555;font-size:40px;">📦</div>';
    // Toda la zona superior (imagen + título + descripción) es clickeable
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
        <div style="display:flex;gap:6px;align-items:center;">
          <a href="/like/${mod.id}" class="${claseLike}">⭐ ${mod.likes}</a>
          <span>💬 ${numCom}</span>
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
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="icon" href="/public/icon.png" type="image/png"><title>Coop Free Mods</title>${estilosCSS}</head><body>
      ${navbar(sesion, nNotif)}
      <div class="main-container">
        <form action="/" method="GET" class="filter-bar">
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
        ${renderPagination('/', pg.page, pg.totalPages, { buscar: req.query.buscar || '', version: buscarVersion === 'Todas' ? '' : buscarVersion, categoria: buscarCategoria === 'Todas' ? '' : buscarCategoria })}
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
            <p style="margin:0 0 10px 0;color:#9ca3af;font-size:12px;">⬇️ ${mod.descargas} descargas</p>
          </div>
        </a>
        <div class="card-footer" style="padding:12px 15px;margin:0;">
          <span>por <a href="/user/${escapeHtml(mod.autor)}" class="author">@${escapeHtml(mod.autor)}</a></span>
          <span>⭐ ${mod.likes}</span>
        </div>
      </div>`;
    }).join('') || '<p style="color:#9ca3af;grid-column:1/-1;text-align:center;padding:40px;">Sin datos.</p>';
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="icon" href="/public/icon.png" type="image/png"><title>Top 10</title>${estilosCSS}</head><body>
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
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="icon" href="/public/icon.png" type="image/png"><title>Favoritos</title>${estilosCSS}</head><body>
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
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="icon" href="/public/icon.png" type="image/png"><title>Mis mods</title>${estilosCSS}</head><body>
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
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="icon" href="/public/icon.png" type="image/png"><title>Notificaciones</title>${estilosCSS}</head><body>
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
          <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">${escapeHtml(r.texto)}</p></div>`;
      }).join('');
      return `<div class="comment-box"><a href="/user/${escapeHtml(c.usuario)}" class="author">@${escapeHtml(c.usuario)}</a> ${del}
        <p style="margin:5px 0 0;font-size:14px;color:#ced4da;">${escapeHtml(c.texto)}</p>${replies}${replyForm}</div>`;
    }).join('') || '<p style="color:#9ca3af;">No hay comentarios.</p>';

    const canEdit = sesion.name === mod.autor;
    const canDelete = canEdit || sesion.esMod;
    const bEdit = canEdit ? `<a href="/edit-mod/${mod.id}" class="btn-blue" style="font-size:13px;padding:6px 12px;">✏️ Editar</a>` : '';
    const bDel = canDelete ? `<a href="/delete-mod/${mod.id}" class="btn-delete" style="padding:8px 12px;" onclick="return confirm('¿Eliminar este mod?')">🗑️ Eliminar mod</a>` : '';
    const cajaCom = (sesion.name && !sesion.banneado)
      ? `<form action="/comment/${mod.id}" method="POST"><textarea name="ctext" placeholder="Escribe un comentario..." rows="2" required minlength="1"></textarea><button type="submit" class="btn-blue">💬 Comentar</button></form>`
      : sesion.banneado ? '<p style="color:#f87171;">Cuenta baneada: no puedes comentar.</p>'
      : '<p><a href="/login" style="color:#ff3333;">Inicia sesión</a> para comentar.</p>';

    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="icon" href="/public/icon.png" type="image/png"><title>${escapeHtml(mod.titulo)}</title>${estilosCSS}</head><body>
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
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="icon" href="/public/icon.png" type="image/png"><title>@${escapeHtml(user.usuario)}</title>${estilosCSS}</head><body>
      ${navbar(sesion, nNotif)}
      <div class="main-container">
        <div class="profile-header">
          <div>
            <h1 style="margin:0;color:white;">@${escapeHtml(user.usuario)} ${modTag} ${banTag}</h1>
            <p style="color:#ced4da;margin:10px 0;">${escapeHtml(user.descripcion)}</p>
            <p style="color:#9ca3af;font-size:12px;margin:0;">Desde: ${escapeHtml(user.fechaRegistro)} · 👥 ${(user.seguidores||[]).length} seguidores</p>
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
  let { data: target } = await supabase.from('usuarios').select('*').eq('usuario', targetName).single();
  if (!target) {
    await supabase.from('usuarios').insert({ usuario: targetName, password: '!', descripcion: 'Creador', fecha_registro: '2026', seguidores: [sesion.name] });
  } else {
    let seg = target.seguidores || [];
    const idx = seg.indexOf(sesion.name);
    if (idx === -1) seg.push(sesion.name); else seg.splice(idx, 1);
    await supabase.from('usuarios').update({ seguidores: seg }).eq('usuario', targetName);
  }
  res.redirect('/user/' + targetName);
});

app.get('/publish', async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.name) return res.redirect('/login');
  if (sesion.banneado) return res.send('Cuenta baneada.');
  const nNotif = await countNotif(sesion.name);
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="icon" href="/public/icon.png" type="image/png"><title>Publicar</title>${estilosCSS}</head><body>
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
        <label>Archivo (.zip / .lua, máx 10 MB):</label><input type="file" name="archivoMod" required>
        <label>Capturas (hasta 4):</label><input type="file" name="imagenesMod" accept="image/*" multiple>
        <button type="submit" class="btn-red" style="width:100%;">Publicar</button>
      </form>
    </div></body></html>`);
});

app.post('/publish', upload.fields([{ name: 'archivoMod', maxCount: 1 }, { name: 'imagenesMod', maxCount: 4 }]), async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.name || sesion.banneado) return res.redirect('/login');
  if (!rateLimit('publish:' + sesion.name, 3000)) return res.send('Espera un momento antes de publicar de nuevo. <a href="/publish">Volver</a>');
  try {
    const arc = req.files['archivoMod'] && req.files['archivoMod'][0];
    const imgs = req.files['imagenesMod'] || [];
    if (!arc) return res.send('Falta el archivo.');
    const ts = Date.now();
    const filePath = `${sesion.name}/${ts}-${arc.originalname}`;
    await uploadToStorage('mods-files', filePath, arc.buffer, arc.mimetype || 'application/octet-stream');
    const rutas = [];
    for (let i = 0; i < imgs.length; i++) {
      const img = imgs[i];
      const p = `${sesion.name}/${ts}-img${i}-${img.originalname}`;
      rutas.push(await uploadToStorage('mods-images', p, img.buffer, img.mimetype));
    }
    const { error } = await supabase.from('mods').insert({
      titulo: req.body.titulo, descripcion: req.body.descripcion, autor: sesion.name,
      version: req.body.version, categoria: req.body.categoria,
      nombre_archivo_real: arc.originalname, archivo_path: filePath, rutas_imagenes: rutas,
      descargas: 0, likes: 0, usuarios_like: [], comentarios: [], historial_actualizaciones: [],
      fecha_creacion: new Date().toLocaleDateString('es-ES'),
      peso_archivo: (arc.size / (1024 * 1024)).toFixed(1) + ' MB'
    });
    if (error) throw error;
    res.redirect('/');
  } catch (e) { console.error(e); res.status(500).send('Error: ' + e.message); }
});

app.get('/edit-mod/:id', async (req, res) => {
  const sesion = await getSesion(req);
  if (!sesion.name) return res.redirect('/login');
  const { data } = await supabase.from('mods').select('*').eq('id', parseInt(req.params.id)).single();
  const mod = mapMod(data);
  if (!mod || mod.autor !== sesion.name) return res.send('Sin permisos.');
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="icon" href="/public/icon.png" type="image/png"><title>Editar</title>${estilosCSS}</head><body>
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
    const { data: urlData } = supabase.storage.from('mods-files').getPublicUrl(mod.archivoPath);
    res.redirect(urlData.publicUrl);
  } catch (e) { res.status(500).send('Error'); }
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
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="icon" href="/public/icon.png" type="image/png">${estilosCSS}</head><body>
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
      fecha_registro: new Date().getFullYear().toString(), seguidores: [], banneado: false
    });
    if (error) throw error;
    res.cookie('usuarioSesion', usuario, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.redirect('/');
  } catch (e) { console.error(e); res.send('Error al registrar. <a href="/register">Volver</a>'); }
});

app.get('/login', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="icon" href="/public/icon.png" type="image/png">${estilosCSS}</head><body>
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

app.get('/logout', (req, res) => { res.clearCookie('usuarioSesion'); res.redirect('/'); });

module.exports = app;
if (require.main === module) {
  app.listen(PORT, () => console.log('Local http://localhost:' + PORT));
}
