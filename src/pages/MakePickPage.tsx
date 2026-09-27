import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { TeamCard } from "../components/TeamCard";
import { TeamLogo } from "../components/TeamLogo";
import { useAuth } from "../hooks/useAuth";
import { getPickOptions, submitPick } from "../services/picks";
import type { MatchupTeam, PickMatchup, PickOptionsResponse, Team } from "../types";

function formatKickoff(kickoffAt: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
    timeZoneName: "short"
  }).format(new Date(kickoffAt));
}

function MatchupPickButton({
  team,
  align,
  disabled,
  selected,
  onSelect
}: {
  team: MatchupTeam;
  align: "home" | "away";
  disabled?: boolean;
  selected?: boolean;
  onSelect: (team: Team) => void;
}) {
  const teamName = `${team.city} ${team.name}`;
  const unavailable = disabled || !team.available;
  const statusLabel = selected ? "Selected" : disabled ? "Locked" : team.used ? "Used previously" : !team.available ? "Started" : "Available";
  const statusClass = selected
    ? "bg-teal-100 text-teal-800"
    : disabled
      ? "bg-slate-200 text-slate-600"
      : team.used
        ? "bg-amber-100 text-amber-800"
        : !team.available
          ? "bg-slate-200 text-slate-600"
          : "bg-green-100 text-green-800";
  const cardClass = selected
    ? "border-teal-700 bg-teal-50 ring-2 ring-teal-100"
    : unavailable
      ? "border-slate-200 bg-slate-100 text-slate-500"
      : "border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50";

  return (
    <button
      type="button"
      disabled={unavailable}
      onClick={() => onSelect(team)}
      className={`flex min-w-0 flex-1 items-center gap-3 rounded-lg border p-3 text-left transition disabled:cursor-not-allowed ${cardClass} ${
        align === "home" ? "md:flex-row-reverse md:text-right" : ""
      }`}
    >
      <TeamLogo abbreviation={team.abbreviation} name={teamName} />
      <div className="min-w-0">
        <p className="font-bold leading-tight">{teamName}</p>
        <div className={`mt-1 inline-flex rounded px-2 py-0.5 text-xs font-bold ${statusClass}`}>{statusLabel}</div>
        <p className="mt-1 text-sm font-semibold text-slate-500">{align === "home" ? "Home" : "Away"}</p>
      </div>
    </button>
  );
}

function MatchupCard({
  matchup,
  locked,
  saving,
  selectedTeamId,
  onSelect
}: {
  matchup: PickMatchup;
  locked: boolean;
  saving: boolean;
  selectedTeamId?: string;
  onSelect: (team: Team) => void;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-slate-700">{formatKickoff(matchup.kickoffAt)}</p>
        <span className="rounded bg-white px-2 py-1 text-xs font-bold uppercase text-slate-500">{matchup.status}</span>
      </div>
      <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
        <MatchupPickButton
          team={matchup.awayTeam}
          align="away"
          disabled={locked || saving}
          selected={selectedTeamId === matchup.awayTeam.id}
          onSelect={onSelect}
        />
        <span className="self-center px-2 text-sm font-black text-slate-400">AT</span>
        <MatchupPickButton
          team={matchup.homeTeam}
          align="home"
          disabled={locked || saving}
          selected={selectedTeamId === matchup.homeTeam.id}
          onSelect={onSelect}
        />
      </div>
    </article>
  );
}

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
      setMessage(
        result.pick.locked
          ? `Saved and locked: ${result.pick.team.city} ${result.pick.team.name}`
          : `Saved: ${result.pick.team.city} ${result.pick.team.name}`
      );
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

      {options.matchups.length ? (
        <div className="mt-4 grid gap-3">
          {options.matchups.map((matchup) => (
            <MatchupCard
              key={matchup.id}
              matchup={matchup}
              locked={options.locked}
              saving={saving}
              selectedTeamId={selectedTeam?.id}
              onSelect={setSelectedTeam}
            />
          ))}
        </div>
      ) : !options.locked ? (
        <p className="mt-4 rounded-md bg-amber-50 p-3 font-semibold text-amber-800">
          Weekly matchups have not been synced yet. Showing available teams only.
        </p>
      ) : null}

      {options.teams.length ? (
        <div className="mt-5">
          <h3 className="text-sm font-bold uppercase text-slate-500">Other available teams</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
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
        </div>
      ) : null}

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
