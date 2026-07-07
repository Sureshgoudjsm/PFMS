import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { formatCurrency, formatDate } from '../utils/format';
import { ACCOUNT_TYPES, type Account } from '../types';
import EmptyState from '../components/EmptyState';
import { Wallet, Plus, X, Landmark } from 'lucide-react';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    account_name: '',
    account_type: 'Savings Account',
    credit_limit: '',
  });



  const load = () => api.getAccounts().then(setAccounts);

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createAccount({
      account_name: form.account_name,
      account_type: form.account_type,
      current_balance: 0,
      credit_limit: form.credit_limit ? parseFloat(form.credit_limit) : null,
      statement_date: null,
      due_date: null,
    });
    setForm({ account_name: '', account_type: 'Savings Account', credit_limit: '' });
    setShowForm(false);
    load();
  };

  const assetTypes = ['Salary Account', 'Savings Account', 'Cash', 'Wallet'];
  const liabilityTypes = ['Credit Card', 'Gold Loan Account', 'Personal Loan Account'];

  const assets = accounts.filter((a) => assetTypes.includes(a.account_type));
  const liabilities = accounts.filter((a) => liabilityTypes.includes(a.account_type));

  const AccountRow = ({ acc }: { acc: Account }) => (
    <div className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
      <div>
        <p className="font-bold text-sm text-slate-200">{acc.account_name}</p>
        <p className="text-[10px] text-slate-500 font-semibold font-mono uppercase tracking-wider mt-0.5">{acc.account_type}</p>
        {acc.credit_limit && (
          <p className="text-[10px] text-slate-400 font-mono mt-1">Limit: {formatCurrency(acc.credit_limit)}</p>
        )}
        {(acc.statement_date || acc.due_date) && (
          <p className="text-[10px] text-slate-500 mt-1">
            {acc.statement_date && `Statement: ${formatDate(acc.statement_date)}`}
            {acc.due_date && ` · Due: ${formatDate(acc.due_date)}`}
          </p>
        )}
      </div>
      <p
        className={`text-base font-extrabold tabular-nums ${
          liabilityTypes.includes(acc.account_type) ? 'text-orange-500' : 'text-emerald-400'
        }`}
      >
        {formatCurrency(acc.computed_balance)}
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-100 tracking-tight">Accounts</h2>
          <p className="text-xs text-slate-400 font-medium font-mono uppercase tracking-wider mt-0.5">
            Balances computed dynamically from transaction history
          </p>
        </div>
        <button
          className="btn-primary flex items-center gap-2"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? (
            <>
              <X size={15} />
              <span>Cancel</span>
            </>
          ) : (
            <>
              <Plus size={15} />
              <span>Add Account</span>
            </>
          )}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card p-6 space-y-4 border border-slate-800 bg-slate-900/40">
          <div>
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-mono">Create Account Card</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Define a ledger asset or liability account.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label block text-[10px] font-semibold uppercase tracking-wider text-slate-300">Account Name</label>
              <input
                className="input"
                required
                value={form.account_name}
                onChange={(e) => setForm({ ...form, account_name: e.target.value })}
                placeholder="e.g. SBI Savings"
              />
            </div>
            <div>
              <label className="label block text-[10px] font-semibold uppercase tracking-wider text-slate-300">Account Type</label>
              <select
                className="input"
                value={form.account_type}
                onChange={(e) => setForm({ ...form, account_type: e.target.value })}
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t} className="bg-[#0f172a] text-slate-200">
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label block text-[10px] font-semibold uppercase tracking-wider text-slate-300">Credit Limit (optional)</label>
              <input
                type="number"
                className="input"
                value={form.credit_limit}
                onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
                placeholder="e.g. 50000"
              />
            </div>
          </div>
          <div className="flex justify-end border-t border-slate-800 pt-4">
            <button type="submit" className="btn-primary">
              Create Account
            </button>
          </div>
        </form>
      )}

      {/* Bento grid layout for Assets, Liabilities, and Telegram */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Assets Panel */}
        <div className="card border border-slate-800 bg-slate-900/40">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <h3 className="font-bold text-xs uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Assets
            </h3>
          </div>
          <div className="divide-y divide-slate-800/80">
            {assets.length === 0 ? (
              <EmptyState
                icon={Landmark}
                title="No asset accounts"
                description="Asset accounts represent your cash, savings, or investments."
              />
            ) : (
              assets.map((a) => <AccountRow key={a.id} acc={a} />)
            )}
          </div>
        </div>

        {/* Liabilities Panel */}
        <div className="card border border-slate-800 bg-slate-900/40">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <h3 className="font-bold text-xs uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
              Liabilities
            </h3>
          </div>
          <div className="divide-y divide-slate-800/80">
            {liabilities.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="No liability accounts"
                description="Liabilities represent credit cards or active personal/gold loans."
              />
            ) : (
              liabilities.map((a) => <AccountRow key={a.id} acc={a} />)
            )}
          </div>
        </div>
      </div>


    </div>
  );
}
