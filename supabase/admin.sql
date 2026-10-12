-- Panel d'administration de Devizo (page admin.html).
-- À exécuter une fois dans Supabase (SQL Editor > New query > Run), après
-- schema.sql, abonnements.sql, equipe.sql et partage.sql. Peut être relancé sans risque.
--
-- IMPORTANT : à la toute fin de ce fichier, remplacez le texte VOTRE-EMAIL-ICI par l'adresse
-- de votre compte Devizo pour devenir administrateur.

-- 1. Liste des administrateurs. Aucune règle d'accès : personne ne peut la lire
-- ni la modifier depuis le navigateur, seulement depuis le SQL Editor.
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  ajoute_le timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.est_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.est_admin() from public, anon;
grant execute on function public.est_admin() to authenticated;

-- 2. Mesure d'audience sans cookie : un simple compteur de visites par jour et
-- par page, sans aucune donnée personnelle (exempté de consentement, CNIL).
create table if not exists public.visites (
  jour date not null default current_date,
  page text not null,
  n integer not null default 0,
  primary key (jour, page)
);
alter table public.visites enable row level security;
-- D'où vient le visiteur (Google, Facebook, lien direct…) et sur quel appareil.
alter table public.visites add column if not exists source text not null default 'direct';
alter table public.visites add column if not exists appareil text not null default 'inconnu';
alter table public.visites drop constraint if exists visites_pkey;
alter table public.visites add constraint visites_pkey primary key (jour, page, source, appareil);

drop function if exists public.compter_visite(text);
drop function if exists public.compter_visite(text, text, text);
create or replace function public.compter_visite(p text, s text default 'direct', a text default 'inconnu')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p not in ('accueil', 'app', 'signer', 'legal') then
    return;
  end if;
  if s is null or s not in ('direct', 'interne', 'google', 'bing', 'autre-moteur', 'facebook', 'instagram', 'tiktok',
      'linkedin', 'youtube', 'x', 'whatsapp', 'pinterest', 'snapchat', 'email', 'autre-site') then
    s := 'autre-site';
  end if;
  if a is null or a not in ('mobile', 'tablette', 'ordinateur') then
    a := 'inconnu';
  end if;
  insert into public.visites as v (jour, page, source, appareil, n) values (current_date, p, s, a, 1)
    on conflict (jour, page, source, appareil) do update set n = v.n + 1;
end;
$$;
revoke all on function public.compter_visite(text, text, text) from public;
grant execute on function public.compter_visite(text, text, text) to anon, authenticated;

-- Abonnements offerts par l'administrateur : « essai » (essai prolongé) ou
-- « cadeau » (formule offerte). Un vrai abonnement Stripe remplace l'offre.
alter table public.abonnements add column if not exists offert text;
alter table public.abonnements drop constraint if exists abonnements_offert_check;
alter table public.abonnements add constraint abonnements_offert_check check (offert is null or offert in ('essai', 'cadeau'));

create or replace function public.abonnement_stripe_remplace_offre()
returns trigger
language plpgsql
as $$
begin
  if new.stripe_abonnement is not null then
    new.offert := null;
  end if;
  return new;
end;
$$;
drop trigger if exists abonnement_stripe_remplace_offre on public.abonnements;
create trigger abonnement_stripe_remplace_offre before insert or update on public.abonnements
  for each row execute function public.abonnement_stripe_remplace_offre();

-- Conversion sans erreur d'une valeur JSON en nombre (0 si vide ou invalide).
create or replace function public.nombre_sur(v text)
returns numeric
language sql
immutable
as $$
  select case when v ~ '^\s*-?[0-9]+(\.[0-9]+)?([eE][-+]?[0-9]+)?\s*$' then v::numeric else 0 end;
$$;

-- Abonnement en cours (même règle que acces_actif).
create or replace function public.abonnement_en_cours(a public.abonnements)
returns boolean
language sql
stable
as $$
  select a.statut in ('active', 'trialing', 'past_due')
    and (a.fin_periode is null or a.fin_periode > now() - interval '3 days');
$$;

-- 3. Statistiques globales (administrateurs uniquement).
create or replace function public.admin_stats()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  resultat json;
begin
  if not public.est_admin() then
    raise exception 'Accès réservé aux administrateurs';
  end if;

  with
  abos as (
    select a.*,
      -- Abonnement annuel si la prochaine échéance est à plus de 35 jours.
      (a.fin_periode is not null and a.fin_periode > now() + interval '35 days') as annuel
    from public.abonnements a
    where public.abonnement_en_cours(a) and a.offert is null
  ),
  entrees as (
    -- Arrivées sur le site (hors navigation d'une page à l'autre), 30 derniers jours.
    select source, appareil, sum(n) n from public.visites
    where jour > current_date - 30 and source <> 'interne'
    group by source, appareil
  ),
  docs as (
    select d
    from public.espaces e, jsonb_array_elements(coalesce(e.donnees -> 'documents', '[]'::jsonb)) d
  ),
  factures as (
    select d,
      (select coalesce(sum(public.nombre_sur(l ->> 'quantite') * public.nombre_sur(l ->> 'prixUnitaire')), 0)
         from jsonb_array_elements(coalesce(d -> 'lignes', '[]'::jsonb)) l) as ht
    from docs
    where d ->> 'type' = 'facture'
  ),
  jours as (
    select generate_series(current_date - 29, current_date, interval '1 day')::date as jour
  )
  select json_build_object(
    'utilisateurs', (select count(*) from auth.users),
    'nouveaux_7j', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'nouveaux_30j', (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'actifs_7j', (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'actifs_30j', (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),
    'non_confirmes', (select count(*) from auth.users where email_confirmed_at is null),
    'en_essai', (select count(*) from auth.users u
                 where u.created_at > now() - interval '14 days'
                   and not exists (select 1 from abos where abos.user_id = u.id)
                   and not exists (select 1 from public.membres m where m.membre = u.id)),
    'membres_equipe', (select count(*) from public.membres where membre is not null),
    'offerts', (select count(*) from public.abonnements a where a.offert = 'cadeau' and public.abonnement_en_cours(a)),
    'essais_prolonges', (select count(*) from public.abonnements a where a.offert = 'essai' and public.abonnement_en_cours(a)),
    'sources_30j', (select coalesce(json_object_agg(source, n), '{}'::json)
                    from (select source, sum(n) n from entrees group by source) x),
    'appareils_30j', (select coalesce(json_object_agg(appareil, n), '{}'::json)
                      from (select appareil, sum(n) n from entrees group by appareil) x),
    'abonnes', (select count(*) from abos),
    'abonnes_par_formule', (select coalesce(json_object_agg(formule, n), '{}'::json)
                            from (select formule, count(*) n from abos group by formule) x),
    'abonnes_annuels', (select count(*) from abos where annuel),
    'resiliations_prevues', (select count(*) from abos where fin_prevue),
    'paiements_en_retard', (select count(*) from abos where statut = 'past_due'),
    -- Revenu mensuel récurrent estimé, hors taxes (annuel ramené au mois).
    'revenu_mensuel_ht', (select coalesce(sum(case
        when formule = 'solo' then case when annuel then 90.0 / 12 else 9 end
        when formule = 'pro' then case when annuel then 190.0 / 12 else 19 end
        when formule = 'equipe' then case when annuel then 390.0 / 12 else 39 end
        else 0 end), 0)
      from abos where statut <> 'past_due'),
    'devis', (select count(*) from docs where d ->> 'type' = 'devis'),
    'factures', (select count(*) from factures),
    'factures_ht', (select coalesce(round(sum(ht), 2), 0) from factures),
    'clients', (select coalesce(sum(jsonb_array_length(coalesce(donnees -> 'clients', '[]'::jsonb))), 0) from public.espaces),
    'depenses', (select coalesce(sum(jsonb_array_length(coalesce(donnees -> 'depenses', '[]'::jsonb))), 0) from public.espaces),
    'emails_envoyes', (select count(*) from public.emails_envoyes),
    'emails_30j', (select count(*) from public.emails_envoyes where envoye_le > now() - interval '30 days'),
    'devis_partages', (select count(*) from public.partages),
    'devis_signes', (select count(*) from public.partages where signe_le is not null),
    'visites_par_page_30j', (select coalesce(json_object_agg(page, n), '{}'::json)
                             from (select page, sum(n) n from public.visites where jour > current_date - 30 group by page) x),
    'par_jour', (select json_agg(json_build_object(
        'jour', j.jour,
        'inscriptions', (select count(*) from auth.users u where u.created_at::date = j.jour),
        'visites', (select coalesce(sum(n), 0) from public.visites v where v.jour = j.jour and v.page = 'accueil'),
        'visites_app', (select coalesce(sum(n), 0) from public.visites v where v.jour = j.jour and v.page = 'app')
      ) order by j.jour) from jours j)
  ) into resultat;
  return resultat;
end;
$$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

-- 4. Liste des utilisateurs (administrateurs uniquement).
create or replace function public.admin_utilisateurs()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  resultat json;
begin
  if not public.est_admin() then
    raise exception 'Accès réservé aux administrateurs';
  end if;
  select coalesce(json_agg(x order by x.inscrit_le desc), '[]'::json) into resultat
  from (
    select
      u.id,
      u.email,
      u.created_at as inscrit_le,
      u.last_sign_in_at as derniere_connexion,
      u.email_confirmed_at is not null as confirme,
      exists (select 1 from public.admins ad where ad.user_id = u.id) as admin,
      e.donnees -> 'entreprise' ->> 'nom' as entreprise,
      coalesce(jsonb_array_length(e.donnees -> 'documents'), 0) as documents,
      (select count(*) from jsonb_array_elements(coalesce(e.donnees -> 'documents', '[]'::jsonb)) d
        where d ->> 'type' = 'facture') as factures,
      coalesce(jsonb_array_length(e.donnees -> 'clients'), 0) as clients,
      e.mis_a_jour as donnees_maj,
      a.formule,
      a.statut,
      a.fin_periode,
      a.fin_prevue,
      a.offert,
      a.stripe_abonnement is not null as stripe,
      (a.user_id is not null and public.abonnement_en_cours(a)) as abonne,
      (u.created_at > now() - interval '14 days') as essai_en_cours,
      (select p.email from public.membres m join auth.users p on p.id = m.proprietaire
        where m.membre = u.id) as membre_de,
      (select count(*) from public.membres m where m.proprietaire = u.id and m.membre is not null) as nb_membres,
      (select count(*) from public.emails_envoyes ee where ee.user_id = u.id) as emails
    from auth.users u
    left join public.espaces e on e.user_id = u.id
    left join public.abonnements a on a.user_id = u.id
    order by u.created_at desc
    limit 2000
  ) x;
  return resultat;
end;
$$;
revoke all on function public.admin_utilisateurs() from public, anon;
grant execute on function public.admin_utilisateurs() to authenticated;

-- 5. Actions de l'administrateur sur un compte.
-- Un abonnement Stripe payant en cours ne peut pas être remplacé par une offre.
create or replace function public.paye_par_stripe(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.abonnements a
    where a.user_id = uid and a.stripe_abonnement is not null and a.offert is null
      and public.abonnement_en_cours(a) and a.statut <> 'canceled'
  );
$$;
revoke all on function public.paye_par_stripe(uuid) from public, anon, authenticated;

-- Prolonger l'essai gratuit de « jours » jours (accès complet, comme l'essai).
create or replace function public.admin_prolonger_essai(uid uuid, jours integer)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  depart timestamptz;
  fin timestamptz;
begin
  if not public.est_admin() then raise exception 'Accès réservé aux administrateurs'; end if;
  if jours is null or jours < 1 or jours > 365 then raise exception 'Durée invalide'; end if;
  if public.paye_par_stripe(uid) then raise exception 'Ce compte a déjà un abonnement payant en cours'; end if;
  select greatest(now(), u.created_at + interval '14 days',
      coalesce((select a.fin_periode from public.abonnements a where a.user_id = uid and a.offert = 'essai'), now()))
    into depart from auth.users u where u.id = uid;
  if depart is null then raise exception 'Compte introuvable'; end if;
  fin := depart + make_interval(days => jours);
  insert into public.abonnements as a (user_id, formule, statut, fin_periode, offert, fin_prevue, stripe_abonnement)
    values (uid, 'equipe', 'trialing', fin, 'essai', true, null)
    on conflict (user_id) do update set formule = 'equipe', statut = 'trialing', fin_periode = fin,
      offert = 'essai', fin_prevue = true, stripe_abonnement = null, mis_a_jour = now();
  return fin;
end;
$$;

-- Offrir une formule (pro ou equipe) pendant « mois » mois (0 = sans limite).
create or replace function public.admin_offrir(uid uuid, formule text, mois integer)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  fin timestamptz;
begin
  if not public.est_admin() then raise exception 'Accès réservé aux administrateurs'; end if;
  if formule not in ('solo', 'pro', 'equipe') then raise exception 'Formule invalide'; end if;
  if mois is null or mois < 0 or mois > 60 then raise exception 'Durée invalide'; end if;
  if not exists (select 1 from auth.users where id = uid) then raise exception 'Compte introuvable'; end if;
  if public.paye_par_stripe(uid) then raise exception 'Ce compte a déjà un abonnement payant en cours'; end if;
  fin := case when mois = 0 then null else now() + make_interval(months => mois) end;
  insert into public.abonnements as a (user_id, formule, statut, fin_periode, offert, fin_prevue, stripe_abonnement)
    values (uid, formule, 'active', fin, 'cadeau', fin is not null, null)
    on conflict (user_id) do update set formule = excluded.formule, statut = 'active', fin_periode = fin,
      offert = 'cadeau', fin_prevue = fin is not null, stripe_abonnement = null, mis_a_jour = now();
  return fin;
end;
$$;

-- Retirer une offre (essai prolongé ou formule offerte).
create or replace function public.admin_retirer_offre(uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.est_admin() then raise exception 'Accès réservé aux administrateurs'; end if;
  delete from public.abonnements where user_id = uid and offert is not null;
end;
$$;

-- Supprimer un compte et toutes ses données (compte indésirable, demande RGPD).
create or replace function public.admin_supprimer_compte(uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.est_admin() then raise exception 'Accès réservé aux administrateurs'; end if;
  if uid = auth.uid() then raise exception 'Vous ne pouvez pas supprimer votre propre compte ici'; end if;
  if exists (select 1 from public.admins where user_id = uid) then raise exception 'Impossible de supprimer un administrateur'; end if;
  if public.paye_par_stripe(uid) then
    raise exception 'Ce compte a un abonnement payant en cours : résiliez-le d''abord dans Stripe, sinon il continuera d''être prélevé';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.admin_prolonger_essai(uuid, integer) from public, anon;
grant execute on function public.admin_prolonger_essai(uuid, integer) to authenticated;
revoke all on function public.admin_offrir(uuid, text, integer) from public, anon;
grant execute on function public.admin_offrir(uuid, text, integer) to authenticated;
revoke all on function public.admin_retirer_offre(uuid) from public, anon;
grant execute on function public.admin_retirer_offre(uuid) to authenticated;
revoke all on function public.admin_supprimer_compte(uuid) from public, anon;
grant execute on function public.admin_supprimer_compte(uuid) to authenticated;

-- 6. Vous devenez administrateur : remplacez VOTRE-EMAIL-ICI par l'adresse de votre
-- compte Devizo (celle avec laquelle vous vous connectez), puis Run.
insert into public.admins (user_id)
  select id from auth.users where lower(email) = lower(trim('VOTRE-EMAIL-ICI'))
  on conflict do nothing;
