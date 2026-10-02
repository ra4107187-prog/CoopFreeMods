# Coop Free Mods (Supabase + Vercel)

Sitio de mods para SM64 Co-op / Co-op DX con base de datos y archivos persistentes.

## 1. Crear proyecto en Supabase (gratis)

1. Entrá a [https://supabase.com](https://supabase.com) y creá un proyecto.
2. Andá a **SQL Editor** → New query.
3. Pegá todo el contenido de `supabase-schema.sql` y ejecutá **Run**.
4. Andá a **Storage** → New bucket:
   - Nombre: `mods-files` → **Public bucket: ON**
   - Nombre: `mods-images` → **Public bucket: ON**
5. Andá a **Project Settings → API** y copiá:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** (secret) → `SUPABASE_SERVICE_ROLE_KEY`  
     ⚠️ Usá la clave **service_role**, no la `anon`.

## 2. Probar en local (opcional)

```bash
cd coopfreemods-vercel
cp .env.example .env
# Editá .env con tus claves de Supabase

npm install
npm start
# Abrí http://localhost:3000
```

## 3. Subir a Vercel

### Opción A – Desde la web de Vercel

1. Subí esta carpeta a un repo de GitHub (o importá el ZIP).
2. En [vercel.com](https://vercel.com) → **Add New Project** → importá el repo.
3. En **Environment Variables** agregá:
   - `SUPABASE_URL` = tu Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = tu service_role key
4. Deploy.

### Opción B – Con CLI

```bash
npm i -g vercel
vercel login
vercel
# Cuando pregunte por env vars, agregá SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
vercel --prod
```

## Qué cambió respecto a la versión anterior

| Antes (Render/Railway)     | Ahora (Supabase + Vercel)        |
|----------------------------|----------------------------------|
| `baseDatos.json` en disco  | Tabla PostgreSQL en Supabase     |
| Carpeta `uploads/` local   | Supabase Storage (público)       |
| Se borra al dormir         | Datos permanentes                |
| Contraseñas en texto plano | Hash con bcrypt                  |
| Cookie simple              | Cookie httpOnly                  |

## Estructura

```
coopfreemods-vercel/
├── server.js              # App Express (compatible Vercel)
├── lib/
│   ├── supabase.js        # Cliente Supabase
│   └── styles.js          # CSS
├── public/
│   ├── logo.png
│   └── fondo.jpg
├── supabase-schema.sql    # Tablas + índices
├── vercel.json
├── package.json
└── .env.example
```

## Límites del plan free de Supabase

- 500 MB de base de datos
- 1 GB de Storage
- Suficiente para cientos de mods pequeños

Si crece mucho, podés subir de plan o mover archivos pesados a Cloudflare R2.
