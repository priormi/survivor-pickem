import { formatCentralDateTime } from "../utils/dates";

export function Countdown({ deadlineAt }: { deadlineAt: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Picks Lock</p>
      <p className="text-xl font-bold">{formatCentralDateTime(deadlineAt)}</p>
    </div>
  );
}
