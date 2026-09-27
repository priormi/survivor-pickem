import { apiError, jsonResponse, optionsResponse } from "../_shared/errors.ts";
import { requireSession } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "POST") return apiError("METHOD_NOT_ALLOWED", "Use POST.", 405);

  const session = await requireSession(request);
  if ("error" in session) return session.error;

  const { roundId, teamId } = await request.json().catch(() => ({}));
  if (!roundId || !teamId) return apiError("MISSING_PICK", "Choose a team before submitting.", 400);

  const { supabase, player } = session;
  const { data: season, error: seasonError } = await supabase
    .from("seasons")
    .select("id")
    .eq("league_id", player.league_id)
    .eq("status", "ACTIVE")
    .order("year", { ascending: false })
    .limit(1)
    .single();

  if (seasonError) return apiError("NO_ACTIVE_SEASON", seasonError.message, 404);

  const { data: seasonPlayer, error: seasonPlayerError } = await supabase
    .from("season_players")
    .select("id, status, season_id")
    .eq("player_id", player.id)
    .eq("season_id", season.id)
    .single();

  if (seasonPlayerError) return apiError("PLAYER_NOT_IN_SEASON", seasonPlayerError.message, 404);
  if (seasonPlayer.status !== "ACTIVE") return apiError("PLAYER_ELIMINATED", "Eliminated players cannot submit picks.", 403);

  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .select("id, deadline_at, status, season_id")
    .eq("id", roundId)
    .single();

  if (roundError) return apiError("ROUND_LOOKUP_FAILED", roundError.message, 500);
  if (round.season_id !== seasonPlayer.season_id) return apiError("ROUND_MISMATCH", "Round is not part of this season.", 400);
  if (round.status !== "OPEN" || new Date(round.deadline_at).getTime() <= Date.now()) {
    return apiError("ROUND_LOCKED", "The pick deadline has passed.", 403);
  }

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id, abbreviation, city, name")
    .eq("id", teamId)
    .eq("active", true)
    .single();

  if (teamError) return apiError("TEAM_NOT_FOUND", "That team is not available.", 404);

  const { data: usedPick, error: usedError } = await supabase
    .from("picks")
    .select("id")
    .eq("season_player_id", seasonPlayer.id)
    .eq("team_id", teamId)
    .neq("round_id", roundId)
    .neq("pick_result", "VOID")
    .maybeSingle();

  if (usedError) return apiError("USED_TEAM_CHECK_FAILED", usedError.message, 500);
  if (usedPick) return apiError("TEAM_ALREADY_USED", "You already used that team this season.", 409);

  const { data: existingPick } = await supabase
    .from("picks")
    .select("id, team_id")
    .eq("season_player_id", seasonPlayer.id)
    .eq("round_id", roundId)
    .maybeSingle();

  const submittedAt = new Date().toISOString();
  const { data: savedPick, error: saveError } = await supabase
    .from("picks")
    .upsert(
      {
        season_player_id: seasonPlayer.id,
        round_id: roundId,
        team_id: teamId,
        submitted_at: submittedAt,
        updated_at: submittedAt
      },
      { onConflict: "season_player_id,round_id" }
    )
    .select("id")
    .single();

  if (saveError) return apiError("PICK_SAVE_FAILED", saveError.message, 500);

  await supabase.from("pick_revisions").insert({
    pick_id: savedPick.id,
    previous_team_id: existingPick?.team_id ?? null,
    new_team_id: teamId,
    changed_by_player_id: player.id,
    change_type: existingPick ? "PLAYER_CHANGE" : "PLAYER_SUBMIT"
  });

  return jsonResponse({
    pick: {
      team,
      submittedAt
    }
  });
});
