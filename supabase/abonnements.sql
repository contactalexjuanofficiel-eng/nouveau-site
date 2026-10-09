-- Abonnements Devizo (Stripe). À exécuter une fois dans Supabase : SQL Editor > New query > Run.
-- Peut être relancé sans risque.

-- Un abonnement par compte, écrit uniquement par la fonction « stripe-webhook »
-- (clé service), jamais par le navigateur.
create table if not exists public.abonnements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  formule text not null check (formule in ('solo', 'pro')),
  statut text not null,
  fin_periode timestamptz,
  stripe_client text,
  stripe_abonnement text unique,
  mis_a_jour timestamptz not null default now()
);

-- Résiliation demandée : l'abonnement reste actif jusqu'à fin_periode, sans renouvellement.
alter table public.abonnements add column if not exists fin_prevue boolean not null default false;

alter table public.abonnements enable row level security;

drop policy if exists "Lire son abonnement" on public.abonnements;
create policy "Lire son abonnement" on public.abonnements
  for select using (auth.uid() = user_id);

-- Accès en écriture : pendant les 14 jours d'essai, ou avec un abonnement
-- en cours (3 jours de tolérance après la fin de période, le temps du renouvellement).
create or replace function public.acces_actif(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
      select 1 from auth.users u
      where u.id = uid and u.created_at > now() - interval '14 days'
    )
    or exists (
      select 1 from public.abonnements a
      where a.user_id = uid
        and a.statut in ('active', 'trialing', 'past_due')
        and (a.fin_periode is null or a.fin_periode > now() - interval '3 days')
    );
$$;

revoke all on function public.acces_actif(uuid) from public, anon;
grant execute on function public.acces_actif(uuid) to authenticated;

-- Après l'essai sans abonnement : les données restent lisibles, mais ne
-- peuvent plus être modifiées.
drop policy if exists "Créer son espace" on public.espaces;
create policy "Créer son espace" on public.espaces
  for insert with check (auth.uid() = user_id and public.acces_actif(auth.uid()));

drop policy if exists "Modifier son espace" on public.espaces;
create policy "Modifier son espace" on public.espaces
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.acces_actif(auth.uid()));
