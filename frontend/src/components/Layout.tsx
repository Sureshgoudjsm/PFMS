import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, ArrowLeftRight, Wallet, Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/people', label: 'People', icon: Users },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-700 dark:bg-surface/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
              PF
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">PFMS</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Personal Finance</p>
            </div>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-accent/10 text-accent dark:bg-accent/20 dark:text-accent-light'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-surface-hover'
                  }`
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </nav>

          <button
            onClick={toggleTheme}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-surface-hover"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        <nav className="flex gap-1 overflow-x-auto border-t border-slate-200 px-4 py-2 md:hidden dark:border-slate-700">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                  isActive
                    ? 'bg-accent/10 text-accent'
                    : 'text-slate-600 dark:text-slate-400'
                }`
              }
            >
              <Icon size={14} />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
