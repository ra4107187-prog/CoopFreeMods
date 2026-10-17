-- Ejecutá esto en Supabase → SQL Editor

-- Tags, reseñas y mod de la semana
alter table public.mods add column if not exists tags jsonb default '[]'::jsonb;
alter table public.mods add column if not exists reviews jsonb default '[]'::jsonb;
alter table public.mods add column if not exists destacado boolean default false;

-- Mensajes privados
create table if not exists public.mensajes (
  id bigserial primary key,
  de text not null,
  para text not null,
  texto text not null,
  leido boolean default false,
  created_at timestamptz default now()
);
alter table public.mensajes enable row level security;
create policy "mensajes_all" on public.mensajes for all using (true) with check (true);

-- Playlists CoopTube
create table if not exists public.playlists (
  id bigserial primary key,
  titulo text not null,
  autor text not null,
  video_ids jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);
alter table public.playlists enable row level security;
create policy "playlists_all" on public.playlists for all using (true) with check (true);
