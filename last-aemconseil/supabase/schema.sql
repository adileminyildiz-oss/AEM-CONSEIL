-- ============================================================================
-- LAST — last.aemconseil.eu
-- Schéma Supabase : traitement des demandes (P1) + fondations formalités (P3)
-- À exécuter dans l'éditeur SQL du projet Supabase dédié.
-- ============================================================================

-- Extensions
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Profils du cabinet (liés à auth.users)
-- ----------------------------------------------------------------------------
create table if not exists public.profils (
  id          uuid primary key references auth.users(id) on delete cascade,
  nom         text,
  role        text not null default 'gestionnaire'
              check (role in ('admin','gestionnaire','lecture')),
  cree_le     timestamptz not null default now()
);

-- Un utilisateur authentifié est « membre du cabinet » s'il a un profil.
create or replace function public.est_cabinet()
returns boolean language sql stable as $$
  select exists (select 1 from public.profils p where p.id = auth.uid());
$$;

-- ----------------------------------------------------------------------------
-- Clients
-- ----------------------------------------------------------------------------
create table if not exists public.clients (
  id                uuid primary key default gen_random_uuid(),
  type              text not null default 'societe' check (type in ('societe','particulier')),
  siren             text,
  siret             text,
  raison_sociale    text,
  nom               text,
  prenom            text,
  adresse           text,
  cp                text,
  ville             text,
  email             text,
  telephone         text,
  tva               text,
  forme_juridique   text,
  source_demande_id uuid,
  cree_le           timestamptz not null default now(),
  maj_le            timestamptz not null default now()
);
create index if not exists clients_siren_idx on public.clients (siren);

-- ----------------------------------------------------------------------------
-- Demandes (intake unifiée depuis aemconseil.eu)
-- ----------------------------------------------------------------------------
create table if not exists public.demandes (
  id           uuid primary key default gen_random_uuid(),
  source       text not null default 'autre'
               check (source in ('contact','rappel','rdv','newsletter','kit','chatbot','identification','autre')),
  type         text,
  nom          text,
  prenom       text,
  email        text,
  telephone    text,
  siren        text,
  entreprise   text,
  objet        text,
  message      text,
  statut       text not null default 'nouveau'
               check (statut in ('nouveau','qualifie','en_cours','converti','perdu','clos')),
  priorite     text not null default 'normale' check (priorite in ('basse','normale','haute')),
  assigned_to  uuid references public.profils(id),
  client_id    uuid references public.clients(id),
  meta         jsonb not null default '{}'::jsonb,
  cree_le      timestamptz not null default now(),
  maj_le       timestamptz not null default now()
);
create index if not exists demandes_statut_idx on public.demandes (statut);
create index if not exists demandes_source_idx on public.demandes (source);
create index if not exists demandes_cree_le_idx on public.demandes (cree_le desc);

-- ----------------------------------------------------------------------------
-- Dossiers de formalités (fondations P3)
-- ----------------------------------------------------------------------------
create table if not exists public.dossiers_formalites (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid references public.clients(id),
  type_formalite  text not null default 'creation'
                  check (type_formalite in ('creation','modification','cessation','comptes')),
  sous_type       text,
  statut          text not null default 'a_faire'
                  check (statut in ('a_faire','pieces_attendues','en_cours','depose_inpi','attente_greffe','clos')),
  reference_inpi  text,
  echeance        date,
  honoraires      numeric(10,2),
  facture_yada_id text,
  assigned_to     uuid references public.profils(id),
  notes           text,
  cree_le         timestamptz not null default now(),
  maj_le          timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Pièces / documents (stockage privé)
-- ----------------------------------------------------------------------------
create table if not exists public.pieces (
  id           uuid primary key default gen_random_uuid(),
  dossier_id   uuid references public.dossiers_formalites(id) on delete cascade,
  nom          text,
  type         text,
  storage_path text,
  statut       text not null default 'attendue' check (statut in ('attendue','recue','validee','rejetee')),
  cree_le      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Journal d'activité
-- ----------------------------------------------------------------------------
create table if not exists public.activity_log (
  id        bigserial primary key,
  entite    text,
  entite_id uuid,
  action    text,
  acteur    uuid,
  payload   jsonb,
  le        timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- RLS : accès réservé aux membres du cabinet
-- ----------------------------------------------------------------------------
alter table public.profils            enable row level security;
alter table public.clients            enable row level security;
alter table public.demandes           enable row level security;
alter table public.dossiers_formalites enable row level security;
alter table public.pieces             enable row level security;
alter table public.activity_log       enable row level security;

-- Chacun lit son propre profil ; les admins gèrent les profils.
create policy profils_self_read on public.profils
  for select using (id = auth.uid() or public.est_cabinet());

-- Tables métier : lecture/écriture réservées aux membres du cabinet.
do $$
declare t text;
begin
  foreach t in array array['clients','demandes','dossiers_formalites','pieces','activity_log']
  loop
    execute format('create policy %I_cabinet_all on public.%I for all using (public.est_cabinet()) with check (public.est_cabinet());', t, t);
  end loop;
end $$;

-- Intake public : le site aemconseil.eu insère les demandes directement via
-- l'API REST (clé publishable). Insertion autorisée pour tous, mais AUCUNE
-- lecture / mise à jour / suppression anonyme (celles-ci restent gérées par la
-- policy cabinet ci-dessus). L'Edge Function `intake` reste une alternative
-- possible si vous souhaitez ajouter une notification e-mail côté serveur.
create policy demandes_public_insert on public.demandes for insert with check (true);
