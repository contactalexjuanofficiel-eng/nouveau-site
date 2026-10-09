-- Formule Équipe : jusqu'à 5 utilisateurs (le titulaire + 4 membres) sur les
-- mêmes données. À exécuter une fois dans Supabase, après schema.sql et
-- abonnements.sql : SQL Editor > New query > Run. Peut être relancé sans risque.

-- 1. La formule « equipe » est acceptée dans les abonnements.
alter table public.abonnements drop constraint if exists abonnements_formule_check;
alter table public.abonnements add constraint abonnements_formule_check
  check (formule in ('solo', 'pro', 'equipe'));

-- 2. Membres invités par un titulaire. « membre » est rempli quand la personne
-- invitée rejoint l'équipe avec un compte à cette adresse e-mail.
create table if not exists public.membres (
  proprietaire uuid not null references auth.users (id) on delete cascade,
  email text not null check (email = lower(email)),
  membre uuid references auth.users (id) on delete cascade,
  invite_le timestamptz not null default now(),
  primary key (proprietaire, email)
);
-- Une personne ne fait partie que d'une seule équipe.
create unique index if not exists membres_un_seul_membre on public.membres (membre) where membre is not null;

alter table public.membres enable row level security;

drop policy if exists "Voir son équipe" on public.membres;
create policy "Voir son équipe" on public.membres
  for select using (auth.uid() = proprietaire or auth.uid() = membre);

-- Le titulaire retire un membre ; un membre peut quitter l'équipe.
drop policy if exists "Retirer un membre" on public.membres;
create policy "Retirer un membre" on public.membres
  for delete using (auth.uid() = proprietaire or auth.uid() = membre);
-- Pas d'ajout direct : uniquement par inviter_membre() (limite et formule vérifiées).

-- 3. Outils pour les règles d'accès.
create or replace function public.est_membre_de(proprio uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.membres where proprietaire = proprio and membre = auth.uid());
$$;

-- L'équipe fonctionne pendant l'essai de 14 jours du titulaire, ou avec un abonnement Équipe en cours.
create or replace function public.equipe_active(proprio uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
      select 1 from auth.users u
      where u.id = proprio and u.created_at > now() - interval '14 days'
    )
    or exists (
      select 1 from public.abonnements a
      where a.user_id = proprio
        and a.formule = 'equipe'
        and a.statut in ('active', 'trialing', 'past_due')
        and (a.fin_periode is null or a.fin_periode > now() - interval '3 days')
    );
$$;

revoke all on function public.est_membre_de(uuid) from public, anon;
grant execute on function public.est_membre_de(uuid) to authenticated;
revoke all on function public.equipe_active(uuid) from public, anon;
grant execute on function public.equipe_active(uuid) to authenticated;

-- 4. Les membres lisent et modifient l'espace du titulaire.
drop policy if exists "Lire son espace" on public.espaces;
create policy "Lire son espace" on public.espaces
  for select using (auth.uid() = user_id or public.est_membre_de(user_id));

drop policy if exists "Modifier son espace" on public.espaces;
create policy "Modifier son espace" on public.espaces
  for update using (auth.uid() = user_id or public.est_membre_de(user_id))
  with check (
    (auth.uid() = user_id and public.acces_actif(auth.uid()))
    or (public.est_membre_de(user_id) and public.equipe_active(user_id))
  );

-- 5. Inviter un membre (titulaire uniquement, 4 membres au plus).
create or replace function public.inviter_membre(adresse text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  e text := lower(trim(adresse));
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Adresse e-mail invalide'; end if;
  if e = lower(auth.email()) then raise exception 'Vous faites déjà partie de votre équipe'; end if;
  if exists (select 1 from public.membres where membre = auth.uid()) then
    raise exception 'Vous êtes membre d''une autre équipe : quittez-la pour créer la vôtre';
  end if;
  if not public.equipe_active(auth.uid()) then raise exception 'La formule Équipe est nécessaire pour inviter'; end if;
  if (select count(*) from public.membres where proprietaire = auth.uid()) >= 4 then
    raise exception 'Votre équipe est complète (5 utilisateurs au plus)';
  end if;
  insert into public.membres (proprietaire, email) values (auth.uid(), e)
  on conflict do nothing;
  return e;
end;
$$;

revoke all on function public.inviter_membre(text) from public, anon;
grant execute on function public.inviter_membre(text) to authenticated;

-- 6. Invitations reçues (adresse e-mail confirmée uniquement).
create or replace function public.mes_invitations()
returns table (proprietaire uuid, email_titulaire text, entreprise text)
language sql
stable
security definer
set search_path = public
as $$
  select m.proprietaire, u.email::text, coalesce(s.donnees -> 'entreprise' ->> 'nom', '')
  from public.membres m
  join auth.users u on u.id = m.proprietaire
  left join public.espaces s on s.user_id = m.proprietaire
  where m.membre is null
    and m.email = lower(auth.email())
    and exists (select 1 from auth.users moi where moi.id = auth.uid() and moi.email_confirmed_at is not null)
    and not exists (select 1 from public.membres d where d.membre = auth.uid());
$$;

revoke all on function public.mes_invitations() from public, anon;
grant execute on function public.mes_invitations() to authenticated;

create or replace function public.rejoindre_equipe(proprio uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null) then
    raise exception 'Adresse e-mail non confirmée';
  end if;
  if exists (select 1 from public.membres where proprietaire = auth.uid()) then
    raise exception 'Vous avez votre propre équipe : retirez d''abord vos membres';
  end if;
  update public.membres set membre = auth.uid()
  where proprietaire = proprio and email = lower(auth.email()) and membre is null;
  if not found then raise exception 'Invitation introuvable'; end if;
end;
$$;

revoke all on function public.rejoindre_equipe(uuid) from public, anon;
grant execute on function public.rejoindre_equipe(uuid) to authenticated;

-- 7. Ce que l'application doit savoir : titulaire ou membre, et l'abonnement qui donne l'accès.
create or replace function public.mon_equipe()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select case
    when m.proprietaire is not null then json_build_object(
      'role', 'membre',
      'proprietaire', m.proprietaire,
      'email_titulaire', u.email,
      'cree_le', u.created_at,
      'active', public.equipe_active(m.proprietaire),
      'abonnement', (select row_to_json(a) from (
        select formule, statut, fin_periode, fin_prevue from public.abonnements where user_id = m.proprietaire) a))
    else json_build_object(
      'role', 'titulaire',
      'membres', coalesce((select json_agg(json_build_object('email', x.email, 'actif', x.membre is not null) order by x.invite_le)
        from public.membres x where x.proprietaire = auth.uid()), '[]'::json))
  end
  from (select 1) _
  left join public.membres m on m.membre = auth.uid()
  left join auth.users u on u.id = m.proprietaire;
$$;

revoke all on function public.mon_equipe() from public, anon;
grant execute on function public.mon_equipe() to authenticated;
