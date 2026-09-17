-- =============================================================================
-- Seed de démonstration : une saison fictive avec 17 élèves, 6 joueurs, deux
-- primes joués et une semaine 3 en cours (nominés saisis, pas encore de sortie).
-- À exécuter en local via la CLI Supabase (supabase db reset). Jamais en prod.
-- Comptes : yanis@ / lea@ / marc@ / sofia@ / hugo@ / fanny@ example.com
-- =============================================================================

do $$
declare
  u_yanis uuid := '00000000-0000-4000-8000-000000000001';
  u_lea   uuid := '00000000-0000-4000-8000-000000000002';
  u_marc  uuid := '00000000-0000-4000-8000-000000000003';
  u_sofia uuid := '00000000-0000-4000-8000-000000000004';
  u_hugo  uuid := '00000000-0000-4000-8000-000000000005';
  u_fanny uuid := '00000000-0000-4000-8000-000000000006';
  s_id    uuid := '10000000-0000-4000-8000-000000000001';
  names text[] := array[
    'Léane Dubreuil','Marius Ferrand','Alba Nogueira','Tidiane Sow','Roxane Vasseur','Enzo Palmieri',
    'Maëlys Corbin','Nathan Leclerc','Inès Bouchard','Gaspard Vidal','Louna Mercier','Sacha Berthier',
    'Jade Rakotoson','Théo Vanoni','Camille Ourdan','Oscar Delaunay','Farah Benali'];
  c_ids uuid[] := array[]::uuid[];
  w1 uuid; w2 uuid; w3 uuid;
  r_id uuid;
  perm int[];
  a int[]; s bigint; j int; t int; k int;
  player record;
begin
  -- Utilisateurs auth + profils
  insert into auth.users (id, email) values
    (u_yanis, 'yanis@example.com'), (u_lea, 'lea@example.com'), (u_marc, 'marc@example.com'),
    (u_sofia, 'sofia@example.com'), (u_hugo, 'hugo@example.com'), (u_fanny, 'fanny@example.com')
  on conflict (id) do nothing;
  insert into public.profiles (id, display_name, is_admin) values
    (u_yanis, 'Yanis', false), (u_lea, 'Léa', false), (u_marc, 'Marc', false),
    (u_sofia, 'Sofia', false), (u_hugo, 'Hugo', false), (u_fanny, 'Fanny', true)
  on conflict (id) do nothing;

  -- Saison + élèves
  insert into public.seasons (id, name, p1_opens_at) values (s_id, 'Saison 14 — 2026 (démo)', '2026-10-05 12:00+02');
  for k in 1..17 loop
    c_ids := c_ids || gen_random_uuid();
    insert into public.contestants (id, season_id, full_name, display_order) values (c_ids[k], s_id, names[k], k);
  end loop;

  -- Classements de phase 1 (permutation déterministe, même graine que le prototype)
  for player in
    select * from (values (u_yanis, 7, true), (u_lea, 23, true), (u_marc, 41, true), (u_sofia, 58, true), (u_hugo, 91, false), (u_fanny, 12, true))
      as v(uid, seed, submitted)
  loop
    a := array(select generate_series(1, 17));
    s := player.seed;
    for k in reverse 16..1 loop
      s := (s * 1103515245 + 12345) % 2147483648;
      j := (s % (k + 1))::int;
      t := a[k + 1]; a[k + 1] := a[j + 1]; a[j + 1] := t;
    end loop;
    insert into public.rankings (season_id, user_id, phase) values (s_id, player.uid, 1) returning id into r_id;
    for k in 1..(case when player.submitted then 17 else 12 end) loop
      insert into public.ranking_items (ranking_id, contestant_id, position) values (r_id, c_ids[a[k]], k);
    end loop;
    if player.submitted then
      update public.rankings set submitted_at = '2026-10-15 20:00+02' where id = r_id;
    end if;
  end loop;

  -- Notes privées de Yanis
  update public.ranking_items ri set comment = v.c
    from (values (c_ids[3], 'La voix de la saison. Elle gagne ou je ne comprends plus rien.'),
                 (c_ids[11], 'Fragile en live, elle ne tient pas trois semaines.'),
                 (c_ids[8], 'Chouchou du public, jamais nominé, il ira loin sans rien faire.')) as v(cid, c)
    where ri.contestant_id = v.cid
      and ri.ranking_id = (select id from public.rankings where season_id = s_id and user_id = u_yanis and phase = 1);

  -- Fermeture et révélation de la phase 1
  update public.seasons set p1_closes_at = '2026-10-16 20:25+02', p1_revealed_at = '2026-10-16 20:30+02' where id = s_id;

  -- Semaines
  insert into public.weeks (season_id, number, prime_at) values (s_id, 1, '2026-10-17 21:10+02') returning id into w1;
  insert into public.weeks (season_id, number, prime_at) values (s_id, 2, '2026-10-24 21:10+02') returning id into w2;
  insert into public.weeks (season_id, number, prime_at) values (s_id, 3, '2026-10-31 21:10+02') returning id into w3;

  -- Semaine 1 : nominés Farah (17), Oscar (16), Sacha (12) ; sortie de Farah, 17e
  insert into public.nominations (week_id, contestant_id) values (w1, c_ids[17]), (w1, c_ids[16]), (w1, c_ids[12]);
  insert into public.weekly_picks (week_id, user_id, contestant_id) values
    (w1, u_yanis, c_ids[17]), (w1, u_lea, c_ids[16]), (w1, u_marc, c_ids[17]), (w1, u_sofia, c_ids[12]), (w1, u_fanny, c_ids[17]);
  update public.weeks set picks_closed_at = '2026-10-17 20:25+02' where id = w1;
  insert into public.eliminations (week_id, contestant_id, exit_place, announced_at) values (w1, c_ids[17], 17, '2026-10-17 22:40+02');

  -- Semaine 2 : nominés Théo (14), Jade (13), Camille (15) ; sortie de Théo, 16e
  insert into public.nominations (week_id, contestant_id) values (w2, c_ids[14]), (w2, c_ids[13]), (w2, c_ids[15]);
  insert into public.weekly_picks (week_id, user_id, contestant_id) values
    (w2, u_yanis, c_ids[13]), (w2, u_lea, c_ids[14]), (w2, u_marc, c_ids[15]), (w2, u_sofia, c_ids[14]), (w2, u_fanny, c_ids[13]);
  update public.weeks set picks_closed_at = '2026-10-24 20:25+02' where id = w2;
  insert into public.eliminations (week_id, contestant_id, exit_place, announced_at) values (w2, c_ids[14], 16, '2026-10-24 22:35+02');

  -- Semaine 3 : nominés Léane (1), Gaspard (10), Louna (11) ; prime à venir
  insert into public.nominations (week_id, contestant_id) values (w3, c_ids[1]), (w3, c_ids[10]), (w3, c_ids[11]);
  insert into public.weekly_picks (week_id, user_id, contestant_id) values
    (w3, u_lea, c_ids[11]), (w3, u_marc, c_ids[1]), (w3, u_sofia, c_ids[11]), (w3, u_fanny, c_ids[10]);

  -- Chat
  insert into public.messages (season_id, user_id, body, created_at) values
    (s_id, u_fanny, 'Classements scellés, on ne touche plus à rien. Bonne saison.', '2026-10-16 21:02+02'),
    (s_id, u_marc,  'J''ai mis Farah 14e, je vais le payer très vite je le sens', '2026-10-16 21:09+02'),
    (s_id, u_lea,   'Moi c''est Alba ou rien. Vous verrez en décembre.', '2026-10-17 08:41+02'),
    (s_id, u_sofia, 'Les nominés de cette semaine sont indéfendables 😬', '2026-10-28 22:15+02'),
    (s_id, u_yanis, 'Louna part ce soir, je mise tout dessus', '2026-10-29 18:30+02'),
    (s_id, u_hugo,  'Attendez je valide mon classement ce soir promis', '2026-10-29 19:02+02'),
    (s_id, u_fanny, '@Hugo la phase 1 est fermée depuis deux semaines. Hors saison, désolée.', '2026-10-29 19:05+02');

  -- Invitations disponibles
  insert into public.invites (code, season_id, created_by) values ('DEMO2026', s_id, u_fanny), ('STARAC14', s_id, u_fanny);
end $$;
