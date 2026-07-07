import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Sparkles, Save, User as UserIcon, AlertTriangle, Database, Bot, Trash2 } from 'lucide-react';

export default function Settings() {
  const [user, setUser] = useState<any>(null);
  const [fullName, setFullName] = useState('');
  const [salaryDay, setSalaryDay] = useState<string>('');
  const [threshold, setThreshold] = useState<string>('1000');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [backupPath, setBackupPath] = useState<string | null>(null);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState(0);
  const [fetchingCode, setFetchingCode] = useState(false);
  const [resetting, setResetting] = useState(false);

  const generateLinkCode = async () => {
    setFetchingCode(true);
    try {
      const res = await api.getTelegramLinkCode();
      setLinkCode(res.code);
      setExpiresIn(res.expires_in_seconds);
    } catch (err) {
      console.error(err);
    } finally {
      setFetchingCode(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Are you sure you want to completely reset your database? This will permanently delete all your accounts, transactions, contacts, EMIs, and notifications. This action cannot be undone.")) {
      return;
    }
    setResetting(true);
    try {
      const res = await api.resetAllData();
      alert(`Database successfully reset! Deleted ${res.deleted_rows_count} records.`);
      window.location.href = "/";
    } catch (err: any) {
      alert(`Reset failed: ${err.message}`);
    } finally {
      setResetting(false);
    }
  };

  useEffect(() => {
    api.getMe()
      .then((data) => {
        setUser(data);
        setFullName(data.full_name || '');
        setSalaryDay(data.salary_day !== null && data.salary_day !== undefined ? String(data.salary_day) : '');
        setThreshold(String(data.forecast_alert_threshold ?? 1000));
      })
      .catch((err) => {
        setMessage({ type: 'error', text: err.message || 'Failed to load settings' });
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const sDay = salaryDay.trim() === '' ? null : Number(salaryDay);
    const thresh = Number(threshold);

    try {
      const updated = await api.updateMe({
        full_name: fullName,
        salary_day: sDay,
        forecast_alert_threshold: thresh,
      });
      setUser(updated);
      setFullName(updated.full_name || '');
      setSalaryDay(updated.salary_day !== null && updated.salary_day !== undefined ? String(updated.salary_day) : '');
      setThreshold(String(updated.forecast_alert_threshold ?? 1000));
      setMessage({ type: 'success', text: 'Preferences updated successfully!' });

      // Update local storage representation if it changed
      const localUser = localStorage.getItem('pfms_user');
      if (localUser) {
        const parsed = JSON.parse(localUser);
        parsed.full_name = updated.full_name;
        parsed.salary_day = updated.salary_day;
        parsed.forecast_alert_threshold = updated.forecast_alert_threshold;
        localStorage.setItem('pfms_user', JSON.stringify(parsed));
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save preferences' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-black text-slate-100 tracking-tight">Settings</h2>
        <p className="text-xs text-slate-400 font-medium font-mono uppercase tracking-wider mt-0.5">
          Manage your personal profile and cash-flow preferences
        </p>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Left Column: Profile Card */}
          <div className="card space-y-6 border border-slate-800 bg-slate-900/40">
            <div className="flex items-center gap-4 border-b border-slate-800/80 pb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-inner">
                <UserIcon size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-200">Personal Profile</h3>
                <p className="text-[11px] text-slate-400">View and update your display credentials.</p>
              </div>
            </div>

            {user && (
              <div className="flex items-center gap-4">
                <img
                  src={user.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`}
                  alt="Avatar"
                  className="h-16 w-16 rounded-full bg-slate-950 border border-slate-800 shadow-2xl"
                />
                <div className="space-y-0.5">
                  <span className="block text-sm font-extrabold text-slate-200">@{user.username}</span>
                  <span className="block text-[10px] text-slate-500 font-mono">{user.email || 'local-user@pfms.internal'}</span>
                </div>
              </div>
            )}

            <div>
              <label className="label block text-[10px] font-semibold uppercase tracking-wider text-slate-300" htmlFor="fullName">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                className="input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
              />
            </div>
          </div>

          {/* Right Column: Preferences Card */}
          <div className="card space-y-6 border border-slate-800 bg-slate-900/40">
            <div className="flex items-center gap-4 border-b border-slate-800/80 pb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-inner">
                <Sparkles size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-200">Cash Flow Forecasting</h3>
                <p className="text-[11px] text-slate-400">Tweak rules for automated monthly projections.</p>
              </div>
            </div>

            <div>
              <label className="label block text-[10px] font-semibold uppercase tracking-wider text-slate-300" htmlFor="salaryDay">
                Salary Day of Month
              </label>
              <input
                id="salaryDay"
                type="number"
                min="1"
                max="31"
                className="input"
                value={salaryDay}
                onChange={(e) => setSalaryDay(e.target.value)}
                placeholder="e.g. 15 (leave empty to skip)"
              />
              <p className="text-[10px] text-slate-500 leading-normal font-medium mt-1.5">
                Muted: Leave blank if you do not want to project automated monthly salary income.
              </p>
            </div>

            <div>
              <label className="label block text-[10px] font-semibold uppercase tracking-wider text-slate-300" htmlFor="threshold">
                Forecast Alert Threshold (₹)
              </label>
              <input
                id="threshold"
                type="number"
                min="0"
                step="any"
                className="input"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="e.g. 1000.00"
                required
              />
              <p className="text-[10px] text-slate-500 leading-normal font-medium mt-1.5">
                Muted: Highlight chart dates red when projected balance falls below this amount.
              </p>
            </div>
          </div>
        </div>

        {/* Messaging responses */}
        {message && (
          <div className={`rounded-xl p-3.5 border text-xs font-semibold leading-relaxed flex items-start gap-2 ${
            message.type === 'success'
              ? 'border-emerald-900/30 bg-emerald-950/20 text-emerald-400'
              : 'border-rose-900/30 bg-rose-950/20 text-rose-400'
          }`}>
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>{message.text}</span>
          </div>
        )}

        {/* Right-aligned Save Button */}
        <div className="flex justify-end border-t border-slate-800/80 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            {saving ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} />
                Save Preferences
              </>
            )}
          </button>
        </div>
      </form>

      {/* Database Backup & Integrations Section */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Database Backup Card */}
        <div className="card space-y-4 border border-slate-800 bg-slate-900/40 shadow-2xl">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
            <Database className="text-purple-400" size={20} />
            <div>
              <h3 className="font-bold text-base text-slate-200">Database Backup</h3>
              <p className="text-xs text-slate-400">
                Create a transaction-consistent local backup of your database.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex justify-start">
              <button
                onClick={async () => {
                  setBackingUp(true);
                  setBackupPath(null);
                  try {
                    const res = await api.triggerBackup();
                    setBackupPath(res.backup_path);
                  } catch (err: any) {
                    setMessage({ type: 'error', text: err.message || 'Backup failed' });
                  } finally {
                    setBackingUp(false);
                  }
                }}
                disabled={backingUp}
                className="btn-primary flex items-center gap-2"
              >
                {backingUp ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Creating Backup...
                  </>
                ) : (
                  <>
                    <Database size={16} />
                    Backup Now
                  </>
                )}
              </button>
            </div>

            {backupPath && (
              <div className="rounded-xl bg-emerald-950/20 border border-emerald-900/30 p-3.5 text-xs text-emerald-400 leading-normal font-mono break-all">
                <strong>Backup created successfully!</strong>
                <div className="mt-1.5">{backupPath}</div>
              </div>
            )}
          </div>
        </div>

        {/* Telegram Link Card */}
        <div className="card space-y-4 border border-slate-800 bg-slate-900/40 shadow-2xl">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
            <Bot className="text-purple-400" size={20} />
            <div>
              <h3 className="font-bold text-base text-slate-200">Telegram Bot Integration</h3>
              <p className="text-xs text-slate-400">Link your Telegram chat to register transactions.</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {linkCode ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <span className="rounded-xl bg-purple-500/10 px-3.5 py-2 font-mono text-sm font-extrabold text-purple-400 border border-purple-500/20 shadow-inner">
                    {linkCode}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold italic">
                    Expires in {Math.round(expiresIn / 60)} minutes
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-snug">
                  Send <code className="bg-slate-950 px-2 py-0.5 rounded font-mono text-purple-400 border border-slate-800">/link {linkCode}</code> to your Telegram bot to connect your profile.
                </p>
              </div>
            ) : (
              <div className="flex justify-start">
                <button
                  onClick={generateLinkCode}
                  disabled={fetchingCode}
                  className="btn-primary"
                >
                  {fetchingCode ? 'Generating...' : 'Generate Linking Code'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Factory Reset Database Card */}
        <div className="card space-y-4 border border-rose-950/40 bg-slate-900/40 shadow-2xl">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
            <Trash2 className="text-rose-400" size={20} />
            <div>
              <h3 className="font-bold text-base text-slate-200">Reset Database</h3>
              <p className="text-xs text-slate-400">Permanently delete all ledger entries and data.</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex justify-start">
              <button
                onClick={handleReset}
                disabled={resetting}
                className="btn-primary bg-rose-600 hover:bg-rose-700 text-white font-semibold flex items-center gap-2 border border-rose-500/10"
              >
                {resetting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Reset All Data
                  </>
                )}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
              ⚠️ Warning: This will delete all transactions, bank accounts, friend ledgers, and notifications. This cannot be undone.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
