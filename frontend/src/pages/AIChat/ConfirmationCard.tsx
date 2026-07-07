import React, { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { api } from "../../api/client";
import type { Account, Category, Person } from "../../types";

interface ConfirmationCardProps {
  previewId: string;
  intent: string;
  initialData: Record<string, any>;
  originalText: string;
  onConfirm: (finalData: Record<string, any>) => Promise<void>;
  onCancel: () => void;
}

export const ConfirmationCard: React.FC<ConfirmationCardProps> = ({
  previewId: _previewId,
  intent,
  initialData,
  originalText,
  onConfirm,
  onCancel,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [editedData, setEditedData] = useState<Record<string, any>>({ ...initialData });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingPerson, setIsCreatingPerson] = useState(false);

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [accs, cats, peop] = await Promise.all([
          api.getAccounts(),
          api.getCategories(),
          api.getPeople(),
        ]);
        setAccounts(accs);
        setCategories(cats);
        setPeople(peop);

        // Pre-fill initial foreign keys if they are not resolved
        const updated = { ...initialData };

        // 1. Resolve Category ID by Name matching (case-insensitive)
        if (initialData.category && !initialData.category_id) {
          const matchedCat = cats.find(
            (c) => c.category_name.toLowerCase() === initialData.category.toLowerCase()
          );
          if (matchedCat) {
            updated.category_id = matchedCat.id;
          }
        }

        // 2. Resolve Account ID by matching Description hints or first available cash/bank account
        if (!initialData.from_account_id && !initialData.to_account_id) {
          const matchedAcc = accs.find((a) =>
            originalText.toLowerCase().includes(a.account_name.toLowerCase())
          );
          const defaultAcc = matchedAcc || accs.find((a) => a.account_type === "Cash") || accs[0];
          
          if (defaultAcc) {
            if (intent === "CREATE_EXPENSE" || (intent === "CREATE_LOAN" && initialData.loan_type !== "received") || (intent === "CREATE_PAYMENT" && initialData.payment_type === "paid")) {
              updated.from_account_id = defaultAcc.id;
            } else if (intent === "CREATE_INCOME") {
              updated.to_account_id = defaultAcc.id;
            } else if (intent === "CREATE_LOAN" && initialData.loan_type === "received") {
              updated.to_account_id = defaultAcc.id;
            } else if (intent === "CREATE_PAYMENT" && initialData.payment_type !== "paid") {
              updated.to_account_id = defaultAcc.id;
            }
          }
        }

        // 3. Resolve Person ID by Name matching
        if (initialData.person_name && !initialData.person_id) {
          const matchedPerson = peop.find(
            (p) => p.full_name.toLowerCase() === initialData.person_name.toLowerCase()
          );
          if (matchedPerson) {
            updated.person_id = matchedPerson.id;
          }
        }

        setEditedData(updated);
      } catch (err) {
        console.error("Failed to load metadata for preview card:", err);
      } finally {
        setLoading(false);
      }
    };

    loadMetadata();
  }, [initialData, originalText, intent]);

  const handleChange = (key: string, value: any) => {
    setEditedData((prev) => ({ ...prev, [key]: value }));
    setErrorMsg(null);
  };

  const handlePersonChange = async (val: string) => {
    if (val === "CREATE_NEW" && initialData.person_name) {
      setIsCreatingPerson(true);
      try {
        const newPerson = await api.createPerson({
          full_name: initialData.person_name,
          relationship_type: "Friend",
          active: true,
          notes: "Created inline via AI Copilot",
        });
        setPeople((prev) => [...prev, newPerson]);
        setEditedData((prev) => ({ ...prev, person_id: newPerson.id }));
      } catch (err: any) {
        console.error("Failed to create inline contact:", err);
        setErrorMsg("Failed to create inline contact: " + err.message);
      } finally {
        setIsCreatingPerson(false);
      }
    } else {
      setEditedData((prev) => ({ ...prev, person_id: val ? Number(val) : undefined }));
    }
  };

  const handleConfirmClick = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onConfirm(editedData);
    } catch (err: any) {
      setErrorMsg(err.message || "Validation failed.");
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 text-xs text-slate-400 gap-2">
        <Loader2 className="animate-spin h-3.5 w-3.5 text-indigo-400" />
        Loading transaction editor...
      </div>
    );
  }

  // Determine intent category friendly title
  const getFriendlyTitle = () => {
    switch (intent) {
      case "CREATE_EXPENSE":
        return "New Expense";
      case "CREATE_INCOME":
        return "New Income";
      case "CREATE_LOAN":
        return "Loan Registration";
      case "CREATE_PAYMENT":
        return editedData.payment_type === "paid" ? "Repayment Paid" : "Repayment Received";
      case "CREATE_EMI":
        return "New EMI Schedule";
      case "CREATE_CREDIT_CARD":
        return "Create Credit Card Account";
      case "CREATE_GOLD_LOAN":
        return "Create Gold Loan Account";
      default:
        return "Verify Transaction";
    }
  };

  const isTransferOrCCPayment = intent === "CREATE_PAYMENT" && !editedData.person_id;

  return (
    <motion.div
      initial={shouldReduceMotion ? {} : { scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="my-3 w-full max-w-sm rounded-xl border border-slate-700/80 bg-slate-900/90 p-4 shadow-xl text-[13px] text-slate-200"
    >
      <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-2">
        <span className="font-semibold text-slate-100 uppercase tracking-wider text-[11px] text-indigo-400">
          {getFriendlyTitle()}
        </span>
        <span className="text-[10px] text-slate-500 italic">AI Draft</span>
      </div>

      <form onSubmit={handleConfirmClick} className="flex flex-col gap-2.5">
        {/* Error message */}
        {errorMsg && (
          <div className="rounded border border-red-800 bg-red-950/40 p-2 text-xs text-red-400 leading-snug">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* 1. Date Field */}
        {(intent === "CREATE_EXPENSE" || intent === "CREATE_INCOME" || intent === "CREATE_PAYMENT" || intent === "CREATE_EMI" || intent === "CREATE_CREDIT_CARD" || intent === "CREATE_GOLD_LOAN") && (
          <div className="flex flex-col gap-1">
            <label htmlFor="confirm-date" className="text-[11px] text-slate-400 font-medium">Date</label>
            <input
              id="confirm-date"
              type="date"
              aria-label="Transaction Date"
              value={editedData.date || editedData.payment_date || editedData.due_date || ""}
              onChange={(e) =>
                handleChange(
                  intent === "CREATE_PAYMENT" ? "payment_date" : intent === "CREATE_EMI" || intent === "CREATE_CREDIT_CARD" || intent === "CREATE_GOLD_LOAN" ? "due_date" : "date",
                  e.target.value
                )
              }
              required
              className="rounded border border-slate-700 bg-slate-950 px-2 py-1 outline-none focus:border-indigo-500"
            />
          </div>
        )}

        {/* 2. Amount Field */}
        <div className="flex flex-col gap-1">
          <label htmlFor="confirm-amount" className="text-[11px] text-slate-400 font-medium">Amount (₹)</label>
          <input
            id="confirm-amount"
            type="number"
            step="0.01"
            aria-label="Transaction Amount"
            value={editedData.amount || ""}
            onChange={(e) => handleChange("amount", e.target.value)}
            required
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 outline-none focus:border-indigo-500"
          />
        </div>

        {/* 3. Category Field (Expense only) */}
        {intent === "CREATE_EXPENSE" && (
          <div className="flex flex-col gap-1">
            <label htmlFor="confirm-category" className="text-[11px] text-slate-400 font-medium">Category</label>
            <select
              id="confirm-category"
              aria-label="Expense Category"
              value={editedData.category_id || ""}
              onChange={(e) => handleChange("category_id", Number(e.target.value))}
              required
              className="rounded border border-slate-700 bg-slate-950 px-2 py-1 outline-none focus:border-indigo-500"
            >
              <option value="" disabled>Select Category</option>
              {categories
                .filter((c) => c.parent_type === "Expense")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.category_name}
                  </option>
                ))}
            </select>
          </div>
        )}

        {intent === "CREATE_INCOME" && (
          <div className="flex flex-col gap-1">
            <label htmlFor="confirm-category" className="text-[11px] text-slate-400 font-medium">Category</label>
            <select
              id="confirm-category"
              aria-label="Income Category"
              value={editedData.category_id || ""}
              onChange={(e) => handleChange("category_id", Number(e.target.value))}
              required
              className="rounded border border-slate-700 bg-slate-950 px-2 py-1 outline-none focus:border-indigo-500"
            >
              <option value="" disabled>Select Category</option>
              {categories
                .filter((c) => c.parent_type === "Income")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.category_name}
                  </option>
                ))}
            </select>
          </div>
        )}

        {/* 4. Account Fields (Conditional) */}
        {isTransferOrCCPayment ? (
          <>
            <div className="flex flex-col gap-1">
              <label htmlFor="confirm-from-account" className="text-[11px] text-slate-400 font-medium">From Account</label>
              <select
                id="confirm-from-account"
                aria-label="Source Account"
                value={editedData.from_account_id || ""}
                onChange={(e) => handleChange("from_account_id", Number(e.target.value))}
                required
                className="rounded border border-slate-700 bg-slate-950 px-2 py-1 outline-none focus:border-indigo-500"
              >
                <option value="" disabled>Select Source Account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.account_name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="confirm-to-account" className="text-[11px] text-slate-400 font-medium">To Account</label>
              <select
                id="confirm-to-account"
                aria-label="Destination Account"
                value={editedData.to_account_id || ""}
                onChange={(e) => handleChange("to_account_id", Number(e.target.value))}
                required
                className="rounded border border-slate-700 bg-slate-950 px-2 py-1 outline-none focus:border-indigo-500"
              >
                <option value="" disabled>Select Destination Account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.account_name}</option>
                ))}
              </select>
            </div>
          </>
        ) : (
          (intent === "CREATE_EXPENSE" || intent === "CREATE_INCOME" || intent === "CREATE_LOAN" || intent === "CREATE_PAYMENT") && (
            <div className="flex flex-col gap-1">
              <label htmlFor="confirm-single-account" className="text-[11px] text-slate-400 font-medium">
                {intent === "CREATE_EXPENSE"
                  ? "Account"
                  : intent === "CREATE_INCOME" || editedData.loan_type === "received" || editedData.payment_type === "received"
                  ? "To Account (Deposit)"
                  : "From Account (Source)"}
              </label>
              <select
                id="confirm-single-account"
                aria-label="Account"
                value={editedData.from_account_id || editedData.to_account_id || ""}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  const isDeposit = intent === "CREATE_INCOME" || editedData.loan_type === "received" || editedData.payment_type === "received";
                  if (isDeposit) {
                    setEditedData((prev) => ({ ...prev, to_account_id: val, from_account_id: null }));
                  } else {
                    setEditedData((prev) => ({ ...prev, from_account_id: val, to_account_id: null }));
                  }
                }}
                required
                className="rounded border border-slate-700 bg-slate-950 px-2 py-1 outline-none focus:border-indigo-500"
              >
                <option value="" disabled>Select Account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.account_name}</option>
                ))}
              </select>
            </div>
          )
        )}

        {/* 5. Contact Person Field (Loans & Payments) */}
        {(intent === "CREATE_LOAN" || (intent === "CREATE_PAYMENT" && !isTransferOrCCPayment) || intent === "CREATE_EMI") && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label htmlFor="confirm-person" className="text-[11px] text-slate-400 font-medium">Linked Person</label>
              {isCreatingPerson && (
                <span className="text-[10px] text-indigo-400 animate-pulse">Creating...</span>
              )}
            </div>
            <select
              id="confirm-person"
              aria-label="Linked Contact"
              value={editedData.person_id || ""}
              onChange={(e) => handlePersonChange(e.target.value)}
              className="rounded border border-slate-700 bg-slate-950 px-2 py-1 outline-none focus:border-indigo-500"
            >
              <option value="">No Contact Linked</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
              {initialData.person_name && !people.some((p) => p.full_name.toLowerCase() === initialData.person_name.toLowerCase()) && (
                <option value="CREATE_NEW">➕ Create new contact "{initialData.person_name}"</option>
              )}
            </select>
          </div>
        )}

        {/* 6. Interest Rate and Due Date (EMI or Loan) */}
        {intent === "CREATE_LOAN" && (
          <>
            <div className="flex flex-col gap-1">
              <label htmlFor="confirm-interest" className="text-[11px] text-slate-400 font-medium">Interest Rate (%)</label>
              <input
                id="confirm-interest"
                type="number"
                aria-label="Interest Rate"
                value={editedData.interest_rate || 0}
                onChange={(e) => handleChange("interest_rate", e.target.value)}
                className="rounded border border-slate-700 bg-slate-950 px-2 py-1 outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="confirm-due-date" className="text-[11px] text-slate-400 font-medium">Due Date</label>
              <input
                id="confirm-due-date"
                type="date"
                aria-label="Due Date"
                value={editedData.due_date || ""}
                onChange={(e) => handleChange("due_date", e.target.value)}
                className="rounded border border-slate-700 bg-slate-950 px-2 py-1 outline-none focus:border-indigo-500"
              />
            </div>
          </>
        )}

        {/* 7. EMI Specific Fields */}
        {intent === "CREATE_EMI" && (
          <>
            <div className="flex flex-col gap-1">
              <label htmlFor="confirm-emi-name" className="text-[11px] text-slate-400 font-medium">EMI Name</label>
              <input
                id="confirm-emi-name"
                type="text"
                aria-label="EMI Name"
                value={editedData.name || ""}
                onChange={(e) => handleChange("name", e.target.value)}
                required
                className="rounded border border-slate-700 bg-slate-950 px-2 py-1 outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="confirm-emi-end" className="text-[11px] text-slate-400 font-medium">End Date</label>
              <input
                id="confirm-emi-end"
                type="date"
                aria-label="End Date"
                value={editedData.end_date || ""}
                onChange={(e) => handleChange("end_date", e.target.value)}
                className="rounded border border-slate-700 bg-slate-950 px-2 py-1 outline-none focus:border-indigo-500"
              />
            </div>
          </>
        )}

        {/* 8. Description / Notes */}
        {(intent === "CREATE_EXPENSE" || intent === "CREATE_INCOME" || intent === "CREATE_PAYMENT" || intent === "CREATE_LOAN") && (
          <div className="flex flex-col gap-1">
            <label htmlFor="confirm-desc" className="text-[11px] text-slate-400 font-medium">Description</label>
            <input
              id="confirm-desc"
              type="text"
              aria-label="Description"
              value={editedData.description || editedData.notes || ""}
              onChange={(e) =>
                handleChange(intent === "CREATE_PAYMENT" ? "notes" : "description", e.target.value)
              }
              className="rounded border border-slate-700 bg-slate-950 px-2 py-1 outline-none focus:border-indigo-500"
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-2 flex items-center justify-end gap-2 border-t border-slate-800 pt-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            aria-label="Cancel transaction draft"
            className="rounded border border-slate-700 px-3 py-1.5 font-medium hover:bg-slate-800 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            aria-label={`Confirm transaction of rupees ${editedData.amount || ''}`}
            className="flex items-center gap-1 rounded bg-indigo-500 px-3.5 py-1.5 font-semibold text-white shadow hover:bg-indigo-600 disabled:opacity-40"
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin h-3.5 w-3.5" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Confirm
          </button>
        </div>
      </form>
    </motion.div>
  );
};
