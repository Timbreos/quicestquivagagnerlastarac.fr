-- =============================================================================
-- 0001 — Schéma : tables, contraintes, triggers, fonctions utilitaires
-- Tout est scopé par saison. Les points ne sont jamais stockés : ils se
-- dérivent des événements (vue score_events, migration 0003).
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Profils : un profil = un joueur du groupe. Créé uniquement via redeem_invite().
-- -----------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  avatar_url   text,
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Saisons
-- -----------------------------------------------------------------------------
create table public.seasons (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (char_length(btrim(name)) between 1 and 80),
  status           text not null default 'preparation'
                   check (status in ('preparation','vote_p1','p1_revelee','en_cours','vote_p2','terminee')),
  p1_opens_at      timestamptz,
  p1_closes_at     timestamptz,
  p1_revealed_at   timestamptz,
  p2_opens_at      timestamptz,
  p2_closes_at     timestamptz,
  p2_revealed_at   timestamptz,
  phase2_threshold integer not null default 8 check (phase2_threshold >= 2),
  created_at       timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Élèves
-- -----------------------------------------------------------------------------
create table public.contestants (
  id            uuid primary key default gen_random_uuid(),
  season_id     uuid not null references public.seasons (id) on delete cascade,
  full_name     text not null check (char_length(btrim(full_name)) between 1 and 80),
  photo_url     text,
  bio           text,
  display_order integer not null default 0,
  created_at    timestamptz not null default now()
);
create index contestants_season_idx on public.contestants (season_id, display_order);

-- -----------------------------------------------------------------------------
-- Semaines de prime
-- -----------------------------------------------------------------------------
create table public.weeks (
  id              uuid primary key default gen_random_uuid(),
  season_id       uuid not null references public.seasons (id) on delete cascade,
  number          integer not null check (number >= 1),
  prime_at        timestamptz,
  picks_closed_at timestamptz,
  created_at      timestamptz not null default now(),
  unique (season_id, number)
);

-- -----------------------------------------------------------------------------
-- Nominés de la semaine
-- -----------------------------------------------------------------------------
create table public.nominations (
  week_id       uuid not null references public.weeks (id) on delete cascade,
  contestant_id uuid not null references public.contestants (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (week_id, contestant_id)
);

-- -----------------------------------------------------------------------------
-- Sorties. exit_place est la vérité du jeu : 17 = premier éliminé, 1 = vainqueur.
-- season_id est dénormalisé (rempli par trigger) pour porter l'unicité
-- (season_id, exit_place) et filtrer le temps réel par saison.
-- -----------------------------------------------------------------------------
create table public.eliminations (
  id            uuid primary key default gen_random_uuid(),
  week_id       uuid not null references public.weeks (id) on delete cascade,
  season_id     uuid not null references public.seasons (id) on delete cascade,
  contestant_id uuid not null references public.contestants (id) on delete cascade,
  exit_place    integer not null check (exit_place >= 1),
  is_scored     boolean not null default true,
  announced_at  timestamptz not null default now(),
  unique (season_id, exit_place),
  unique (contestant_id)
);
create index eliminations_week_idx on public.eliminations (week_id);

-- -----------------------------------------------------------------------------
-- Classements. Un brouillon est un ranking avec submitted_at nul.
-- -----------------------------------------------------------------------------
create table public.rankings (
  id           uuid primary key default gen_random_uuid(),
  season_id    uuid not null references public.seasons (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  phase        smallint not null check (phase in (1, 2)),
  submitted_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (season_id, user_id, phase)
);

-- position nulle = élève non placé mais annoté (le carnet survit à un retrait).
-- L'unicité de position est différée pour permettre un échange en une écriture.
create table public.ranking_items (
  ranking_id    uuid not null references public.rankings (id) on delete cascade,
  contestant_id uuid not null references public.contestants (id) on delete cascade,
  position      integer check (position is null or position >= 1),
  comment       text check (comment is null or char_length(comment) <= 1000),
  primary key (ranking_id, contestant_id),
  unique (ranking_id, position) deferrable initially deferred
);

-- -----------------------------------------------------------------------------
-- Pronostic hebdomadaire « qui part ce soir ? »
-- -----------------------------------------------------------------------------
create table public.weekly_picks (
  week_id       uuid not null references public.weeks (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  contestant_id uuid not null references public.contestants (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (week_id, user_id)
);

-- -----------------------------------------------------------------------------
-- Barème, en base et par saison. phase 0 = bonus du pronostic hebdo
-- (points_exact = bonus, plage de places ignorée).
-- -----------------------------------------------------------------------------
create table public.scoring_rules (
  id               uuid primary key default gen_random_uuid(),
  season_id        uuid not null references public.seasons (id) on delete cascade,
  phase            smallint not null check (phase in (0, 1, 2)),
  exit_place_min   integer not null check (exit_place_min >= 1),
  exit_place_max   integer not null,
  points_exact     integer not null check (points_exact >= 0),
  points_nominated integer not null default 0 check (points_nominated >= 0),
  check (exit_place_min <= exit_place_max)
);
create index scoring_rules_season_idx on public.scoring_rules (season_id, phase);

-- -----------------------------------------------------------------------------
-- Chat : un fil par saison. Suppression douce par l'auteur.
-- -----------------------------------------------------------------------------
create table public.messages (
  id           uuid primary key default gen_random_uuid(),
  season_id    uuid not null references public.seasons (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  body         text check (body is null or char_length(body) <= 2000),
  gif_url      text,
  gif_provider text check (gif_provider is null or gif_provider in ('tenor', 'giphy')),
  image_url    text,
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  -- un message vivant a un contenu ; un message supprimé est une pierre tombale vide
  check (deleted_at is not null or nullif(btrim(coalesce(body, '')), '') is not null or gif_url is not null or image_url is not null)
);
create index messages_season_created_idx on public.messages (season_id, created_at desc);

create table public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  emoji      text not null check (emoji in ('👍', '😂', '😮', '😭', '🔥', '❤️')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

-- -----------------------------------------------------------------------------
-- Invitations
-- -----------------------------------------------------------------------------
create or replace function public.gen_invite_code()
returns text
language sql
volatile
as $$
  -- 8 caractères lisibles, sans 0/O/1/I.
  select string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), ''
  ) from generate_series(1, 8);
$$;

create table public.invites (
  code       text primary key default public.gen_invite_code(),
  season_id  uuid references public.seasons (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  used_by    uuid references public.profiles (id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- Fonctions utilitaires (security definer : lues par les policies sans récursion)
-- =============================================================================

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.phase_is_open(p_season_id uuid, p_phase integer)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case p_phase
      when 1 then s.p1_opens_at is not null and s.p1_closes_at is null
      when 2 then s.p2_opens_at is not null and s.p2_closes_at is null
      else false
    end
    from public.seasons s where s.id = p_season_id
  ), false);
$$;

create or replace function public.phase_is_revealed(p_season_id uuid, p_phase integer)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case p_phase
      when 1 then s.p1_revealed_at is not null
      when 2 then s.p2_revealed_at is not null
      else false
    end
    from public.seasons s where s.id = p_season_id
  ), false);
$$;

-- Nombre d'élèves attendus dans un classement de la phase donnée.
create or replace function public.expected_ranking_size(p_season_id uuid, p_phase integer)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case p_phase
    when 1 then (select count(*)::int from public.contestants c where c.season_id = p_season_id)
    when 2 then (select s.phase2_threshold from public.seasons s where s.id = p_season_id)
  end;
$$;

-- =============================================================================
-- Triggers
-- =============================================================================

-- --- profiles : is_admin n'est modifiable que par un admin ---------------------
create or replace function public.profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_admin is distinct from old.is_admin and not public.is_admin() then
    raise exception 'Seul un admin peut modifier le rôle admin.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

-- --- seasons : statut dérivé des dates et des sorties -------------------------
create or replace function public.compute_season_status(
  p_season_id uuid, p1_opens timestamptz, p1_revealed timestamptz, p2_opens timestamptz, p2_revealed timestamptz
) returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (select 1 from public.eliminations e where e.season_id = p_season_id and e.exit_place = 1) then 'terminee'
    when p2_opens is not null and p2_revealed is null then 'vote_p2'
    when exists (select 1 from public.eliminations e where e.season_id = p_season_id) then 'en_cours'
    when p1_revealed is not null then 'p1_revelee'
    when p1_opens is not null then 'vote_p1'
    else 'preparation'
  end;
$$;

create or replace function public.seasons_set_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.status := public.compute_season_status(new.id, new.p1_opens_at, new.p1_revealed_at, new.p2_opens_at, new.p2_revealed_at);
  return new;
end;
$$;
create trigger seasons_set_status before insert or update on public.seasons
  for each row execute function public.seasons_set_status();

create or replace function public.refresh_season_status(p_season_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.seasons s set status = s.status where s.id = p_season_id;
$$;

-- --- seasons : barème par défaut à la création --------------------------------
create or replace function public.seasons_default_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.scoring_rules (season_id, phase, exit_place_min, exit_place_max, points_exact, points_nominated) values
    (new.id, 1, 5, 999, 10, 2),
    (new.id, 1, 4, 4,   20, 4),
    (new.id, 1, 3, 3,   30, 6),
    (new.id, 1, 2, 2,   40, 8),
    (new.id, 1, 1, 1,   60, 12),
    (new.id, 2, 5, 999, 5,  1),
    (new.id, 2, 4, 4,   10, 2),
    (new.id, 2, 3, 3,   15, 3),
    (new.id, 2, 2, 2,   20, 4),
    (new.id, 2, 1, 1,   30, 6),
    (new.id, 0, 1, 999, 5,  0);
  return new;
end;
$$;
create trigger seasons_default_rules after insert on public.seasons
  for each row execute function public.seasons_default_rules();

-- --- nominations : même saison ------------------------------------------------
create or replace function public.nominations_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week_season uuid;
  v_cont_season uuid;
begin
  select season_id into v_week_season from public.weeks where id = new.week_id;
  select season_id into v_cont_season from public.contestants where id = new.contestant_id;
  if v_week_season is null or v_week_season <> v_cont_season then
    raise exception 'L''élève et la semaine n''appartiennent pas à la même saison.';
  end if;
  if exists (select 1 from public.eliminations e where e.contestant_id = new.contestant_id) then
    raise exception 'Cet élève a déjà quitté l''aventure.';
  end if;
  return new;
end;
$$;
create trigger nominations_guard before insert or update on public.nominations
  for each row execute function public.nominations_guard();

-- --- eliminations : season_id dérivé, cohérence, statut de saison -------------
create or replace function public.eliminations_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cont_season uuid;
begin
  select season_id into new.season_id from public.weeks where id = new.week_id;
  if new.season_id is null then
    raise exception 'Semaine inconnue.';
  end if;
  select season_id into v_cont_season from public.contestants where id = new.contestant_id;
  if v_cont_season <> new.season_id then
    raise exception 'L''élève n''appartient pas à cette saison.';
  end if;
  if new.exit_place > (select count(*) from public.contestants c where c.season_id = new.season_id) then
    raise exception 'Place de sortie supérieure au nombre d''élèves.';
  end if;
  return new;
end;
$$;
create trigger eliminations_guard before insert or update on public.eliminations
  for each row execute function public.eliminations_guard();

create or replace function public.eliminations_after()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_season_status(coalesce(new.season_id, old.season_id));
  return null;
end;
$$;
create trigger eliminations_after after insert or update or delete on public.eliminations
  for each row execute function public.eliminations_after();

-- --- rankings : scellé = intouchable ; soumission = classement dense et complet
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
create trigger rankings_guard before insert or update on public.rankings
  for each row execute function public.rankings_guard();

-- --- ranking_items : après scellement, seule la note privée bouge -------------
create or replace function public.ranking_items_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rankings%rowtype;
  v_cont_season uuid;
  v_ranking_id uuid := coalesce(new.ranking_id, old.ranking_id);
begin
  select * into r from public.rankings where id = v_ranking_id;
  if r.id is null then
    raise exception 'Classement inconnu.';
  end if;

  if tg_op = 'UPDATE' and new.ranking_id <> old.ranking_id then
    raise exception 'Un élément ne change pas de classement.';
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select season_id into v_cont_season from public.contestants where id = new.contestant_id;
    if v_cont_season <> r.season_id then
      raise exception 'L''élève n''appartient pas à cette saison.';
    end if;
    if new.position is not null and new.position > public.expected_ranking_size(r.season_id, r.phase) then
      raise exception 'Position hors classement.';
    end if;
    if r.phase = 2 and exists (select 1 from public.eliminations e where e.contestant_id = new.contestant_id) then
      raise exception 'Cet élève a déjà quitté l''aventure : il ne se classe plus en phase 2.';
    end if;
  end if;

  if r.submitted_at is not null then
    -- scellé : seul le commentaire est modifiable, par UPDATE uniquement
    if tg_op <> 'UPDATE' or new.position is distinct from old.position or new.contestant_id <> old.contestant_id then
      raise exception 'Ce classement est scellé : seule la note privée reste modifiable.' using errcode = '42501';
    end if;
    return new;
  end if;

  -- brouillon : les positions ne bougent que phase ouverte ; la note, toujours
  if tg_op = 'INSERT' or tg_op = 'DELETE'
     or (tg_op = 'UPDATE' and (new.position is distinct from old.position or new.contestant_id <> old.contestant_id)) then
    if not public.phase_is_open(r.season_id, r.phase) then
      raise exception 'La phase % n''est pas ouverte au vote.', r.phase using errcode = '42501';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
create trigger ranking_items_guard before insert or update or delete on public.ranking_items
  for each row execute function public.ranking_items_guard();

-- --- weekly_picks : nominé de la semaine, semaine ouverte ---------------------
create or replace function public.weekly_picks_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select picks_closed_at from public.weeks where id = new.week_id) is not null then
    raise exception 'Les pronostics de cette semaine sont fermés.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.nominations n where n.week_id = new.week_id and n.contestant_id = new.contestant_id) then
    raise exception 'Cet élève n''est pas nominé cette semaine.';
  end if;
  new.created_at := now();
  return new;
end;
$$;
create trigger weekly_picks_guard before insert or update on public.weekly_picks
  for each row execute function public.weekly_picks_guard();

-- --- messages : on ne réécrit pas l'histoire, on la supprime -----------------
-- La suppression vide le contenu (pierre tombale) : la ligne reste visible de
-- tous, le temps réel propage la suppression, l'historique garde sa place.
create or replace function public.messages_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.deleted_at is not null then
    raise exception 'Ce message est déjà supprimé.' using errcode = '42501';
  end if;
  if new.deleted_at is null
     or new.user_id <> old.user_id or new.season_id <> old.season_id or new.created_at <> old.created_at then
    raise exception 'Un message ne se modifie pas, il se supprime.' using errcode = '42501';
  end if;
  new.body := null;
  new.gif_url := null;
  new.gif_provider := null;
  new.image_url := null;
  return new;
end;
$$;
create trigger messages_guard before update on public.messages
  for each row execute function public.messages_guard();

-- =============================================================================
-- RPC
-- =============================================================================

-- Entrée par code d'invitation : crée le profil du joueur connecté.
create or replace function public.redeem_invite(p_code text, p_display_name text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.invites%rowtype;
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'Connecte-toi d''abord.' using errcode = '42501';
  end if;
  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.id is not null then
    return v_profile;
  end if;
  select * into v_invite from public.invites where code = upper(btrim(p_code)) for update;
  if v_invite.code is null then
    raise exception 'Code d''invitation inconnu.';
  end if;
  if v_invite.used_by is not null then
    raise exception 'Ce code a déjà servi.';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'Ce code a expiré.';
  end if;
  if (select count(*) from public.profiles) >= 10 then
    raise exception 'Le groupe est complet (10 joueurs).';
  end if;
  insert into public.profiles (id, display_name)
    values (v_uid, btrim(p_display_name))
    returning * into v_profile;
  update public.invites set used_by = v_uid where code = v_invite.code;
  return v_profile;
end;
$$;
revoke execute on function public.redeem_invite(text, text) from public, anon;
grant execute on function public.redeem_invite(text, text) to authenticated;

-- Sauvegarde atomique d'un brouillon : p_items = [{contestant_id, position}].
-- Les notes des élèves retirés sont conservées (position nulle).
create or replace function public.save_ranking_draft(p_season_id uuid, p_phase integer, p_items jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_submitted timestamptz;
begin
  select id, submitted_at into v_id, v_submitted
    from public.rankings
    where season_id = p_season_id and user_id = auth.uid() and phase = p_phase;
  if v_id is null then
    insert into public.rankings (season_id, user_id, phase)
      values (p_season_id, auth.uid(), p_phase)
      returning id into v_id;
  elsif v_submitted is not null then
    raise exception 'Ce classement est scellé.' using errcode = '42501';
  end if;

  -- Élèves retirés du brouillon : on supprime la ligne, sauf si elle porte une note.
  delete from public.ranking_items ri
    where ri.ranking_id = v_id and ri.comment is null
      and not exists (
        select 1 from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) x
        where x->>'position' is not null and (x->>'contestant_id')::uuid = ri.contestant_id
      );

  update public.ranking_items ri set position = null
    where ri.ranking_id = v_id and ri.position is not null
      and not exists (
        select 1 from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) x
        where x->>'position' is not null and (x->>'contestant_id')::uuid = ri.contestant_id
      );

  update public.ranking_items ri set position = d.position
    from (
      select (x->>'contestant_id')::uuid as contestant_id, (x->>'position')::int as position
      from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) x
      where x->>'position' is not null
    ) d
    where ri.ranking_id = v_id and ri.contestant_id = d.contestant_id and ri.position is distinct from d.position;

  insert into public.ranking_items (ranking_id, contestant_id, position)
    select v_id, d.contestant_id, d.position
    from (
      select (x->>'contestant_id')::uuid as contestant_id, (x->>'position')::int as position
      from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) x
      where x->>'position' is not null
    ) d
    where not exists (select 1 from public.ranking_items ri where ri.ranking_id = v_id and ri.contestant_id = d.contestant_id);

  update public.rankings set updated_at = now() where id = v_id;
  return v_id;
end;
$$;
revoke execute on function public.save_ranking_draft(uuid, integer, jsonb) from public, anon;
grant execute on function public.save_ranking_draft(uuid, integer, jsonb) to authenticated;

-- Note privée sur un élève pour une phase (éditable toute la saison par son auteur).
create or replace function public.set_note(p_season_id uuid, p_phase integer, p_contestant_id uuid, p_comment text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.rankings
    where season_id = p_season_id and user_id = auth.uid() and phase = p_phase;
  if v_id is null then
    insert into public.rankings (season_id, user_id, phase)
      values (p_season_id, auth.uid(), p_phase)
      returning id into v_id;
  end if;
  update public.ranking_items set comment = nullif(btrim(p_comment), '')
    where ranking_id = v_id and contestant_id = p_contestant_id;
  if not found then
    insert into public.ranking_items (ranking_id, contestant_id, position, comment)
      values (v_id, p_contestant_id, null, nullif(btrim(p_comment), ''));
  end if;
end;
$$;
revoke execute on function public.set_note(uuid, integer, uuid, text) from public, anon;
grant execute on function public.set_note(uuid, integer, uuid, text) to authenticated;
