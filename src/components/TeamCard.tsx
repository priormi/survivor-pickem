import { TeamLogo } from "./TeamLogo";
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
      <div className="flex items-center gap-3">
        <TeamLogo abbreviation={team.abbreviation} name={`${team.city} ${team.name}`} />
        <div className="min-w-0">
          <p className="font-bold leading-tight">
            {team.city} {team.name}
          </p>
        </div>
      </div>
    </button>
  );
}
