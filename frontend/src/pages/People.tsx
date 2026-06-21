import { useEffect, useState } from 'react';
import { User, ChevronRight } from 'lucide-react';
import { api } from '../api/client';
import TransactionList from '../components/TransactionList';
import { formatCurrency } from '../utils/format';
import type { Person, PersonLedger } from '../types';
import { RELATIONSHIP_TYPES } from '../types';

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [ledger, setLedger] = useState<PersonLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    relationship_type: 'Friend',
    notes: '',
  });

  useEffect(() => {
    api.getPeople().then(setPeople).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedId) {
      api.getPersonLedger(selectedId).then(setLedger);
    } else {
      setLedger(null);
    }
  }, [selectedId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const person = await api.createPerson({
      full_name: form.full_name,
      relationship_type: form.relationship_type,
      active: true,
      notes: form.notes || null,
    });
    setPeople((prev) => [...prev, person].sort((a, b) => a.full_name.localeCompare(b.full_name)));
    setForm({ full_name: '', relationship_type: 'Friend', notes: '' });
    setShowForm(false);
    setSelectedId(person.id);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">People Manager</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Track friend loans and repayment timelines
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Add Person'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Full Name</label>
            <input
              className="input"
              required
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Relationship</label>
            <select
              className="input"
              value={form.relationship_type}
              onChange={(e) => setForm({ ...form, relationship_type: e.target.value })}
            >
              {RELATIONSHIP_TYPES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Notes</label>
            <input
              className="input"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div className="sm:col-span-3">
            <button type="submit" className="btn-primary">
              Save Person
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-0 lg:col-span-1">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <h3 className="font-semibold">Contacts</h3>
          </div>
          <div className="max-h-[480px] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-700">
            {people.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-surface-hover ${
                  selectedId === p.id ? 'bg-accent/5 dark:bg-accent/10' : ''
                }`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <User size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.full_name}</p>
                  <p className="text-xs text-slate-500">{p.relationship_type}</p>
                </div>
                <ChevronRight size={16} className="text-slate-400" />
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2">
          {ledger ? (
            <div className="space-y-4">
              <div className="card">
                <h3 className="text-xl font-bold">{ledger.full_name}</h3>
                <p className="text-sm text-slate-500">{ledger.relationship_type}</p>
                {ledger.notes && (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{ledger.notes}</p>
                )}

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-violet-500/10 p-3">
                    <p className="text-xs text-slate-500">Outstanding Lent</p>
                    <p className="text-lg font-bold text-violet-600 dark:text-violet-400">
                      {formatCurrency(ledger.ledger.outstanding_lent)}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatCurrency(ledger.ledger.total_lent)} lent ·{' '}
                      {formatCurrency(ledger.ledger.total_lent_returned)} returned
                    </p>
                  </div>
                  <div className="rounded-lg bg-amber-500/10 p-3">
                    <p className="text-xs text-slate-500">Outstanding Borrowed</p>
                    <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                      {formatCurrency(ledger.ledger.outstanding_borrowed)}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatCurrency(ledger.ledger.total_borrowed)} borrowed ·{' '}
                      {formatCurrency(ledger.ledger.total_borrowed_returned)} repaid
                    </p>
                  </div>
                  <div className="rounded-lg bg-accent/10 p-3">
                    <p className="text-xs text-slate-500">Net Position</p>
                    <p className="text-lg font-bold text-accent">
                      {formatCurrency(ledger.ledger.net_position)}
                    </p>
                    <p className="text-xs text-slate-400">Positive = they owe you</p>
                  </div>
                </div>
              </div>

              <TransactionList
                transactions={ledger.transactions}
                title={`Timeline — ${ledger.full_name}`}
              />
            </div>
          ) : (
            <div className="card flex h-64 items-center justify-center text-slate-500">
              Select a person to view their loan ledger and timeline
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
