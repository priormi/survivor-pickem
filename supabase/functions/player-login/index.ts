import { apiError, jsonResponse, optionsResponse } from "../_shared/errors.ts";
import { randomToken, serviceClient, sha256 } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "POST") return apiError("METHOD_NOT_ALLOWED", "Use POST.", 405);

  const { leagueSlug, displayName, playerId, pin } = await request.json().catch(() => ({}));
  const loginName = String(displayName ?? playerId ?? "").trim();
  const loginPin = String(pin ?? "");

  if (!leagueSlug || !loginName || !loginPin) {
    return apiError("MISSING_LOGIN", "Choose a player and enter a PIN.", 400);
  }

  const supabase = serviceClient();
  const { data: player, error } = await supabase.rpc("verify_player_pin", {
    league_slug_input: leagueSlug,
    display_name_input: loginName,
    pin_input: loginPin
  }).maybeSingle();

  if (error) return apiError("LOGIN_FAILED", error.message, 500);
  if (!player) return apiError("INVALID_LOGIN", "Player or PIN was not recognized.", 401);

  const token = randomToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  const { error: sessionError } = await supabase.from("player_sessions").insert({
    player_id: player.id,
    token_hash: await sha256(token),
    expires_at: expiresAt
  });

  if (sessionError) return apiError("SESSION_CREATE_FAILED", sessionError.message, 500);

  return jsonResponse({
    token,
    player: {
      id: player.id,
      displayName: player.display_name,
      isAdmin: player.is_admin
    }
  });
});
