-- Parcours d'inscription : en plus des pages vues, on compte (sans cookie,
-- seulement des totaux par jour) les clics sur « Essai gratuit », les clics
-- sur « Continuer avec Google » et l'ouverture du formulaire d'inscription.
-- À exécuter une fois dans Supabase (SQL Editor > New query > Run), après
-- admin.sql. Peut être relancé sans risque.
create or replace function public.compter_visite(p text, s text default 'direct', a text default 'inconnu')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p not in ('accueil', 'app', 'signer', 'legal', 'clic-essai', 'clic-google', 'formulaire') then
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
