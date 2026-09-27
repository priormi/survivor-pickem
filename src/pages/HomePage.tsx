import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Countdown } from "../components/Countdown";
import { PickStatus } from "../components/PickStatus";
import { StrikeBadge } from "../components/StrikeBadge";
import { useAuth } from "../hooks/useAuth";
import { getDashboard } from "../services/league";
import type { DashboardResponse } from "../types";

export function HomePage() {
  const auth = useAuth();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.token) return;

    getDashboard(auth.token)
      .then(setDashboard)
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load league."));
  }, [auth.token]);

  if (!auth.token) return <Navigate to="/login" replace />;

  if (error) {
    return <section className="rounded-lg border border-red-200 bg-red-50 p-5 font-semibold text-red-800">{error}</section>;
  }

  if (!dashboard) {
    return <section className="rounded-lg border border-slate-200 bg-white p-5">Loading league...</section>;
  }

  const me = dashboard.players.find((player) => player.playerId === dashboard.player.id);
  const myPickLabel = me?.pickTeam ? `${me.pickTeam.city} ${me.pickTeam.name}` : undefined;
  const picksRemaining = Math.max(
    0,
    dashboard.currentRound.expectedPickCount - dashboard.currentRound.submittedPickCount
  );
  const revealMessage = dashboard.currentRound.allPicksSubmitted
    ? "All picks are in. Everyone's team is visible."
    : `${picksRemaining} ${picksRemaining === 1 ? "pick" : "picks"} still out. Teams stay hidden until everyone is in.`;

  return (
    <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{dashboard.season.name}</p>
        <h2 className="text-2xl font-bold">{dashboard.currentRound.displayName}</h2>
        <div className="mt-4">
          <Countdown deadlineAt={dashboard.currentRound.deadlineAt} />
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
          <div>
            <p className="font-bold">{dashboard.player.displayName}</p>
            <PickStatus submitted={Boolean(me?.pickSubmitted)} label={myPickLabel ?? "No pick yet"} />
          </div>
          <StrikeBadge strikes={me?.strikeCount ?? 0} />
        </div>
        <Link className="mt-4 inline-flex rounded-lg bg-teal-700 px-4 py-3 font-bold text-white hover:bg-teal-800" to="/pick">
          {me?.pickSubmitted ? "Change Pick" : "Make Pick"}
        </Link>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Dashboard</h2>
            <p className="mt-1 text-sm font-semibold text-teal-700">{revealMessage}</p>
          </div>
          <span className="rounded bg-teal-50 px-3 py-1 text-sm font-bold text-teal-800">
            {dashboard.currentRound.submittedPickCount}/{dashboard.currentRound.expectedPickCount}
          </span>
        </div>
        <div className="mt-3">
        {dashboard.players.map((player) => (
          <div key={player.id} className="flex items-center justify-between gap-3 border-t border-slate-200 py-3 first:border-t-0">
            <div>
              <p className="font-bold">{player.displayName}</p>
              <p className="text-sm text-slate-600">
                {player.pickVisible && player.pickTeam
                  ? `${player.pickTeam.city} ${player.pickTeam.name}`
                  : player.pickSubmitted
                    ? "Pick submitted"
                    : "No pick yet"}
              </p>
            </div>
            <StrikeBadge strikes={player.strikeCount} />
          </div>
        ))}
        </div>
      </section>
    </div>
  );
}
