import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getAdminState, type AdminState } from "../services/admin";
import { formatCentralDateTime } from "../utils/dates";

export function AdminPage() {
  const auth = useAuth();
  const [state, setState] = useState<AdminState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.token || !auth.player?.isAdmin) return;

    getAdminState(auth.token)
      .then(setState)
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load commissioner tools."));
  }, [auth.player?.isAdmin, auth.token]);

  if (!auth.token) return <Navigate to="/login" replace />;

  if (!auth.player?.isAdmin) {
    return <section className="rounded-lg border border-red-200 bg-red-50 p-5 font-semibold text-red-800">Commissioner access is required.</section>;
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Commissioner</p>
          <h2 className="text-2xl font-bold">Admin</h2>
        </div>
        {state ? (
          <span className="rounded bg-teal-50 px-3 py-1 text-sm font-bold text-teal-800">{state.round.status}</span>
        ) : null}
      </div>

      {error ? <p className="mt-4 rounded-md bg-red-50 p-3 font-semibold text-red-800">{error}</p> : null}

      {!state ? (
        <p className="mt-4 rounded-md bg-slate-50 p-3 font-semibold text-slate-600">Loading commissioner dashboard...</p>
      ) : (
        <div className="mt-5 grid gap-4">
          <div className="rounded-lg border border-slate-200 p-4">
            <h3 className="font-bold">Current Round</h3>
            <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
              <p><span className="font-semibold">Season:</span> {state.season.name}</p>
              <p><span className="font-semibold">Round:</span> {state.round.displayName}</p>
              <p><span className="font-semibold">Lock:</span> {formatCentralDateTime(state.round.deadlineAt)}</p>
              <p><span className="font-semibold">Status:</span> {state.round.status}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Active Players</p>
              <p className="mt-1 text-2xl font-bold">{state.counts.activePlayers}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Submitted Picks</p>
              <p className="mt-1 text-2xl font-bold">{state.counts.submittedPicks}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Locked Picks</p>
              <p className="mt-1 text-2xl font-bold">{state.counts.lockedPicks}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
