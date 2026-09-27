import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { TeamCard } from "../components/TeamCard";
import { TeamLogo } from "../components/TeamLogo";
import { useAuth } from "../hooks/useAuth";
import { getPickOptions, submitPick } from "../services/picks";
import type { PickOptionsResponse, Team } from "../types";

export function MakePickPage() {
  const auth = useAuth();
  const [options, setOptions] = useState<PickOptionsResponse | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!auth.token) return;

    getPickOptions(auth.token)
      .then((result) => {
        setOptions(result);
        setSelectedTeam(result.currentPick);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load teams."));
  }, [auth.token]);

  async function handleSubmit() {
    if (!auth.token || !options || !selectedTeam) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const result = await submitPick(auth.token, options.round.id, selectedTeam.id);
      setSelectedTeam(result.pick.team);
      setMessage(`Saved: ${result.pick.team.city} ${result.pick.team.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save pick.");
    } finally {
      setSaving(false);
    }
  }

  if (!auth.token) return <Navigate to="/login" replace />;

  if (error && !options) {
    return <section className="rounded-lg border border-red-200 bg-red-50 p-5 font-semibold text-red-800">{error}</section>;
  }

  if (!options) {
    return <section className="rounded-lg border border-slate-200 bg-white p-5">Loading teams...</section>;
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Make Pick</h2>
          <p className="mt-1 text-slate-600">{options.round.displayName}</p>
        </div>
        <Link className="rounded-lg border border-slate-300 px-4 py-2 font-bold text-slate-700" to="/">
          Dashboard
        </Link>
      </div>

      {options.disabledReason ? (
        <p className="mt-4 rounded-md bg-amber-50 p-3 font-semibold text-amber-800">{options.disabledReason.replace(/_/g, " ")}</p>
      ) : null}
      {error ? <p className="mt-4 rounded-md bg-red-50 p-3 font-semibold text-red-800">{error}</p> : null}
      {message ? <p className="mt-4 rounded-md bg-green-50 p-3 font-semibold text-green-800">{message}</p> : null}
      {selectedTeam ? (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-teal-200 bg-teal-50 p-3">
          <TeamLogo abbreviation={selectedTeam.abbreviation} name={`${selectedTeam.city} ${selectedTeam.name}`} />
          <div>
            <p className="text-sm font-semibold text-teal-800">Selected team</p>
            <p className="font-bold">{selectedTeam.city} {selectedTeam.name}</p>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {options.teams.map((team) => (
          <TeamCard
            key={team.id}
            team={team}
            disabled={options.locked || saving}
            selected={selectedTeam?.id === team.id}
            onSelect={setSelectedTeam}
          />
        ))}
      </div>

      <div className="sticky bottom-0 -mx-5 mt-5 border-t border-slate-200 bg-white p-5">
        <button
          className="w-full rounded-lg bg-teal-700 px-4 py-3 font-bold text-white hover:bg-teal-800 disabled:opacity-60"
          disabled={!selectedTeam || options.locked || saving}
          onClick={handleSubmit}
        >
          {saving ? "Saving..." : selectedTeam ? `Submit ${selectedTeam.abbreviation}` : "Choose a Team"}
        </button>
      </div>
    </section>
  );
}
