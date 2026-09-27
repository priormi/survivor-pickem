import type { Team } from "../types";

export function TeamCard({
  team,
  disabled,
  selected,
  onSelect
}: {
  team: Team;
  disabled?: boolean;
  selected?: boolean;
  onSelect?: (team: Team) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect?.(team)}
      className={`w-full rounded-lg border bg-white p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
        selected ? "border-teal-700 ring-2 ring-teal-100" : "border-slate-200 hover:border-teal-300"
      }`}
    >
      <span className="rounded bg-teal-800 px-2 py-1 text-sm font-bold text-white">{team.abbreviation}</span>
      <p className="mt-2 font-bold">
        {team.city} {team.name}
      </p>
    </button>
  );
}
