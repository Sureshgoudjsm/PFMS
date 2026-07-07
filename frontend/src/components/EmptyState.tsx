
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  loading?: boolean;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  loading = false,
}: EmptyStateProps) {
  return (
    <div className="card flex flex-col items-center justify-center text-center p-8 border border-slate-800 bg-slate-900/40 min-h-[250px] gap-4">
      {/* Softly glowing icon container */}
      <div className="w-16 h-16 rounded-full bg-purple-500/5 border border-purple-500/10 flex items-center justify-center text-purple-400 shadow-inner">
        <Icon size={28} />
      </div>

      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-slate-200">{title}</h3>
        <p className="text-xs text-slate-400 max-w-sm leading-relaxed">{description}</p>
      </div>

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          disabled={loading}
          className="btn-primary mt-2"
        >
          {loading ? 'Processing...' : actionLabel}
        </button>
      )}
    </div>
  );
}
