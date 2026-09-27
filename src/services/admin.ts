import { callFunction } from "./api";

export function adminCommand(token: string, command: string, payload: unknown) {
  return callFunction("admin", { command, payload }, token);
}
