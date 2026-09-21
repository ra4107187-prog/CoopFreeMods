const express = require('express');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); 

// Crear carpetas de almacenamiento físico dentro de Render
const dirUploads = path.join(__dirname, 'uploads');
if (!fs.existsSync(dirUploads)) fs.mkdirSync(dirUploads);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

app.use('/uploads', express.static('uploads'));

// BASE DE DATOS PERSISTENTE JSON
const rutaArchivoDatos = path.join(__dirname, 'baseDatos.json');
let listaUsuarios = []; 
let listaMods = [];

function cargarBaseDatos() {
    if (fs.existsSync(rutaArchivoDatos)) {
        try {
            const datosParseados = JSON.parse(fs.readFileSync(rutaArchivoDatos, 'utf8'));
            listaUsuarios = datosParseados.usuarios || [];
            listaMods = datosParseados.mods || [];
            console.log("-> Base de datos JSON cargada.");
        } catch (e) { console.log("Iniciando base vacía."); }
    }
}
function guardarBaseDatos() {
    fs.writeFileSync(rutaArchivoDatos, JSON.stringify({ usuarios: listaUsuarios, mods: listaMods }, null, 2), 'utf8');
}
cargarBaseDatos();
const estilosCSS = `<style>
    body {
        background-image: url('https://postimg.cc') !important;
        background-repeat: repeat !important;
        background-color: #111319;
        color: #f1f3f5;
        font-family: sans-serif;
        margin: 0;
        padding: 0;
    }
    .navbar {
        background-color: rgba(15, 17, 21, 0.95);
        padding: 10px 50px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 3px solid #ff3333;
        backdrop-filter: blur(5px);
    }
    .brand-logo { height: 45px; display: block; }
    .nav-links { display: flex; align-items: center; gap: 20px; }
    .nav-links a { color: #ced4da; text-decoration: none; font-weight: bold; }
    .btn-red { background-color: #ff3333; color: white!important; padding: 8px 16px; border-radius: 6px; font-weight: bold; text-decoration: none; border: none; cursor: pointer; }
    .btn-blue { background-color: #2563eb; color: white; padding: 8px 20px; border-radius: 6px; font-weight: bold; text-decoration: none; border: none; }
    .btn-like { background-color: #2d3139; color: #ced4da; padding: 6px 12px; border-radius: 6px; font-size: 12px; text-decoration: none; border: 1px solid #4b5563; font-weight: bold; display: inline-flex; align-items: center; gap: 4px; }
    .btn-like.active { background-color: #2563eb; color: white; }
    .btn-delete { background-color: #dc2626; color: white!important; padding: 4px 8px; border-radius: 4px; font-size: 11px; text-decoration: none; }
    .main-container { max-width: 1200px; margin: 40px auto; padding: 0 20px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 20px; }
    .card { background-color: rgba(31, 35, 43, 0.9); border-radius: 12px; overflow: hidden; border: 1px solid #2d3139; box-shadow: 0 4px 10px rgba(0,0,0,0.4); display: flex; flex-direction: column; backdrop-filter: blur(3px); }
    .card-img-box { height: 130px; background-color: #161920; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .card-img-box img { width: 100%; height: 100%; object-fit: cover; }
    .estrella-icono {
        width: 18px;
        height: 18px;
        background-image: url('https://postimg.cc');
        background-size: contain;
        background-repeat: no-repeat;
        display: inline-block;
    }
    .card-content { padding: 15px; flex-grow: 1; }
    .tags { display: flex; gap: 6px; margin-bottom: 10px; }
    .tag-version { background-color: #2e3545; color: #93c5fd; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: bold; }
    .tag-category { background-color: #374151; color: #d1d5db; font-size: 10px; padding: 2px 6px; border-radius: 4px; }
    .card h3 { margin: 0 0 10px 0; font-size: 16px; }
    .card h3 a { color: white; text-decoration: none; }
    .card p { color: #9ca3af; font-size: 12px; height: 35px; overflow: hidden; margin: 0 0 15px 0; }
    .card-footer { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #2d3139; padding-top: 12px; margin-top: auto; }
    .author { color: #facc15; text-decoration: none; font-weight: bold; }
    .mod-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; }
    .mod-header h1 { margin: 0; font-size: 32px; color: white; }
    .mod-meta { font-size: 14px; color: #9ca3af; display: flex; gap: 15px; align-items: center; }
    .gallery-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
    .gallery-item { background-color: #1f232b; border-radius: 8px; overflow: hidden; border: 1px solid #2d3139; height: 150px; display: flex; align-items: center; justify-content: center; }
    .gallery-item img { width: 100%; height: 100%; object-fit: cover; }
    .info-box { background-color: rgba(31, 35, 43, 0.9); border: 1px solid #2d3139; border-radius: 12px; padding: 25px; margin-bottom: 25px; }
    .info-box h2 { margin: 0; font-size: 18px; color: white; border-bottom: 1px solid #2d3139; padding-bottom: 10px; margin-bottom: 15px; }
    .info-box p { color: #ced4da; font-size: 14px; white-space: pre-wrap; }
    .comment-item { background-color: #161920; border: 1px solid #2d3139; border-radius: 8px; padding: 15px; margin-bottom: 12px; }
    .comment-user { color: #facc15; font-weight: bold; font-size: 13px; }
    .form-box { background-color: rgba(31, 35, 43, 0.9); max-width: 500px; margin: 50px auto; padding: 30px; border-radius: 12px; border: 1px solid #2d3139; }
    input, select, textarea { width: 100%; padding: 10px; margin-bottom: 15px; background-color: #161920; border: 1px solid #374151; color: white; border-radius: 6px; box-sizing: border-box; }
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
        const fotoPortada = mod.rutasImagenes && mod.rutasImagenes[0] ? mod.rutasImagenes[0] : '';

        let botonEliminar = '';
        if (sesionUsuario && sesionUsuario === mod.autor) {
            botonEliminar = `<a href="/delete/${mod.id}" class="btn-delete" onclick="return confirm('¿Borrar?')">🗑️</a>`;
        }

        tarjetasHTML += `<div class="card">
            <div class="card-img-box">
                ${fotoPortada ? `<img src="\${fotoPortada}">` : '<img src="https://postimg.cc" style="width:40px;height:40px;object-fit:contain;">'}
            </div>
            <div class="card-content">
                <div class="tags">
                    <span class="tag-version">${mod.version}</span>
                    <span class="tag-category">${mod.categoria}</span>
                </div>
                <h3><a href="/mod/${mod.id}">${mod.titulo}</a></h3>
                <p>${mod.descripcion}</p>
                <div class="card-footer">
                    <span>por <span class="author">@${mod.autor}</span></span>
                    <div style="display:flex;gap:6px;align-items:center;">
                        <a href="/like/${mod.id}" class="${claseLike}"><span class="estrella-icono"></span> ${mod.likes}</a>
                        <span>💬 ${numComentarios}</span>
                        <span>⬇ ${mod.descargas}</span>
                        ${botonEliminar}
                    </div>
                </div>
            </div>
        </div>`;
    });

    let authLinks = `<a href="/login" style="color:#ced4da;text-decoration:none;font-size:14px;">Iniciar sesión</a> <a href="/register" class="btn-red">Registrarme</a>`;
    if (sesionUsuario) {
        authLinks = `<a href="/publish" class="btn-red">+ Publicar mod</a> <span style="color:#9ca3af;font-size:14px;margin-left:10px;">Hola, <b style="color:#ff3333;">${sesionUsuario}</b></span> <a href="/logout" style="color:#9ca3af;margin-left:10px;">Salir</a>`;
    }

    res.send(`<html><head><title>Coop Free Mods Rebirth</title>${estilosCSS}</head><body><div class="navbar"><div class="brand"><a href="/"><img src="https://postimg.cc" class="brand-logo" alt="Logo"></a></div><div class="nav-links"><a href="/">Inicio</a>${authLinks}</div></div><div class="main-container"><form action="/" method="GET" style="background-color:rgba(31,35,43,0.9);padding:15px;border-radius:12px;display:flex;gap:10px;align-items:center;border:1px solid #2d3139;margin-bottom:25px;backdrop-filter:blur(5px);"><input type="text" name="buscar" placeholder="Buscar por título..." style="background:#161920;border:1px solid #374151;color:white;padding:8px 12px;border-radius:6px;flex:1;" value="${req.query.buscar||''}"><select name="version" style="background:#161920;border:1px solid #374151;color:white;padding:8px 12px;border-radius:6px;width:140px;"><option value="Todas">Todas las versiones</option><option value="SM64 Co-op DX">SM64 Co-op DX</option><option value="SM64 EX Co-op">SM64 EX Co-op</option></select><select name="categoria" style="background:#161920;border:1px solid #374151;color:white;padding:8px 12px;border-radius:6px;width:150px;"><option value="Todas">Todas las categorías</option><option value="Personajes">Personajes</option><option value="Jugabilidad">Jugabilidad</option></select><button type="submit" class="btn-blue">Filtrar</button></form><p style="color:#9ca3af;margin-bottom:20px;font-weight:bold;">${modsFiltrados.length} mods encontrados</p><div class="grid">${tarjetasHTML}</div></div></body></html>`);
});

app.get('/mod/:id', (req, res) => {
    const sesionUsuario = req.cookies.usuarioSesion || null;
    const modEncontrado = listaMods.find(m => m.id === parseInt(req.params.id));
    if (!modEncontrado) return res.status(404).send('<h1>Mod no encontrado</h1>');
    const yaTieneLike = sesionUsuario ? modEncontrado.usuariosLike.includes(sesionUsuario) : false;
    const claseLike = yaTieneLike ? 'btn-like active' : 'btn-like';
    let fotosHTML = '';
    if (modEncontrado.rutasImagenes) {
        modEncontrado.rutasImagenes.forEach(url => { if(url) fotosHTML += `<div class="gallery-item"><img src="${url}"></div>`; });
    }
    let comentariosHTML = '<p style="color:#9ca3af;margin:0;">No hay comentarios todavía.</p>';
    if (modEncontrado.comentarios && modEncontrado.comentarios.length > 0) {
        comentariosHTML = '';
        modEncontrado.comentarios.forEach(com => { comentariosHTML += `<div class="comment-item"><div class="comment-user">@${com.usuario}</div><p style="margin:0;color:#e1e1e6;font-size:14px;">${com.texto}</p></div>`; });
    }
    let cajaFormularioComentarios = `<p style="color:#9ca3af;"><a href="/login" style="color:#ff3333;">Inicia sesión</a> para comentar.</p>`;
    if (sesionUsuario) cajaFormularioComentarios = `<form action="/comment/${modEncontrado.id}" method="POST"><textarea name="comentarioTexto" placeholder="Escribe un comentario..." rows="2" required></textarea><button type="submit" class="btn-blue">💬 Comentar</button></form>`;

    res.send(`<html><head><title>${modEncontrado.titulo}</title>${estilosCSS}</head><body><div class="navbar"><div class="brand"><a href="/"><img src="https://postimg.cc" class="brand-logo" alt="Logo"></a></div><div class="nav-links"><a href="/">Volver</a></div></div><div class="main-container"><div class="mod-header"><div><div style="margin-bottom:10px;"><span class="tag-version" style="background:#2563eb; color:white;">${modEncontrado.version}</span> <span class="tag-category">${modEncontrado.categoria}</span></div><h1>${modEncontrado.titulo}</h1><div class="mod-meta"><span>por <b>@${modEncontrado.autor}</b></span> <span>⬇ ${modEncontrado.descargas} descargas</span> <a href="/like/${modEncontrado.id}" class="${claseLike}"><span class="estrella-icono"></span> ${modEncontrado.likes} Likes</a></div></div><a href="/download/${modEncontrado.id}" class="btn-red" style="padding:12px 30px;">⬇ Descargar Real .zip</a></div><div class="gallery-container">${fotosHTML}</div><div class="info-box"><h2>Descripción</h2><p>${modEncontrado.descripcion}</p></div><div class="info-box"><h2>💬 Comentarios</h2><div style="margin-bottom:20px;">${comentariosHTML}</div>${cajaFormularioComentarios}</div></div></body></html>`);
});
app.get('/download/:id', (req, res) => {
    const mod = listaMods.find(m => m.id === parseInt(req.params.id));
    if (!mod || !mod.nombreArchivoServidor) return res.status(404).send('Archivo no encontrado');
    mod.descargas += 1; guardarBaseDatos();
    const pathFisico = path.join(__dirname, 'uploads', mod.nombreArchivoServidor);
    res.download(pathFisico, mod.nombreArchivoReal);
});

app.get('/like/:id', (req, res) => {
    const sesionUsuario = req.cookies.usuarioSesion || null;
    if (!sesionUsuario) return res.redirect('/login');
    const mod = listaMods.find(m => m.id === parseInt(req.params.id));
    if (mod) {
        const idx = mod.usuariosLike.indexOf(sesionUsuario);
        if (idx === -1) { mod.likes += 1; mod.usuariosLike.push(sesionUsuario); } 
        else { mod.likes -= 1; mod.usuariosLike.splice(idx, 1); }
        guardarBaseDatos();
    }
    res.redirect(req.headers.referer || '/');
});

app.post('/comment/:id', (req, res) => {
    const sesionUsuario = req.cookies.usuarioSesion || null;
    if (!sesionUsuario) return res.redirect('/login');
    const mod = listaMods.find(m => m.id === parseInt(req.params.id));
    if (mod) { mod.comentarios.push({ usuario: sesionUsuario, texto: req.body.comentarioTexto }); guardarBaseDatos(); }
    res.redirect(`/mod/${req.params.id}`);
});

app.get('/delete/:id', (req, res) => {
    const sesionUsuario = req.cookies.usuarioSesion || null;
    listaMods = listaMods.filter(m => !(m.id === parseInt(req.params.id) && sesionUsuario === m.autor));
    guardarBaseDatos(); res.redirect('/');
});

app.get('/register', (req, res) => res.send(`<html><head>${estilosCSS}</head><body><div class="form-box"><h2>Crear cuenta</h2><form action="/register" method="POST"><label>Usuario</label><input type="text" name="usuario" required><label>Email</label><input type="email" name="email" required><label>Contraseña</label><input type="password" name="password" required><button type="submit" class="btn-red" style="width:100%;">Registrarme</button></form></div></body></html>`));
app.post('/register', (req, res) => { listaUsuarios.push(req.body); guardarBaseDatos(); res.cookie('usuarioSesion', req.body.usuario); res.redirect('/'); });

app.get('/login', (req, res) => res.send(`<html><head>${estilosCSS}</head><body><div class="form-box"><h2>Iniciar sesión</h2><form action="/login" method="POST"><label>Usuario</label><input type="text" name="usuario" required><label>Contraseña</label><input type="password" name="password" required><button type="submit" class="btn-red" style="width:100%;">Ingresar</button></form></div></body></html>`));
app.post('/login', (req, res) => { const u = listaUsuarios.find(user => user.usuario === req.body.usuario && user.password === req.body.password); if (u) { res.cookie('usuarioSesion', u.usuario); res.redirect('/'); } else { res.send('Error. <a href="/login">Volver</a>'); } });
app.get('/logout', (req, res) => { res.clearCookie('usuarioSesion'); res.redirect('/'); });

app.get('/publish', (req, res) => {
    if (!req.cookies.usuarioSesion) return res.redirect('/login');
    res.send(`<html><head><title>Publicar</title>${estilosCSS}</head><body><div class="navbar"><div class="brand"><h2>⭐ Coop Free Mods Rebirth</h2></div></div><div class="form-box"><h2>Publicar nuevo mod</h2><form action="/publish" method="POST" enctype="multipart/form-data"><label>Nombre del Mod:</label><input type="text" name="titulo" required><label>Versión:</label><select name="version"><option value="SM64 Co-op DX">SM64 Co-op DX</option><option value="SM64 EX Co-op">SM64 EX Co-op</option><option value="DX + EX">DX + EX</option></select><label>Categoría:</label><select name="categoria"><option value="Personajes">Personajes</option><option value="Jugabilidad">Jugabilidad</option><option value="HUD / Texturas">HUD / Texturas</option></select><label>Descripción:</label><textarea name="descripcion" required></textarea><label>Archivo del Mod (Sube tu .zip):</label><input type="file" name="archivoMod" required><label>Capturas del Mod (Sube hasta 4 fotos simultáneas):</label><input type="file" name="imagenesMod" accept="image/*" multiple required><button type="submit" class="btn-red" style="width:100%; padding:12px; margin-top:10px;">🚀 Publicar Mod Físico</button></form></div></body></html>`);
});

app.post('/publish', upload.fields([{ name: 'archivoMod', maxCount: 1 }, { name: 'imagenesMod', maxCount: 4 }]), (req, res) => {
    const sesionUsuario = req.cookies.usuarioSesion || null;
    if (!sesionUsuario) return res.redirect('/login');
    const arc = req.files['archivoMod'] ? req.files['archivoMod'][0] : null;
    const imgs = req.files['imagenesMod'] ? req.files['imagenesMod'] : [];
    if (!arc || imgs.length === 0) return res.send('Faltan archivos obligatorios.');
    
    const rutasDeFotos = imgs.map(f => '/uploads/' + f.filename);
    const nuevoMod = {
        id: listaMods.length + 1, titulo: req.body.titulo, descripcion: req.body.descripcion, autor: sesionUsuario, version: req.body.version, categoria: req.body.categoria,
        nombreArchivoReal: arc.originalname, nombreArchivoServidor: arc.filename, rutasImagenes: rutasDeFotos,
        descargas: 0, likes: 0, usuariosLike: [], comentarios: []
    };
    listaMods.push(nuevoMod); guardarBaseDatos(); res.redirect('/');
});

app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));
