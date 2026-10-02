const express = require('express');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const path = require('path');
const bcrypt = require('bcryptjs');
const { supabase } = require('./lib/supabase');
const { estilosCSS } = require('./lib/styles');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/public', express.static(path.join(__dirname, 'public')));

// Multer en memoria (los archivos van a Supabase Storage, no al disco)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'archivoMod') {
      const ext = path.extname(file.originalname).toLowerCase();
      if (['.zip', '.7z', '.rar', '.lua'].includes(ext)) return cb(null, true);
      return cb(new Error('Solo se aceptan .zip, .7z, .rar o .lua'));
    }
    if (file.fieldname === 'imagenesMod') {
      if (file.mimetype.startsWith('image/')) return cb(null, true);
      return cb(new Error('Solo se aceptan imágenes'));
    }
    cb(null, true);
  }
});

// ---------- Helpers ----------
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mapMod(row) {
  if (!row) return null;
  return {
    id: row.id,
    titulo: row.titulo,
    descripcion: row.descripcion,
    autor: row.autor,
    version: row.version,
    categoria: row.categoria,
    nombreArchivoReal: row.nombre_archivo_real,
    archivoPath: row.archivo_path,
    rutasImagenes: row.rutas_imagenes || [],
    descargas: row.descargas || 0,
    likes: row.likes || 0,
    usuariosLike: row.usuarios_like || [],
    comentarios: row.comentarios || [],
    historialActualizaciones: row.historial_actualizaciones || [],
    fechaCreacion: row.fecha_creacion,
    pesoArchivo: row.peso_archivo
  };
}

function mapUser(row) {
  if (!row) return null;
  return {
    usuario: row.usuario,
    descripcion: row.descripcion,
    fechaRegistro: row.fecha_registro,
    seguidores: row.seguidores || []
  };
}

async function uploadToStorage(bucket, filePath, buffer, contentType) {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, buffer, { contentType, upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}

function authLinks(sesionUsuario) {
  if (sesionUsuario) {
    return `<a href="/publish" class="btn-red">+ Publicar mod</a>
      <span style="color:#9ca3af;font-size:14px;margin-left:10px;">Hola,
      <a href="/user/${escapeHtml(sesionUsuario)}" style="color:#ff3333;font-weight:bold;text-decoration:none;">${escapeHtml(sesionUsuario)}</a></span>
      <a href="/logout" style="color:#9ca3af;margin-left:10px;">Salir</a>`;
  }
  return `<a href="/login" style="color:#ced4da;text-decoration:none;font-size:14px;">Entrar</a>
    <a href="/register" class="btn-red">Registrarse</a>`;
}

function navbar(sesionUsuario, extraLinks = '') {
  return `<div class="navbar">
    <div class="brand"><a href="/"><img src="/public/logo.png" class="brand-logo" alt="Logo"></a></div>
    <div class="nav-links">
      <a href="/">Inicio</a>
      <a href="/top">⭐ Top 10</a>
      ${extraLinks}
      ${authLinks(sesionUsuario)}
    </div>
  </div>`;
}

// ---------- RUTAS ----------

app.get('/', async (req, res) => {
  try {
    const sesionUsuario = req.cookies.usuarioSesion || null;
    const buscarTexto = (req.query.buscar || '').toLowerCase();
    const buscarCategoria = req.query.categoria || 'Todas';
    const buscarVersion = req.query.version || 'Todas';

    let query = supabase.from('mods').select('*').order('id', { ascending: false });
    const { data, error } = await query;
    if (error) throw error;

    let mods = (data || []).map(mapMod).filter(mod => {
      const coincideTexto = !buscarTexto ||
        mod.titulo.toLowerCase().includes(buscarTexto) ||
        mod.descripcion.toLowerCase().includes(buscarTexto);
      const coincideCategoria = buscarCategoria === 'Todas' || mod.categoria === buscarCategoria;
      const coincideVersion = buscarVersion === 'Todas' || mod.version === buscarVersion;
      return coincideTexto && coincideCategoria && coincideVersion;
    });

    let tarjetasHTML = '';
    if (mods.length === 0) {
      tarjetasHTML = '<p style="color:#9ca3af;grid-column:1/-1;text-align:center;padding:40px;">No se encontraron mods.</p>';
    }

    mods.forEach(mod => {
      const yaTieneLike = sesionUsuario ? mod.usuariosLike.includes(sesionUsuario) : false;
      const claseLike = yaTieneLike ? 'btn-like active' : 'btn-like';
      const numComentarios = mod.comentarios ? mod.comentarios.length : 0;
      const fotoPortada = mod.rutasImagenes && mod.rutasImagenes.length > 0 ? mod.rutasImagenes[0] : '';
      const imagenHTML = fotoPortada
        ? `<img src="${escapeHtml(fotoPortada)}">`
        : '<div style="color:#555;font-size:40px;">📦</div>';

      tarjetasHTML += `<div class="card">
        <div class="card-img-box">${imagenHTML}</div>
        <div class="card-content">
          <div class="tags">
            <span class="tag-version">${escapeHtml(mod.version)}</span>
            <span class="tag-category">${escapeHtml(mod.categoria)}</span>
          </div>
          <h3><a href="/mod/${mod.id}">${escapeHtml(mod.titulo)}</a></h3>
          <p>${escapeHtml(mod.descripcion)}</p>
          <div class="card-footer">
            <span>por <a href="/user/${escapeHtml(mod.autor)}" class="author">@${escapeHtml(mod.autor)}</a></span>
            <div style="display:flex;gap:6px;align-items:center;">
              <a href="/like/${mod.id}" class="${claseLike}">⭐ ${mod.likes}</a>
              <span>💬 ${numComentarios}</span>
            </div>
          </div>
        </div>
      </div>`;
    });

    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Coop Free Mods</title>${estilosCSS}</head><body>
      ${navbar(sesionUsuario)}
      <div class="main-container">
        <form action="/" method="GET" style="background-color:rgba(31,35,43,0.9);padding:15px;border-radius:12px;display:flex;gap:10px;align-items:center;border:1px solid #2d3139;margin-bottom:25px;flex-wrap:wrap;">
          <input type="text" name="buscar" placeholder="Buscar mods..." style="background:#161920;border:1px solid #374151;color:white;padding:8px 12px;border-radius:6px;flex:1;min-width:150px;" value="${escapeHtml(req.query.buscar || '')}">
          <select name="version" style="background:#161920;border:1px solid #374151;color:white;padding:8px 12px;border-radius:6px;width:140px;">
            <option value="Todas">Todas las versiones</option>
            <option value="SM64 Co-op DX" ${buscarVersion === 'SM64 Co-op DX' ? 'selected' : ''}>SM64 Co-op DX</option>
            <option value="SM64 EX Co-op" ${buscarVersion === 'SM64 EX Co-op' ? 'selected' : ''}>SM64 EX Co-op</option>
          </select>
          <select name="categoria" style="background:#161920;border:1px solid #374151;color:white;padding:8px 12px;border-radius:6px;width:170px;">
            <option value="Todas">Todas las categorías</option>
            <option value="Personajes" ${buscarCategoria === 'Personajes' ? 'selected' : ''}>👤 Personajes</option>
            <option value="Jugabilidad" ${buscarCategoria === 'Jugabilidad' ? 'selected' : ''}>🎮 Jugabilidad</option>
            <option value="HUD / Texturas" ${buscarCategoria === 'HUD / Texturas' ? 'selected' : ''}>🎨 HUD / Texturas</option>
            <option value="Mapas / Niveles" ${buscarCategoria === 'Mapas / Niveles' ? 'selected' : ''}>🗺️ Mapas / Niveles</option>
            <option value="Scripts LUA" ${buscarCategoria === 'Scripts LUA' ? 'selected' : ''}>📜 Scripts LUA</option>
            <option value="Otros" ${buscarCategoria === 'Otros' ? 'selected' : ''}>📦 Otros</option>
          </select>
          <button type="submit" class="btn-blue">Filtrar</button>
        </form>
        <p style="color:#9ca3af;margin-bottom:20px;font-weight:bold;">${mods.length} mods encontrados</p>
        <div class="grid">${tarjetasHTML}</div>
      </div>
    </body></html>`);
  } catch (err) {
    console.error(err);
    res.status(500).send('<p class="error-msg">Error al cargar mods. Revisa la conexión a Supabase.</p>');
  }
});

app.get('/top', async (req, res) => {
  try {
    const sesionUsuario = req.cookies.usuarioSesion || null;
    const buscarCategoria = req.query.categoria || 'Todas';
    const buscarVersion = req.query.version || 'Todas';

    const { data, error } = await supabase.from('mods').select('*').order('descargas', { ascending: false }).limit(50);
    if (error) throw error;

    let mods = (data || []).map(mapMod).filter(mod => {
      const coincideCategoria = buscarCategoria === 'Todas' || mod.categoria === buscarCategoria;
      const coincideVersion = buscarVersion === 'Todas' || mod.version === buscarVersion;
      return coincideCategoria && coincideVersion;
    }).slice(0, 10);

    let tarjetasHTML = '';
    if (mods.length === 0) {
      tarjetasHTML = '<p style="color:#9ca3af;grid-column:1/-1;text-align:center;padding:40px;">No hay descargas registradas en este filtro.</p>';
    }

    mods.forEach((mod, index) => {
      const fotoPortada = mod.rutasImagenes && mod.rutasImagenes.length > 0 ? mod.rutasImagenes[0] : '';
      const imagenHTML = fotoPortada
        ? `<img src="${escapeHtml(fotoPortada)}">`
        : '<div style="color:#555;font-size:40px;">📦</div>';

      tarjetasHTML += `<div class="card">
        <div class="card-img-box">${imagenHTML}</div>
        <div class="card-content">
          <div style="margin-bottom:10px;"><span class="top-badge">#${index + 1}</span><span class="tag-version">${escapeHtml(mod.version)}</span></div>
          <h3><a href="/mod/${mod.id}">${escapeHtml(mod.titulo)}</a></h3>
          <p style="margin:0 0 10px 0; color:#9ca3af; font-size:12px;">⬇️ ${mod.descargas} descargas</p>
          <div class="card-footer">
            <span>por <a href="/user/${escapeHtml(mod.autor)}" class="author">@${escapeHtml(mod.autor)}</a></span>
            <span>⭐ ${mod.likes}</span>
          </div>
        </div>
      </div>`;
    });

    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Top 10 Mods</title>${estilosCSS}</head><body>
      ${navbar(sesionUsuario, '<a href="/top" style="color:white;border-bottom:2px solid #ff3333;padding-bottom:4px;">⭐ Top 10</a>')}
      <div class="main-container">
        <h2>🏆 Top 10 Mods más Descargados</h2>
        <form action="/top" method="GET" style="background-color:rgba(31,35,43,0.9);padding:15px;border-radius:12px;display:flex;gap:10px;align-items:center;border:1px solid #2d3139;margin-bottom:25px;flex-wrap:wrap;">
          <select name="version" style="background:#161920;border:1px solid #374151;color:white;padding:8px 12px;border-radius:6px;width:140px;">
            <option value="Todas">Todas las versiones</option>
            <option value="SM64 Co-op DX">SM64 Co-op DX</option>
            <option value="SM64 EX Co-op">SM64 EX Co-op</option>
          </select>
          <select name="categoria" style="background:#161920;border:1px solid #374151;color:white;padding:8px 12px;border-radius:6px;width:170px;">
            <option value="Todas">Todas las categorías</option>
            <option value="Personajes">👤 Personajes</option>
            <option value="Jugabilidad">🎮 Jugabilidad</option>
            <option value="HUD / Texturas">🎨 HUD / Texturas</option>
            <option value="Mapas / Niveles">🗺️ Mapas / Niveles</option>
            <option value="Scripts LUA">📜 Scripts LUA</option>
            <option value="Otros">📦 Otros</option>
          </select>
          <button type="submit" class="btn-blue">Ver Ranking</button>
        </form>
        <div class="grid">${tarjetasHTML}</div>
      </div>
    </body></html>`);
  } catch (err) {
    console.error(err);
    res.status(500).send('<p class="error-msg">Error al cargar el ranking.</p>');
  }
});

app.get('/mod/:id', async (req, res) => {
  try {
    const sesionUsuario = req.cookies.usuarioSesion || null;
    const { data, error } = await supabase.from('mods').select('*').eq('id', parseInt(req.params.id)).single();
    if (error || !data) return res.status(404).send('<h1>Mod no encontrado</h1>');
    const mod = mapMod(data);

    let fotosHTML = '';
    (mod.rutasImagenes || []).forEach(url => {
      if (url) fotosHTML += `<div class="mod-gallery-preview"><img src="${escapeHtml(url)}"></div>`;
    });

    let updatesHTML = '';
    if (mod.historialActualizaciones && mod.historialActualizaciones.length > 0) {
      mod.historialActualizaciones.forEach(up => {
        updatesHTML += `<div class="changelog-item"><b>Versión ${escapeHtml(up.version)}</b> (${escapeHtml(up.fecha)}): <br>${escapeHtml(up.notas)}</div>`;
      });
    } else {
      updatesHTML = '<p style="color:#9ca3af;font-size:13px;margin:0;">No hay actualizaciones registradas.</p>';
    }

    let comentariosHTML = '';
    if (mod.comentarios && mod.comentarios.length > 0) {
      mod.comentarios.forEach(com => {
        comentariosHTML += `<div style="background:#161920;border:1px solid #2d3139;border-radius:8px;padding:12px;margin-bottom:10px;">
          <a href="/user/${escapeHtml(com.usuario)}" class="author">@${escapeHtml(com.usuario)}</a>
          <p style="margin:5px 0 0 0;font-size:14px;color:#ced4da;">${escapeHtml(com.texto)}</p>
        </div>`;
      });
    } else {
      comentariosHTML = '<p style="color:#9ca3af;">No hay comentarios todavía.</p>';
    }

    const bEdit = (sesionUsuario === mod.autor)
      ? `<a href="/edit-mod/${mod.id}" class="btn-blue" style="font-size:13px;padding:6px 12px;">✏️ Editar / Actualizar</a>`
      : '';
    const cajaComentarios = sesionUsuario
      ? `<form action="/comment/${mod.id}" method="POST"><textarea name="ctext" placeholder="Escribe un comentario público..." rows="2" required></textarea><button type="submit" class="btn-blue">💬 Comentar</button></form>`
      : '<p><a href="/login" style="color:#ff3333;">Inicia sesión</a> para comentar.</p>';

    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(mod.titulo)}</title>${estilosCSS}</head><body>
      ${navbar(sesionUsuario, '<a href="/">Volver al Inicio</a>')}
      <div class="main-container">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap;gap:15px;">
          <div>
            <h1>${escapeHtml(mod.titulo)}</h1>
            <p style="margin:0;color:#9ca3af;">Creado por <a href="/user/${escapeHtml(mod.autor)}" class="author">@${escapeHtml(mod.autor)}</a></p>
          </div>
          <div style="display:flex;gap:10px;align-items:center;">
            <a href="/download/${mod.id}" class="btn-red" style="font-size:16px;padding:12px 25px;">⬇️ Descargar</a>
            ${bEdit}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:25px;">
          <div class="info-box">
            <h2>Descripción</h2>
            <p>${escapeHtml(mod.descripcion)}</p>
            ${fotosHTML}
          </div>
          <div>
            <div class="info-box">
              <h2>Detalles Técnicos</h2>
              <table class="meta-table">
                <tr><td>Versión:</td><td>${escapeHtml(mod.version)}</td></tr>
                <tr><td>Categoría:</td><td>${escapeHtml(mod.categoria)}</td></tr>
                <tr><td>Publicado:</td><td>${escapeHtml(mod.fechaCreacion || 'Reciente')}</td></tr>
                <tr><td>Peso:</td><td>${escapeHtml(mod.pesoArchivo || 'Desconocido')}</td></tr>
                <tr><td>Descargas:</td><td>${mod.descargas}</td></tr>
              </table>
            </div>
            <div class="info-box"><h2>🔄 Historial de Cambios</h2>${updatesHTML}</div>
          </div>
        </div>
        <div class="info-box" style="margin-top:25px;">
          <h2>💬 Comentarios</h2>
          <div style="margin-bottom:20px;">${comentariosHTML}</div>
          ${cajaComentarios}
        </div>
      </div>
    </body></html>`);
  } catch (err) {
    console.error(err);
    res.status(500).send('<p class="error-msg">Error al cargar el mod.</p>');
  }
});

app.get('/user/:username', async (req, res) => {
  try {
    const sesionUsuario = req.cookies.usuarioSesion || null;
    const username = req.params.username;

    let { data: userRow } = await supabase.from('usuarios').select('*').eq('usuario', username).single();
    const user = userRow
      ? mapUser(userRow)
      : { usuario: username, descripcion: 'Desarrollador de la comunidad.', fechaRegistro: '2026', seguidores: [] };

    const { data: modsData } = await supabase.from('mods').select('*').eq('autor', username).order('id', { ascending: false });
    const userMods = (modsData || []).map(mapMod);

    let tarjetasHTML = '';
    userMods.forEach(mod => {
      tarjetasHTML += `<div class="card"><div class="card-content">
        <h3><a href="/mod/${mod.id}">${escapeHtml(mod.titulo)}</a></h3>
        <p>${escapeHtml(mod.descripcion)}</p>
        <span class="tag-version">${escapeHtml(mod.version)}</span>
      </div></div>`;
    });
    if (userMods.length === 0) {
      tarjetasHTML = '<p style="color:#9ca3af;">Este creador no ha publicado ningún mod todavía.</p>';
    }

    const yaSigue = sesionUsuario ? (user.seguidores || []).includes(sesionUsuario) : false;
    let bFollow = '';
    if (sesionUsuario && sesionUsuario !== user.usuario) {
      bFollow = `<a href="/follow/${escapeHtml(user.usuario)}" class="btn-red" style="background:${yaSigue ? '#4b5563' : '#ff3333'};">${yaSigue ? 'Unfollow' : '👤 Seguir'}</a>`;
    }

    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Perfil de ${escapeHtml(user.usuario)}</title>${estilosCSS}</head><body>
      ${navbar(sesionUsuario)}
      <div class="main-container">
        <div class="profile-header">
          <div>
            <h1 style="margin:0;color:white;">@${escapeHtml(user.usuario)}</h1>
            <p style="color:#ced4da;margin:10px 0;">${escapeHtml(user.descripcion)}</p>
            <p style="color:#9ca3af;font-size:12px;margin:0;">Miembro desde: ${escapeHtml(user.fechaRegistro)} | 👥 ${(user.seguidores || []).length} seguidores</p>
          </div>
          ${bFollow}
        </div>
        <h2>📦 Mods creados por este usuario</h2>
        <div class="grid">${tarjetasHTML}</div>
      </div>
    </body></html>`);
  } catch (err) {
    console.error(err);
    res.status(500).send('<p class="error-msg">Error al cargar el perfil.</p>');
  }
});

app.get('/follow/:username', async (req, res) => {
  const sesionUsuario = req.cookies.usuarioSesion;
  if (!sesionUsuario) return res.redirect('/login');

  try {
    const targetName = req.params.username;
    let { data: target } = await supabase.from('usuarios').select('*').eq('usuario', targetName).single();

    if (!target) {
      await supabase.from('usuarios').insert({
        usuario: targetName,
        password: '!',
        descripcion: 'Creador',
        fecha_registro: '2026',
        seguidores: [sesionUsuario]
      });
    } else {
      let seguidores = target.seguidores || [];
      const idx = seguidores.indexOf(sesionUsuario);
      if (idx === -1) seguidores.push(sesionUsuario);
      else seguidores.splice(idx, 1);
      await supabase.from('usuarios').update({ seguidores }).eq('usuario', targetName);
    }
    res.redirect(`/user/${targetName}`);
  } catch (err) {
    console.error(err);
    res.redirect(`/user/${req.params.username}`);
  }
});

app.get('/publish', (req, res) => {
  if (!req.cookies.usuarioSesion) return res.redirect('/login');
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Publicar</title>${estilosCSS}</head><body>
    <div class="form-box">
      <h2>🚀 Publicar Mod</h2>
      <form action="/publish" method="POST" enctype="multipart/form-data">
        <label>Nombre del Mod:</label><input type="text" name="titulo" required>
        <label>Versión del emulador:</label>
        <select name="version">
          <option value="SM64 Co-op DX">SM64 Co-op DX</option>
          <option value="SM64 EX Co-op">SM64 EX Co-op</option>
        </select>
        <label>Categoría:</label>
        <select name="categoria">
          <option value="Personajes">👤 Personajes</option>
          <option value="Jugabilidad">🎮 Jugabilidad</option>
          <option value="HUD / Texturas">🎨 HUD / Texturas</option>
          <option value="Mapas / Niveles">🗺️ Mapas / Niveles</option>
          <option value="Scripts LUA">📜 Scripts LUA</option>
          <option value="Otros">📦 Otros</option>
        </select>
        <label>Descripción:</label><textarea name="descripcion" required></textarea>
        <label>Archivo del Mod (.zip / .lua):</label><input type="file" name="archivoMod" required>
        <label>Capturas (hasta 4 imágenes):</label><input type="file" name="imagenesMod" accept="image/*" multiple>
        <button type="submit" class="btn-red" style="width:100%;">Publicar Mod</button>
      </form>
    </div>
  </body></html>`);
});

app.post('/publish', upload.fields([
  { name: 'archivoMod', maxCount: 1 },
  { name: 'imagenesMod', maxCount: 4 }
]), async (req, res) => {
  const sesionUsuario = req.cookies.usuarioSesion;
  if (!sesionUsuario) return res.redirect('/login');

  try {
    const arc = req.files['archivoMod'] ? req.files['archivoMod'][0] : null;
    const imgs = req.files['imagenesMod'] || [];
    if (!arc) return res.send('Falta el archivo del mod.');

    const ts = Date.now();
    const filePath = `${sesionUsuario}/${ts}-${arc.originalname}`;
    const publicUrl = await uploadToStorage(
      'mods-files',
      filePath,
      arc.buffer,
      arc.mimetype || 'application/octet-stream'
    );

    const rutasDeFotos = [];
    for (let i = 0; i < imgs.length; i++) {
      const img = imgs[i];
      const imgPath = `${sesionUsuario}/${ts}-img${i}-${img.originalname}`;
      const imgUrl = await uploadToStorage('mods-images', imgPath, img.buffer, img.mimetype);
      rutasDeFotos.push(imgUrl);
    }

    const peso = ((arc.size / (1024 * 1024)).toFixed(1)) + ' MB';

    const { error } = await supabase.from('mods').insert({
      titulo: req.body.titulo,
      descripcion: req.body.descripcion,
      autor: sesionUsuario,
      version: req.body.version,
      categoria: req.body.categoria,
      nombre_archivo_real: arc.originalname,
      archivo_path: filePath,
      rutas_imagenes: rutasDeFotos,
      descargas: 0,
      likes: 0,
      usuarios_like: [],
      comentarios: [],
      historial_actualizaciones: [],
      fecha_creacion: new Date().toLocaleDateString('es-ES'),
      peso_archivo: peso
    });

    if (error) throw error;
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al publicar: ' + err.message + ' <a href="/publish">Volver</a>');
  }
});

app.get('/edit-mod/:id', async (req, res) => {
  const sesionUsuario = req.cookies.usuarioSesion;
  if (!sesionUsuario) return res.redirect('/login');

  const { data } = await supabase.from('mods').select('*').eq('id', parseInt(req.params.id)).single();
  const mod = mapMod(data);
  if (!mod || mod.autor !== sesionUsuario) return res.send('No tienes permisos.');

  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Editar Mod</title>${estilosCSS}</head><body>
    <div class="form-box">
      <h2>✏️ Modificar / Lanzar Update</h2>
      <form action="/edit-mod/${mod.id}" method="POST" enctype="multipart/form-data">
        <label>Título:</label><input type="text" name="titulo" value="${escapeHtml(mod.titulo)}" required>
        <label>Descripción:</label><textarea name="descripcion" required>${escapeHtml(mod.descripcion)}</textarea>
        <label>Nueva versión del archivo (opcional):</label><input type="file" name="archivoMod">
        <label>Notas de la actualización:</label><input type="text" name="notasUpdate" placeholder="Ej: Fix de texturas">
        <button type="submit" class="btn-blue" style="width:100%;">💾 Guardar Cambios</button>
      </form>
    </div>
  </body></html>`);
});

app.post('/edit-mod/:id', upload.fields([{ name: 'archivoMod', maxCount: 1 }]), async (req, res) => {
  const sesionUsuario = req.cookies.usuarioSesion;
  if (!sesionUsuario) return res.redirect('/login');

  try {
    const { data } = await supabase.from('mods').select('*').eq('id', parseInt(req.params.id)).single();
    const mod = mapMod(data);
    if (!mod || mod.autor !== sesionUsuario) return res.send('Acceso denegado.');

    const update = {
      titulo: req.body.titulo,
      descripcion: req.body.descripcion
    };

    if (req.files['archivoMod'] && req.files['archivoMod'].length > 0) {
      const file = req.files['archivoMod'][0];
      const filePath = `${sesionUsuario}/${Date.now()}-${file.originalname}`;
      await uploadToStorage('mods-files', filePath, file.buffer, file.mimetype || 'application/octet-stream');
      update.nombre_archivo_real = file.originalname;
      update.archivo_path = filePath;
      update.peso_archivo = ((file.size / (1024 * 1024)).toFixed(1)) + ' MB';

      const historial = mod.historialActualizaciones || [];
      historial.push({
        version: 'Update ' + (historial.length + 1),
        fecha: new Date().toLocaleDateString('es-ES'),
        notas: req.body.notasUpdate || 'Modificaciones generales.'
      });
      update.historial_actualizaciones = historial;
    }

    await supabase.from('mods').update(update).eq('id', mod.id);
    res.redirect(`/mod/${mod.id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al editar: ' + err.message);
  }
});

app.get('/download/:id', async (req, res) => {
  try {
    const { data } = await supabase.from('mods').select('*').eq('id', parseInt(req.params.id)).single();
    const mod = mapMod(data);
    if (!mod || !mod.archivoPath) return res.status(404).send('No encontrado');

    await supabase.from('mods').update({ descargas: (mod.descargas || 0) + 1 }).eq('id', mod.id);

    const { data: fileData, error } = await supabase.storage
      .from('mods-files')
      .download(mod.archivoPath);

    if (error || !fileData) {
      // Fallback: redirigir a URL pública
      const { data: urlData } = supabase.storage.from('mods-files').getPublicUrl(mod.archivoPath);
      return res.redirect(urlData.publicUrl);
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    res.setHeader('Content-Disposition', `attachment; filename="${mod.nombreArchivoReal || 'mod.zip'}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al descargar.');
  }
});

app.get('/like/:id', async (req, res) => {
  const sesionUsuario = req.cookies.usuarioSesion;
  if (!sesionUsuario) return res.redirect('/login');

  try {
    const { data } = await supabase.from('mods').select('*').eq('id', parseInt(req.params.id)).single();
    if (!data) return res.redirect('/');

    let likes = data.likes || 0;
    let usuariosLike = data.usuarios_like || [];
    const idx = usuariosLike.indexOf(sesionUsuario);
    if (idx === -1) {
      likes += 1;
      usuariosLike.push(sesionUsuario);
    } else {
      likes -= 1;
      usuariosLike.splice(idx, 1);
    }
    await supabase.from('mods').update({ likes, usuarios_like: usuariosLike }).eq('id', data.id);
    res.redirect(req.headers.referer || '/');
  } catch (err) {
    console.error(err);
    res.redirect('/');
  }
});

app.post('/comment/:id', async (req, res) => {
  const sesionUsuario = req.cookies.usuarioSesion;
  if (!sesionUsuario) return res.redirect('/login');

  try {
    const { data } = await supabase.from('mods').select('*').eq('id', parseInt(req.params.id)).single();
    if (data) {
      const comentarios = data.comentarios || [];
      comentarios.push({ usuario: sesionUsuario, texto: req.body.ctext });
      await supabase.from('mods').update({ comentarios }).eq('id', data.id);
    }
    res.redirect(`/mod/${req.params.id}`);
  } catch (err) {
    console.error(err);
    res.redirect(`/mod/${req.params.id}`);
  }
});

app.get('/register', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8">${estilosCSS}</head><body>
    <div class="form-box">
      <h2>Crear cuenta</h2>
      <form action="/register" method="POST">
        <label>Usuario:</label><input type="text" name="usuario" required pattern="[a-zA-Z0-9_\\-]{3,20}" title="3-20 caracteres: letras, números, _ o -">
        <label>Mini-Descripción de perfil:</label><input type="text" name="descripcion" placeholder="Ej: Modder de LUA en DX" required>
        <label>Contraseña:</label><input type="password" name="password" required minlength="4">
        <button type="submit" class="btn-red" style="width:100%;">Registrarme</button>
      </form>
      <p style="text-align:center;margin-top:15px;"><a href="/login" style="color:#93c5fd;">¿Ya tienes cuenta? Entrar</a></p>
    </div>
  </body></html>`);
});

app.post('/register', async (req, res) => {
  try {
    const usuario = (req.body.usuario || '').trim();
    const password = req.body.password || '';
    const descripcion = req.body.descripcion || 'Desarrollador de la comunidad.';

    if (!usuario || usuario.length < 3) return res.send('Usuario inválido. <a href="/register">Volver</a>');

    const { data: existing } = await supabase.from('usuarios').select('id').eq('usuario', usuario).single();
    if (existing) return res.send('Ese usuario ya existe. <a href="/register">Volver</a>');

    const hash = await bcrypt.hash(password, 10);
    const { error } = await supabase.from('usuarios').insert({
      usuario,
      password: hash,
      descripcion,
      fecha_registro: new Date().getFullYear().toString(),
      seguidores: []
    });
    if (error) throw error;

    res.cookie('usuarioSesion', usuario, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.send('Error al registrar. <a href="/register">Volver</a>');
  }
});

app.get('/login', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8">${estilosCSS}</head><body>
    <div class="form-box">
      <h2>Iniciar sesión</h2>
      <form action="/login" method="POST">
        <label>Usuario:</label><input type="text" name="usuario" required>
        <label>Contraseña:</label><input type="password" name="password" required>
        <button type="submit" class="btn-red" style="width:100%;">Ingresar</button>
      </form>
      <p style="text-align:center;margin-top:15px;"><a href="/register" style="color:#93c5fd;">Crear cuenta</a></p>
    </div>
  </body></html>`);
});

app.post('/login', async (req, res) => {
  try {
    const { data: u } = await supabase.from('usuarios').select('*').eq('usuario', req.body.usuario).single();
    if (!u) return res.send('Usuario o contraseña incorrectos. <a href="/login">Volver</a>');

    // Compatibilidad: si la contraseña antigua estaba en texto plano
    let ok = false;
    if (u.password.startsWith('$2')) {
      ok = await bcrypt.compare(req.body.password, u.password);
    } else {
      ok = u.password === req.body.password;
      if (ok) {
        const hash = await bcrypt.hash(req.body.password, 10);
        await supabase.from('usuarios').update({ password: hash }).eq('id', u.id);
      }
    }

    if (ok) {
      res.cookie('usuarioSesion', u.usuario, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
      res.redirect('/');
    } else {
      res.send('Usuario o contraseña incorrectos. <a href="/login">Volver</a>');
    }
  } catch (err) {
    console.error(err);
    res.send('Error. <a href="/login">Volver</a>');
  }
});

app.get('/logout', (req, res) => {
  res.clearCookie('usuarioSesion');
  res.redirect('/');
});

// Exportar para Vercel (serverless) y también escuchar en local
module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => console.log(`Servidor local en http://localhost:${PORT}`));
}
