import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import TransactionList from '../components/TransactionList';
import EmptyState from '../components/EmptyState';
import {
  TRANSACTION_TYPES,
  transactionFieldRules,
  type Account,
  type Category,
  type Person,
  type Transaction,
  type TransactionCreate,
} from '../types';
import { Sparkles, Calendar, Tag, Info, Landmark, HelpCircle, ArrowLeftRight } from 'lucide-react';

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
  const [seeding, setSeeding] = useState(false);

  const handleSeedSample = async () => {
    setSeeding(true);
    setError(null);
    setSuccess(null);
    try {
      await api.seedSampleData();
      setSuccess('Sample dataset seeded successfully!');
      load();
    } catch (err: any) {
      setError(err.message || 'Failed to seed sample data');
    } finally {
      setSeeding(false);
    }
  };

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
        <h2 className="text-2xl font-black text-slate-100 tracking-tight">Transactions</h2>
        <p className="text-xs text-slate-400 font-medium font-mono uppercase tracking-wider mt-0.5">
          Record income, expenses, transfers, and friend loans
        </p>
      </div>

      {/* Transaction Entry Form */}
      <form onSubmit={handleSubmit} className="card p-6 space-y-6 border border-slate-800 bg-slate-900/40">
        <div>
          <h3 className="text-base font-bold text-slate-200">New Transaction</h3>
          <p className="text-[11px] text-slate-400">Record a ledger entry to track cash flow.</p>
        </div>

        {/* Section 1: Transaction Details */}
        <div className="space-y-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-purple-400 font-mono border-b border-slate-800 pb-1">
            Transaction Details
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="transaction_type" className="label block text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                Transaction Type
              </label>
              <select
                id="transaction_type"
                className="input"
                value={form.transaction_type}
                onChange={(e) => handleTypeChange(e.target.value)}
              >
                {TRANSACTION_TYPES.map((t) => (
                  <option key={t} value={t} className="bg-[#0f172a] text-slate-200">
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="amount" className="label block text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                Amount (₹)
              </label>
              <input
                id="amount"
                type="number"
                className="input text-lg font-bold"
                required
                min="0.01"
                step="0.01"
                value={form.amount || ''}
                onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Payment Info */}
        <div className="space-y-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-purple-400 font-mono border-b border-slate-800 pb-1">
            Payment Info
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor="date" className="label block text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                Date
              </label>
              <input
                id="date"
                type="date"
                className="input"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>

            {rules.needsFrom && (
              <div>
                <label htmlFor="from_account" className="label block text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                  From Account
                </label>
                <select
                  id="from_account"
                  className="input"
                  required
                  value={form.from_account_id ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, from_account_id: Number(e.target.value) || null })
                  }
                >
                  <option value="" className="bg-[#0f172a] text-slate-400">Select account</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id} className="bg-[#0f172a] text-slate-200">
                      {a.account_name} ({a.account_type})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {rules.needsTo && (
              <div>
                <label htmlFor="to_account" className="label block text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                  To Account
                </label>
                <select
                  id="to_account"
                  className="input"
                  required
                  value={form.to_account_id ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, to_account_id: Number(e.target.value) || null })
                  }
                >
                  <option value="" className="bg-[#0f172a] text-slate-400">Select account</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id} className="bg-[#0f172a] text-slate-200">
                      {a.account_name} ({a.account_type})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {rules.needsPerson && (
              <div>
                <label htmlFor="person" className="label block text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                  Contact Person
                </label>
                <select
                  id="person"
                  className="input"
                  required
                  value={form.person_id ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, person_id: Number(e.target.value) || null })
                  }
                >
                  <option value="" className="bg-[#0f172a] text-slate-400">Select contact</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id} className="bg-[#0f172a] text-slate-200">
                      {p.full_name} ({p.relationship_type})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="category" className="label block text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                Category
              </label>
              <select
                id="category"
                className="input"
                value={form.category_id ?? ''}
                onChange={(e) =>
                  setForm({ ...form, category_id: Number(e.target.value) || null })
                }
              >
                <option value="" className="bg-[#0f172a] text-slate-400">Optional</option>
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#0f172a] text-slate-200">
                    {c.category_name} ({c.parent_type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="description" className="label block text-[10px] font-semibold uppercase tracking-wider text-slate-300">
              Description
            </label>
            <input
              id="description"
              className="input"
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Starbucks coffee, rent payment, SBI salary, etc."
            />
          </div>
        </div>

        {rules.canApplyFee && (
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={form.apply_processing_fee ?? false}
              onChange={(e) => setForm({ ...form, apply_processing_fee: e.target.checked })}
              className="rounded border-slate-700 bg-surface-lowest text-purple-600 focus:ring-purple-500"
            />
            Apply 2% processing fee (creates processing charge Expense entry)
          </label>
        )}

        {error && (
          <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-400">
            {error}
          </p>
        )}
        {success && (
          <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-400">
            {success}
          </p>
        )}

        <div className="flex justify-end border-t border-slate-800/80 pt-4">
          <button type="submit" className="btn-primary flex items-center gap-2" disabled={submitting}>
            {submitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving...
              </>
            ) : (
              <>
                Save Transaction
              </>
            )}
          </button>
        </div>
      </form>

      {/* Transactions List */}
      {transactions.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="No transactions recorded"
          description="Click below to seed dummy data, or log custom records via the form above."
          actionLabel="Try with Sample Data"
          onAction={handleSeedSample}
          loading={seeding}
        />
      ) : (
        <TransactionList
          transactions={transactions}
          title="All Transactions"
          onSeedSample={handleSeedSample}
          seeding={seeding}
        />
      )}
    </div>
  );
}
