import { apiError, jsonResponse, optionsResponse } from "../_shared/errors.ts";
import { randomToken, requireSession, sha256 } from "../_shared/supabase.ts";

async function getActiveSeason(supabase: any, leagueId: string) {
  return await supabase
    .from("seasons")
    .select("id, year, name, status, current_round_id")
    .eq("league_id", leagueId)
    .in("status", ["ACTIVE", "DRAFT"])
    .order("year", { ascending: false })
    .limit(1)
    .single();
}

async function getAdminState(supabase: any, leagueId: string) {
  const { data: season, error: seasonError } = await getActiveSeason(supabase, leagueId);

  if (seasonError) return { error: apiError("SEASON_LOOKUP_FAILED", seasonError.message, 500) };

  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .select("id, display_name, deadline_at, status")
    .eq("id", season.current_round_id)
    .single();

  if (roundError) return { error: apiError("ROUND_LOOKUP_FAILED", roundError.message, 500) };

  const { data: participants, error: participantsError } = await supabase
    .from("season_players")
    .select("id, strike_count, status, joined_at, player:players(id, display_name, is_admin, active)")
    .eq("season_id", season.id)
    .order("joined_at", { ascending: true });

  if (participantsError) return { error: apiError("PARTICIPANTS_LOOKUP_FAILED", participantsError.message, 500) };

  const visibleParticipants = (participants ?? []).filter((participant: any) => {
    const player = Array.isArray(participant.player) ? participant.player[0] : participant.player;
    return player?.active !== false;
  });
  const activeParticipants = visibleParticipants.filter((participant: any) => participant.status === "ACTIVE");
  const activeParticipantIds = activeParticipants.map((participant: any) => participant.id);

  const { count: submittedPickCount, error: picksError } = activeParticipantIds.length
    ? await supabase
        .from("picks")
        .select("id", { count: "exact", head: true })
        .eq("round_id", round.id)
        .in("season_player_id", activeParticipantIds)
    : { count: 0, error: null };

  if (picksError) return { error: apiError("PICKS_COUNT_FAILED", picksError.message, 500) };

  const { count: lockedPickCount, error: lockedPicksError } = activeParticipantIds.length
    ? await supabase
        .from("picks")
        .select("id", { count: "exact", head: true })
        .eq("round_id", round.id)
        .in("season_player_id", activeParticipantIds)
        .not("locked_at", "is", null)
    : { count: 0, error: null };

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
        activePlayers: activeParticipants.length,
        submittedPicks: submittedPickCount ?? 0,
        lockedPicks: lockedPickCount ?? 0
      },
      participants: visibleParticipants.map((participant: any) => {
        const player = Array.isArray(participant.player) ? participant.player[0] : participant.player;
        return {
          id: participant.id,
          playerId: player?.id,
          displayName: player?.display_name ?? "Unknown",
          isAdmin: Boolean(player?.is_admin),
          active: Boolean(player?.active),
          strikeCount: participant.strike_count,
          status: participant.status,
          joinedAt: participant.joined_at
        };
      })
    }
  };
}

function cleanName(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

async function addParticipant(supabase: any, leagueId: string, payload: Record<string, unknown>) {
  const displayName = cleanName(payload.displayName);
  const pin = String(payload.pin ?? "").trim();

  if (!displayName) return { error: apiError("MISSING_DISPLAY_NAME", "Enter a participant name.", 400) };
  if (displayName.length > 40) return { error: apiError("DISPLAY_NAME_TOO_LONG", "Participant names must be 40 characters or less.", 400) };
  if (!/^\d{4,8}$/.test(pin)) return { error: apiError("INVALID_PIN", "PIN must be 4 to 8 digits.", 400) };

  const { data: existingPlayer, error: existingError } = await supabase
    .from("players")
    .select("id")
    .eq("league_id", leagueId)
    .eq("active", true)
    .ilike("display_name", displayName)
    .maybeSingle();

  if (existingError) return { error: apiError("PLAYER_LOOKUP_FAILED", existingError.message, 500) };
  if (existingPlayer) return { error: apiError("PLAYER_ALREADY_EXISTS", "A participant with that name already exists.", 409) };

  const { data: season, error: seasonError } = await getActiveSeason(supabase, leagueId);
  if (seasonError) return { error: apiError("SEASON_LOOKUP_FAILED", seasonError.message, 500) };

  const salt = randomToken();
  const pinHash = `sha256:${salt}:${await sha256(`${salt}:${pin}`)}`;

  const { data: player, error: insertPlayerError } = await supabase
    .from("players")
    .insert({ league_id: leagueId, display_name: displayName, pin_hash: pinHash, is_admin: false, active: true })
    .select("id")
    .single();

  if (insertPlayerError) return { error: apiError("PLAYER_CREATE_FAILED", insertPlayerError.message, 500) };

  const { error: seasonPlayerError } = await supabase.from("season_players").insert({
    season_id: season.id,
    player_id: player.id,
    strike_count: 0,
    status: "ACTIVE"
  });

  if (seasonPlayerError) return { error: apiError("PARTICIPANT_CREATE_FAILED", seasonPlayerError.message, 500) };

  return await getAdminState(supabase, leagueId);
}

async function removeParticipant(supabase: any, leagueId: string, adminPlayerId: string, payload: Record<string, unknown>) {
  const participantId = String(payload.participantId ?? "").trim();

  if (!participantId) return { error: apiError("MISSING_PARTICIPANT", "Choose a participant to remove.", 400) };

  const { data: participant, error: participantError } = await supabase
    .from("season_players")
    .select("id, player_id, player:players(id, league_id, display_name, is_admin, active)")
    .eq("id", participantId)
    .maybeSingle();

  if (participantError) return { error: apiError("PARTICIPANT_LOOKUP_FAILED", participantError.message, 500) };
  if (!participant) return { error: apiError("PARTICIPANT_NOT_FOUND", "Participant was not found.", 404) };

  const participantPlayer = Array.isArray(participant.player) ? participant.player[0] : participant.player;
  if (!participantPlayer || participantPlayer.league_id !== leagueId) {
    return { error: apiError("PARTICIPANT_NOT_FOUND", "Participant was not found.", 404) };
  }

  if (participantPlayer.id === adminPlayerId) {
    return { error: apiError("CANNOT_REMOVE_SELF", "You cannot remove your own admin account.", 400) };
  }

  if (participantPlayer.is_admin) {
    return { error: apiError("CANNOT_REMOVE_ADMIN", "Admin accounts cannot be removed here.", 400) };
  }

  const now = new Date().toISOString();
  const { error: playerUpdateError } = await supabase
    .from("players")
    .update({ active: false, updated_at: now })
    .eq("id", participantPlayer.id);

  if (playerUpdateError) return { error: apiError("PLAYER_REMOVE_FAILED", playerUpdateError.message, 500) };

  const { error: seasonPlayerUpdateError } = await supabase
    .from("season_players")
    .update({ status: "ELIMINATED", updated_at: now })
    .eq("id", participant.id);

  if (seasonPlayerUpdateError) return { error: apiError("PARTICIPANT_REMOVE_FAILED", seasonPlayerUpdateError.message, 500) };

  await supabase.from("player_sessions").update({ revoked_at: now }).eq("player_id", participantPlayer.id).is("revoked_at", null);

  return await getAdminState(supabase, leagueId);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "POST") return apiError("METHOD_NOT_ALLOWED", "Use POST.", 405);

  const session = await requireSession(request);
  if ("error" in session) return session.error;

  const { supabase, player } = session;
  if (!player.is_admin) return apiError("ADMIN_REQUIRED", "Commissioner access is required.", 403);

  const body = await request.json().catch(() => ({}));
  const command = String(body.command ?? "get-state");
  const payload = (body.payload && typeof body.payload === "object" ? body.payload : {}) as Record<string, unknown>;

  const result = command === "add-participant"
    ? await addParticipant(supabase, player.league_id, payload)
    : command === "remove-participant"
      ? await removeParticipant(supabase, player.league_id, player.id, payload)
      : await getAdminState(supabase, player.league_id);

  if ("error" in result) return result.error;
  return jsonResponse(result.state);
});
