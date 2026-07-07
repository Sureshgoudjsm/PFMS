export interface Person {
  id: number;
  full_name: string;
  relationship_type: string;
  active: boolean;
  notes: string | null;
}

export interface PersonLedger extends Person {
  ledger: {
    total_lent: number;
    total_lent_returned: number;
    outstanding_lent: number;
    total_borrowed: number;
    total_borrowed_returned: number;
    outstanding_borrowed: number;
    net_position: number;
  };
  transactions: Transaction[];
}

export interface Account {
  id: number;
  account_name: string;
  account_type: string;
  current_balance: number;
  computed_balance: number;
  credit_limit: number | null;
  statement_date: string | null;
  due_date: string | null;
}

export interface Category {
  id: number;
  category_name: string;
  parent_type: string;
}

export interface Transaction {
  id: number;
  date: string;
  transaction_type: string;
  from_account_id: number | null;
  to_account_id: number | null;
  person_id: number | null;
  category_id: number | null;
  amount: number;
  description: string | null;
  parent_transaction_id?: number | null;
  processing_fee?: Transaction | null;
}

export interface TransactionCreate {
  date: string;
  transaction_type: string;
  from_account_id?: number | null;
  to_account_id?: number | null;
  person_id?: number | null;
  category_id?: number | null;
  amount: number;
  description?: string | null;
  apply_processing_fee?: boolean;
}

export interface DashboardSummary {
  current_month_expenses: number;
  total_bank_balance: number;
  cash_balance: number;
  credit_outstanding: number;
  money_lent: number;
  money_borrowed: number;
  net_worth: number;
  total_assets: number;
  total_liabilities: number;
}

export interface TrendPoint {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

export interface DashboardData {
  summary: DashboardSummary;
  trend: TrendPoint[];
  recent_transactions: Transaction[];
  total_accounts?: number;
  total_transactions?: number;
  has_sample_data?: boolean;
}

export const TRANSACTION_TYPES = [
  'Income',
  'Expense',
  'Transfer',
  'Loan Given',
  'Loan Received',
  'Loan Repayment Received',
  'Loan Repayment Paid',
  'Credit Card Payment',
  'EMI Payment',
  'Interest Payment',
  'Investment',
  'Withdrawal',
  'Deposit',
] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const RELATIONSHIP_TYPES = [
  'Brother',
  'Sister',
  'Friend',
  'Relative',
  'Colleague',
  'Vendor',
  'Other',
] as const;

export const ACCOUNT_TYPES = [
  'Salary Account',
  'Savings Account',
  'Cash',
  'Credit Card',
  'Gold Loan Account',
  'Personal Loan Account',
  'Wallet',
] as const;

export function transactionFieldRules(type: string) {
  const needsFrom = [
    'Expense',
    'Transfer',
    'Loan Given',
    'Loan Repayment Paid',
    'Credit Card Payment',
    'EMI Payment',
    'Interest Payment',
    'Investment',
    'Withdrawal',
  ].includes(type);

  const needsTo = [
    'Income',
    'Transfer',
    'Loan Received',
    'Loan Repayment Received',
    'Credit Card Payment',
    'Deposit',
  ].includes(type);

  const needsPerson = [
    'Loan Given',
    'Loan Received',
    'Loan Repayment Received',
    'Loan Repayment Paid',
  ].includes(type);

  const canApplyFee = [
    'Transfer',
    'Credit Card Payment',
    'Expense',
  ].includes(type);

  return { needsFrom, needsTo, needsPerson, canApplyFee };
}

export interface ChatRequest {
  message: string;
}

export interface ChatResponse {
  message: string;
  intent: string;
  confidence: number;
  reply: string;
  created: Record<string, any> | null;
  executed: boolean;
}

export interface SummaryResponse {
  summary: string;
  stats: Record<string, any>;
}

export interface PreviewResponse {
  preview_id: string;
  intent: string;
  intent_data: Record<string, any>;
  original_text: string;
}

export interface ConfirmResponse {
  status: string;
  transaction_id?: number | null;
  timestamp?: number | null;
}

export interface UndoResponse {
  success: boolean;
  reason?: string | null;
}

export interface ForecastDayEvents {
  salary_added: boolean;
  emi_deducted: boolean;
  discretionary_spend: number;
}

export interface ForecastDay {
  date: string;
  balance: number;
  events: ForecastDayEvents;
}
