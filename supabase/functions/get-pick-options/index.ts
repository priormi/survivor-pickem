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
    return jsonResponse({ round, teams: [], currentPick: null, locked, disabledReason: "PLAYER_ELIMINATED" });
  }
  if (locked) {
    return jsonResponse({ round, teams: [], currentPick: null, locked, disabledReason: "ROUND_LOCKED" });
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

  const currentTeam = Array.isArray(currentPick?.team) ? currentPick?.team[0] : currentPick?.team;

  return jsonResponse({
    round: {
      id: round.id,
      displayName: round.display_name,
      deadlineAt: round.deadline_at,
      status: round.status
    },
    teams: (teams ?? []).filter((team) => !usedTeamIds.has(team.id)),
    currentPick: currentTeam ?? null,
    locked
  });
});
