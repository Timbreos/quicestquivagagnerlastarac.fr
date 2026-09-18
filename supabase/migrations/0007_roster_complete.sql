-- =============================================================================
-- 0007 — Casting dévoilé au fil du prime : le vote peut s'ouvrir pendant que
-- la liste se complète, mais aucun classement ne se scelle avant que
-- l'organisateur déclare la liste complète (seasons.roster_complete_at).
-- =============================================================================

alter table public.seasons add column if not exists roster_complete_at timestamptz;

-- Soumission : la liste doit être complète.
create or replace function public.rankings_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected integer;
  v_count integer;
  v_positioned integer;
  v_min integer;
  v_max integer;
begin
  if tg_op = 'UPDATE' then
    if old.submitted_at is not null then
      raise exception 'Ce classement est scellé.' using errcode = '42501';
    end if;
    if new.season_id <> old.season_id or new.user_id <> old.user_id or new.phase <> old.phase then
      raise exception 'Un classement ne change ni de saison, ni de joueur, ni de phase.';
    end if;
  end if;

  new.updated_at := now();

  if new.submitted_at is not null then
    if not public.phase_is_open(new.season_id, new.phase) then
      raise exception 'La phase % n''est pas ouverte au vote.', new.phase using errcode = '42501';
    end if;
    if new.phase = 1 and (select roster_complete_at from public.seasons where id = new.season_id) is null then
      raise exception 'La liste des élèves n''est pas encore complète : la validation ouvrira à ce moment-là.' using errcode = '42501';
    end if;
    v_expected := public.expected_ranking_size(new.season_id, new.phase);
    select count(*), count(position), min(position), max(position)
      into v_count, v_positioned, v_min, v_max
      from public.ranking_items where ranking_id = new.id;
    if v_count <> v_expected or v_positioned <> v_expected or v_min <> 1 or v_max <> v_expected then
      raise exception 'Classement incomplet : % place(s) sur % remplie(s).', coalesce(v_positioned, 0), v_expected;
    end if;
    if new.phase = 2 and exists (
      select 1 from public.ranking_items ri
      join public.eliminations e on e.contestant_id = ri.contestant_id
      where ri.ranking_id = new.id
    ) then
      raise exception 'Le classement de phase 2 contient un élève déjà sorti.';
    end if;
  end if;
  return new;
end;
$$;

-- Liste complète : plus d'ajout ni de retrait d'élève (rouvrir la liste d'abord).
create or replace function public.contestants_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season uuid := coalesce(new.season_id, old.season_id);
begin
  if (select roster_complete_at from public.seasons where id = v_season) is not null then
    raise exception 'La liste des élèves est déclarée complète. Rouvre-la avant d''ajouter ou de retirer un élève.' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
drop trigger if exists contestants_guard on public.contestants;
create trigger contestants_guard before insert or delete on public.contestants
  for each row execute function public.contestants_guard();

-- Rouvrir la liste est impossible dès qu'un classement de phase 1 est scellé.
create or replace function public.seasons_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.roster_complete_at is not null and new.roster_complete_at is null
     and exists (select 1 from public.rankings r where r.season_id = new.id and r.phase = 1 and r.submitted_at is not null) then
    raise exception 'Des classements sont déjà scellés : la liste des élèves ne peut plus être rouverte.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists seasons_guard on public.seasons;
create trigger seasons_guard before update on public.seasons
  for each row execute function public.seasons_guard();

revoke execute on function public.contestants_guard() from public, anon, authenticated;
revoke execute on function public.seasons_guard() from public, anon, authenticated;
