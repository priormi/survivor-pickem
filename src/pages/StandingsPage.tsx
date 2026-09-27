import { Check, Clock, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { PlayerCard } from "../components/PlayerCard";
import { StrikeBadge } from "../components/StrikeBadge";
import { TeamLogo } from "../components/TeamLogo";
import { useAuth } from "../hooks/useAuth";
import { getDashboard } from "../services/league";
import type { DashboardPickHistoryItem, DashboardResponse, PickResult } from "../types";

function resultState(result: PickResult) {
  if (["WIN", "TIE", "SURVIVED_ALL_LOST"].includes(result)) return "win";
  if (["LOSS", "NO_PICK"].includes(result)) return "loss";
  return "pending";
}

function ResultIcon({ result }: { result: PickResult }) {
  const state = resultState(result);

  if (state === "win") {
    return (
      <span className="inline-grid h-7 w-7 shrink-0 place-items-center rounded-full bg-green-100 text-green-700">
        <Check aria-label="Win" size={18} strokeWidth={3} />
      </span>
    );
  }

  if (state === "loss") {
    return (
      <span className="inline-grid h-7 w-7 shrink-0 place-items-center rounded-full bg-red-100 text-red-700">
        <X aria-label="Loss" size={18} strokeWidth={3} />
      </span>
    );
  }

  return (
    <span className="inline-grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500">
      <Clock aria-label="Pending" size={16} strokeWidth={2.5} />
    </span>
  );
}

function PickHistoryRow({ pick }: { pick: DashboardPickHistoryItem }) {
  const teamName = pick.team ? `${pick.team.city} ${pick.team.name}` : pick.visible ? "No team" : "Pick hidden";

  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 py-2 first:border-t-0">
      <div className="flex min-w-0 items-center gap-3">
        {pick.team ? <TeamLogo abbreviation={pick.team.abbreviation} name={teamName} size="sm" /> : null}
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase text-slate-500">{pick.roundName}</p>
          <p className="truncate font-semibold text-slate-800">{teamName}</p>
        </div>
      </div>
      <ResultIcon result={pick.result} />
    </div>
  );
}

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
          <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-3">
            {player.pickHistory.length ? (
              player.pickHistory.map((pick) => <PickHistoryRow key={pick.id} pick={pick} />)
            ) : (
              <p className="py-3 text-sm font-semibold text-slate-500">No picks yet</p>
            )}
          </div>
        </PlayerCard>
      ))}
    </section>
  );
}
