const express = require('express');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const https = require('https'); 
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); 

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/public', express.static(path.join(__dirname, 'public')));

const dirUploads = path.join(__dirname, 'uploads');
if (!fs.existsSync(dirUploads)) fs.mkdirSync(dirUploads);
const dirPublic = path.join(__dirname, 'public');
if (!fs.existsSync(dirPublic)) fs.mkdirSync(dirPublic);

const rutaArchivoDatos = path.join(__dirname, 'baseDatos.json');
let listaUsuarios = []; 
let listaMods = [];

function cargarBaseDatos() {
    if (fs.existsSync(rutaArchivoDatos)) {
        try {
            const datos = JSON.parse(fs.readFileSync(rutaArchivoDatos, 'utf8'));
            listaUsuarios = datos.usuarios || [];
            listaMods = datos.mods || [];
            console.log("-> Base de datos JSON cargada.");
        } catch (e) { console.log("Iniciando base vacía."); }
    }
}
function guardarBaseDatos() {
    fs.writeFileSync(rutaArchivoDatos, JSON.stringify({ usuarios: listaUsuarios, mods: listaMods }, null, 2), 'utf8');
}
cargarBaseDatos();

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

setInterval(() => {
    https.get('https://onrender.com', (res) => {
        console.log(`[Auto-Wake] Ping enviado. Estado: ${res.statusCode}`);
    }).on('error', (err) => {
        console.log('[Auto-Wake] Error en el ping: ' + err.message);
    });
}, 10 * 60 * 1000);
const estilosCSS = `<style>
    body {
        background-image: url('/public/fondo.jpg') !important;
        background-repeat: repeat !important;
        background-color: #111319;
        color: #f1f3f5;
        font-family: sans-serif;
        margin: 0; padding: 0;
    }
    .navbar {
        background-color: rgba(15, 17, 21, 0.95);
        padding: 2px 50px;
        display: flex; justify-content: space-between; align-items: center;
        border-bottom: 3px solid #ff3333; backdrop-filter: blur(5px);
    }
    .brand-logo { height: 120px; display: block; object-fit: contain; }
    .nav-links { display: flex; align-items: center; gap: 20px; }
    .nav-links a { color: #ced4da; text-decoration: none; font-weight: bold; }
    .nav-links a:hover { color: white; }
    .btn-red { background-color: #ff3333; color: white!important; padding: 8px 16px; border-radius: 6px; font-weight: bold; text-decoration: none; border: none; cursor: pointer; }
    .btn-blue { background-color: #2563eb; color: white!important; padding: 8px 20px; border-radius: 6px; font-weight: bold; text-decoration: none; border: none; cursor: pointer; }
    .btn-delete { background-color: #dc2626; color: white!important; padding: 4px 8px; border-radius: 4px; font-size: 11px; text-decoration: none; }
    .main-container { max-width: 1200px; margin: 40px auto; padding: 0 20px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 20px; }
    .card { background-color: rgba(31, 35, 43, 0.93); border-radius: 12px; overflow: hidden; border: 1px solid #2d3139; box-shadow: 0 4px 10px rgba(0,0,0,0.4); display: flex; flex-direction: column; backdrop-filter: blur(3px); }
    .card-img-box { height: 140px; background-color: #161920; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .card-img-box img { width: 100%; height: 100%; object-fit: cover; }
    .card-content { padding: 15px; flex-grow: 1; }
    .tags { display: flex; gap: 6px; margin-bottom: 10px; }
    .tag-version { background-color: #2e3545; color: #93c5fd; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: bold; }
    .tag-category { background-color: #374151; color: #d1d5db; font-size: 10px; padding: 2px 6px; border-radius: 4px; }
    .card h3 { margin: 0 0 10px 0; font-size: 16px; }
    .card h3 a { color: white; text-decoration: none; }
    .card p { color: #9ca3af; font-size: 12px; height: 35px; overflow: hidden; margin: 0 0 15px 0; }
    .card-footer { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #2d3139; padding-top: 12px; margin-top: auto; }
    .author { color: #facc15; text-decoration: none; font-weight: bold; }
    .info-box { background-color: rgba(31, 35, 43, 0.9); border: 1px solid #2d3139; border-radius: 12px; padding: 25px; margin-bottom: 25px; }
    .info-box h2 { margin: 0 0 15px 0; font-size: 18px; color: white; border-bottom: 1px solid #2d3139; padding-bottom: 10px; }
    .info-box p { color: #ced4da; font-size: 14px; white-space: pre-wrap; }
    .form-box { background-color: rgba(31, 35, 43, 0.9); max-width: 500px; margin: 50px auto; padding: 30px; border-radius: 12px; border: 1px solid #2d3139; }
    input, select, textarea { width: 100%; padding: 10px; margin-bottom: 15px; background-color: #161920; border: 1px solid #374151; color: white; border-radius: 6px; box-sizing: border-box; }
    .profile-header { background: rgba(22, 25, 32, 0.9); border: 1px solid #2d3139; border-radius: 12px; padding: 30px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
    .meta-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    .meta-table td { padding: 8px; border-bottom: 1px solid #2d3139; font-size: 14px; }
    .meta-table td:first-child { color: #9ca3af; font-weight: bold; width: 40%; }
    .changelog-item { background: #161920; padding: 10px; border-radius: 6px; margin-bottom: 8px; font-size: 13px; border-left: 3px solid #ff3333; }
    .mod-gallery-preview img { width: 100%; max-width: 600px; height: auto; border-radius: 8px; border: 1px solid #374151; display: block; object-fit: contain; margin-top: 10px; }
    .top-badge { background: #facc15; color: #111319; font-weight: bold; padding: 2px 8px; border-radius: 4px; margin-right: 8px; }
</style>`;
app.get('/', (req, res) => {
    const sesionUsuario = req.cookies.usuarioSesion || null;
    const buscarTexto = req.query.buscar ? req.query.buscar.toLowerCase() : '';
    const buscarCategoria = req.query.categoria || 'Todas';
    const buscarVersion = req.query.version || 'Todas';

    let modsFiltrados = listaMods.filter(mod => {
        const coincideTexto = mod.titulo.toLowerCase().includes(buscarTexto) || mod.descripcion.toLowerCase().includes(buscarTexto);
        const coincideCategoria = (buscarCategoria === 'Todas' || mod.categoria === buscarCategoria);
        const coincideVersion = (buscarVersion === 'Todas' || mod.version === buscarVersion);
        return coincideTexto && coincideCategoria && coincideVersion;
    });

    let tarjetasHTML = '';
    if (modsFiltrados.length === 0) {
        tarjetasHTML = '<p style="color:#9ca3af;grid-column:1/-1;text-align:center;padding:40px;">No se encontraron mods.</p>';
    }

    modsFiltrados.forEach(mod => {
        const yaTieneLike = sesionUsuario ? mod.usuariosLike.includes(sesionUsuario) : false;
        const claseLike = yaTieneLike ? 'btn-like active' : 'btn-like';
        const numComentarios = mod.comentarios ? mod.comentarios.length : 0;
        const fotoPortada = mod.rutasImagenes && mod.rutasImagenes.length > 0 ? mod.rutasImagenes[0] : '';

        tarjetasHTML += `<div class="card">
            <div class="card-img-box">
                ${fotoPortada ? `<img src="\${fotoPortada}">` : '<img src="https://icons8.com" style="width:40px;height:40px;object-fit:contain;">'}
            </div>
            <div class="card-content">
                <div class="tags">
                    <span class="tag-version">${mod.version}</span>
                    <span class="tag-category">${mod.categoria}</span>
                </div>
                <h3><a href="/mod/${mod.id}">${mod.titulo}</a></h3>
                <p>${mod.descripcion}</p>
                <div class="card-footer">
                    <span>por <a href="/user/${mod.autor}" class="author">@${mod.autor}</a></span>
                    <div style="display:flex;gap:6px;align-items:center;">
                        <a href="/like/${mod.id}" class="${claseLike}">⭐ ${mod.likes}</a>
                        <span>💬 ${numComentarios}</span>
                    </div>
                </div>
            </div>
        </div>`;
    });

    let authLinks = `<a href="/login" style="color:#ced4da;text-decoration:none;font-size:14px;">Entrar</a> <a href="/register" class="btn-red">Registrarse</a>`;
    if (sesionUsuario) {
        authLinks = `<a href="/publish" class="btn-red">+ Publicar mod</a> <span style="color:#9ca3af;font-size:14px;margin-left:10px;">Hola, <a href="/user/${sesionUsuario}" style="color:#ff3333;font-weight:bold;text-decoration:none;">${sesionUsuario}</a></span> <a href="/logout" style="color:#9ca3af;margin-left:10px;">Salir</a>`;
    }

    res.send(`<html><head><title>Coop Free Mods</title>${estilosCSS}</head><body><div class="navbar"><div class="brand"><a href="/"><img src="/public/logo.png" class="brand-logo" alt="Logo"></a></div><div class="nav-links"><a href="/">Inicio</a><a href="/top">⭐ Top 10</a>${authLinks}</div></div><div class="main-container"><form action="/" method="GET" style="background-color:rgba(31,35,43,0.9);padding:15px;border-radius:12px;display:flex;gap:10px;align-items:center;border:1px solid #2d3139;margin-bottom:25px;backdrop-filter:blur(5px);"><input type="text" name="buscar" placeholder="Buscar mods..." style="background:#161920;border:1px solid #374151;color:white;padding:8px 12px;border-radius:6px;flex:1;" value="${req.query.buscar||''}"><select name="version" style="background:#161920;border:1px solid #374151;color:white;padding:8px 12px;border-radius:6px;width:140px;"><option value="Todas">Todas las versiones</option><option value="SM64 Co-op DX">SM64 Co-op DX</option><option value="SM64 EX Co-op">SM64 EX Co-op</option></select><select name="categoria" style="background:#161920;border:1px solid #374151;color:white;padding:8px 12px;border-radius:6px;width:170px;"><option value="Todas">Todas las categorías</option><option value="Personajes">👤 Personajes</option><option value="Jugabilidad">🎮 Jugabilidad</option><option value="HUD / Texturas">🎨 HUD / Texturas</option><option value="Mapas / Niveles">🗺️ Mapas / Niveles</option><option value="Scripts LUA">📜 Scripts LUA</option><option value="Otros">📦 Otros</option></select><button type="submit" class="btn-blue">Filtrar</button></form><p style="color:#9ca3af;margin-bottom:20px;font-weight:bold;">${modsFiltrados.length} mods encontrados</p><div class="grid">${tarjetasHTML}</div></div></body></html>`);
});

app.get('/top', (req, res) => {
    const sesionUsuario = req.cookies.usuarioSesion || null;
    const buscarCategoria = req.query.categoria || 'Todas';
    const buscarVersion = req.query.version || 'Todas';

    let modsTop = listaMods.filter(mod => {
        const coincideCategoria = (buscarCategoria === 'Todas' || mod.categoria === buscarCategoria);
        const coincideVersion = (buscarVersion === 'Todas' || mod.version === buscarVersion);
        return coincideCategoria && coincideVersion;
    });

    modsTop.sort((a, b) => b.descargas - a.descargas);
    modsTop = modsTop.slice(0, 10);

    let tarjetasHTML = '';
    if (modsTop.length === 0) {
        tarjetasHTML = '<p style="color:#9ca3af;grid-column:1/-1;text-align:center;padding:40px;">No hay descargas registradas en este filtro.</p>';
    }

    modsTop.forEach((mod, index) => {
        const fotoPortada = mod.rutasImagenes && mod.rutasImagenes.length > 0 ? mod.rutasImagenes[0] : '';
        tarjetasHTML += `<div class="card">
            <div class="card-img-box">
                ${fotoPortada ? `<img src="\${fotoPortada}">` : '<img src="https://icons8.com" style="width:40px;height:40px;object-fit:contain;">'}
            </div>
            <div class="card-content">
                <div style="margin-bottom:10px;"><span class="top-badge">#${index + 1}</span><span class="tag-version">${mod.version}</span></div>
                <h3><a href="/mod/${mod.id}">${mod.titulo}</a></h3>
                <p style="margin:0 0 10px 0; color:#9ca3af; font-size:12px;">⬇️ ${mod.descargas} descargas</p>
                <div class="card-footer">
                    <span>por <a href="/user/${mod.autor}" class="author">@${mod.autor}</a></span>
                    <span>⭐ ${mod.likes}</span>
                </div>
            </div>
        </div>`;
    });

    let authLinks = `<a href="/login" style="color:#ced4da;text-decoration:none;font-size:14px;">Entrar</a>`;
    if (sesionUsuario) { authLinks = `<span style="color:#9ca3af;font-size:14px;">Hola, <b>${sesionUsuario}</b></span>`; }

    res.send(`<html><head><title>Top 10 Mods</title>${estilosCSS}</head><body><div class="navbar"><div class="brand"><a href="/"><img src="/public/logo.png" class="brand-logo" alt="Logo"></a></div><div class="nav-links"><a href="/">Inicio</a><a href="/top" style="color:white;border-bottom:2px solid #ff3333;padding-bottom:4px;">⭐ Top 10</a>${authLinks}</div></div><div class="main-container"><h2>🏆 Top 10 Mods más Descargados</h2><form action="/top" method="GET" style="background-color:rgba(31,35,43,0.9);padding:15px;border-radius:12px;display:flex;gap:10px;align-items:center;border:1px solid #2d3139;margin-bottom:25px;"><select name="version" style="background:#161920;border:1px solid #374151;color:white;padding:8px 12px;border-radius:6px;width:140px;"><option value="Todas">Todas las versiones</option><option value="SM64 Co-op DX">SM64 Co-op DX</option><option value="SM64 EX Co-op">SM64 EX Co-op</option></select><select name="categoria" style="background:#161920;border:1px solid #374151;color:white;padding:8px 12px;border-radius:6px;width:170px;"><option value="Todas">Todas las categorías</option><option value="Personajes">👤 Personajes</option><option value="Jugabilidad">🎮 Jugabilidad</option><option value="HUD / Texturas">🎨 HUD / Texturas</option><option value="Mapas / Niveles">🗺️ Mapas / Niveles</option><option value="Scripts LUA">📜 Scripts LUA</option><option value="Otros">📦 Otros</option></select><button type="submit" class="btn-blue">Ver Ranking</button></form><div class="grid">${tarjetasHTML}</div></div></body></html>`);
});
app.get('/mod/:id', (req, res) => {
    const sesionUsuario = req.cookies.usuarioSesion || null;
    const mod = listaMods.find(m => m.id === parseInt(req.params.id));
    if (!mod) return res.status(404).send('<h1>Mod no encontrado</h1>');
    
    let fotosHTML = '';
    if (mod.rutasImagenes) {
        mod.rutasImagenes.forEach(url => { if(url) fotosHTML += `<div class="mod-gallery-preview"><img src="${url}"></div>`; });
    }
    let updatesHTML = '';
    if (mod.historialActualizaciones && mod.historialActualizaciones.length > 0) {
        mod.historialActualizaciones.forEach(up => { updatesHTML += `<div class="changelog-item"><b>Versión ${up.version}</b> (${up.fecha}): <br>${up.notas}</div>`; });
    } else { updatesHTML = '<p style="color:#9ca3af;font-size:13px;margin:0;">No hay actualizaciones registradas.</p>'; }

    let comentariosHTML = '';
    if (mod.comentarios && mod.comentarios.length > 0) {
        mod.comentarios.forEach(com => { comentariosHTML += `<div style="background:#161920;border:1px solid #2d3139;border-radius:8px;padding:12px;margin-bottom:10px;"><a href="/user/${com.usuario}" class="author">@${com.usuario}</a><p style="margin:5px 0 0 0;font-size:14px;color:#ced4da;">${com.texto}</p></div>`; });
    } else { comentariosHTML = '<p style="color:#9ca3af;">No hay comentarios todavía.</p>'; }

    let bEdit = (sesionUsuario === mod.autor) ? `<a href="/edit-mod/${mod.id}" class="btn-blue" style="font-size:13px;padding:6px 12px;">✏️ Editar / Actualizar</a>` : '';
    let cajaComentarios = sesionUsuario ? `<form action="/comment/${mod.id}" method="POST"><textarea name="ctext" placeholder="Escribe un comentario público..." rows="2" required></textarea><button type="submit" class="btn-blue">💬 Comentar</button></form>` : '<p><a href="/login" style="color:#ff3333;">Inicia sesión</a> para comentar.</p>';

    res.send(`<html><head><title>${mod.titulo}</title>${estilosCSS}</head><body><div class="navbar"><div class="brand"><a href="/"><img src="/public/logo.png" class="brand-logo" alt="Logo"></a></div><div class="nav-links"><a href="/">Volver al Inicio</a></div></div><div class="main-container"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;"><div><h1>${mod.titulo}</h1><p style="margin:0;color:#9ca3af;">Creado por <a href="/user/${mod.autor}" class="author">@${mod.autor}</a></p></div><div style="display:flex;gap:10px;align-items:center;"><a href="/download/${mod.id}" class="btn-red" style="font-size:16px;padding:12px 25px;">⬇️ Descargar (.zip)</a>${bEdit}</div></div><div style="display:grid;grid-template-columns:2fr 1fr;gap:25px;"><div class="info-box"><h2>Descripción</h2><p>${mod.descripcion}</p>${fotosHTML}</div><div><div class="info-box"><h2>Detalles Técnicos</h2><table class="meta-table"><tr><td>Versión:</td><td>${mod.version}</td></tr><tr><td>Categoría:</td><td>${mod.categoria}</td></tr><tr><td>Publicado:</td><td>${mod.fechaCreacion || 'Reciente'}</td></tr><tr><td>Peso:</td><td>${mod.pesoArchivo || 'Desconocido'}</td></tr><tr><td>Descargas:</td><td>${mod.descargas}</td></tr></table></div><div class="info-box"><h2>🔄 Historial de Cambios</h2>${updatesHTML}</div></div></div><div class="info-box" style="margin-top:25px;"><h2>💬 Comentarios</h2><div style="margin-bottom:20px;">${comentariosHTML}</div>${cajaComentarios}</div></div></body></html>`);
});
app.get('/user/:username', (req, res) => {
    const sesionUsuario = req.cookies.usuarioSesion || null;
    const user = listaUsuarios.find(u => u.usuario === req.params.username) || { usuario: req.params.username, descripcion: "Desarrollador de la comunidad.", fechaRegistro: "2026", seguidores: [] };
    if(!user.seguidores) user.seguidores = [];
    
    let userMods = listaMods.filter(m => m.autor === user.usuario);
    let tarjetasHTML = '';
    userMods.forEach(mod => {
        tarjetasHTML += `<div class="card"><div class="card-content"><h3><a href="/mod/${mod.id}">${mod.titulo}</a></h3><p>${mod.descripcion}</p><span class="tag-version">${mod.version}</span></div></div>`;
    });
    if(userMods.length === 0) tarjetasHTML = '<p style="color:#9ca3af;">Este creador no ha publicado ningún mod todavía.</p>';

    let yaSigue = sesionUsuario ? user.seguidores.includes(sesionUsuario) : false;
    let bFollow = '';
    if (sesionUsuario && sesionUsuario !== user.usuario) {
        bFollow = `<a href="/follow/${user.usuario}" class="btn-red" style="background:${yaSigue?'#4b5563':'#ff3333'};">${yaSigue?'Unfollow':'👤 Seguir'}</a>`;
    }

    res.send(`<html><head><title>Perfil de ${user.usuario}</title>${estilosCSS}</head><body><div class="navbar"><div class="brand"><a href="/"><img src="/public/logo.png" class="brand-logo" alt="Logo"></a></div><div class="nav-links"><a href="/">Inicio</a></div></div><div class="main-container"><div class="profile-header"><div><h1 style="margin:0;color:white;">@${user.usuario}</h1><p style="color:#ced4da;margin:10px 0;">${user.descripcion}</p><p style="color:#9ca3af;font-size:12px;margin:0;">Miembro desde: ${user.fechaRegistro} | 👥 ${user.seguidores.length} seguidores</p></div>${bFollow}</div><h2>📦 Mods creados por este usuario</h2><div class="grid">${tarjetasHTML}</div></div></body></html>`);
});

app.get('/follow/:username', (req, res) => {
    const sesionUsuario = req.cookies.usuarioSesion || null; if (!sesionUsuario) return res.redirect('/login');
    let target = listaUsuarios.find(u => u.usuario === req.params.username);
    if (!target) { target = { usuario: req.params.username, descripcion: "Creador", fechaRegistro: "2026", seguidores: [] }; listaUsuarios.push(target); }
    if (!target.seguidores) target.seguidores = [];
    let idx = target.seguidores.indexOf(sesionUsuario);
    if (idx === -1) target.seguidores.push(sesionUsuario); else target.seguidores.splice(idx, 1);
    guardarBaseDatos(); res.redirect(`/user/${req.params.username}`);
});

app.get('/edit-mod/:id', (req, res) => {
    const sesionUsuario = req.cookies.usuarioSesion || null;
    const mod = listaMods.find(m => m.id === parseInt(req.params.id));
    if (!mod || mod.autor !== sesionUsuario) return res.send('No tienes permisos.');
    res.send(`<html><head><title>Editar Mod</title>${estilosCSS}</head><body><div class="form-box"><h2>✏️ Modificar / Lanzar Update</h2><form action="/edit-mod/${mod.id}" method="POST" enctype="multipart/form-data"><label>Título:</label><input type="text" name="titulo" value="${mod.titulo}" required><label>Descripción:</label><textarea name="descripcion" required>${mod.descripcion}</textarea><label>Lanzar Nueva Versión (Opcional - Sube un nuevo .zip):</label><input type="file" name="archivoMod"><label>Notas de la actualización / Changelog:</label><input type="text" name="notasUpdate" placeholder="Ej: Fix de texturas en EX Co-op"><button type="submit" class="btn-blue" style="width:100%;">💾 Guardar Cambios</button></form></div></body></html>`);
});

app.post('/edit-mod/:id', upload.fields([{ name: 'archivoMod', maxCount: 1 }]), (req, res) => {
    const sesionUsuario = req.cookies.usuarioSesion || null;
    const mod = listaMods.find(m => m.id === parseInt(req.params.id));
    if (!mod || mod.autor !== sesionUsuario) return res.send('Acceso denegado.');

    mod.titulo = req.body.titulo;
    mod.descripcion = req.body.descripcion;

    if (req.files['archivoMod'] && req.files['archivoMod'].length > 0) {
        const file = req.files['archivoMod'][0];
        mod.nombreArchivoReal = file.originalname;
        mod.nombreArchivoServidor = file.filename;
        mod.pesoArchivo = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
        
        if(!mod.historialActualizaciones) mod.historialActualizaciones = [];
        mod.historialActualizaciones.push({
            version: 'Update ' + (mod.historialActualizaciones.length + 1),
            fecha: new Date().toLocaleDateString('es-ES'),
            notas: req.body.notasUpdate || 'Modificaciones generales en el archivo.'
        });
    }
    guardarBaseDatos(); res.redirect(`/mod/${mod.id}`);
});

app.get('/publish', (req, res) => {
    if (!req.cookies.usuarioSesion) return res.redirect('/login');
    res.send(`<html><head><title>Publicar</title>${estilosCSS}</head><body><div class="form-box"><h2>🚀 Publicar Mod Físico</h2><form action="/publish" method="POST" enctype="multipart/form-data"><label>Nombre del Mod:</label><input type="text" name="titulo" required><label>Versión del emulador:</label><select name="version"><option value="SM64 Co-op DX">SM64 Co-op DX</option><option value="SM64 EX Co-op">SM64 EX Co-op</option></select><label>Categoría:</label><select name="categoria"><option value="Personajes">👤 Personajes</option><option value="Jugabilidad">🎮 Jugabilidad</option><option value="HUD / Texturas">🎨 HUD / Texturas</option><option value="Mapas / Niveles">🗺️ Mapas / Niveles</option><option value="Scripts LUA">📜 Scripts LUA</option><option value="Otros">📦 Otros</option></select><label>Descripción:</label><textarea name="descripcion" required></textarea><label>Archivo del Mod (.zip):</label><input type="file" name="archivoMod" required><label>Capturas (Hasta 4 imágenes):</label><input type="file" name="imagenesMod" accept="image/*" multiple required><button type="submit" class="btn-red" style="width:100%;">Publicar Mod</button></form></div></body></html>`);
});

app.post('/publish', upload.fields([{ name: 'archivoMod', maxCount: 1 }, { name: 'imagenesMod', maxCount: 4 }]), (req, res) => {
    const sesionUsuario = req.cookies.usuarioSesion || null; if (!sesionUsuario) return res.redirect('/login');
    const arc = req.files['archivoMod'] ? req.files['archivoMod'][0] : null;
    const imgs = req.files['imagenesMod'] ? req.files['imagenesMod'] : [];
    if (!arc) return res.send('Falta el archivo comprimido .zip.');
    
    const rutasDeFotos = imgs.map(f => '/uploads/' + f.filename);
    const nuevoMod = {
        id: listaMods.length + 1, titulo: req.body.titulo, descripcion: req.body.descripcion, autor: sesionUsuario, version: req.body.version, categoria: req.body.categoria,
        nombreArchivoReal: arc.originalname, nombreArchivoServidor: arc.filename, rutasImagenes: rutasDeFotos,
        descargas: 0, likes: 0, usuariosLike: [], comentarios: [], historialActualizaciones: [],
        fechaCreacion: new Date().toLocaleDateString('es-ES'), pesoArchivo: (arc.size / (1024 * 1024)).toFixed(1) + ' MB'
    };
    listaMods.push(nuevoMod); guardarBaseDatos(); res.redirect('/');
});

app.get('/download/:id', (req, res) => {
    const mod = listaMods.find(m => m.id === parseInt(req.params.id));
    if (!mod) return res.status(404).send('No encontrado');
    mod.descargas += 1; guardarBaseDatos();
    res.download(path.join(__dirname, 'uploads', mod.nombreArchivoServidor), mod.nombreArchivoReal);
});

app.get('/like/:id', (req, res) => {
    const sesionUsuario = req.cookies.usuarioSesion || null; if (!sesionUsuario) return res.redirect('/login');
    const mod = listaMods.find(m => m.id === parseInt(req.params.id));
    if (mod) {
        const idx = mod.usuariosLike.indexOf(sesionUsuario);
        if (idx === -1) { mod.likes += 1; mod.usuariosLike.push(sesionUsuario); } else { mod.likes -= 1; mod.usuariosLike.splice(idx, 1); }
        guardarBaseDatos();
    }
    res.redirect(req.headers.referer || '/');
});

app.post('/comment/:id', (req, res) => {
    const sesionUsuario = req.cookies.usuarioSesion || null; if (!sesionUsuario) return res.redirect('/login');
    const mod = listaMods.find(m => m.id === parseInt(req.params.id));
    if (mod) { mod.comentarios.push({ usuario: sesionUsuario, texto: req.body.ctext }); guardarBaseDatos(); }
    res.redirect(`/mod/${req.params.id}`);
});

app.get('/register', (req, res) => res.send(`<html><head>${estilosCSS}</head><body><div class="form-box"><h2>Crear cuenta</h2><form action="/register" method="POST"><label>Usuario:</label><input type="text" name="usuario" required><label>Mini-Descripción de perfil:</label><input type="text" name="descripcion" placeholder="Ej: Modder de LUA en DX" required><label>Contraseña:</label><input type="password" name="password" required><button type="submit" class="btn-red" style="width:100%;">Registrarme</button></form></div></body></html>`));
app.post('/register', (req, res) => { const body = req.body; body.fechaRegistro = new Date().getFullYear().toString(); body.seguidores = []; listaUsuarios.push(body); guardarBaseDatos(); res.cookie('usuarioSesion', body.usuario); res.redirect('/'); });
app.get('/login', (req, res) => res.send(`<html><head>${estilosCSS}</head><body><div class="form-box"><h2>Iniciar sesión</h2><form action="/login" method="POST"><label>Usuario:</label><input type="text" name="usuario" required><label>Contraseña:</label><input type="password" name="password" required><button type="submit" class="btn-red" style="width:100%;">Ingresar</button></form></div></body></html>`));
app.post('/login', (req, res) => { const u = listaUsuarios.find(user => user.usuario === req.body.usuario && user.password === req.body.password); if (u) { res.cookie('usuarioSesion', u.usuario); res.redirect('/'); } else { res.send('Error. <a href="/login">Volver</a>'); } });
app.get('/logout', (req, res) => { res.clearCookie('usuarioSesion'); res.redirect('/'); });

app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));
