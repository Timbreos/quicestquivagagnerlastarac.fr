-- =============================================================================
-- 0008 — Carnet privé en fil : plusieurs notes datées par élève, façon suivi.
-- Indépendant des classements (la note de vote reste dans ranking_items.comment).
-- Lisible et modifiable par son auteur seul, sans exception, à vie.
-- =============================================================================

create table public.contestant_notes (
  id            uuid primary key default gen_random_uuid(),
  season_id     uuid not null references public.seasons (id) on delete cascade,
  user_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  contestant_id uuid not null references public.contestants (id) on delete cascade,
  body          text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index contestant_notes_owner_idx on public.contestant_notes (user_id, contestant_id, created_at desc);
create index contestant_notes_contestant_idx on public.contestant_notes (contestant_id);
create index contestant_notes_season_idx on public.contestant_notes (season_id);

-- L'élève doit appartenir à la saison ; rien ne change de main ni de cible.
create or replace function public.contestant_notes_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.user_id <> old.user_id or new.season_id <> old.season_id or new.contestant_id <> old.contestant_id then
      raise exception 'Une note ne change ni d''auteur, ni de saison, ni d''élève.';
    end if;
    new.created_at := old.created_at;
    new.updated_at := now();
  else
    if not exists (select 1 from public.contestants c where c.id = new.contestant_id and c.season_id = new.season_id) then
      raise exception 'Cet élève n''appartient pas à cette saison.';
    end if;
    new.created_at := now();
    new.updated_at := new.created_at;
  end if;
  new.body := btrim(new.body);
  return new;
end;
$$;
revoke execute on function public.contestant_notes_guard() from public, anon, authenticated;

create trigger contestant_notes_guard
  before insert or update on public.contestant_notes
  for each row execute function public.contestant_notes_guard();

alter table public.contestant_notes enable row level security;

create policy "contestant_notes: lecture par l'auteur seul"
  on public.contestant_notes for select to authenticated
  using (user_id = auth.uid());

create policy "contestant_notes: écrire les siennes"
  on public.contestant_notes for insert to authenticated
  with check (public.is_member() and user_id = auth.uid());

create policy "contestant_notes: modifier les siennes"
  on public.contestant_notes for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "contestant_notes: supprimer les siennes"
  on public.contestant_notes for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.contestant_notes from anon;
