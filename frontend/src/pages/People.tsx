import { useEffect, useState } from 'react';
import { User, ChevronRight, Users, Plus, X } from 'lucide-react';
import { api } from '../api/client';
import TransactionList from '../components/TransactionList';
import EmptyState from '../components/EmptyState';
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
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
        <p className="text-xs text-slate-400 font-mono uppercase tracking-widest">Loading contacts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-100 tracking-tight">People Manager</h2>
          <p className="text-xs text-slate-400 font-medium font-mono uppercase tracking-wider mt-0.5">
            Track friend loans and repayment timelines
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
              <span>Add Person</span>
            </>
          )}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card p-6 space-y-4 border border-slate-800 bg-slate-900/40">
          <div>
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-mono">Create Contact Card</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Add a new person to record loans or payouts.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label block text-[10px] font-semibold uppercase tracking-wider text-slate-300">Full Name</label>
              <input
                className="input"
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="e.g. Sunny"
              />
            </div>
            <div>
              <label className="label block text-[10px] font-semibold uppercase tracking-wider text-slate-300">Relationship</label>
              <select
                className="input"
                value={form.relationship_type}
                onChange={(e) => setForm({ ...form, relationship_type: e.target.value })}
              >
                {RELATIONSHIP_TYPES.map((r) => (
                  <option key={r} value={r} className="bg-[#0f172a] text-slate-200">
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label block text-[10px] font-semibold uppercase tracking-wider text-slate-300">Notes</label>
              <input
                className="input"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="e.g. Roommate, sibling, etc."
              />
            </div>
          </div>
          <div className="flex justify-end border-t border-slate-800 pt-4">
            <button type="submit" className="btn-primary">
              Save Contact
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Pane: Contacts List */}
        <div className="lg:col-span-1 flex flex-col min-h-[300px]">
          <div className="card p-0 overflow-hidden flex-1 border border-slate-800 bg-slate-900/40">
            <div className="border-b border-slate-800/80 px-4 py-3 bg-[#090e1b]/40">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-300">Contacts</h3>
            </div>
            {people.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={Users}
                  title="No contacts yet"
                  description="Use the button in the top right to register your first contact."
                />
              </div>
            ) : (
              <div className="max-h-[480px] divide-y divide-slate-800/80 overflow-y-auto">
                {people.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition ${
                      selectedId === p.id
                        ? 'bg-purple-500/15 text-purple-300 border-l-2 border-l-purple-500 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]'
                        : 'text-slate-300 hover:bg-slate-800/20'
                    }`}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-inner shrink-0">
                      <User size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-sm">{p.full_name}</p>
                      <p className="text-[10px] text-slate-500 font-medium font-mono uppercase tracking-wider mt-0.5">{p.relationship_type}</p>
                    </div>
                    <ChevronRight size={16} className="text-slate-500 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Contact Ledger Detail */}
        <div className="lg:col-span-2">
          {ledger ? (
            <div className="space-y-6 animate-fade-in">
              <div className="card space-y-4 border border-slate-800 bg-slate-900/40">
                <div>
                  <h3 className="text-xl font-extrabold text-slate-200">{ledger.full_name}</h3>
                  <p className="text-xs text-slate-500 font-semibold font-mono uppercase tracking-wider mt-0.5">{ledger.relationship_type}</p>
                  {ledger.notes && (
                    <p className="mt-2 text-xs text-slate-400 bg-slate-950/20 p-2 rounded-lg border border-slate-850">{ledger.notes}</p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Outstanding Lent</p>
                    <p className="text-xl font-extrabold text-violet-400 mt-1">
                      {formatCurrency(ledger.ledger.outstanding_lent)}
                    </p>
                    <p className="text-[9px] text-slate-500 font-medium mt-1">
                      {formatCurrency(ledger.ledger.total_lent)} lent ·{' '}
                      {formatCurrency(ledger.ledger.total_lent_returned)} returned
                    </p>
                  </div>

                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Outstanding Borrowed</p>
                    <p className="text-xl font-extrabold text-amber-400 mt-1">
                      {formatCurrency(ledger.ledger.outstanding_borrowed)}
                    </p>
                    <p className="text-[9px] text-slate-500 font-medium mt-1">
                      {formatCurrency(ledger.ledger.total_borrowed)} borrowed ·{' '}
                      {formatCurrency(ledger.ledger.total_borrowed_returned)} repaid
                    </p>
                  </div>

                  <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Net Position</p>
                    <p className="text-xl font-extrabold text-purple-400 mt-1">
                      {formatCurrency(ledger.ledger.net_position)}
                    </p>
                    <p className="text-[9px] text-slate-500 font-medium mt-1">Positive = they owe you</p>
                  </div>
                </div>
              </div>

              <TransactionList
                transactions={ledger.transactions}
                title={`Timeline — ${ledger.full_name}`}
              />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <EmptyState
                icon={User}
                title="Select a contact"
                description="Click on any contact in the left pane to view their loan ledger, total payouts, and timeline."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
