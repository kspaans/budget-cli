/**
 *
 * All functionality related to the Ledger file format
 *
 */

import { writeFileSync } from 'node:fs'

import Database from './db.mjs'

const LEDGERFILE_PATH = 'expenses.dat'
const config = {
  amount_padding: 35,
}

/**
 * @param db {Database}
 */
const a2tx = (db) => {
  /**
   * @param tx {Transaction}
   */
  const mapper = (tx) => {
  // TODO remove after data migration
  // handle missing currency while migrating all tx to use cur_id: default to
  // CAD
  let tx_currency_code = 'CAD'
  const currency_result = db.currency_code(tx.cur_id)
  if (currency_result !== undefined && currency_result !== null) {
    tx_currency_code = currency_result.cur_code
  }

  const tx_postings = db.postings_for_tx(tx.tx_id)
  // if there is no credit column, then it's a split posting
  // TODO migrate older txs to tx + postings
  let credit_lines = ''
  if (tx.tx_credit === null) {
    for (const p of tx_postings) {
      // TODO backstop to the tx currency code until I've migrated data
      const posting_currency_code = db.currency_code(p.cur_id)?.cur_code ||
        tx_currency_code
      // detect a currency exchange transaction, and add the exchange rate to
      // the posting line for strict&pendantic mode in Ledger
      // if (tx.cur_id === null)
      const space_padded_amount = String(
        Number(p.pst_amount).toFixed(2)
      ).padStart(config.amount_padding - p.pst_account.length, ' ')
      credit_lines += `  ${p.pst_account}${space_padded_amount} ${posting_currency_code}\n`
    }
  } else {
    credit_lines = '  ' + tx.tx_credit +
      String(Number(tx.tx_amount).toFixed(2))
      .padStart(config.amount_padding - tx.tx_credit.length, ' ') +
      ' ' + tx_currency_code + '\n'
  }
  // if it's an exchange tx, the debit is handled above
  let debit_account_string = ''
  if (tx.tx_debit !== null) {
    debit_account_string = String((-tx.tx_amount).toFixed(2)).padStart(config.amount_padding - tx.tx_debit.length, ' ')
  }
  // TODO handle recurring txs
  return `${tx.tx_date} ${tx.tx_posted ? '*' : ' '} ${tx.tx_payee}\n` +
    credit_lines + (debit_account_string ?
    `  ${tx.tx_debit}${debit_account_string} ${tx_currency_code}\n` : '')
  }

  return mapper
}

/**
 * @param db {Database}
 */
const output_txs_to_ledger = (db) => {
  const mapper = a2tx(db)
  writeFileSync(LEDGERFILE_PATH,
    db.transactions()
      .map(mapper)
      .join('\n')
  )
}

export {
  output_txs_to_ledger,
}
