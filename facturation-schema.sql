-- ============================================================================
-- AEM-CONSEIL — Facturation : persistance cloud (Supabase)
-- À exécuter une fois dans Supabase → SQL Editor.
-- Toutes les données sont isolées par compte via RLS (auth.uid()).
-- ============================================================================

-- Profil émetteur (un par compte) : raison sociale, SIRET, RCS, IBAN…
create table if not exists public.fact_profile (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Documents : factures, devis, avoirs. Le JSON complet vit dans `data`,
-- les colonnes dénormalisées servent au tri / aux filtres.
create table if not exists public.fact_documents (
  user_id    uuid not null references auth.users(id) on delete cascade,
  doc_id     text not null,
  kind       text,                 -- 'facture' | 'devis' | 'avoir'
  number     text,
  status     text,                 -- 'brouillon' | 'emise' | 'payee' | 'annulee' | 'envoye' | 'accepte' | 'refuse'
  updated_at timestamptz not null default now(),
  data       jsonb not null,
  primary key (user_id, doc_id)
);

create index if not exists fact_documents_user_updated_idx
  on public.fact_documents (user_id, updated_at desc);

-- ============================================================================
-- RLS : chaque utilisateur ne voit et ne modifie que ses propres lignes.
-- ============================================================================
alter table public.fact_profile   enable row level security;
alter table public.fact_documents enable row level security;

drop policy if exists fact_profile_rw on public.fact_profile;
create policy fact_profile_rw on public.fact_profile
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists fact_documents_rw on public.fact_documents;
create policy fact_documents_rw on public.fact_documents
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
