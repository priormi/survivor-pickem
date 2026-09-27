import { type FormEvent, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { addParticipant, getAdminState, type AdminState } from "../services/admin";
import { formatCentralDateTime } from "../utils/dates";

export function AdminPage() {
  const auth = useAuth();
  const [state, setState] = useState<AdminState | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.token || !auth.player?.isAdmin) return;

    setLoading(true);
    getAdminState(auth.token)
      .then(setState)
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load commissioner tools."))
      .finally(() => setLoading(false));
  }, [auth.player?.isAdmin, auth.token]);

  async function handleAddParticipant(event: FormEvent) {
    event.preventDefault();
    if (!auth.token || saving) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const nextState = await addParticipant(auth.token, displayName, pin);
      setState(nextState);
      setMessage(`${displayName.trim()} was added.`);
      setDisplayName("");
      setPin("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add participant.");
    } finally {
      setSaving(false);
    }
  }

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
      {message ? <p className="mt-4 rounded-md bg-green-50 p-3 font-semibold text-green-800">{message}</p> : null}

      {!state && loading ? (
        <p className="mt-4 rounded-md bg-slate-50 p-3 font-semibold text-slate-600">Loading commissioner dashboard...</p>
      ) : state ? (
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

          <form className="rounded-lg border border-slate-200 p-4" onSubmit={handleAddParticipant}>
            <h3 className="font-bold">Add Participant</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_10rem_auto]">
              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                Name
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2 font-normal text-slate-900"
                  maxLength={40}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Participant name"
                  value={displayName}
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                PIN
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2 font-normal text-slate-900"
                  inputMode="numeric"
                  maxLength={8}
                  minLength={4}
                  onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
                  placeholder="4-8 digits"
                  type="password"
                  value={pin}
                />
              </label>
              <button
                className="self-end rounded-lg bg-teal-700 px-4 py-2 font-bold text-white hover:bg-teal-800 disabled:opacity-60"
                disabled={saving || !displayName.trim() || pin.length < 4}
                type="submit"
              >
                {saving ? "Adding..." : "Add"}
              </button>
            </div>
          </form>

          <div className="rounded-lg border border-slate-200 p-4">
            <h3 className="font-bold">Participants</h3>
            <div className="mt-3 divide-y divide-slate-100">
              {state.participants.map((participant) => (
                <div className="flex flex-wrap items-center justify-between gap-2 py-3" key={participant.id}>
                  <div>
                    <p className="font-bold">{participant.displayName}</p>
                    <p className="text-sm font-semibold text-slate-500">
                      {participant.status} - {participant.strikeCount} of 2 strikes{participant.isAdmin ? " - Admin" : ""}
                    </p>
                  </div>
                  <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold uppercase text-slate-600">
                    {participant.active ? "Active" : "Inactive"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
