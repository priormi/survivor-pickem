import { apiError, jsonResponse, optionsResponse } from "../_shared/errors.ts";
import { requireSession } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "POST") return apiError("METHOD_NOT_ALLOWED", "Use POST.", 405);

  const session = await requireSession(request);
  if ("error" in session) return session.error;

  const { supabase, player } = session;
  const { data: season, error: seasonError } = await supabase
    .from("seasons")
    .select("id, current_round_id")
    .eq("league_id", player.league_id)
    .eq("status", "ACTIVE")
    .order("year", { ascending: false })
    .limit(1)
    .single();

  if (seasonError) return apiError("NO_ACTIVE_SEASON", seasonError.message, 404);

  const { data: seasonPlayer, error: seasonPlayerError } = await supabase
    .from("season_players")
    .select("id, status")
    .eq("season_id", season.id)
    .eq("player_id", player.id)
    .single();

  if (seasonPlayerError) return apiError("PLAYER_NOT_IN_SEASON", seasonPlayerError.message, 404);

  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .select("id, display_name, deadline_at, status")
    .eq("id", season.current_round_id)
    .single();

  if (roundError) return apiError("ROUND_LOOKUP_FAILED", roundError.message, 500);

  const roundClosed = round.status === "FINAL" || round.status === "PROCESSING";
  if (seasonPlayer.status !== "ACTIVE") {
    return jsonResponse({ round, teams: [], matchups: [], currentPick: null, locked: roundClosed, disabledReason: "PLAYER_ELIMINATED" });
  }

  const { data: activeSeasonPlayers, error: activePlayersError } = await supabase
    .from("season_players")
    .select("id")
    .eq("season_id", season.id)
    .eq("status", "ACTIVE");

  if (activePlayersError) return apiError("ACTIVE_PLAYERS_LOOKUP_FAILED", activePlayersError.message, 500);

  const activeSeasonPlayerIds = (activeSeasonPlayers ?? []).map((activePlayer) => activePlayer.id);
  const { data: activeRoundPicks, error: activeRoundPicksError } = activeSeasonPlayerIds.length
    ? await supabase
        .from("picks")
        .select("season_player_id")
        .eq("round_id", round.id)
        .in("season_player_id", activeSeasonPlayerIds)
    : { data: [], error: null };

  if (activeRoundPicksError) return apiError("ROUND_PICK_LOCK_CHECK_FAILED", activeRoundPicksError.message, 500);

  const pickedSeasonPlayerIds = new Set((activeRoundPicks ?? []).map((pick) => pick.season_player_id));
  const allActivePlayersPicked =
    activeSeasonPlayerIds.length > 0 && activeSeasonPlayerIds.every((activePlayerId) => pickedSeasonPlayerIds.has(activePlayerId));
  const locked = roundClosed || allActivePlayersPicked;

  const { data: usedPicks, error: usedError } = await supabase
    .from("picks")
    .select("team_id")
    .eq("season_player_id", seasonPlayer.id)
    .neq("round_id", round.id)
    .neq("pick_result", "VOID");

  if (usedError) return apiError("USED_TEAMS_LOOKUP_FAILED", usedError.message, 500);

  const usedTeamIds = new Set((usedPicks ?? []).map((pick) => pick.team_id));
  const { data: currentPick, error: currentPickError } = await supabase
    .from("picks")
    .select("team:teams(id, abbreviation, city, name)")
    .eq("season_player_id", seasonPlayer.id)
    .eq("round_id", round.id)
    .maybeSingle();

  if (currentPickError) return apiError("CURRENT_PICK_LOOKUP_FAILED", currentPickError.message, 500);

  if (locked) {
    const currentTeam = Array.isArray(currentPick?.team) ? currentPick?.team[0] : currentPick?.team;
    return jsonResponse({
      round: {
        id: round.id,
        displayName: round.display_name,
        deadlineAt: round.deadline_at,
        status: round.status
      },
      teams: [],
      matchups: [],
      currentPick: currentTeam ?? null,
      locked,
      disabledReason: allActivePlayersPicked ? "ALL_PICKS_LOCKED" : "ROUND_CLOSED"
    });
  }

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, abbreviation, city, name, conference, division")
    .eq("active", true)
    .order("city", { ascending: true });

  if (teamsError) return apiError("TEAMS_LOOKUP_FAILED", teamsError.message, 500);

  const { data: games, error: gamesError } = await supabase
    .from("games")
    .select("id, kickoff_at, status, home_team:teams!games_home_team_id_fkey(id, abbreviation, city, name, conference, division), away_team:teams!games_away_team_id_fkey(id, abbreviation, city, name, conference, division)")
    .eq("round_id", round.id)
    .order("kickoff_at", { ascending: true });

  if (gamesError) return apiError("GAMES_LOOKUP_FAILED", gamesError.message, 500);

  const currentTeam = Array.isArray(currentPick?.team) ? currentPick?.team[0] : currentPick?.team;
  const now = Date.now();
  const gameStartedTeamIds = new Set<string>();
  for (const game of games ?? []) {
    if (new Date(game.kickoff_at).getTime() <= now) {
      const homeTeam = Array.isArray(game.home_team) ? game.home_team[0] : game.home_team;
      const awayTeam = Array.isArray(game.away_team) ? game.away_team[0] : game.away_team;
      if (homeTeam?.id) gameStartedTeamIds.add(homeTeam.id);
      if (awayTeam?.id) gameStartedTeamIds.add(awayTeam.id);
    }
  }
  const availableTeams = (teams ?? []).filter((team) => !usedTeamIds.has(team.id) && !gameStartedTeamIds.has(team.id));
  const matchups = (games ?? []).map((game) => {
    const homeTeam = Array.isArray(game.home_team) ? game.home_team[0] : game.home_team;
    const awayTeam = Array.isArray(game.away_team) ? game.away_team[0] : game.away_team;
    const homeTeamUsed = usedTeamIds.has(homeTeam?.id);
    const awayTeamUsed = usedTeamIds.has(awayTeam?.id);
    const homeTeamStarted = gameStartedTeamIds.has(homeTeam?.id);
    const awayTeamStarted = gameStartedTeamIds.has(awayTeam?.id);

    return {
      id: game.id,
      kickoffAt: game.kickoff_at,
      status: game.status,
      homeTeam: {
        ...homeTeam,
        used: homeTeamUsed,
        started: homeTeamStarted,
        available: !homeTeamUsed && !homeTeamStarted
      },
      awayTeam: {
        ...awayTeam,
        used: awayTeamUsed,
        started: awayTeamStarted,
        available: !awayTeamUsed && !awayTeamStarted
      }
    };
  });
  const matchupTeamIds = new Set(matchups.flatMap((matchup) => [matchup.homeTeam.id, matchup.awayTeam.id]));

  return jsonResponse({
    round: {
      id: round.id,
      displayName: round.display_name,
      deadlineAt: round.deadline_at,
      status: round.status
    },
    teams: matchups.length ? availableTeams.filter((team) => !matchupTeamIds.has(team.id)) : [],
    matchups,
    currentPick: currentTeam ?? null,
    locked
  });
});
