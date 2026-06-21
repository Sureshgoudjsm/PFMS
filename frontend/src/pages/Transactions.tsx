import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import TransactionList from '../components/TransactionList';
import {
  TRANSACTION_TYPES,
  transactionFieldRules,
  type Account,
  type Category,
  type Person,
  type Transaction,
  type TransactionCreate,
} from '../types';

const emptyForm: TransactionCreate = {
  date: new Date().toISOString().slice(0, 10),
  transaction_type: 'Expense',
  from_account_id: null,
  to_account_id: null,
  person_id: null,
  category_id: null,
  amount: 0,
  description: '',
  apply_processing_fee: false,
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [form, setForm] = useState<TransactionCreate>({ ...emptyForm });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const rules = useMemo(() => transactionFieldRules(form.transaction_type), [form.transaction_type]);

  const filteredCategories = useMemo(() => {
    const typeMap: Record<string, string> = {
      Income: 'Income',
      Expense: 'Expense',
      'Loan Given': 'Loan',
      'Loan Received': 'Loan',
      'Loan Repayment Received': 'Loan',
      'Loan Repayment Paid': 'Loan',
      Investment: 'Investment',
      Withdrawal: 'Investment',
      Deposit: 'Investment',
    };
    const parent = typeMap[form.transaction_type];
    if (parent) return categories.filter((c) => c.parent_type === parent);
    return categories;
  }, [categories, form.transaction_type]);

  const load = () => {
    Promise.all([
      api.getTransactions({ limit: 100 }),
      api.getAccounts(),
      api.getCategories(),
      api.getPeople(true),
    ]).then(([txns, accs, cats, ppl]) => {
      setTransactions(txns);
      setAccounts(accs);
      setCategories(cats);
      setPeople(ppl);
    });
  };

  useEffect(load, []);

  const handleTypeChange = (type: string) => {
    setForm((prev) => ({
      ...prev,
      transaction_type: type,
      from_account_id: null,
      to_account_id: null,
      person_id: null,
      apply_processing_fee: false,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    const payload: TransactionCreate = {
      ...form,
      amount: Number(form.amount),
      from_account_id: rules.needsFrom ? form.from_account_id : null,
      to_account_id: rules.needsTo ? form.to_account_id : null,
      person_id: rules.needsPerson ? form.person_id : null,
    };

    try {
      const created = await api.createTransaction(payload);
      setSuccess(
        created.processing_fee
          ? `Transaction saved with ${created.processing_fee.amount} processing fee`
          : 'Transaction saved successfully'
      );
      setForm({ ...emptyForm });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Transactions</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Record income, expenses, transfers, and friend loans
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <h3 className="text-lg font-semibold">New Transaction</h3>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label">Date</label>
            <input
              type="date"
              className="input"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="label">Transaction Type</label>
            <select
              className="input"
              value={form.transaction_type}
              onChange={(e) => handleTypeChange(e.target.value)}
            >
              {TRANSACTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {rules.needsFrom && (
            <div>
              <label className="label">From Account</label>
              <select
                className="input"
                required
                value={form.from_account_id ?? ''}
                onChange={(e) =>
                  setForm({ ...form, from_account_id: Number(e.target.value) || null })
                }
              >
                <option value="">Select account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_name} ({a.account_type})
                  </option>
                ))}
              </select>
            </div>
          )}

          {rules.needsTo && (
            <div>
              <label className="label">To Account</label>
              <select
                className="input"
                required
                value={form.to_account_id ?? ''}
                onChange={(e) =>
                  setForm({ ...form, to_account_id: Number(e.target.value) || null })
                }
              >
                <option value="">Select account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_name} ({a.account_type})
                  </option>
                ))}
              </select>
            </div>
          )}

          {rules.needsPerson && (
            <div>
              <label className="label">Person</label>
              <select
                className="input"
                required
                value={form.person_id ?? ''}
                onChange={(e) =>
                  setForm({ ...form, person_id: Number(e.target.value) || null })
                }
              >
                <option value="">Select person</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} ({p.relationship_type})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label">Category</label>
            <select
              className="input"
              value={form.category_id ?? ''}
              onChange={(e) =>
                setForm({ ...form, category_id: Number(e.target.value) || null })
              }
            >
              <option value="">Optional</option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.category_name} ({c.parent_type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Amount (₹)</label>
            <input
              type="number"
              className="input"
              required
              min="0.01"
              step="0.01"
              value={form.amount || ''}
              onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="label">Description</label>
            <input
              className="input"
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What was this for?"
            />
          </div>
        </div>

        {rules.canApplyFee && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.apply_processing_fee ?? false}
              onChange={(e) => setForm({ ...form, apply_processing_fee: e.target.checked })}
              className="rounded border-slate-300 text-accent focus:ring-accent"
            />
            Apply 2% processing fee (auto-creates Expense → Processing Charges)
          </label>
        )}

        {error && (
          <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}
        {success && (
          <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
            {success}
          </p>
        )}

        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save Transaction'}
        </button>
      </form>

      <TransactionList transactions={transactions} title="All Transactions" />
    </div>
  );
}
