-- =============================================================================
-- 0009 — Étoiles privées : une note de 1 à 5 par élève et par joueur, pour
-- s'aider à classer. Comme le carnet : lisible et modifiable par son auteur seul.
-- Retirer ses étoiles = supprimer la ligne.
-- =============================================================================

create table public.contestant_ratings (
  user_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  contestant_id uuid not null references public.contestants (id) on delete cascade,
  season_id     uuid not null references public.seasons (id) on delete cascade,
  stars         smallint not null check (stars between 1 and 5),
  updated_at    timestamptz not null default now(),
  primary key (user_id, contestant_id)
);
create index contestant_ratings_contestant_idx on public.contestant_ratings (contestant_id);
create index contestant_ratings_season_idx on public.contestant_ratings (season_id);

create or replace function public.contestant_ratings_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and (new.user_id <> old.user_id or new.contestant_id <> old.contestant_id or new.season_id <> old.season_id) then
    raise exception 'Une note ne change ni d''auteur, ni d''élève, ni de saison.';
  end if;
  if not exists (select 1 from public.contestants c where c.id = new.contestant_id and c.season_id = new.season_id) then
    raise exception 'Cet élève n''appartient pas à cette saison.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function public.contestant_ratings_guard() from public, anon, authenticated;

create trigger contestant_ratings_guard
  before insert or update on public.contestant_ratings
  for each row execute function public.contestant_ratings_guard();

alter table public.contestant_ratings enable row level security;

create policy "contestant_ratings: lecture par l'auteur seul"
  on public.contestant_ratings for select to authenticated
  using (user_id = auth.uid());

create policy "contestant_ratings: poser les siennes"
  on public.contestant_ratings for insert to authenticated
  with check (public.is_member() and user_id = auth.uid());

create policy "contestant_ratings: modifier les siennes"
  on public.contestant_ratings for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "contestant_ratings: retirer les siennes"
  on public.contestant_ratings for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.contestant_ratings from anon;
