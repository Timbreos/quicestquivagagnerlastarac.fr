-- =============================================================================
-- 0002 — Row Level Security
-- La sécurité repose entièrement ici : aucun secret dans le bundle statique.
-- Révélation des votes et confidentialité des notes vivent dans les policies.
-- =============================================================================

alter table public.profiles          enable row level security;
alter table public.seasons           enable row level security;
alter table public.contestants       enable row level security;
alter table public.weeks             enable row level security;
alter table public.nominations       enable row level security;
alter table public.eliminations      enable row level security;
alter table public.rankings          enable row level security;
alter table public.ranking_items     enable row level security;
alter table public.weekly_picks      enable row level security;
alter table public.scoring_rules     enable row level security;
alter table public.messages          enable row level security;
alter table public.message_reactions enable row level security;
alter table public.invites           enable row level security;

-- --- profiles -----------------------------------------------------------------
create policy "profiles: membres lisent tout"
  on public.profiles for select to authenticated
  using (public.is_member());

create policy "profiles: chacun modifie le sien"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Pas d'insert direct : redeem_invite() seulement.

-- --- tables publiques (lecture membres, écriture admin) -----------------------
create policy "seasons: lecture membres"    on public.seasons for select to authenticated using (public.is_member());
create policy "seasons: écriture admin"     on public.seasons for all    to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "contestants: lecture membres" on public.contestants for select to authenticated using (public.is_member());
create policy "contestants: écriture admin"  on public.contestants for all    to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "weeks: lecture membres"       on public.weeks for select to authenticated using (public.is_member());
create policy "weeks: écriture admin"        on public.weeks for all    to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "nominations: lecture membres" on public.nominations for select to authenticated using (public.is_member());
create policy "nominations: écriture admin"  on public.nominations for all    to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "eliminations: lecture membres" on public.eliminations for select to authenticated using (public.is_member());
create policy "eliminations: écriture admin"  on public.eliminations for all    to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "scoring_rules: lecture membres" on public.scoring_rules for select to authenticated using (public.is_member());
create policy "scoring_rules: écriture admin"  on public.scoring_rules for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- --- rankings -----------------------------------------------------------------
-- Les siens toujours ; ceux des autres uniquement soumis et après révélation.
create policy "rankings: lecture"
  on public.rankings for select to authenticated
  using (
    public.is_member() and (
      user_id = auth.uid()
      or (submitted_at is not null and public.phase_is_revealed(season_id, phase))
    )
  );

create policy "rankings: créer le sien, phase ouverte"
  on public.rankings for insert to authenticated
  with check (
    public.is_member() and user_id = auth.uid()
    and submitted_at is null
    and public.phase_is_open(season_id, phase)
  );

-- Mise à jour (dont la soumission) : le sien, non scellé, phase ouverte.
create policy "rankings: modifier le sien, non scellé, phase ouverte"
  on public.rankings for update to authenticated
  using (user_id = auth.uid() and submitted_at is null and public.phase_is_open(season_id, phase))
  with check (user_id = auth.uid());

create policy "rankings: vider son brouillon"
  on public.rankings for delete to authenticated
  using (user_id = auth.uid() and submitted_at is null and public.phase_is_open(season_id, phase));

-- --- ranking_items ------------------------------------------------------------
-- La table brute (avec la colonne comment) n'est lisible que par son auteur,
-- sans exception. La révélation passe par la vue ranking_items_public.
create policy "ranking_items: lecture par l'auteur seul"
  on public.ranking_items for select to authenticated
  using (exists (select 1 from public.rankings r where r.id = ranking_id and r.user_id = auth.uid()));

create policy "ranking_items: insérer dans son brouillon, phase ouverte"
  on public.ranking_items for insert to authenticated
  with check (exists (
    select 1 from public.rankings r
    where r.id = ranking_id and r.user_id = auth.uid()
      and r.submitted_at is null and public.phase_is_open(r.season_id, r.phase)
  ));

-- Le trigger ranking_items_guard restreint l'update à la note une fois scellé.
create policy "ranking_items: modifier les siens"
  on public.ranking_items for update to authenticated
  using (exists (select 1 from public.rankings r where r.id = ranking_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.rankings r where r.id = ranking_id and r.user_id = auth.uid()));

create policy "ranking_items: retirer de son brouillon, phase ouverte"
  on public.ranking_items for delete to authenticated
  using (exists (
    select 1 from public.rankings r
    where r.id = ranking_id and r.user_id = auth.uid()
      and r.submitted_at is null and public.phase_is_open(r.season_id, r.phase)
  ));

-- --- weekly_picks -------------------------------------------------------------
create policy "weekly_picks: les siens avant fermeture, tous après"
  on public.weekly_picks for select to authenticated
  using (
    public.is_member() and (
      user_id = auth.uid()
      or exists (select 1 from public.weeks w where w.id = week_id and w.picks_closed_at is not null)
    )
  );

create policy "weekly_picks: poser le sien, semaine ouverte"
  on public.weekly_picks for insert to authenticated
  with check (
    public.is_member() and user_id = auth.uid()
    and exists (select 1 from public.weeks w where w.id = week_id and w.picks_closed_at is null)
  );

create policy "weekly_picks: changer le sien, semaine ouverte"
  on public.weekly_picks for update to authenticated
  using (user_id = auth.uid() and exists (select 1 from public.weeks w where w.id = week_id and w.picks_closed_at is null))
  with check (user_id = auth.uid());

create policy "weekly_picks: retirer le sien, semaine ouverte"
  on public.weekly_picks for delete to authenticated
  using (user_id = auth.uid() and exists (select 1 from public.weeks w where w.id = week_id and w.picks_closed_at is null));

-- --- messages -----------------------------------------------------------------
-- Les messages supprimés restent visibles comme pierres tombales vides (contenu effacé par trigger).
create policy "messages: lecture membres"
  on public.messages for select to authenticated
  using (public.is_member());

create policy "messages: écrire en son nom"
  on public.messages for insert to authenticated
  with check (public.is_member() and user_id = auth.uid() and deleted_at is null);

-- Suppression douce par l'auteur seul (le trigger interdit toute autre modification).
create policy "messages: supprimer le sien"
  on public.messages for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- --- message_reactions --------------------------------------------------------
create policy "reactions: lecture membres"
  on public.message_reactions for select to authenticated
  using (public.is_member());

create policy "reactions: réagir en son nom"
  on public.message_reactions for insert to authenticated
  with check (public.is_member() and user_id = auth.uid());

create policy "reactions: retirer la sienne"
  on public.message_reactions for delete to authenticated
  using (user_id = auth.uid());

-- --- invites ------------------------------------------------------------------
create policy "invites: admin"
  on public.invites for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
