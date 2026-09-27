import { PropsWithChildren, useContext, useMemo, useState } from "react";
import { AuthContext } from "../context/AuthContext";
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

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setTokenState] = useState(() => localStorage.getItem("survivor-session"));
  const [player, setPlayerState] = useState<SessionPlayer | null>(() => readPlayer());

  const value = useMemo(
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used inside AuthProvider.");
  return auth;
}
