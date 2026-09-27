export function AdminPage() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-2xl font-bold">Commissioner</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {["League", "Season", "Players", "Picks", "Survivor Results", "NFL Sync"].map((label) => (
          <div key={label} className="rounded-lg border border-slate-200 p-4 font-bold">
            {label}
          </div>
        ))}
      </div>
    </section>
  );
}
