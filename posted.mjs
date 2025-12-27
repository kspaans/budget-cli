import { cancel, isCancel, note, selectKey, text } from '@clack/prompts';

const posted = async (db) => {
  note('Mark transactions as posted or not.')
  const start = await text({
    message: 'Which transaction date should start looking at?',
    placeholder: (new Date()).toLocaleDateString(),
    initialValue: (new Date()).toLocaleDateString(),
    validate: (d) => {
      if (typeof d === 'undefined' || d === '') {
        return 'Please enter a date.'
      }
      const result = Date.parse(d)
      if (isNaN(result) || result === 'Invalid Date') {
        return 'Please enter a valid date in YYYY-MM-DD format.'
      }
    }
  })
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
        { key: 'p', value: 'p', label: 'Posted' },
        { key: 'n', value: 'n', label: 'Not Posted' },
        { key: 'q', value: 'q', label: 'Done' },
      ],
    })

    if (isCancel(value) || value === 'q') {
      cancel('Ok, leaving for now')
      break
    }
    // TODO DB query to set TX flag
    tx.isPosted = value === 'p'
    i += 1
  }
}

export default {
  posted
}
