-- Base de données de Devizo (Supabase).
-- À coller une seule fois dans Supabase : SQL Editor > New query > Run.

-- Un « espace » par compte : toutes les données de l'artisan (entreprise,
-- clients, devis, factures, dépenses, catalogue) dans un seul document JSON.
create table if not exists public.espaces (
  user_id uuid primary key references auth.users (id) on delete cascade,
  donnees jsonb not null default '{}'::jsonb,
  mis_a_jour timestamptz not null default now()
);

-- Chaque compte ne voit et ne modifie que ses propres données.
alter table public.espaces enable row level security;

drop policy if exists "Lire son espace" on public.espaces;
create policy "Lire son espace" on public.espaces
  for select using (auth.uid() = user_id);

drop policy if exists "Créer son espace" on public.espaces;
create policy "Créer son espace" on public.espaces
  for insert with check (auth.uid() = user_id);

drop policy if exists "Modifier son espace" on public.espaces;
create policy "Modifier son espace" on public.espaces
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Suppression du compte par l'utilisateur lui-même (droit à l'effacement, RGPD).
-- Supprimer l'utilisateur supprime aussi son espace (on delete cascade).
create or replace function public.supprimer_mon_compte()
returns void
language sql
security definer
set search_path = public
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.supprimer_mon_compte() from public, anon;
grant execute on function public.supprimer_mon_compte() to authenticated;

-- Abonnements : voir supabase/abonnements.sql (à exécuter après ce fichier).
