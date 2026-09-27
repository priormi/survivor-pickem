import { useMemo, useState } from "react";
import type { SessionPlayer } from "../types";

function readPlayer() {
  const raw = localStorage.getItem("survivor-player");
  if (!raw) return null;

  try {
    return JSON.parse(raw) as SessionPlayer;
  } catch {
    localStorage.removeItem("survivor-player");
    return null;
  }
}

export function useAuth() {
  const [token, setTokenState] = useState(() => localStorage.getItem("survivor-session"));
  const [player, setPlayerState] = useState<SessionPlayer | null>(() => readPlayer());

  return useMemo(
    () => ({
      token,
      player,
      setSession(nextToken: string, nextPlayer: SessionPlayer) {
        localStorage.setItem("survivor-session", nextToken);
        localStorage.setItem("survivor-player", JSON.stringify(nextPlayer));
        setTokenState(nextToken);
        setPlayerState(nextPlayer);
      },
      clearSession() {
        localStorage.removeItem("survivor-session");
        localStorage.removeItem("survivor-player");
        setTokenState(null);
        setPlayerState(null);
      }
    }),
    [player, token]
  );
}
