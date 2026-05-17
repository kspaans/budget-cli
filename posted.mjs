import { cancel, isCancel, note, selectKey } from '@clack/prompts'

import Database from './db.mjs'
import { date_prompt } from './lib.js'

/**
 * @param db {Database}
 */
const posted = async (db) => {
  note('Mark transactions as posted or not.')
  const start = String(await date_prompt('Which transaction date should start looking at?'))
  const txs = db.transactions()
  const l = txs.length
  let i = 1
  for (const tx of txs) {
    if (tx.tx_date < start) {
      i += 1
      continue
    }

    const value = await selectKey({
      message: `(${i}/${l}) ${tx.tx_posted ? 'POSTED' : ''} ${tx.tx_date}: $${tx.tx_amount} - ${tx.tx_payee} - ${tx.tx_debit} ?`,
      options: [
        { value: 'p', label: 'Posted' },
        { value: 'n', label: 'Not Posted' },
        { value: 'q', label: 'Done' },
      ],
    })

    if (isCancel(value) || value === 'q') {
      cancel('Ok, leaving for now')
      break
    }
    db.mark_tx_as_posted(value === 'p' ? 1 : 0, tx.tx_id)
    i += 1
  }
}

export default {
  posted
}
