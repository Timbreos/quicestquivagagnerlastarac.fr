-- =============================================================================
-- 0003 — Vues : révélation des classements, calcul des points, classement général
-- Ces vues s'exécutent avec les droits de leur propriétaire (security_invoker
-- désactivé) pour projeter des colonnes que la table brute interdit. Elles
-- portent donc elles-mêmes les règles de visibilité (membre, révélation).
-- =============================================================================

-- --- Classements révélés, sans la colonne comment -----------------------------
create or replace view public.ranking_items_public
with (security_invoker = false) as
select
  r.season_id,
  r.user_id,
  r.phase,
  ri.ranking_id,
  ri.contestant_id,
  ri.position
from public.ranking_items ri
join public.rankings r on r.id = ri.ranking_id
where ri.position is not null
  and r.submitted_at is not null
  and public.is_member()
  and (r.user_id = auth.uid() or public.phase_is_revealed(r.season_id, r.phase));

-- --- Une ligne de points par (sortie, joueur, phase) + bonus des pronostics ---
create or replace view public.score_events
with (security_invoker = false) as
with elim as (
  select
    e.id, e.season_id, e.week_id, e.contestant_id, e.exit_place, e.is_scored, e.announced_at,
    w.number as week_number,
    (select count(*) from public.nominations n where n.week_id = e.week_id) as nominee_count,
    (select count(*) from public.contestants c where c.season_id = e.season_id)
      - (select count(*) from public.eliminations e2 where e2.season_id = e.season_id and e2.exit_place > e.exit_place)
      as remaining_before
  from public.eliminations e
  join public.weeks w on w.id = e.week_id
),
visible_rankings as (
  select r.*
  from public.rankings r
  where r.submitted_at is not null
    and public.is_member()
    and (r.user_id = auth.uid() or public.phase_is_revealed(r.season_id, r.phase))
),
ranking_events as (
  select
    e.season_id, e.week_id, e.week_number, e.id as elimination_id,
    r.user_id, r.phase, 'ranking'::text as source,
    e.exit_place, e.contestant_id as eliminated_contestant_id,
    ri.contestant_id as placed_contestant_id,
    e.is_scored, e.announced_at,
    case
      when ri.contestant_id = e.contestant_id then 'exact'
      when e.nominee_count < e.remaining_before
           and exists (select 1 from public.nominations n where n.week_id = e.week_id and n.contestant_id = ri.contestant_id)
        then 'nominated'
      else 'miss'
    end as outcome,
    coalesce(sr.points_exact, 0) as points_exact,
    coalesce(sr.points_nominated, 0) as points_nominated
  from elim e
  join public.seasons s on s.id = e.season_id
  join visible_rankings r on r.season_id = e.season_id and r.submitted_at <= e.announced_at
  join public.ranking_items ri on ri.ranking_id = r.id and ri.position = e.exit_place
  left join public.scoring_rules sr
    on sr.season_id = e.season_id and sr.phase = r.phase
   and e.exit_place between sr.exit_place_min and sr.exit_place_max
  where r.phase = 1
     or (r.phase = 2 and e.exit_place <= s.phase2_threshold)
),
pick_events as (
  select
    e.season_id, e.week_id, e.week_number, e.id as elimination_id,
    wp.user_id, 0::smallint as phase, 'pick'::text as source,
    e.exit_place, e.contestant_id as eliminated_contestant_id,
    wp.contestant_id as placed_contestant_id,
    e.is_scored, e.announced_at,
    case when wp.contestant_id = e.contestant_id then 'pick_hit' else 'pick_miss' end as outcome,
    coalesce(sr.points_exact, 0) as points_exact,
    0 as points_nominated
  from elim e
  join public.weekly_picks wp on wp.week_id = e.week_id
  join public.weeks w on w.id = e.week_id
  left join public.scoring_rules sr on sr.season_id = e.season_id and sr.phase = 0
  where exists (select 1 from visible_rankings r where r.season_id = e.season_id and r.user_id = wp.user_id and r.phase = 1)
    and (w.picks_closed_at is not null or wp.user_id = auth.uid())
),
all_events as (
  select * from ranking_events
  union all
  select * from pick_events
)
select
  season_id, week_id, week_number, elimination_id, user_id, phase, source,
  exit_place, eliminated_contestant_id, placed_contestant_id, is_scored, announced_at, outcome,
  case outcome
    when 'exact'     then points_exact
    when 'nominated' then points_nominated
    when 'pick_hit'  then points_exact
    else 0
  end as points
from all_events;

-- --- Classement général : total, départage, statut de validation -------------
create or replace view public.leaderboard
with (security_invoker = false) as
select
  s.id as season_id,
  p.id as user_id,
  p.display_name,
  p.avatar_url,
  p.is_admin,
  (r1.submitted_at is not null) as has_submitted,
  coalesce(sum(se.points) filter (where se.is_scored), 0)::integer as total_points,
  count(*) filter (where se.is_scored and se.outcome = 'exact')::integer as exact_count,
  count(*) filter (where se.is_scored and se.outcome = 'pick_hit')::integer as pick_hits
from public.seasons s
cross join public.profiles p
left join public.rankings r1 on r1.season_id = s.id and r1.user_id = p.id and r1.phase = 1
left join public.score_events se on se.season_id = s.id and se.user_id = p.id
where public.is_member()
group by s.id, p.id, p.display_name, p.avatar_url, p.is_admin, r1.submitted_at;

grant select on public.ranking_items_public, public.score_events, public.leaderboard to authenticated;
revoke all on public.ranking_items_public, public.score_events, public.leaderboard from anon;

-- --- Temps réel ---------------------------------------------------------------
alter publication supabase_realtime add table
  public.messages,
  public.message_reactions,
  public.eliminations,
  public.nominations,
  public.weeks,
  public.seasons,
  public.contestants;
