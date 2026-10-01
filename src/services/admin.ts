import { callFunction } from "./api";

export interface AdminParticipant {
  id: string;
  playerId: string;
  displayName: string;
  isAdmin: boolean;
  active: boolean;
  strikeCount: number;
  status: string;
  joinedAt: string;
}

export interface AdminState {
  season: { id: string; year: number; name: string; status: string };
  round: { id: string; displayName: string; deadlineAt: string; status: string };
  counts: { activePlayers: number; submittedPicks: number; lockedPicks: number };
  participants: AdminParticipant[];
}

export function getAdminState(token: string) {
  return callFunction<AdminState>("admin", { command: "get-state", payload: {} }, token);
}

export function addParticipant(token: string, displayName: string, pin: string) {
  return callFunction<AdminState>("admin", { command: "add-participant", payload: { displayName, pin } }, token);
}

export function removeParticipant(token: string, participantId: string) {
  return callFunction<AdminState>("admin", { command: "remove-participant", payload: { participantId } }, token);
}

export function resetParticipantPin(token: string, participantId: string, pin: string) {
  return callFunction<AdminState>("admin", { command: "reset-pin", payload: { participantId, pin } }, token);
}
