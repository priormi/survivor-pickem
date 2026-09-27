import { PropsWithChildren } from "react";
import { Navigation } from "./Navigation";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-slate-800 px-4 py-4 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-300">NFL Survivor</p>
            <h1 className="text-lg font-bold">Prior Family Survivor</h1>
          </div>
          <p className="text-sm text-slate-300">America/Chicago</p>
        </div>
      </header>
      <Navigation />
      <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>
    </div>
  );
}
