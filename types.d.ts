// nominal typing for the Primary Key IDs which are ints, but shouldn't be
// operated on
type CurrencyID    = number & { __brand: unique symbol }
type PostingID     = number & { __brand: unique symbol }
type RecurringID   = number & { __brand: unique symbol }
type TransactionID = number & { __brand: unique symbol }

type SelectOption = {
  value: string,
  label: string,
  hint?: string,
}

type Config = {
  income_accounts:    Array<SelectOption>,
  expense_accounts:   Array<SelectOption>,
  asset_accounts:     Array<SelectOption>,
  liability_accounts: Array<SelectOption>,
}

type Currency = {
  cur_id: CurrencyID,
  cur_code: string,
  cur_name: string,
}

type Posting = {
  pst_id: PostingID,
  pst_amount: number,
  pst_account: string,
  tx_id: number,
  cur_id: number,
}

enum EFrequency {
  BI_MONTHLY = "b",
  WEEKLY = "w",
  MONTHLY = "m",
  ANNUALLY = "a",
}

type Recurring = {
  rx_id: RecurringID,
  rx_start_date: string,
  rx_date: string,
  rx_payee: string,
  rx_credit: string,
  rx_debit: string,
  rx_frequency: EFrequency,
  rx_amount: number,
  rx_uuid: string,
}

type Transaction = {
  tx_id: TransactionID,
  tx_date: string,
  tx_payee: string,
  tx_credit: string?,
  tx_debit: string?,
  tx_amount: number?,
  tx_posted: boolean,
  cur_id: number?,
}
