import { NavLink } from "react-router-dom";

const links = [
  ["/", "Home"],
  ["/pick", "Pick"],
  ["/standings", "Standings"],
  ["/history", "History"],
  ["/admin", "Admin"]
];

export function Navigation() {
  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
        {links.map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `border-b-2 px-4 py-3 text-sm font-semibold ${isActive ? "border-blue-700 text-blue-700" : "border-transparent text-slate-600"}`
            }
          >
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
