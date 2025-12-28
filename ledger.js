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
  const credit_string = String(Number(tx.tx_amount).toFixed(2))
    .padStart(config.amount_padding - tx.tx_credit.length, ' ')
  const debit_string =  String(     (-tx.tx_amount).toFixed(2))
    .padStart(config.amount_padding - tx.tx_debit.length,  ' ')
  const recurring_string = tx.tx_recurring_frequency ? `  ${tx.tx_recurring_frequency}\n` : ''
  const ruuid_string = tx.tx_ruuid ? `  ; :ruuid: ${tx.tx_ruuid}\n` : ''
  return `${tx.tx_date} ${tx.tx_posted ? '*' : ' '} ${tx.tx_payee}\n` +
    recurring_string +
    ruuid_string +
    `  ${tx.tx_credit}${credit_string} CAD\n` +
    `  ${tx.tx_debit}${debit_string} CAD\n`
}

const output_txs_to_ledger = () => {
  writeFileSync(LEDGERFILE_PATH,
    db.db.transactions()
      .sort((a,b) => ((a.date < b.date) ? -1 : 1))
      .map(a2tx)
      .join('\n')
  )
}

export {
  output_txs_to_ledger,
}
