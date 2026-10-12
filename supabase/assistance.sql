-- Assistance : les utilisateurs écrivent depuis l'appli (page « Assistance »),
-- les demandes des clients Entreprise sont marquées prioritaires.
-- À exécuter une fois dans Supabase (SQL Editor > New query > Run), après
-- admin.sql. Peut être relancé sans risque.

create table if not exists public.demandes_assistance (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null default '',
  categorie text not null check (categorie in ('question', 'probleme', 'abonnement', 'suggestion')),
  sujet text not null check (length(sujet) between 2 and 150),
  message text not null check (length(message) between 5 and 5000),
  formule text,
  prioritaire boolean not null default false,
  contexte jsonb check (contexte is null or length(contexte::text) <= 2000),
  notifiee boolean not null default false,
  cree_le timestamptz not null default now(),
  traitee_le timestamptz
);
create index if not exists demandes_assistance_user on public.demandes_assistance (user_id, cree_le);
create index if not exists demandes_assistance_ouvertes on public.demandes_assistance (traitee_le, prioritaire, cree_le);

alter table public.demandes_assistance enable row level security;

drop policy if exists "Voir ses demandes" on public.demandes_assistance;
create policy "Voir ses demandes" on public.demandes_assistance
  for select using (auth.uid() = user_id or public.est_admin());
drop policy if exists "Écrire une demande" on public.demandes_assistance;
create policy "Écrire une demande" on public.demandes_assistance
  for insert with check (auth.uid() = user_id);
drop policy if exists "Traiter une demande" on public.demandes_assistance;
create policy "Traiter une demande" on public.demandes_assistance
  for update using (public.est_admin()) with check (public.est_admin());
drop policy if exists "Supprimer une demande" on public.demandes_assistance;
create policy "Supprimer une demande" on public.demandes_assistance
  for delete using (public.est_admin());

-- À la création : e-mail, formule et priorité calculés par le serveur (jamais
-- fournis par le navigateur), et 10 demandes par jour au plus.
create or replace function public.preparer_demande_assistance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  abo public.abonnements;
  proprio uuid;
begin
  if (select count(*) from public.demandes_assistance
      where user_id = new.user_id and cree_le > now() - interval '1 day') >= 10 then
    raise exception 'Vous avez déjà envoyé 10 demandes aujourd''hui. Réessayez demain.';
  end if;
  new.email := coalesce((select email from auth.users where id = new.user_id), '');
  new.cree_le := now();
  new.traitee_le := null;
  new.notifiee := false;
  new.prioritaire := false;

  select m.proprietaire into proprio from public.membres m where m.membre = new.user_id;
  if proprio is not null and public.equipe_active(proprio) then
    new.formule := 'equipe (membre)';
    new.prioritaire := true;
    return new;
  end if;

  select * into abo from public.abonnements a where a.user_id = new.user_id;
  if found and public.abonnement_en_cours(abo) then
    if abo.offert = 'essai' then
      new.formule := 'essai';
    else
      new.formule := abo.formule || case when abo.offert = 'cadeau' then ' (offert)' else '' end;
      new.prioritaire := abo.formule = 'equipe';
    end if;
  elsif exists (select 1 from auth.users u where u.id = new.user_id and u.created_at > now() - interval '14 days') then
    new.formule := 'essai';
  else
    new.formule := 'aucune';
  end if;
  return new;
end;
$$;

drop trigger if exists preparer_demande_assistance on public.demandes_assistance;
create trigger preparer_demande_assistance before insert on public.demandes_assistance
  for each row execute function public.preparer_demande_assistance();
