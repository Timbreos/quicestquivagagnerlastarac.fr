-- =============================================================================
-- 0006 — Durcissement : fonctions internes non exposées via l'API, index sur
-- les clés étrangères. Suite aux conseils du linter Supabase.
-- =============================================================================

alter function public.gen_invite_code() set search_path = public;

-- Fonctions de trigger et helpers internes : jamais appelables via /rest/v1/rpc.
-- (les triggers sont security definer : leurs appels internes tournent en propriétaire)
revoke execute on function public.profiles_guard() from public, anon, authenticated;
revoke execute on function public.profiles_bootstrap_admin() from public, anon, authenticated;
revoke execute on function public.seasons_set_status() from public, anon, authenticated;
revoke execute on function public.seasons_default_rules() from public, anon, authenticated;
revoke execute on function public.nominations_guard() from public, anon, authenticated;
revoke execute on function public.eliminations_guard() from public, anon, authenticated;
revoke execute on function public.eliminations_after() from public, anon, authenticated;
revoke execute on function public.rankings_guard() from public, anon, authenticated;
revoke execute on function public.ranking_items_guard() from public, anon, authenticated;
revoke execute on function public.weekly_picks_guard() from public, anon, authenticated;
revoke execute on function public.messages_guard() from public, anon, authenticated;
revoke execute on function public.compute_season_status(uuid, timestamptz, timestamptz, timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.refresh_season_status(uuid) from public, anon, authenticated;
revoke execute on function public.expected_ranking_size(uuid, integer) from public, anon, authenticated;

-- Helpers lus par les policies : réservés aux connectés.
revoke execute on function public.is_member() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.phase_is_open(uuid, integer) from public, anon;
revoke execute on function public.phase_is_revealed(uuid, integer) from public, anon;
revoke execute on function public.gen_invite_code() from public, anon;

-- Index sur les clés étrangères fréquemment jointes.
create index if not exists rankings_user_idx on public.rankings (user_id);
create index if not exists ranking_items_contestant_idx on public.ranking_items (contestant_id);
create index if not exists weekly_picks_user_idx on public.weekly_picks (user_id);
create index if not exists weekly_picks_contestant_idx on public.weekly_picks (contestant_id);
create index if not exists nominations_contestant_idx on public.nominations (contestant_id);
create index if not exists messages_user_idx on public.messages (user_id);
create index if not exists message_reactions_user_idx on public.message_reactions (user_id);
create index if not exists invites_used_by_idx on public.invites (used_by);
