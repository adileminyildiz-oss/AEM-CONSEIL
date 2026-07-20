-- ============================================================
--  AEM-CONSEIL — Table « tiers » (clients & fournisseurs)
--  À exécuter une seule fois dans Supabase :
--  Dashboard → SQL Editor → New query → coller → Run.
--
--  Chaque tiers est rattaché à un utilisateur (user_id).
--  Les règles RLS garantissent qu'un utilisateur ne voit et ne
--  modifie QUE ses propres tiers.
-- ============================================================

create table if not exists public.tiers (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  type       text not null default 'client' check (type in ('client','fournisseur')),
  nom        text not null,
  siret      text,
  email      text,
  tel        text,
  adr        text,
  cp         text,
  ville      text,
  notes      text,
  created_at timestamptz not null default now()
);

-- Index pour des chargements rapides par utilisateur
create index if not exists tiers_user_id_idx on public.tiers (user_id);

-- Sécurité au niveau des lignes (Row Level Security)
alter table public.tiers enable row level security;

-- Un utilisateur ne peut lire que ses propres tiers
drop policy if exists "tiers_select_own" on public.tiers;
create policy "tiers_select_own" on public.tiers
  for select using (auth.uid() = user_id);

-- …n'insérer que pour lui-même
drop policy if exists "tiers_insert_own" on public.tiers;
create policy "tiers_insert_own" on public.tiers
  for insert with check (auth.uid() = user_id);

-- …ne modifier que ses propres tiers
drop policy if exists "tiers_update_own" on public.tiers;
create policy "tiers_update_own" on public.tiers
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- …ne supprimer que ses propres tiers
drop policy if exists "tiers_delete_own" on public.tiers;
create policy "tiers_delete_own" on public.tiers
  for delete using (auth.uid() = user_id);
