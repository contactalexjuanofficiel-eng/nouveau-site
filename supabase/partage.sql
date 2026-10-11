-- Envoi par e-mail, signature en ligne des devis et relances.
-- À exécuter une fois dans Supabase (SQL Editor > New query > Run), après
-- schema.sql, abonnements.sql et equipe.sql. Peut être relancé sans risque.

-- 1. Documents partagés avec un client (lien de signature).
-- « contenu » est une copie du devis tel qu'il a été envoyé : la page publique
-- n'a jamais accès au reste des données de l'artisan.
create table if not exists public.partages (
  jeton uuid primary key default gen_random_uuid(),
  proprietaire uuid not null references auth.users (id) on delete cascade,
  document_id text not null,
  numero text not null,
  contenu jsonb not null,
  cree_le timestamptz not null default now(),
  expire_le timestamptz not null default now() + interval '90 days',
  vu_le timestamptz,
  signe_le timestamptz,
  signature_nom text,
  signature_image text
);
create index if not exists partages_proprietaire on public.partages (proprietaire, signe_le);

alter table public.partages enable row level security;

-- L'artisan (et les membres de son équipe) gèrent leurs partages.
drop policy if exists "Voir ses partages" on public.partages;
create policy "Voir ses partages" on public.partages
  for select using (auth.uid() = proprietaire or public.est_membre_de(proprietaire));
drop policy if exists "Créer ses partages" on public.partages;
create policy "Créer ses partages" on public.partages
  for insert with check (
    (auth.uid() = proprietaire and public.acces_actif(auth.uid()))
    or (public.est_membre_de(proprietaire) and public.equipe_active(proprietaire))
  );
drop policy if exists "Supprimer ses partages" on public.partages;
create policy "Supprimer ses partages" on public.partages
  for delete using (auth.uid() = proprietaire or public.est_membre_de(proprietaire));

-- 2. Le client, sans compte, voit le devis grâce au jeton reçu par e-mail.
create or replace function public.voir_partage(j uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.partages;
begin
  select * into p from public.partages where jeton = j;
  if not found or p.expire_le < now() then
    return null;
  end if;
  if p.vu_le is null then
    update public.partages set vu_le = now() where jeton = j;
  end if;
  return json_build_object(
    'numero', p.numero,
    'contenu', p.contenu,
    'expire_le', p.expire_le,
    'signe_le', p.signe_le,
    'signature_nom', p.signature_nom
  );
end;
$$;

-- 3. Signature du client : une seule fois, avant expiration.
create or replace function public.signer_partage(j uuid, nom text, image text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.partages;
begin
  select * into p from public.partages where jeton = j for update;
  if not found or p.expire_le < now() then
    raise exception 'Lien invalide ou expiré';
  end if;
  if p.signe_le is not null then
    raise exception 'Ce devis est déjà signé';
  end if;
  if length(trim(coalesce(nom, ''))) < 2 or length(nom) > 120 then
    raise exception 'Indiquez votre nom et prénom';
  end if;
  if image is null or image !~ '^data:image/png;base64,' or length(image) > 300000 then
    raise exception 'Signature manquante';
  end if;
  update public.partages
    set signe_le = now(), signature_nom = trim(nom), signature_image = image
    where jeton = j;
  return now();
end;
$$;

revoke all on function public.voir_partage(uuid) from public;
grant execute on function public.voir_partage(uuid) to anon, authenticated;
revoke all on function public.signer_partage(uuid, text, text) from public;
grant execute on function public.signer_partage(uuid, text, text) to anon, authenticated;

-- 4. Journal des e-mails envoyés (limite anti-abus, écrit par la fonction « envoyer-email »).
create table if not exists public.emails_envoyes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  destinataire text not null,
  objet text not null,
  envoye_le timestamptz not null default now()
);
create index if not exists emails_envoyes_user on public.emails_envoyes (user_id, envoye_le);
alter table public.emails_envoyes enable row level security;
drop policy if exists "Voir ses e-mails" on public.emails_envoyes;
create policy "Voir ses e-mails" on public.emails_envoyes
  for select using (auth.uid() = user_id);
