-- ===========================================================
-- Fonction publique : get_public_services()
-- -----------------------------------------------------------
-- Permet au SITE VITRINE (public, non connecté) d'afficher la
-- liste des services/prix gérés par Maggie dans le portail
-- (page Réglages → table alaska_settings.data.services).
--
-- security definer : la fonction contourne la RLS pour lire
-- alaska_settings, MAIS ne retourne QUE le tableau "services"
-- (label, price, suffix). Aucune donnée privée (adresse,
-- courriel, téléphone, factures, clients) n'est exposée.
--
-- Le site public l'appelle en lecture seule via
--   POST /rest/v1/rpc/get_public_services
-- avec la clé anon (déjà publique).
--
-- Appliquée le 2026-07-07 (migration Supabase
-- « public_services_readonly_function »). Ce fichier sert de
-- trace/documentation ; il est déjà en place dans la base.
-- ===========================================================

create or replace function public.get_public_services()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(data->'services', '[]'::jsonb)
  from public.alaska_settings
  limit 1
$$;

comment on function public.get_public_services() is
  'Retourne uniquement le tableau des services/prix (label, price, suffix) pour affichage public sur le site vitrine. Aucune donnée privée exposée.';

revoke all on function public.get_public_services() from public;
grant execute on function public.get_public_services() to anon, authenticated;
