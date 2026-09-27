import { formatCentralDateTime } from "../utils/dates";

export function Countdown({ deadlineAt }: { deadlineAt: string }) {
  return (
    <div className="inline-block rounded-md border border-slate-200 bg-white px-3 py-2">
      <p className="text-[0.65rem] font-bold uppercase text-slate-500">Picks Lock</p>
      <p className="text-sm font-bold leading-tight">{formatCentralDateTime(deadlineAt)}</p>
    </div>
  );
}
