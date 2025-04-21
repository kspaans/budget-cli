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
        const new_txns = []
        // - [X] if the tx exists, mark it as posted
        //   - [ ] modify the amount, if necessary
        //   - [ ] modify the date, if necessary (e.g. day falls on weekend or holiday)
        // - [X] if the tx desn't exist in the future, create it
        // - [ ] create more recurring TXs more into the future
        for await (const rtx of db.recurring) {
          let create_new_flag = true // TODO better way?
          const value = await selectKey({
            message: `$${rtx.date} - ${rtx.payee} - ${rtx.debit} ?`,
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
            let target = rtx.date
            // TODO don't linearly scan the transactions, we know which date to start from
            // the transactions are always saved sorted in date order, so we
            // can safely walk them in this order
            for await (const t of db.transactions) {
              if (t.date > target) {
                const rmap = {
                  m: '; :recurring: monthly',
                  b: '; :recurring: bi-weekly',
                  w: '; :recurring: weekly',
                }
                const new_tx = {
                  ...rtx,
                  recurring_frequency: rmap[rtx.frequency],
                  date: target,
                }
                delete new_tx.start_date
                delete new_tx.frequency
                if (create_new_flag) {
                  new_txns.push(new_tx)
                }
                const tdate = new Date(target)
                switch (rtx.frequency) {
                  case 'm':
                    tdate.setMonth(tdate.getMonth() + 1)
                    target = `${tdate.toISOString().split('T')[0]}`
                    break;
                  case 'b':
                    tdate.setDate(tdate.getDate() + 14)
                    target = `${tdate.toISOString().split('T')[0]}`
                    break;
                  case 'w':
                    tdate.setDate(tdate.getDate() + 7)
                    target = `${tdate.toISOString().split('T')[0]}`
                    break;
                  default:
                    note('WHOOPS do not have a plan for that recurring value yet!')
                    break;
                  // TODO semi-monthly
                }
                create_new_flag = true
              }
              if (t.ruuid === rtx.ruuid) {
                const p = await selectKey({
                  message: `Post/unpost this transaction? $${t.date} - ${t.payee} - ${t.debit} - ${t.isPosted ? '' : 'not'}posted?`,
                  options: [
                    { key: 'y', value: 'y', label: 'Yes' },
                    { key: 'n', value: 'n', label: 'No' }
                  ],
                })
                t.isPosted = p === 'y'
                create_new_flag = false
              }
            }
          }
        }

        note(JSON.stringify(new_txns))
        db.transactions = db.transactions.concat(new_txns)
        break
      }
  }
}

export default {
  recurring
}
