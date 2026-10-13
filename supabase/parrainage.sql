-- Parrainage : chaque compte a un lien personnel (devizo-app.fr/?p=CODE).
--   - Le filleul : son essai gratuit passe de 14 à 44 jours.
--   - Le parrain : 1 mois offert quand le filleul paie son premier abonnement
--     (crédit Stripe s'il paie déjà, sinon essai prolongé d'un mois).
-- À exécuter une fois dans Supabase (SQL Editor > New query > Run), après
-- admin.sql. Peut être relancé sans risque.

create table if not exists public.parrainage_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{4,12}$'),
  cree_le timestamptz not null default now()
);
alter table public.parrainage_codes enable row level security;

create table if not exists public.parrainages (
  filleul uuid primary key references auth.users (id) on delete cascade,
  parrain uuid not null references auth.users (id) on delete cascade,
  code text not null,
  cree_le timestamptz not null default now(),
  recompense_le timestamptz,
  recompense text check (recompense is null or recompense in ('credit', 'essai', 'offre', 'plafond'))
);
create index if not exists parrainages_parrain on public.parrainages (parrain);
alter table public.parrainages enable row level security;
-- Aucune règle d'accès directe : tout passe par les fonctions ci-dessous.

-- Code personnel du compte connecté (créé à la première demande) : début du
-- nom de l'entreprise + 2 chiffres, par exemple DUPONT47.
create or replace function public.mon_code_parrainage()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  existant text;
  prefixe text;
  essai text;
  i int := 0;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  select code into existant from public.parrainage_codes where user_id = uid;
  if existant is not null then return existant; end if;
  select upper(left(regexp_replace(translate(lower(coalesce(donnees -> 'entreprise' ->> 'nom', '')),
      'àâäáãéèêëíìîïóòôöõúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'), '[^a-z]', '', 'g'), 6))
    into prefixe from public.espaces where user_id = uid;
  if coalesce(length(prefixe), 0) < 3 then prefixe := 'DEVIZO'; end if;
  loop
    i := i + 1;
    essai := prefixe || (10 + floor(random() * (case when i < 20 then 90 else 9990 end)))::int::text;
    begin
      insert into public.parrainage_codes (user_id, code) values (uid, essai);
      return essai;
    exception when unique_violation then
      if i > 60 then raise exception 'Code impossible à créer'; end if;
    end;
  end loop;
end;
$$;

-- Nom affiché pour un code (bandeau « Invité par … » sur la page d'accueil).
create or replace function public.info_code_parrainage(c text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object('nom', coalesce(nullif(e.donnees -> 'entreprise' ->> 'nom', ''), 'un artisan'))
  from public.parrainage_codes pc
  left join public.espaces e on e.user_id = pc.user_id
  where pc.code = upper(trim(c));
$$;

-- Le nouveau compte utilise un code : essai porté à 44 jours.
create or replace function public.utiliser_code_parrainage(c text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cible uuid;
  cree timestamptz;
  fin timestamptz;
  nom text;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  select user_id into cible from public.parrainage_codes where code = upper(trim(c));
  if cible is null then return json_build_object('ok', false, 'raison', 'code inconnu'); end if;
  if cible = uid then return json_build_object('ok', false, 'raison', 'propre code'); end if;
  if exists (select 1 from public.parrainages where filleul = uid) then return json_build_object('ok', false, 'raison', 'déjà parrainé'); end if;
  select created_at into cree from auth.users where id = uid;
  if cree < now() - interval '3 days' then return json_build_object('ok', false, 'raison', 'compte trop ancien'); end if;
  if public.paye_par_stripe(uid) or exists (select 1 from public.membres where membre = uid) then
    return json_build_object('ok', false, 'raison', 'déjà abonné');
  end if;
  insert into public.parrainages (filleul, parrain, code) values (uid, cible, upper(trim(c)));
  -- Essai : 14 jours + 30 jours offerts.
  fin := greatest(cree + interval '44 days',
    coalesce((select a.fin_periode from public.abonnements a where a.user_id = uid and a.offert = 'essai'), cree));
  if not exists (select 1 from public.abonnements a where a.user_id = uid and a.offert = 'cadeau') then
    insert into public.abonnements as a (user_id, formule, statut, fin_periode, offert, fin_prevue, stripe_abonnement)
      values (uid, 'equipe', 'trialing', fin, 'essai', true, null)
      on conflict (user_id) do update set formule = 'equipe', statut = 'trialing', fin_periode = fin,
        offert = 'essai', fin_prevue = true, stripe_abonnement = null, mis_a_jour = now();
  end if;
  select coalesce(nullif(donnees -> 'entreprise' ->> 'nom', ''), 'un artisan') into nom from public.espaces where user_id = cible;
  return json_build_object('ok', true, 'parrain', coalesce(nom, 'un artisan'), 'fin_essai', fin);
end;
$$;

-- Récompense du parrain sans Stripe (appelée par la fonction « stripe-webhook » avec la clé serveur) :
-- essai prolongé d'un mois, ou formule offerte prolongée d'un mois.
create or replace function public.parrainage_prolonger(p uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.abonnements;
  cree timestamptz;
  fin timestamptz;
begin
  select * into a from public.abonnements where user_id = p;
  if found and a.offert = 'cadeau' then
    if a.fin_periode is null then return 'offre'; end if;
    update public.abonnements set fin_periode = greatest(fin_periode, now()) + interval '30 days', mis_a_jour = now() where user_id = p;
    return 'offre';
  end if;
  select created_at into cree from auth.users where id = p;
  fin := greatest(now(), cree + interval '14 days', coalesce(case when a.offert = 'essai' then a.fin_periode end, now())) + interval '30 days';
  insert into public.abonnements as x (user_id, formule, statut, fin_periode, offert, fin_prevue, stripe_abonnement)
    values (p, 'equipe', 'trialing', fin, 'essai', true, null)
    on conflict (user_id) do update set formule = 'equipe', statut = 'trialing', fin_periode = fin,
      offert = 'essai', fin_prevue = true, stripe_abonnement = null, mis_a_jour = now();
  return 'essai';
end;
$$;

-- Tableau du parrain : son code, ses filleuls (adresse masquée) et ses mois gagnés.
create or replace function public.mes_parrainages()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  code text;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  code := public.mon_code_parrainage();
  return json_build_object(
    'code', code,
    'inscrits', (select count(*) from public.parrainages where parrain = uid),
    'abonnes', (select count(*) from public.parrainages where parrain = uid and recompense_le is not null),
    'mois', (select count(*) from public.parrainages where parrain = uid and recompense in ('credit', 'essai', 'offre')),
    'filleuls', (select coalesce(json_agg(json_build_object(
        'nom', coalesce(nullif(e.donnees -> 'entreprise' ->> 'nom', ''),
          left(split_part(u.email, '@', 1), 2) || '•••@' || split_part(u.email, '@', 2)),
        'inscrit_le', p.cree_le, 'abonne', p.recompense_le is not null) order by p.cree_le desc), '[]'::json)
      from public.parrainages p join auth.users u on u.id = p.filleul left join public.espaces e on e.user_id = p.filleul
      where p.parrain = uid)
  );
end;
$$;

-- Panel d'administration : tous les parrainages.
create or replace function public.admin_parrainages()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.est_admin() then raise exception 'Accès réservé aux administrateurs'; end if;
  return json_build_object(
    'total', (select count(*) from public.parrainages),
    'payants', (select count(*) from public.parrainages where recompense_le is not null),
    'liste', (select coalesce(json_agg(json_build_object(
        'parrain', up.email, 'filleul', uf.email, 'le', p.cree_le, 'recompense', p.recompense, 'recompense_le', p.recompense_le)
        order by p.cree_le desc), '[]'::json)
      from public.parrainages p join auth.users up on up.id = p.parrain join auth.users uf on uf.id = p.filleul)
  );
end;
$$;

revoke all on function public.mon_code_parrainage() from public, anon;
grant execute on function public.mon_code_parrainage() to authenticated;
revoke all on function public.info_code_parrainage(text) from public;
grant execute on function public.info_code_parrainage(text) to anon, authenticated;
revoke all on function public.utiliser_code_parrainage(text) from public, anon;
grant execute on function public.utiliser_code_parrainage(text) to authenticated;
revoke all on function public.parrainage_prolonger(uuid) from public, anon, authenticated;
revoke all on function public.mes_parrainages() from public, anon;
grant execute on function public.mes_parrainages() to authenticated;
revoke all on function public.admin_parrainages() from public, anon;
grant execute on function public.admin_parrainages() to authenticated;
