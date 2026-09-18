-- =============================================================================
-- Test de scoring et de RLS : une saison jouet (6 élèves, seuil phase 2 = 4)
-- dont tous les totaux sont calculés à la main dans les commentaires.
-- Toute assertion ratée lève une exception (le runner s'arrête).
-- =============================================================================

create or replace function pg_temp.assert_eq(p_label text, p_got anyelement, p_want anyelement)
returns void language plpgsql as $$
begin
  if p_got is distinct from p_want then
    raise exception 'ASSERTION « % » : obtenu %, attendu %', p_label, p_got, p_want;
  end if;
  raise notice 'ok — %', p_label;
end $$;

-- Exécute une requête sous l'identité d'un utilisateur (RLS active) et renvoie un compte.
create or replace function pg_temp.count_as(p_uid uuid, p_sql text)
returns bigint language plpgsql as $$
declare v bigint;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
  execute 'select count(*) from (' || p_sql || ') q' into v;
  reset role;
  return v;
end $$;

-- Exécute une écriture sous une identité et renvoie true si elle a été refusée.
create or replace function pg_temp.denied_as(p_uid uuid, p_sql text)
returns boolean language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    execute p_sql;
  exception when others then
    reset role;
    return true;
  end;
  reset role;
  return false;
end $$;

do $$
declare
  u1 uuid := '20000000-0000-4000-8000-000000000001'; -- admin, joue aussi
  u2 uuid := '20000000-0000-4000-8000-000000000002';
  u3 uuid := '20000000-0000-4000-8000-000000000003'; -- ne valide jamais
  u4 uuid := '20000000-0000-4000-8000-000000000004'; -- connecté mais sans profil
  sid uuid;
  cA uuid; cB uuid; cC uuid; cD uuid; cE uuid; cF uuid;
  w1 uuid; w2 uuid; w3 uuid; w4 uuid; w5 uuid;
  r1 uuid; r2 uuid; r3 uuid; r1p2 uuid; r2p2 uuid;
  e_week2 uuid; e_week4 uuid;
  v int; vb bigint; vt text;
begin
  insert into auth.users (id, email) values (u1, 't1@x'), (u2, 't2@x'), (u3, 't3@x'), (u4, 't4@x');
  insert into public.profiles (id, display_name, is_admin) values (u1, 'Ulysse', true), (u2, 'Uma', false), (u3, 'Ugo', false);

  insert into public.seasons (name, phase2_threshold) values ('Test', 4) returning id into sid;
  perform pg_temp.assert_eq('barème par défaut créé', (select count(*) from public.scoring_rules where season_id = sid), 11::bigint);
  perform pg_temp.assert_eq('statut préparation', (select status from public.seasons where id = sid), 'preparation');

  insert into public.contestants (season_id, full_name, display_order) values (sid, 'A', 1) returning id into cA;
  insert into public.contestants (season_id, full_name, display_order) values (sid, 'B', 2) returning id into cB;
  insert into public.contestants (season_id, full_name, display_order) values (sid, 'C', 3) returning id into cC;
  insert into public.contestants (season_id, full_name, display_order) values (sid, 'D', 4) returning id into cD;
  insert into public.contestants (season_id, full_name, display_order) values (sid, 'E', 5) returning id into cE;
  insert into public.contestants (season_id, full_name, display_order) values (sid, 'F', 6) returning id into cF;

  -- Phase 1 fermée : impossible de créer un classement
  perform pg_temp.assert_eq('phase 1 fermée : insert refusé',
    pg_temp.denied_as(u2, format('insert into public.rankings (season_id, user_id, phase) values (%L, %L, 1)', sid, u2)), true);

  update public.seasons set p1_opens_at = '2026-01-01' where id = sid;
  perform pg_temp.assert_eq('statut vote_p1', (select status from public.seasons where id = sid), 'vote_p1');

  -- Brouillons via la RPC, sous l'identité des joueurs (RLS active)
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  r1 := public.save_ranking_draft(sid, 1, jsonb_build_array(
    jsonb_build_object('contestant_id', cA, 'position', 1), jsonb_build_object('contestant_id', cB, 'position', 2),
    jsonb_build_object('contestant_id', cC, 'position', 3), jsonb_build_object('contestant_id', cD, 'position', 4),
    jsonb_build_object('contestant_id', cE, 'position', 5), jsonb_build_object('contestant_id', cF, 'position', 6)));
  perform public.set_note(sid, 1, cA, 'Ma favorite, note privée.');
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- Uma commence par un ordre, puis échange deux places (contrainte différée) et retire un élève annoté
  r2 := public.save_ranking_draft(sid, 1, jsonb_build_array(
    jsonb_build_object('contestant_id', cA, 'position', 1), jsonb_build_object('contestant_id', cB, 'position', 2)));
  perform public.set_note(sid, 1, cB, 'Note sur B');
  r2 := public.save_ranking_draft(sid, 1, jsonb_build_array(
    jsonb_build_object('contestant_id', cB, 'position', 1), jsonb_build_object('contestant_id', cA, 'position', 2)));
  r2 := public.save_ranking_draft(sid, 1, jsonb_build_array(jsonb_build_object('contestant_id', cA, 'position', 1)));
  reset role;
  perform pg_temp.assert_eq('note conservée après retrait (position nulle)',
    (select position is null and comment = 'Note sur B' from public.ranking_items where ranking_id = r2 and contestant_id = cB), true);

  -- Classement incomplet : soumission refusée
  perform pg_temp.assert_eq('soumission incomplète refusée',
    pg_temp.denied_as(u2, format('update public.rankings set submitted_at = now() where id = %L', r2)), true);

  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  r2 := public.save_ranking_draft(sid, 1, jsonb_build_array(
    jsonb_build_object('contestant_id', cF, 'position', 1), jsonb_build_object('contestant_id', cE, 'position', 2),
    jsonb_build_object('contestant_id', cD, 'position', 3), jsonb_build_object('contestant_id', cC, 'position', 4),
    jsonb_build_object('contestant_id', cB, 'position', 5), jsonb_build_object('contestant_id', cA, 'position', 6)));
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated')::text, true);
  set local role authenticated;
  r3 := public.save_ranking_draft(sid, 1, jsonb_build_array(jsonb_build_object('contestant_id', cA, 'position', 1)));
  reset role;

  -- Casting en cours : Uma a tout placé mais ne peut pas valider
  perform pg_temp.assert_eq('liste incomplète : validation refusée',
    pg_temp.denied_as(u2, format('update public.rankings set submitted_at = now() where id = %L', r2)), true);
  update public.seasons set roster_complete_at = '2026-01-01 12:00' where id = sid;
  perform pg_temp.assert_eq('liste complète : ajout d''élève refusé',
    pg_temp.denied_as(u1, format('insert into public.contestants (season_id, full_name) values (%L, %L)', sid, 'G')), true);

  -- Avant révélation : Uma ne voit pas le classement d'Ulysse, ni ses items
  perform pg_temp.assert_eq('avant révélation, rankings des autres invisibles',
    pg_temp.count_as(u2, format('select 1 from public.rankings where user_id = %L', u1)), 0::bigint);
  perform pg_temp.assert_eq('ranking_items bruts des autres invisibles',
    pg_temp.count_as(u2, format('select 1 from public.ranking_items where ranking_id = %L', r1)), 0::bigint);

  -- Soumissions (antidatées pour précéder les sorties)
  update public.rankings set submitted_at = '2026-01-02' where id in (r1, r2);
  perform pg_temp.assert_eq('scellé : position intouchable',
    pg_temp.denied_as(u1, format('update public.ranking_items set position = 2 where ranking_id = %L and contestant_id = %L', r1, cA)), true);
  perform pg_temp.assert_eq('scellé : note modifiable',
    pg_temp.denied_as(u1, format('select public.set_note(%L, 1, %L, %L)', sid, cA, 'Note corrigée en semaine 6')), false);
  perform pg_temp.denied_as(u1, format('update public.rankings set submitted_at = null where id = %L', r1));
  perform pg_temp.assert_eq('scellé : ranking intouchable (RLS filtre la ligne)',
    (select submitted_at is not null from public.rankings where id = r1), true);

  perform pg_temp.assert_eq('classements scellés : liste non rouvrable',
    pg_temp.denied_as(u1, format('update public.seasons set roster_complete_at = null where id = %L', sid)), true);
  update public.seasons set p1_closes_at = '2026-01-03', p1_revealed_at = '2026-01-03' where id = sid;
  perform pg_temp.assert_eq('statut p1_revelee', (select status from public.seasons where id = sid), 'p1_revelee');
  perform pg_temp.assert_eq('phase fermée : brouillon de Ugo figé',
    pg_temp.denied_as(u3, format('select public.save_ranking_draft(%L, 1, %L::jsonb)', sid, jsonb_build_array(jsonb_build_object('contestant_id', cB, 'position', 2)))), true);

  -- Après révélation : positions visibles via la vue, jamais la note
  perform pg_temp.assert_eq('révélé : positions d''Ulysse visibles par Uma',
    pg_temp.count_as(u2, format('select 1 from public.ranking_items_public where user_id = %L', u1)), 6::bigint);
  perform pg_temp.assert_eq('révélé : brouillon non soumis de Ugo invisible',
    pg_temp.count_as(u2, format('select 1 from public.ranking_items_public where user_id = %L', u3)), 0::bigint);
  perform pg_temp.assert_eq('révélé : table brute toujours privée',
    pg_temp.count_as(u2, format('select 1 from public.ranking_items where ranking_id = %L', r1)), 0::bigint);
  perform pg_temp.assert_eq('la vue publique ne projette pas comment',
    (select count(*) from information_schema.columns where table_name = 'ranking_items_public' and column_name = 'comment'), 0::bigint);
  perform pg_temp.assert_eq('sans profil : rien',
    pg_temp.count_as(u4, 'select 1 from public.seasons'), 0::bigint);

  -- Semaines et sorties -------------------------------------------------------
  insert into public.weeks (season_id, number) values (sid, 1) returning id into w1;
  insert into public.nominations (week_id, contestant_id) values (w1, cE), (w1, cF);
  insert into public.weekly_picks (week_id, user_id, contestant_id) values (w1, u1, cF), (w1, u2, cE);
  perform pg_temp.assert_eq('pronostic hors nominés refusé',
    pg_temp.denied_as(u2, format('insert into public.weekly_picks (week_id, user_id, contestant_id) values (%L, %L, %L) on conflict (week_id, user_id) do update set contestant_id = excluded.contestant_id', w1, u2, cA)), true);
  perform pg_temp.assert_eq('avant fermeture : le pronostic des autres est invisible',
    pg_temp.count_as(u2, format('select 1 from public.weekly_picks where week_id = %L', w1)), 1::bigint);
  update public.weeks set picks_closed_at = now() where id = w1;
  perform pg_temp.denied_as(u2, format('update public.weekly_picks set contestant_id = %L where week_id = %L and user_id = %L', cF, w1, u2));
  perform pg_temp.assert_eq('après fermeture : pronostic inchangé (RLS filtre la ligne)',
    (select contestant_id from public.weekly_picks where week_id = w1 and user_id = u2), cE);
  perform pg_temp.assert_eq('après fermeture : nouveau pronostic refusé',
    pg_temp.denied_as(u3, format('insert into public.weekly_picks (week_id, user_id, contestant_id) values (%L, %L, %L)', w1, u3, cF)), true);
  perform pg_temp.assert_eq('après fermeture : tous les pronostics visibles',
    pg_temp.count_as(u2, format('select 1 from public.weekly_picks where week_id = %L', w1)), 2::bigint);
  perform pg_temp.assert_eq('joueur : insert elimination refusé',
    pg_temp.denied_as(u2, format('insert into public.eliminations (week_id, contestant_id, exit_place) values (%L, %L, 6)', w1, cF)), true);

  -- Semaine 1 : F sort 6e. Ulysse 6e = F exact → 10 ; pronostic F juste → +5. Uma 6e = A → 0.
  insert into public.eliminations (week_id, contestant_id, exit_place, announced_at) values (w1, cF, 6, '2026-01-10');
  perform pg_temp.assert_eq('statut en_cours', (select status from public.seasons where id = sid), 'en_cours');
  perform pg_temp.assert_eq('S1 Ulysse = 15', (select total_points from public.leaderboard where season_id = sid and user_id = u1), 15);
  perform pg_temp.assert_eq('S1 Uma = 0', (select total_points from public.leaderboard where season_id = sid and user_id = u2), 0);
  perform pg_temp.assert_eq('nominé déjà sorti refusé',
    pg_temp.denied_as(u1, format('insert into public.nominations (week_id, contestant_id) values (%L, %L)', w1, cF)), true);

  -- Semaine 2 : nominés D, E ; E sort 5e. Ulysse 5e = E → 10. Uma 5e = B → 0. Uma pronostique D → 0.
  insert into public.weeks (season_id, number, picks_closed_at) values (sid, 2, '2026-01-16') returning id into w2;
  insert into public.nominations (week_id, contestant_id) values (w2, cD), (w2, cE);
  update public.weeks set picks_closed_at = null where id = w2;
  insert into public.weekly_picks (week_id, user_id, contestant_id) values (w2, u2, cD);
  update public.weeks set picks_closed_at = '2026-01-16' where id = w2;
  insert into public.eliminations (week_id, contestant_id, exit_place, announced_at) values (w2, cE, 5, '2026-01-17') returning id into e_week2;
  perform pg_temp.assert_eq('S2 Ulysse = 25', (select total_points from public.leaderboard where season_id = sid and user_id = u1), 25);
  perform pg_temp.assert_eq('S2 Uma = 0', (select total_points from public.leaderboard where season_id = sid and user_id = u2), 0);
  perform pg_temp.assert_eq('place déjà prise refusée',
    pg_temp.denied_as(u1, format('insert into public.eliminations (week_id, contestant_id, exit_place) values (%L, %L, 5)', w2, cD)), true);

  -- Hors scoring : la sortie de E est neutralisée puis rétablie
  update public.eliminations set is_scored = false where id = e_week2;
  perform pg_temp.assert_eq('hors scoring : Ulysse = 15', (select total_points from public.leaderboard where season_id = sid and user_id = u1), 15);
  update public.eliminations set is_scored = true where id = e_week2;

  -- Phase 2 : 4 restants (A, B, C, D)
  update public.seasons set p2_opens_at = '2026-01-18' where id = sid;
  perform pg_temp.assert_eq('statut vote_p2', (select status from public.seasons where id = sid), 'vote_p2');
  perform pg_temp.assert_eq('phase 2 : élève sorti refusé',
    pg_temp.denied_as(u1, format('select public.save_ranking_draft(%L, 2, %L::jsonb)', sid, jsonb_build_array(jsonb_build_object('contestant_id', cE, 'position', 1)))), true);

  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  r1p2 := public.save_ranking_draft(sid, 2, jsonb_build_array(
    jsonb_build_object('contestant_id', cA, 'position', 1), jsonb_build_object('contestant_id', cB, 'position', 2),
    jsonb_build_object('contestant_id', cC, 'position', 3), jsonb_build_object('contestant_id', cD, 'position', 4)));
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  r2p2 := public.save_ranking_draft(sid, 2, jsonb_build_array(
    jsonb_build_object('contestant_id', cD, 'position', 1), jsonb_build_object('contestant_id', cC, 'position', 2),
    jsonb_build_object('contestant_id', cB, 'position', 3), jsonb_build_object('contestant_id', cA, 'position', 4)));
  reset role;
  update public.rankings set submitted_at = '2026-01-20' where id in (r1p2, r2p2);
  update public.seasons set p2_closes_at = '2026-01-21', p2_revealed_at = '2026-01-21' where id = sid;
  perform pg_temp.assert_eq('statut en_cours après révélation P2', (select status from public.seasons where id = sid), 'en_cours');

  -- Semaine 3 : nominés C, D (2 < 4, sous-ensemble strict) ; C sort 4e.
  -- P1 : Ulysse 4e = D nominé → 4 ; Uma 4e = C exact → 20.
  -- P2 : Ulysse 4e = D nominé → 2 ; Uma 4e = A → 0.
  insert into public.weeks (season_id, number) values (sid, 3) returning id into w3;
  insert into public.nominations (week_id, contestant_id) values (w3, cC), (w3, cD);
  update public.weeks set picks_closed_at = '2026-01-23' where id = w3;
  insert into public.eliminations (week_id, contestant_id, exit_place, announced_at) values (w3, cC, 4, '2026-01-24');
  perform pg_temp.assert_eq('S3 Ulysse = 31', (select total_points from public.leaderboard where season_id = sid and user_id = u1), 31);
  perform pg_temp.assert_eq('S3 Uma = 20', (select total_points from public.leaderboard where season_id = sid and user_id = u2), 20);
  perform pg_temp.assert_eq('S3 lignes de phase 2 présentes',
    (select count(*) from public.score_events where season_id = sid and phase = 2), 2::bigint);

  -- Semaine 4 (demi-finale) : nominés A, B, D = tous les restants → pas de points « nominé ».
  -- D sort 3e. P1 : Ulysse 3e = C (déjà sorti) → 0 ; Uma 3e = D exact → 30.
  -- P2 : Ulysse 3e = C → 0 ; Uma 3e = B, nominé mais pas sous-ensemble strict → 0.
  insert into public.weeks (season_id, number) values (sid, 4) returning id into w4;
  insert into public.nominations (week_id, contestant_id) values (w4, cA), (w4, cB), (w4, cD);
  update public.weeks set picks_closed_at = '2026-01-30' where id = w4;
  insert into public.eliminations (week_id, contestant_id, exit_place, announced_at) values (w4, cD, 3, '2026-01-31') returning id into e_week4;
  perform pg_temp.assert_eq('S4 Ulysse = 31', (select total_points from public.leaderboard where season_id = sid and user_id = u1), 31);
  perform pg_temp.assert_eq('S4 Uma = 50', (select total_points from public.leaderboard where season_id = sid and user_id = u2), 50);
  perform pg_temp.assert_eq('S4 aucun point nominé distribué',
    (select count(*) from public.score_events where season_id = sid and week_id = w4 and outcome = 'nominated'), 0::bigint);

  -- Repêchage : la sortie de D est annulée puis ressaisie
  delete from public.eliminations where id = e_week4;
  perform pg_temp.assert_eq('repêchage : Uma = 20', (select total_points from public.leaderboard where season_id = sid and user_id = u2), 20);
  insert into public.eliminations (week_id, contestant_id, exit_place, announced_at) values (w4, cD, 3, '2026-01-31');

  -- Semaine 5 (finale) : nominés A, B. B sort 2e puis A gagne (1re). Deux sorties le même soir.
  -- Place 2 : P1 Ulysse 2e = B exact → 40 ; Uma 2e = E → 0. P2 Ulysse 2e = B → 20 ; Uma 2e = C → 0.
  -- Place 1 : P1 Ulysse 1er = A exact → 60 ; Uma 1re = F → 0. P2 Ulysse 1er = A → 30 ; Uma 1re = D → 0.
  -- Pronostics : Ulysse A (juste sur la place 1) +5 ; Uma B (juste sur la place 2) +5.
  insert into public.weeks (season_id, number) values (sid, 5) returning id into w5;
  insert into public.nominations (week_id, contestant_id) values (w5, cA), (w5, cB);
  insert into public.weekly_picks (week_id, user_id, contestant_id) values (w5, u1, cA), (w5, u2, cB);
  update public.weeks set picks_closed_at = '2026-02-06' where id = w5;
  insert into public.eliminations (week_id, contestant_id, exit_place, announced_at) values (w5, cB, 2, '2026-02-07 22:00');
  insert into public.eliminations (week_id, contestant_id, exit_place, announced_at) values (w5, cA, 1, '2026-02-07 23:00');
  perform pg_temp.assert_eq('Finale Ulysse = 186', (select total_points from public.leaderboard where season_id = sid and user_id = u1), 186);
  perform pg_temp.assert_eq('Finale Uma = 55', (select total_points from public.leaderboard where season_id = sid and user_id = u2), 55);
  perform pg_temp.assert_eq('Ugo non validé : 0 et has_submitted = false',
    (select total_points = 0 and has_submitted = false from public.leaderboard where season_id = sid and user_id = u3), true);
  perform pg_temp.assert_eq('départage : exacts d''Ulysse = 6', (select exact_count from public.leaderboard where season_id = sid and user_id = u1), 6);
  perform pg_temp.assert_eq('départage : exacts d''Uma = 2', (select exact_count from public.leaderboard where season_id = sid and user_id = u2), 2);
  perform pg_temp.assert_eq('statut terminee', (select status from public.seasons where id = sid), 'terminee');

  -- Le classement vu par un joueur (RLS) est identique
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select total_points into v from public.leaderboard where season_id = sid and user_id = u1;
  reset role;
  perform pg_temp.assert_eq('vu par Uma : Ulysse = 186', v, 186);

  -- Changement de barème : recalcul immédiat
  update public.scoring_rules set points_exact = 100 where season_id = sid and phase = 1 and exit_place_min = 1;
  perform pg_temp.assert_eq('barème modifié : Ulysse = 226', (select total_points from public.leaderboard where season_id = sid and user_id = u1), 226);

  -- Chat : suppression douce par l'auteur seul, pas de réécriture
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.messages (season_id, user_id, body) values (sid, u2, 'coucou');
  reset role;
  perform pg_temp.assert_eq('message : réécriture refusée',
    pg_temp.denied_as(u2, format('update public.messages set body = %L where season_id = %L and user_id = %L', 'autre', sid, u2)), true);
  perform pg_temp.assert_eq('message : suppression par un autre sans effet',
    pg_temp.denied_as(u1, format('update public.messages set deleted_at = now() where season_id = %L and user_id = %L', sid, u2)), false);
  perform pg_temp.assert_eq('message toujours intact', pg_temp.count_as(u1, format('select 1 from public.messages where season_id = %L and deleted_at is null and body = %L', sid, 'coucou')), 1::bigint);
  perform pg_temp.assert_eq('message : suppression par l''auteur',
    pg_temp.denied_as(u2, format('update public.messages set deleted_at = now() where season_id = %L and user_id = %L', sid, u2)), false);
  perform pg_temp.assert_eq('message supprimé : contenu effacé, tombale visible',
    pg_temp.count_as(u1, format('select 1 from public.messages where season_id = %L and deleted_at is not null and body is null', sid)), 1::bigint);
  perform pg_temp.assert_eq('message supprimé : plus aucun message vivant',
    pg_temp.count_as(u1, format('select 1 from public.messages where season_id = %L and deleted_at is null', sid)), 0::bigint);

  -- Invitation
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.invites (code, season_id, created_by) values ('TESTCODE', sid, u1);
  reset role;
  perform pg_temp.assert_eq('code inconnu refusé', pg_temp.denied_as(u4, 'select public.redeem_invite(''NOPE'', ''Quatre'')'), true);
  perform pg_temp.assert_eq('code valide accepté', pg_temp.denied_as(u4, 'select public.redeem_invite(''testcode'', ''Quatre'')'), false);
  perform pg_temp.assert_eq('profil créé', (select count(*) from public.profiles where id = u4), 1::bigint);
  perform pg_temp.assert_eq('code consommé', (select used_by from public.invites where code = 'TESTCODE'), u4);
  perform pg_temp.assert_eq('code réutilisé refusé', pg_temp.denied_as(u3, 'select public.redeem_invite(''TESTCODE'', ''Bis'')'), false); -- u3 a déjà un profil : renvoie le sien
  perform pg_temp.assert_eq('non-admin : is_admin verrouillé',
    pg_temp.denied_as(u2, format('update public.profiles set is_admin = true where id = %L', u2)), true);
end $$;
