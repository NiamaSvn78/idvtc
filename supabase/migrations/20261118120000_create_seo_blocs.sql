-- Blocs SEO validés sur Telegram (Make → POST /api/seo-blocs), injectés au build Vercel.
create extension if not exists pgcrypto;

create table if not exists public.seo_blocs (
  id uuid primary key default gen_random_uuid(),
  action_id text unique not null,          -- id de l'action Airtable (rec...)
  type text not null,                       -- Contenu | Maillage & enrichissement | Title/Meta | Défense
  page_path text not null,                  -- ex. /chauffeur-prive-neuilly-sur-seine
  bloc_md text,                             -- Markdown (FR, ou langue de la page)
  bloc_en text,                             -- Markdown EN (vide → version FR dans les deux langues)
  title text,
  meta text,
  liens text,                               -- lignes "/page-source | phrase avec [lien](/cible)"
  actif boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.seo_blocs add column if not exists bloc_en text;
create index if not exists seo_blocs_page_idx on public.seo_blocs (page_path, actif, created_at desc);
alter table public.seo_blocs enable row level security;
-- Aucune policy publique : seul le serveur (clé service_role) lit et écrit.
revoke all on public.seo_blocs from anon, authenticated;
