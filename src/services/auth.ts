import type { SessionPlayer } from "../types";
import { callFunction } from "./api";

export interface LoginResponse {
  token: string;
  player: SessionPlayer;
}

export function loginPlayer(displayName: string, pin: string) {
  return callFunction<LoginResponse>("player-login", {
    leagueSlug: "prior-family",
    displayName,
    pin
  });
}
