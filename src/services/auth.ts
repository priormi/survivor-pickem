import type { SessionPlayer } from "../types";
import { callFunction } from "./api";

export interface LoginResponse {
  token: string;
  player: SessionPlayer;
}

export interface LoginPlayerOption {
  displayName: string;
}

export interface LoginPlayersResponse {
  players: LoginPlayerOption[];
}

export function listLoginPlayers() {
  return callFunction<LoginPlayersResponse>("player-login", {
    command: "list-players",
    leagueSlug: "prior-family"
  });
}

export function loginPlayer(displayName: string, pin: string) {
  return callFunction<LoginResponse>("player-login", {
    leagueSlug: "prior-family",
    displayName,
    pin
  });
}
