-- =============================================================================
-- 0005 — Amorçage : le tout premier profil créé est l'organisateur.
-- Évite un passage par le SQL editor pour poser le premier admin.
-- =============================================================================
create or replace function public.profiles_bootstrap_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id <> new.id) then
    new.is_admin := true;
  end if;
  return new;
end;
$$;
create trigger profiles_bootstrap_admin before insert on public.profiles
  for each row execute function public.profiles_bootstrap_admin();
