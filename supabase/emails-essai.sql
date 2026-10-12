-- E-mails automatiques pendant l'essai gratuit (bienvenue, J-3, dernier jour).
-- À exécuter une fois dans Supabase (SQL Editor > New query > Run), APRÈS avoir
-- déployé la fonction « emails-essai » (Verify JWT désactivé). Peut être relancé sans risque.

-- 1. Journal des e-mails automatiques : chaque e-mail ne part qu'une fois par personne.
create table if not exists public.emails_auto (
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('bienvenue', 'j-3', 'dernier-jour')),
  envoye_le timestamptz not null default now(),
  primary key (user_id, type)
);
alter table public.emails_auto enable row level security;

-- 2. Personnes qui ne veulent plus recevoir ces e-mails (lien en bas de chaque e-mail).
create table if not exists public.emails_auto_refus (
  user_id uuid primary key references auth.users (id) on delete cascade,
  le timestamptz not null default now()
);
alter table public.emails_auto_refus enable row level security;
-- Aucune règle d'accès : seule la fonction « emails-essai » (clé serveur) lit et écrit ces tables.

-- 3. Planification : la fonction est appelée toutes les heures.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

select cron.unschedule(jobid) from cron.job where jobname = 'devizo-emails-essai';
select cron.schedule(
  'devizo-emails-essai',
  '5 * * * *',
  $$ select net.http_post(
       url := 'https://ryiqhstcshbqvuldfhok.supabase.co/functions/v1/emails-essai',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{}'::jsonb
     ); $$
);
