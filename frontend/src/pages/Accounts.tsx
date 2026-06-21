import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { formatCurrency, formatDate } from '../utils/format';
import { ACCOUNT_TYPES, type Account } from '../types';

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
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="font-medium">{acc.account_name}</p>
        <p className="text-xs text-slate-500">{acc.account_type}</p>
        {acc.credit_limit && (
          <p className="text-xs text-slate-400">Limit: {formatCurrency(acc.credit_limit)}</p>
        )}
        {(acc.statement_date || acc.due_date) && (
          <p className="text-xs text-slate-400">
            {acc.statement_date && `Stmt: ${formatDate(acc.statement_date)}`}
            {acc.due_date && ` · Due: ${formatDate(acc.due_date)}`}
          </p>
        )}
      </div>
      <p
        className={`text-lg font-bold ${
          liabilityTypes.includes(acc.account_type) ? 'text-orange-500' : 'text-emerald-600 dark:text-emerald-400'
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
          <h2 className="text-2xl font-bold">Accounts</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Balances computed dynamically from transaction history
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Add Account'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Account Name</label>
            <input
              className="input"
              required
              value={form.account_name}
              onChange={(e) => setForm({ ...form, account_name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Account Type</label>
            <select
              className="input"
              value={form.account_type}
              onChange={(e) => setForm({ ...form, account_type: e.target.value })}
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Credit Limit (optional)</label>
            <input
              type="number"
              className="input"
              value={form.credit_limit}
              onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
            />
          </div>
          <div className="sm:col-span-3">
            <button type="submit" className="btn-primary">
              Create Account
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="card">
          <h3 className="mb-2 font-semibold text-emerald-600 dark:text-emerald-400">Assets</h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {assets.length === 0 ? (
              <p className="py-4 text-sm text-slate-500">No asset accounts</p>
            ) : (
              assets.map((a) => <AccountRow key={a.id} acc={a} />)
            )}
          </div>
        </div>
        <div className="card">
          <h3 className="mb-2 font-semibold text-orange-500">Liabilities</h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {liabilities.length === 0 ? (
              <p className="py-4 text-sm text-slate-500">No liability accounts</p>
            ) : (
              liabilities.map((a) => <AccountRow key={a.id} acc={a} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
