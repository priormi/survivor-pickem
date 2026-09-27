import { apiError, jsonResponse, optionsResponse } from "../_shared/errors.ts";
import { requireSession } from "../_shared/supabase.ts";

async function getAdminState(supabase: any, leagueId: string) {
  const { data: season, error: seasonError } = await supabase
    .from("seasons")
    .select("id, year, name, status, current_round_id")
    .eq("league_id", leagueId)
    .in("status", ["ACTIVE", "DRAFT"])
    .order("year", { ascending: false })
    .limit(1)
    .single();

  if (seasonError) return { error: apiError("SEASON_LOOKUP_FAILED", seasonError.message, 500) };

  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .select("id, display_name, deadline_at, status")
    .eq("id", season.current_round_id)
    .single();

  if (roundError) return { error: apiError("ROUND_LOOKUP_FAILED", roundError.message, 500) };

  const { count: activePlayerCount, error: playersError } = await supabase
    .from("season_players")
    .select("id", { count: "exact", head: true })
    .eq("season_id", season.id)
    .eq("status", "ACTIVE");

  if (playersError) return { error: apiError("PLAYERS_COUNT_FAILED", playersError.message, 500) };

  const { count: submittedPickCount, error: picksError } = await supabase
    .from("picks")
    .select("id", { count: "exact", head: true })
    .eq("round_id", round.id);

  if (picksError) return { error: apiError("PICKS_COUNT_FAILED", picksError.message, 500) };

  const { count: lockedPickCount, error: lockedPicksError } = await supabase
    .from("picks")
    .select("id", { count: "exact", head: true })
    .eq("round_id", round.id)
    .not("locked_at", "is", null);

  if (lockedPicksError) return { error: apiError("LOCKED_PICKS_COUNT_FAILED", lockedPicksError.message, 500) };

  return {
    state: {
      season: {
        id: season.id,
        year: season.year,
        name: season.name,
        status: season.status
      },
      round: {
        id: round.id,
        displayName: round.display_name,
        deadlineAt: round.deadline_at,
        status: round.status
      },
      counts: {
        activePlayers: activePlayerCount ?? 0,
        submittedPicks: submittedPickCount ?? 0,
        lockedPicks: lockedPickCount ?? 0
      }
    }
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "POST") return apiError("METHOD_NOT_ALLOWED", "Use POST.", 405);

  const session = await requireSession(request);
  if ("error" in session) return session.error;

  const { supabase, player } = session;
  if (!player.is_admin) return apiError("ADMIN_REQUIRED", "Commissioner access is required.", 403);

  const result = await getAdminState(supabase, player.league_id);
  if ("error" in result) return result.error;
  return jsonResponse(result.state);
});
