import { callFunction } from "./api";

export interface AdminState {
  season: { id: string; year: number; name: string; status: string };
  round: { id: string; displayName: string; deadlineAt: string; status: string };
  counts: { activePlayers: number; submittedPicks: number; lockedPicks: number };
}

export function getAdminState(token: string) {
  return callFunction<AdminState>("admin", { command: "get-state", payload: {} }, token);
}
