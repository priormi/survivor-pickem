import { apiError, jsonResponse, optionsResponse } from "../_shared/errors.ts";
import { requireSession } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "POST") return apiError("METHOD_NOT_ALLOWED", "Use POST.", 405);

  const session = await requireSession(request);
  if ("error" in session) return session.error;

  const { supabase, player } = session;
  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("id, name, slug, timezone")
    .eq("id", player.league_id)
    .single();

  if (leagueError) return apiError("LEAGUE_LOOKUP_FAILED", leagueError.message, 500);

  const { data: season, error: seasonError } = await supabase
    .from("seasons")
    .select("id, year, name, status, current_round_id")
    .eq("league_id", league.id)
    .in("status", ["ACTIVE", "DRAFT"])
    .order("year", { ascending: false })
    .limit(1)
    .single();

  if (seasonError) return apiError("SEASON_LOOKUP_FAILED", seasonError.message, 500);

  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .select("id, display_name, deadline_at, status")
    .eq("id", season.current_round_id)
    .single();

  if (roundError) return apiError("ROUND_LOOKUP_FAILED", roundError.message, 500);

  const { data: seasonPlayers, error: playersError } = await supabase
    .from("season_players")
    .select("id, strike_count, status, player:players(id, display_name, active)")
    .eq("season_id", season.id)
    .order("strike_count", { ascending: true });

  if (playersError) return apiError("PLAYERS_LOOKUP_FAILED", playersError.message, 500);

  const visibleSeasonPlayers = (seasonPlayers ?? []).filter((seasonPlayer) => {
    const playerRecord = Array.isArray(seasonPlayer.player) ? seasonPlayer.player[0] : seasonPlayer.player;
    return playerRecord?.active !== false;
  });
  const seasonPlayerIds = visibleSeasonPlayers.map((item) => item.id);
  const { data: picks, error: picksError } = seasonPlayerIds.length
    ? await supabase
        .from("picks")
        .select("season_player_id, submitted_at, team:teams(id, abbreviation, city, name)")
        .eq("round_id", round.id)
        .in("season_player_id", seasonPlayerIds)
    : { data: [], error: null };

  if (picksError) return apiError("PICKS_LOOKUP_FAILED", picksError.message, 500);

  const { data: pickHistory, error: pickHistoryError } = seasonPlayerIds.length
    ? await supabase
        .from("picks")
        .select("id, season_player_id, round_id, pick_result, submitted_at, team:teams(id, abbreviation, city, name), round:rounds(id, display_name, sequence_number)")
        .in("season_player_id", seasonPlayerIds)
        .order("submitted_at", { ascending: true })
    : { data: [], error: null };

  if (pickHistoryError) return apiError("PICK_HISTORY_LOOKUP_FAILED", pickHistoryError.message, 500);

  const pickBySeasonPlayer = new Map((picks ?? []).map((pick) => [pick.season_player_id, pick]));
  const isLocked = new Date(round.deadline_at).getTime() <= Date.now() || round.status !== "OPEN";
  const activeSeasonPlayers = visibleSeasonPlayers.filter((seasonPlayer) => seasonPlayer.status === "ACTIVE");
  const submittedActivePickCount = activeSeasonPlayers.filter((seasonPlayer) => pickBySeasonPlayer.has(seasonPlayer.id)).length;
  const allActivePlayersPicked =
    activeSeasonPlayers.length > 0 && submittedActivePickCount === activeSeasonPlayers.length;
  const revealAllPicks = allActivePlayersPicked;

  const historyBySeasonPlayer = new Map<string, any[]>();
  for (const pick of pickHistory ?? []) {
    const existing = historyBySeasonPlayer.get(pick.season_player_id) ?? [];
    existing.push(pick);
    historyBySeasonPlayer.set(pick.season_player_id, existing);
  }

  const players = visibleSeasonPlayers.map((seasonPlayer) => {
    const pick = pickBySeasonPlayer.get(seasonPlayer.id);
    const playerRecord = Array.isArray(seasonPlayer.player) ? seasonPlayer.player[0] : seasonPlayer.player;
    const rawTeam = Array.isArray(pick?.team) ? pick?.team[0] : pick?.team;
    const canSeePick = revealAllPicks || playerRecord?.id === player.id;
    const team = rawTeam && canSeePick ? rawTeam : null;
    const history = (historyBySeasonPlayer.get(seasonPlayer.id) ?? []).map((historyPick) => {
      const historyTeam = Array.isArray(historyPick.team) ? historyPick.team[0] : historyPick.team;
      const historyRound = Array.isArray(historyPick.round) ? historyPick.round[0] : historyPick.round;
      const visible = historyPick.round_id !== round.id || revealAllPicks || playerRecord?.id === player.id;

      return {
        id: historyPick.id,
        roundId: historyPick.round_id,
        roundName: historyRound?.display_name ?? "Round",
        roundSequence: historyRound?.sequence_number ?? 0,
        result: historyPick.pick_result,
        submittedAt: historyPick.submitted_at,
        team: visible ? historyTeam ?? null : null,
        visible
      };
    }).sort((a, b) => a.roundSequence - b.roundSequence);

    return {
      id: seasonPlayer.id,
      playerId: playerRecord?.id,
      displayName: playerRecord?.display_name ?? "Unknown",
      strikeCount: seasonPlayer.strike_count,
      status: seasonPlayer.status,
      pickSubmitted: Boolean(pick),
      pickTeam: team,
      pickVisible: Boolean(team),
      pickHistory: history
    };
  });

  return jsonResponse({
    league,
    season,
    currentRound: {
      id: round.id,
      displayName: round.display_name,
      deadlineAt: round.deadline_at,
      status: round.status,
      locked: isLocked,
      allPicksSubmitted: allActivePlayersPicked,
      submittedPickCount: submittedActivePickCount,
      expectedPickCount: activeSeasonPlayers.length
    },
    player: {
      id: player.id,
      displayName: player.display_name,
      isAdmin: player.is_admin
    },
    players
  });
});
