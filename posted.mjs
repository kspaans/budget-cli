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
  const l = db.transactions.length
  let i = 1
  for await (const tx of db.transactions) {
    if (tx.date < start) {
      i += 1
      continue
    }

    const value = await selectKey({
      message: `(${i}/${l}) ${tx.isPosted ? 'POSTED' : ''} ${tx.date}: $${tx.amount} - ${tx.payee} - ${tx.debit} ?`,
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
    tx.isPosted = value === 'p'
    i += 1
  }
}

export default {
  posted
}
