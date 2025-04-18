import { cancel, isCancel, note, selectKey, text } from '@clack/prompts';

const recurring = async (db) => {
  const task = await  selectKey({
    message: 'What do you want to do?',
    options: [
      { key: '_', value: '_', label: 'I\'m not sure what to do...', hint: 'We can help!' },
      { key: 'v', value: 'v', label: 'View recurring transactions' },
      { key: 'r', value: 'r', label: 'Reconcile transactions' }, // e.g. modify date due to holiday/weekend
      { key: 'e', value: 'e', label: 'Extend recurrences into the future' },
      { key: 'q', value: 'q', label: 'Go back' },
    ],
  });

  if (isCancel(task)) {
    cancel('Ok, going back')
    return
  }

  switch (task) {
    case 'v':
      {
        // TODO move recurring TX into their own array in the ledger, which will also
        // work as a Set of recurring tx with no repeats
        //const a = new Set()
        for await (const tx of db.recurring) {
          note(`Recurring every '${tx.frequency}': ${tx.payee} ${tx.credit} ${tx.amount}`)
        }
        break
      }

    case 'r':
      {
        note(`OK, let's reconcile any existing transactions against the recurring transactions you've setup.`)
        note(`Pick which recurring transaction to reconcile:`)
        for await (const tx of db.recurring) {
          const value = await selectKey({
            message: `$${tx.date} - ${tx.payee} - ${tx.debit} ?`,
            options: [
              { key: 'y', value: 'y', label: 'Yes' },
              { key: 'n', value: 'n', label: 'No' }
            ],
          })
          if (isCancel(value)) {
            cancel('Ok, leaving for now')
            break
          }
          if (value === 'n') {
            continue
          }
          if (value === 'y') {
            let target = tx.date
            let n = ''
            // TODO don't linearly scan the transactions
            // the transactions are always saved sorted in date order, so we
            // can safely walk them in this order
            for await (const t of db.transactions) {
              if (t.date > target) {
                n += `\nPast the start date (${target}), moving to the next scheduled date...`
                const tdate = new Date(target)
                // TODO switch on the recurring type of the tx
                const month = tdate.getMonth()
                tdate.setMonth(month + 1)
                target = `${tdate.toISOString().split('T')[0]}`
                n += `\nNew scheduled date is ${target}`
              }
              // TODO what if the tx has been moved due to a weekend/holiday
              // and so the date doesn't match exactly?
              if (t.date === target && t.amount === tx.amount) {
                n += `\nFound one on ${t.date}: ${t.amount} ${t.payee}`
              }
            }
            note(n)
          }
        }

        break
      }
  }
}

export default {
  recurring
}
