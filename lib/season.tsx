"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import type {
  Contestant,
  ContestantRating,
  Elimination,
  LeaderboardRow,
  Nomination,
  Profile,
  Ranking,
  RankingItem,
  ScoringRule,
  Season,
  Week,
  WeeklyPick,
} from "@/lib/types";

export type SeasonStore = {
  /** L'état d'authentification est connu. */
  ready: boolean;
  session: Session | null;
  /** Profil du joueur connecté ; null tant qu'il n'a pas redeem un code d'invitation. */
  profile: Profile | null;
  profileChecked: boolean;
  seasons: Season[];
  season: Season | null;
  selectSeason: (id: string) => void;
  contestants: Contestant[];
  weeks: Week[];
  nominations: Nomination[];
  eliminations: Elimination[];
  scoringRules: ScoringRule[];
  profiles: Profile[];
  leaderboard: LeaderboardRow[];
  myRankings: Ranking[];
  myItems: RankingItem[];
  picks: WeeklyPick[];
  /** Étoiles privées du joueur connecté, par élève. */
  myStars: Map<string, number>;
  /** Pose (1 à 5) ou retire (null) ses étoiles sur un élève. Optimiste ; renvoie l'erreur éventuelle. */
  setStars: (contestantId: string, stars: number | null) => Promise<string | null>;
  loadingSeason: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  reloadProfile: () => Promise<void>;
  /** Dernière sortie reçue en direct : déclenche la séquence de prime. */
  primeEvent: Elimination | null;
  dismissPrime: () => void;
  replayPrime: (e: Elimination) => void;
  signOut: () => Promise<void>;
};

const Ctx = createContext<SeasonStore | null>(null);

export function useSeason(): SeasonStore {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSeason() hors de SeasonProvider");
  return v;
}

const EMPTY = {
  contestants: [] as Contestant[],
  weeks: [] as Week[],
  nominations: [] as Nomination[],
  eliminations: [] as Elimination[],
  scoringRules: [] as ScoringRule[],
  profiles: [] as Profile[],
  leaderboard: [] as LeaderboardRow[],
  myRankings: [] as Ranking[],
  myItems: [] as RankingItem[],
  picks: [] as WeeklyPick[],
  myRatings: [] as ContestantRating[],
};

export function SeasonProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileChecked, setProfileChecked] = useState(false);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [data, setData] = useState(EMPTY);
  const [loadingSeason, setLoadingSeason] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [primeEvent, setPrimeEvent] = useState<Elimination | null>(null);
  const seenEliminations = useRef<Set<string>>(new Set());
  const initialLoadDone = useRef(false);

  // --- auth ------------------------------------------------------------------
  useEffect(() => {
    const sb = supabase();
    sb.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const reloadProfile = useCallback(async () => {
    const uid = session?.user.id;
    if (!uid) {
      setProfile(null);
      setProfileChecked(true);
      return;
    }
    const { data, error } = await supabase().from("profiles").select("*").eq("id", uid).maybeSingle();
    if (error) setError(error.message);
    setProfile((data as Profile | null) ?? null);
    setProfileChecked(true);
  }, [session?.user.id]);

  useEffect(() => {
    if (!ready) return;
    setProfileChecked(false);
    void reloadProfile();
  }, [ready, reloadProfile]);

  // --- saisons ---------------------------------------------------------------
  const loadSeasons = useCallback(async () => {
    const { data, error } = await supabase().from("seasons").select("*").order("created_at", { ascending: false });
    if (error) {
      setError(error.message);
      return;
    }
    const list = (data ?? []) as Season[];
    setSeasons(list);
    setSeasonId((cur) => {
      if (cur && list.some((s) => s.id === cur)) return cur;
      const active = list.find((s) => s.status !== "terminee") ?? list[0];
      return active?.id ?? null;
    });
  }, []);

  useEffect(() => {
    if (profile) void loadSeasons();
    else {
      setSeasons([]);
      setSeasonId(null);
      setData(EMPTY);
    }
  }, [profile, loadSeasons]);

  const season = useMemo(() => seasons.find((s) => s.id === seasonId) ?? null, [seasons, seasonId]);

  // --- données de la saison --------------------------------------------------
  const refresh = useCallback(async () => {
    if (!seasonId || !session) return;
    const sb = supabase();
    const uid = session.user.id;
    setLoadingSeason(!initialLoadDone.current);
    try {
      const [contestants, weeks, eliminations, scoringRules, profiles, leaderboard, myRankings, seasonsRes, myRatings] =
        await Promise.all([
          sb.from("contestants").select("*").eq("season_id", seasonId).order("display_order").order("full_name"),
          sb.from("weeks").select("*").eq("season_id", seasonId).order("number"),
          sb.from("eliminations").select("*").eq("season_id", seasonId).order("exit_place", { ascending: false }),
          sb.from("scoring_rules").select("*").eq("season_id", seasonId).order("phase").order("exit_place_min"),
          sb.from("profiles").select("*").order("display_name"),
          sb.from("leaderboard").select("*").eq("season_id", seasonId),
          sb.from("rankings").select("*").eq("season_id", seasonId).eq("user_id", uid),
          sb.from("seasons").select("*").order("created_at", { ascending: false }),
          sb.from("contestant_ratings").select("*").eq("season_id", seasonId).eq("user_id", uid),
        ]);
      const firstError = [contestants, weeks, eliminations, scoringRules, profiles, leaderboard, myRankings, seasonsRes, myRatings]
        .map((r) => r.error)
        .find(Boolean);
      if (firstError) throw firstError;

      const weekIds = (weeks.data ?? []).map((w) => w.id);
      const rankingIds = (myRankings.data ?? []).map((r) => r.id);
      const [nominations, picks, myItems] = await Promise.all([
        weekIds.length ? sb.from("nominations").select("*").in("week_id", weekIds) : Promise.resolve({ data: [], error: null }),
        weekIds.length ? sb.from("weekly_picks").select("*").in("week_id", weekIds) : Promise.resolve({ data: [], error: null }),
        rankingIds.length ? sb.from("ranking_items").select("*").in("ranking_id", rankingIds) : Promise.resolve({ data: [], error: null }),
      ]);
      const secondError = [nominations, picks, myItems].map((r) => r.error).find(Boolean);
      if (secondError) throw secondError;

      const elims = (eliminations.data ?? []) as Elimination[];
      if (!initialLoadDone.current) {
        elims.forEach((e) => seenEliminations.current.add(e.id));
      }
      setSeasons((seasonsRes.data ?? []) as Season[]);
      setData({
        contestants: (contestants.data ?? []) as Contestant[],
        weeks: (weeks.data ?? []) as Week[],
        nominations: (nominations.data ?? []) as Nomination[],
        eliminations: elims,
        scoringRules: (scoringRules.data ?? []) as ScoringRule[],
        profiles: (profiles.data ?? []) as Profile[],
        leaderboard: (leaderboard.data ?? []) as LeaderboardRow[],
        myRankings: (myRankings.data ?? []) as Ranking[],
        myItems: (myItems.data ?? []) as RankingItem[],
        picks: (picks.data ?? []) as WeeklyPick[],
        myRatings: (myRatings.data ?? []) as ContestantRating[],
      });
      setError(null);
      initialLoadDone.current = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingSeason(false);
    }
  }, [seasonId, session]);

  useEffect(() => {
    initialLoadDone.current = false;
    seenEliminations.current = new Set();
    void refresh();
  }, [refresh]);

  // --- temps réel ------------------------------------------------------------
  useEffect(() => {
    if (!seasonId || !session) return;
    const sb = supabase();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 250);
    };
    const channel = sb
      .channel(`season-${seasonId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "eliminations", filter: `season_id=eq.${seasonId}` },
        (payload) => {
          const e = payload.new as Elimination;
          if (!seenEliminations.current.has(e.id)) {
            seenEliminations.current.add(e.id);
            setPrimeEvent(e);
          }
          scheduleRefresh();
        },
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "eliminations" }, scheduleRefresh)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "eliminations" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "nominations" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "weeks", filter: `season_id=eq.${seasonId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "seasons" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "contestants", filter: `season_id=eq.${seasonId}` }, scheduleRefresh)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void sb.removeChannel(channel);
    };
  }, [seasonId, session, refresh]);

  const myStars = useMemo(() => new Map(data.myRatings.map((r) => [r.contestant_id, r.stars])), [data.myRatings]);

  const setStars = useCallback(
    async (contestantId: string, stars: number | null) => {
      const uid = session?.user.id;
      if (!seasonId || !uid) return "Pas de saison active.";
      const before = data.myRatings;
      const others = before.filter((r) => r.contestant_id !== contestantId);
      const next = stars
        ? [...others, { user_id: uid, contestant_id: contestantId, season_id: seasonId, stars, updated_at: new Date().toISOString() }]
        : others;
      setData((d) => ({ ...d, myRatings: next }));
      const sb = supabase();
      const { error } = stars
        ? await sb
            .from("contestant_ratings")
            .upsert({ user_id: uid, contestant_id: contestantId, season_id: seasonId, stars }, { onConflict: "user_id,contestant_id" })
        : await sb.from("contestant_ratings").delete().eq("user_id", uid).eq("contestant_id", contestantId);
      if (error) {
        setData((d) => ({ ...d, myRatings: before }));
        return error.message;
      }
      return null;
    },
    [seasonId, session?.user.id, data.myRatings],
  );

  const signOut = useCallback(async () => {
    await supabase().auth.signOut();
    setProfile(null);
    setSeasons([]);
    setSeasonId(null);
    setData(EMPTY);
  }, []);

  const value = useMemo<SeasonStore>(
    () => ({
      ready,
      session,
      profile,
      profileChecked,
      seasons,
      season,
      selectSeason: setSeasonId,
      ...data,
      myStars,
      setStars,
      loadingSeason,
      error,
      refresh,
      reloadProfile,
      primeEvent,
      dismissPrime: () => setPrimeEvent(null),
      replayPrime: (e: Elimination) => setPrimeEvent(e),
      signOut,
    }),
    [ready, session, profile, profileChecked, seasons, season, data, myStars, setStars, loadingSeason, error, refresh, reloadProfile, primeEvent, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
