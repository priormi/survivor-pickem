import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginPlayer } from "../services/auth";
import { useAuth } from "../hooks/useAuth";

const players = ["Mike", "Heather", "Chloe", "Sophia"];

export function LoginPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [displayName, setDisplayName] = useState(players[0]);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await loginPlayer(displayName, pin);
      auth.setSession(result.token, result.player);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to log in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">NFL Survivor</p>
      <h2 className="mt-1 text-2xl font-bold">Who's playing?</h2>
      <form className="mt-4 grid gap-4" onSubmit={handleSubmit}>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Player
          <select
            className="rounded-lg border border-slate-300 bg-white px-3 py-3"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          >
            {players.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          PIN
          <input
            className="rounded-lg border border-slate-300 px-3 py-3 text-lg tracking-widest"
            inputMode="numeric"
            type="password"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
          />
        </label>
        {error ? <p className="rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
        <button className="rounded-lg bg-teal-700 px-4 py-3 font-bold text-white hover:bg-teal-800 disabled:opacity-60" disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </section>
  );
}
