import type { PickOptionsResponse, Team } from "../types";
import { callFunction } from "./api";

export function getPickOptions(token: string) {
  return callFunction<PickOptionsResponse>("get-pick-options", {}, token);
}

export function submitPick(token: string, roundId: string, teamId: string) {
  return callFunction<{ pick: { team: Team; submittedAt: string; locked: boolean } }>("submit-pick", { roundId, teamId }, token);
}
