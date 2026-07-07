import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Users,
  Wallet,
  Sparkles,
  TrendingUp,
  FileText,
  Settings as SettingsIcon,
  PiggyBank,
  X,
} from 'lucide-react';

interface SidebarProps {
  onCloseMobile?: () => void;
}

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/people', label: 'People', icon: Users },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/copilot', label: 'AI Copilot', icon: Sparkles },
  { to: '/forecast', label: 'Forecast', icon: TrendingUp },
  { to: '/audit', label: 'Audit', icon: FileText },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export default function Sidebar({ onCloseMobile }: SidebarProps) {
  return (
    <aside className="flex flex-col h-full bg-[#090e1b]/95 border-r border-slate-800/80 p-5 w-64 text-slate-300">
      {/* Sidebar Header / Branding */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-inner">
            <PiggyBank size={22} className="animate-pulse" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm text-slate-100 tracking-tight">PFMS</h1>
            <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-widest font-mono">Personal Finance</p>
          </div>
        </div>

        {/* Mobile close button */}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation list */}
      <nav className="flex-1 space-y-1.5" role="navigation">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onCloseMobile}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 hover:border hover:border-slate-800/50'
              }`
            }
          >
            <Icon size={18} className="shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Sidebar Footer */}
      <div className="border-t border-slate-800/80 pt-4 text-center">
        <p className="text-[10px] text-slate-500 font-mono">Local-first Workspace</p>
      </div>
    </aside>
  );
}
