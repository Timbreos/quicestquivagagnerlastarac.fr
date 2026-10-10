// Types de la base. Écrits à la main pour suivre les migrations ; à régénérer
// via `supabase gen types typescript` si le schéma bouge.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type SeasonStatus = "preparation" | "vote_p1" | "p1_revelee" | "en_cours" | "vote_p2" | "terminee";
export type Outcome = "exact" | "nominated" | "miss" | "pick_hit" | "pick_miss";
export type ScoreSource = "ranking" | "pick";

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
};

export type Season = {
  id: string;
  name: string;
  status: SeasonStatus;
  p1_opens_at: string | null;
  p1_closes_at: string | null;
  p1_revealed_at: string | null;
  p2_opens_at: string | null;
  p2_closes_at: string | null;
  p2_revealed_at: string | null;
  roster_complete_at: string | null;
  phase2_threshold: number;
  created_at: string;
};

export type Contestant = {
  id: string;
  season_id: string;
  full_name: string;
  photo_url: string | null;
  bio: string | null;
  display_order: number;
  created_at: string;
};

export type Week = {
  id: string;
  season_id: string;
  number: number;
  prime_at: string | null;
  picks_closed_at: string | null;
  created_at: string;
};

export type Nomination = { week_id: string; contestant_id: string; created_at: string };

export type Elimination = {
  id: string;
  week_id: string;
  season_id: string;
  contestant_id: string;
  exit_place: number;
  is_scored: boolean;
  announced_at: string;
};

export type Ranking = {
  id: string;
  season_id: string;
  user_id: string;
  phase: number;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RankingItem = {
  ranking_id: string;
  contestant_id: string;
  position: number | null;
  comment: string | null;
};

export type RankingItemPublic = {
  season_id: string;
  user_id: string;
  phase: number;
  ranking_id: string;
  contestant_id: string;
  position: number;
};

/** Entrée du carnet privé : plusieurs notes datées par élève, lisibles par leur auteur seul. */
export type ContestantNote = {
  id: string;
  season_id: string;
  user_id: string;
  contestant_id: string;
  body: string;
  created_at: string;
  updated_at: string;
};

/** Étoiles privées (1 à 5) d'un joueur sur un élève. */
export type ContestantRating = {
  user_id: string;
  contestant_id: string;
  season_id: string;
  stars: number;
  updated_at: string;
};

export type WeeklyPick = { week_id: string; user_id: string; contestant_id: string; created_at: string };

export type ScoringRule = {
  id: string;
  season_id: string;
  phase: number;
  exit_place_min: number;
  exit_place_max: number;
  points_exact: number;
  points_nominated: number;
};

export type Message = {
  id: string;
  season_id: string;
  user_id: string;
  body: string | null;
  gif_url: string | null;
  gif_provider: string | null;
  image_url: string | null;
  created_at: string;
  deleted_at: string | null;
};

export type MessageReaction = { message_id: string; user_id: string; emoji: string; created_at: string };

export type Invite = {
  code: string;
  season_id: string | null;
  created_by: string | null;
  used_by: string | null;
  expires_at: string | null;
  created_at: string;
};

export type ScoreEvent = {
  season_id: string;
  week_id: string;
  week_number: number;
  elimination_id: string;
  user_id: string;
  phase: number;
  source: ScoreSource;
  exit_place: number;
  eliminated_contestant_id: string;
  placed_contestant_id: string;
  is_scored: boolean;
  announced_at: string;
  outcome: Outcome;
  points: number;
};

export type LeaderboardRow = {
  season_id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  is_admin: boolean;
  has_submitted: boolean;
  total_points: number;
  exact_count: number;
  pick_hits: number;
};

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: "12" };
  public: {
    Tables: {
      profiles: Table<Profile, Pick<Profile, "id" | "display_name"> & Partial<Profile>>;
      seasons: Table<Season, Pick<Season, "name"> & Partial<Season>>;
      contestants: Table<Contestant, Pick<Contestant, "season_id" | "full_name"> & Partial<Contestant>>;
      weeks: Table<Week, Pick<Week, "season_id" | "number"> & Partial<Week>>;
      nominations: Table<Nomination, Pick<Nomination, "week_id" | "contestant_id"> & Partial<Nomination>>;
      eliminations: Table<
        Elimination,
        Pick<Elimination, "week_id" | "contestant_id" | "exit_place"> & Partial<Elimination>
      >;
      rankings: Table<Ranking, Pick<Ranking, "season_id" | "user_id" | "phase"> & Partial<Ranking>>;
      ranking_items: Table<RankingItem, Pick<RankingItem, "ranking_id" | "contestant_id"> & Partial<RankingItem>>;
      contestant_notes: Table<ContestantNote, Pick<ContestantNote, "season_id" | "contestant_id" | "body"> & Partial<ContestantNote>>;
      contestant_ratings: Table<ContestantRating, Pick<ContestantRating, "season_id" | "contestant_id" | "stars"> & Partial<ContestantRating>>;
      weekly_picks: Table<WeeklyPick, Pick<WeeklyPick, "week_id" | "user_id" | "contestant_id"> & Partial<WeeklyPick>>;
      scoring_rules: Table<
        ScoringRule,
        Pick<ScoringRule, "season_id" | "phase" | "exit_place_min" | "exit_place_max" | "points_exact"> & Partial<ScoringRule>
      >;
      messages: Table<Message, Pick<Message, "season_id" | "user_id"> & Partial<Message>>;
      message_reactions: Table<
        MessageReaction,
        Pick<MessageReaction, "message_id" | "user_id" | "emoji"> & Partial<MessageReaction>
      >;
      invites: Table<Invite, Partial<Invite>>;
    };
    Views: {
      ranking_items_public: { Row: RankingItemPublic; Relationships: [] };
      score_events: { Row: ScoreEvent; Relationships: [] };
      leaderboard: { Row: LeaderboardRow; Relationships: [] };
    };
    Functions: {
      redeem_invite: { Args: { p_code: string; p_display_name: string }; Returns: Profile };
      save_ranking_draft: {
        Args: { p_season_id: string; p_phase: number; p_items: Json };
        Returns: string;
      };
      set_note: {
        Args: { p_season_id: string; p_phase: number; p_contestant_id: string; p_comment: string };
        Returns: undefined;
      };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_member: { Args: Record<string, never>; Returns: boolean };
      phase_is_open: { Args: { p_season_id: string; p_phase: number }; Returns: boolean };
      phase_is_revealed: { Args: { p_season_id: string; p_phase: number }; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
