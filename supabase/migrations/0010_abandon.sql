-- =============================================================================
-- 0010 — Abandon : une sortie qui n'est pas le verdict du vote.
-- - Place exacte : rapporte comme d'habitude (sauf « hors scoring »).
-- - Points « dans les nominés » : aucun, les nominés n'ont pas été départagés.
-- - Pronostic hebdo : bonne pioche si on avait désigné l'élève qui abandonne
--   (avant l'annonce) ; sinon neutralisé, ni raté ni gagné.
-- =============================================================================

alter table public.eliminations
  add column if not exists reason text not null default 'elimination'
  check (reason in ('elimination', 'abandon'));

-- --- Une ligne de points par (sortie, joueur, phase) + bonus des pronostics ---
create or replace view public.score_events
with (security_invoker = false) as
with elim as (
  select
    e.id, e.season_id, e.week_id, e.contestant_id, e.exit_place, e.is_scored, e.announced_at, e.reason,
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
      when e.reason = 'elimination'
           and e.nominee_count < e.remaining_before
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
    -- Abandon : seul compte le pronostic posé sur lui avant l'annonce ; les autres sont neutralisés.
    and (e.reason = 'elimination' or (wp.contestant_id = e.contestant_id and wp.created_at <= e.announced_at))
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
