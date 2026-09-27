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

  const locked = new Date(round.deadline_at).getTime() <= Date.now() || round.status !== "OPEN";
  if (seasonPlayer.status !== "ACTIVE") {
    return jsonResponse({ round, teams: [], matchups: [], currentPick: null, locked, disabledReason: "PLAYER_ELIMINATED" });
  }
  if (locked) {
    return jsonResponse({ round, teams: [], matchups: [], currentPick: null, locked, disabledReason: "ROUND_LOCKED" });
  }

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
  const availableTeams = (teams ?? []).filter((team) => !usedTeamIds.has(team.id));
  const availabilityByTeamId = new Map((teams ?? []).map((team) => [team.id, !usedTeamIds.has(team.id)]));
  const teamsWithAvailability = (teams ?? []).map((team) => ({
    ...team,
    used: availabilityByTeamId.get(team.id) === false,
    available: availabilityByTeamId.get(team.id) === true
  }));
  const matchups = (games?.length
    ? games.map((game) => {
        const homeTeam = Array.isArray(game.home_team) ? game.home_team[0] : game.home_team;
        const awayTeam = Array.isArray(game.away_team) ? game.away_team[0] : game.away_team;

        return {
          id: game.id,
          kickoffAt: game.kickoff_at,
          status: game.status,
          homeTeam: {
            ...homeTeam,
            used: availabilityByTeamId.get(homeTeam?.id) === false,
            available: availabilityByTeamId.get(homeTeam?.id) === true
          },
          awayTeam: {
            ...awayTeam,
            used: availabilityByTeamId.get(awayTeam?.id) === false,
            available: availabilityByTeamId.get(awayTeam?.id) === true
          }
        };
      })
    : Array.from({ length: Math.floor(teamsWithAvailability.length / 2) }, (_, index) => {
        const awayTeam = teamsWithAvailability[index * 2];
        const homeTeam = teamsWithAvailability[index * 2 + 1];

        return {
          id: `demo-${awayTeam.id}-${homeTeam.id}`,
          kickoffAt: round.deadline_at,
          status: "SCHEDULED",
          awayTeam,
          homeTeam
        };
      }));
  const matchupTeamIds = new Set(matchups.flatMap((matchup) => [matchup.homeTeam.id, matchup.awayTeam.id]));

  return jsonResponse({
    round: {
      id: round.id,
      displayName: round.display_name,
      deadlineAt: round.deadline_at,
      status: round.status
    },
    teams: availableTeams.filter((team) => !matchupTeamIds.has(team.id)),
    matchups,
    currentPick: currentTeam ?? null,
    locked
  });
});
