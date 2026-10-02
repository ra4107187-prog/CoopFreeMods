-- ============================================================
-- Coop Free Mods - Esquema Supabase
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- ============================================================

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id BIGSERIAL PRIMARY KEY,
  usuario TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  descripcion TEXT DEFAULT 'Desarrollador de la comunidad.',
  fecha_registro TEXT DEFAULT to_char(NOW(), 'YYYY'),
  seguidores TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de mods
CREATE TABLE IF NOT EXISTS mods (
  id BIGSERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  autor TEXT NOT NULL REFERENCES usuarios(usuario) ON DELETE CASCADE,
  version TEXT NOT NULL DEFAULT 'SM64 Co-op DX',
  categoria TEXT NOT NULL DEFAULT 'Otros',
  nombre_archivo_real TEXT,
  archivo_path TEXT,
  rutas_imagenes TEXT[] DEFAULT '{}',
  descargas INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  usuarios_like TEXT[] DEFAULT '{}',
  comentarios JSONB DEFAULT '[]',
  historial_actualizaciones JSONB DEFAULT '[]',
  fecha_creacion TEXT DEFAULT to_char(NOW(), 'DD/MM/YYYY'),
  peso_archivo TEXT DEFAULT 'Desconocido',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_mods_autor ON mods(autor);
CREATE INDEX IF NOT EXISTS idx_mods_categoria ON mods(categoria);
CREATE INDEX IF NOT EXISTS idx_mods_version ON mods(version);
CREATE INDEX IF NOT EXISTS idx_mods_descargas ON mods(descargas DESC);
CREATE INDEX IF NOT EXISTS idx_mods_likes ON mods(likes DESC);

-- Políticas RLS (permitir acceso público de lectura/escritura vía service role desde el server)
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE mods ENABLE ROW LEVEL SECURITY;

-- Lectura pública
CREATE POLICY "Lectura pública usuarios" ON usuarios FOR SELECT USING (true);
CREATE POLICY "Lectura pública mods" ON mods FOR SELECT USING (true);

-- Escritura solo con service role (el backend usa la service key, bypass RLS)
-- No creamos policies de INSERT/UPDATE/DELETE públicas a propósito.

-- ============================================================
-- STORAGE
-- En el panel de Supabase → Storage → New bucket:
--   1) Nombre: mods-files     → Public bucket: ON
--   2) Nombre: mods-images    → Public bucket: ON
-- ============================================================
