import { cancel, isCancel, note, selectKey, text } from '@clack/prompts';

const rmap = {
  m: '; :recurring: monthly',
  b: '; :recurring: bi-weekly',
  w: '; :recurring: weekly',
}
const rmap_human = {
  m: 'monthly',
  b: 'bi-weekly',
  w: 'weekly',
}

const recurring = async (db) => {
  const task = await selectKey({
    message: 'What do you want to do?',
    options: [
      { key: 'v', value: 'v', label: 'View recurring transactions' },
      // will fill up transactions between the start date and last dated txns in
      // the ledger, so to extend recurring txns into the future, add more
      // non-recurring
      { key: 'r', value: 'r', label: 'Reconcile transactions' }, // e.g. modify date due to holiday/weekend
      { key: 'e', value: 'e', label: 'Extend recurrences into the future' }, // TODO, maybe unnecessary?
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
        let message = ''
        for await (const rx of db.recurring()) {
          const amount = ('$'+String(Number(rx.rx_amount).toFixed(2))).padStart(8, ' ')
          const r = rmap_human[rx.rx_frequency].padStart(9, ' ')
          message += `Recurring ${rx.rx_amount}, ${r}: ${rx.rx_payee} ${rx.rx_credit} \n`
        }
        note(message)
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
        for await (const rtx of db.recurring()) {
          let create_new_flag = true // TODO better way?
          const value = await selectKey({
            message: `$${rtx.rx_date} - ${rtx.rx_payee} - ${rtx.rx_debit} ?`,
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
            let target = rtx.rx_date
            // TODO don't linearly scan the transactions, we know which date to start from
            // the transactions are always saved sorted in date order, so we
            // can safely walk them in this order
            for await (const t of db.transactions()) {
              if (t.tx_date > target) {
                // TODO have to map between the two sets of columns
                const new_tx = {
                  ...rtx,
                  recurring_frequency: rmap[rtx.rx_frequency],
                  date: target,
                }
                delete new_tx.rx_start_date
                delete new_tx.rx_frequency
                if (create_new_flag) {
                  new_txns.push(new_tx)
                }
                const tdate = new Date(target)
                switch (rtx.rx_frequency) {
                  case 'm':
                    tdate.setMonth(tdate.getMonth() + 1)
                    target = `${tdate.toLocaleDateString()}`
                    break;
                  case 'b':
                    tdate.setDate(tdate.getDate() + 14)
                    target = `${tdate.toLocaleDateString()}`
                    break;
                  case 'w':
                    tdate.setDate(tdate.getDate() + 7)
                    target = `${tdate.toLocaleDateString()}`
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
                  message: `Post/unpost this transaction? $${t.tx_date} - ${t.tx_payee} - ${t.tx_debit} - ${t.tx_posted ? '' : 'not'}posted?`,
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
        // TODO save new recurring tx
        //db.transactions = db.transactions.concat(new_txns)
        break
      }
  }
}

export default {
  recurring
}
