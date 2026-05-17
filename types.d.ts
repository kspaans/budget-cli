type Currency = {
  cur_id: number,
  cur_code: string,
  cur_name: string,
}

type Posting = {
  pst_id: number,
  pst_amount: number,
  pst_account: string,
  tx_id: number,
  cur_id: number,
}

type Transaction = {
  tx_id: number,
  tx_date: string,
  tx_payee: string,
  tx_credit: string?,
  tx_debit: string?,
  tx_amount: number?,
  tx_posted: boolean,
  cur_id: number?,
}
