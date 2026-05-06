/**
 *
 * All functionality related to the Ledger file format
 *
 */

import { writeFileSync } from 'node:fs'

import db from './db.mjs'

const LEDGERFILE_PATH = 'expenses.dat'
const config = {
  amount_padding: 35,
}

const a2tx = (tx) => {
  // handle missing currency while migrating all tx to use cur_id: default to
  // CAD
  let tx_currency_code = 'CAD'
  const currency_result = db.db.currency_code(tx.cur_id)
  if (currency_result !== undefined) {
    tx_currency_code = currency_result.cur_code
  }

  // if there is no credit column, then it's a split posting
  // TODO migrate older txs to tx + postings
  let credit_lines = ''
  if (tx.tx_credit === null) {
    for (const p of db.db.postings_for_tx(tx.tx_id)) {
      credit_lines += `  ${p.pst_account}${String(Number(p.pst_amount).toFixed(2)).padStart(config.amount_padding - p.pst_account.length, ' ')} ${tx_currency_code}\n`
    }
  } else {
    credit_lines = '  ' + tx.tx_credit +
      String(Number(tx.tx_amount).toFixed(2))
      .padStart(config.amount_padding - tx.tx_credit.length, ' ') +
      ' ' + tx_currency_code + '\n'
  }
  const debit_string =  String(     (-tx.tx_amount).toFixed(2))
    .padStart(config.amount_padding - tx.tx_debit.length,  ' ')
  // TODO handle recurring txs
  return `${tx.tx_date} ${tx.tx_posted ? '*' : ' '} ${tx.tx_payee}\n` +
    credit_lines +
    `  ${tx.tx_debit}${debit_string} ${tx_currency_code}\n`
}

const output_txs_to_ledger = () => {
  writeFileSync(LEDGERFILE_PATH,
    db.db.transactions()
      .map(a2tx)
      .join('\n')
  )
}

export {
  output_txs_to_ledger,
}
