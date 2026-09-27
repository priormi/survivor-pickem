import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { PlayerCard } from "../components/PlayerCard";
import { StrikeBadge } from "../components/StrikeBadge";
import { useAuth } from "../hooks/useAuth";
import { getDashboard } from "../services/league";
import type { DashboardResponse } from "../types";

export function StandingsPage() {
  const auth = useAuth();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.token) return;
    getDashboard(auth.token)
      .then(setDashboard)
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load standings."));
  }, [auth.token]);

  if (!auth.token) return <Navigate to="/login" replace />;
  if (error) return <section className="rounded-lg border border-red-200 bg-red-50 p-5 font-semibold text-red-800">{error}</section>;
  if (!dashboard) return <section className="rounded-lg border border-slate-200 bg-white p-5">Loading standings...</section>;

  return (
    <section className="grid gap-3">
      {dashboard.players.map((player) => (
        <PlayerCard key={player.id} name={player.displayName}>
          <div className="flex items-center justify-between gap-3">
            <span>{player.status}</span>
            <StrikeBadge strikes={player.strikeCount} />
          </div>
        </PlayerCard>
      ))}
    </section>
  );
}
