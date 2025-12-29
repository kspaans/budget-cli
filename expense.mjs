import { cancel, isCancel, note, select, selectKey, text } from '@clack/prompts'

import { amount_prompt, date_prompt } from './lib.js'

const expense = async (db, config) => {
  while (true) {
    const date = await date_prompt('When did/will the expense occur?')

    if (isCancel(date)) {
      cancel('Whoops, OK')
      break
    }

    const amount = await amount_prompt('OK, what\'s the amount?')

    let expense_cat
    const postings = []
    const split = await select({
      message: 'Should the expense be split into multiple categories?',
      options: [
        { value: 'y', label: 'Yes' },
        { value: 'n', label: 'No' },
      ],
    })
    if (split === 'y') {
      // create postings
      // total of all posting amounts should match expense amount
      // use BigInt type to force integer arithmetic using cents
      let remaining = BigInt(Math.round(amount*100))
      while (remaining > 0) {
        // TODO convert cents back into decimal dollars
        const split_amount = await text({
          message: `You have ${remaining} left to split, how much would you like to split now?`,
          placeholder: '12.34',
          validate: (value) => {
            const num = Number(value)
            if (isNaN(value) || typeof value === 'undefined' || value === '') {
              return 'Please enter a number.'
            }
            if (num > remaining ) {
              return `Amount is larger than remaining left to split: ${remaining}. Please give a smaller amount.`
            }
          }
        })
        const split_expense_cat = await select({
          message: `How should this be categorized?`,
          options: config.expense_accounts
        })
        postings.push([split_amount, split_expense_cat])
        remaining -= BigInt(Math.round(split_amount*100))
      }
    } else {
      expense_cat = await select({
        message: `How should this be categorized?`,
        options: config.expense_accounts
      })
      postings.push([amount, expense_cat])
    }

    let debit_cat = await select({
      message: 'Debit from where?',
      options: config.asset_accounts.concat({
        value: 'CC', label: 'Credit Card'
      }),
    })

    if (debit_cat === 'CC') {
      debit_cat =  await select({
        message: 'Which card?',
        options: config.liability_accounts,
      })
    }

    const payee = await text({
      message: 'Payee?',
      placeholder: "Bob's Burgers",
      validate: (value) => {
        if (value.length === 0) {
           'Please enter a payee name.'
        }
      }
    })

    const recurring = await select({
      message: 'Is it recurring?',
      options: [
        { value: 'y', label: 'Yes' },
        { value: 'n', label: 'No' },
      ],
    })

    let recurring_frequency = false
    let ruuid = undefined
    if (recurring === 'y') {
      const frequency = await selectKey({
        message: 'How often is it recurring?',
        options: [
          { key: 'w', value: 'w', label: 'Weekly' },
          { key: 'b', value: 'b', label: 'Bi-Weekly (every two weeks)' },
          { key: 't', value: 't', label: 'Bi-Monthly (twice a month)' },
          { key: 'm', value: 'm', label: 'Monthly' },
          { key: 'a', value: 'a', label: 'Annually' },
        ]
      })
      const value_map = {
        w: 'weekly',
        b: 'bi-weekly',
        t: 'bi-monthly',
        m: 'monthly',
        a: 'annually',
      }
      recurring_frequency = `; :recurring: ${value_map[frequency]}`
      ruuid = crypto.randomUUID()
      db.exec(`BEGIN TRANSACTION`)
      // TODO convert amount to an integer
      const rx_id = db.insert_recurring(date, date, payee, amount, expense_cat, debit_cat, frequency, ruuid)
      const tx_id = db.insert_tx(date, payee, expense_cat, debit_cat, amount, 0)
      db.insert_rtx(rx_id.lastInsertRowid, tx_id.lastInsertRowid)
      db.exec(`COMMIT`)
    } else {
      // TODO make the tx and rtx insert idempotent
      // TODO support recurring split expenses
      db.exec(`BEGIN TRANSACTION`)
      const tx_id = db.insert_tx(date, payee, null, debit_cat, amount, 0).lastInsertRowid
      for (const p of postings) {
        db.insert_posting(p[0], p[1], tx_id)
      }
      db.exec(`COMMIT`)
    }

    if (isCancel(expense_cat)) {
      cancel('Ok, leaving for now')
      process.exit(0)
    }

    const projectType = await select({
      message: 'What do you want to do next?',
      options: [
        { value: 'e', label: 'Enter another expense' },
        { value: 'q', label: 'Exit', hint: 'niiiiice work' },
      ],
    })
    if (projectType === 'q') {
      break
    }
  }
}

export {
  expense,
}
