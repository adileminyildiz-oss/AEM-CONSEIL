-- ============================================================================
-- AEM-CONSEIL — Tiers (clients & fournisseurs) : persistance cloud (Supabase)
-- À exécuter une fois dans Supabase → SQL Editor.
-- Données isolées par compte via RLS (auth.uid()).
-- ============================================================================

create table if not exists public.tiers (
  user_id    uuid not null references auth.users(id) on delete cascade,
  tiers_id   text not null,
  updated_at timestamptz not null default now(),
  data       jsonb not null,
  primary key (user_id, tiers_id)
);

create index if not exists tiers_user_updated_idx
  on public.tiers (user_id, updated_at desc);

alter table public.tiers enable row level security;

drop policy if exists tiers_rw on public.tiers;
create policy tiers_rw on public.tiers
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
