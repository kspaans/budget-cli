import { autocomplete, cancel, isCancel, note, select, selectKey, text } from '@clack/prompts'

import { amount_prompt, currency_prompt, date_prompt } from './lib.js'

const expense = async (db, config) => {
  while (true) {
    const date = await date_prompt('When did/will the expense occur?')

    if (isCancel(date)) {
      cancel('Whoops, OK')
      break
    }

    const amount = await amount_prompt('OK, what\'s the amount?')

    const cur_id = await currency_prompt('Which currency did the expense use?')
    if (isCancel(cur_id)) {
      cancel('Whoops, OK')
      break
    }

    let expense_cat
    const postings = []
    const split = await select({
      message: 'Should the expense be split into multiple categories?',
      options: [
        { value: 'y', label: 'Yes' },
        { value: 'n', label: 'No' },
      ],
    })
    if (isCancel(split)) {
      cancel('Whoops, OK')
      break
    }
    if (split === 'y') {
      // create postings
      // total of all posting amounts should match expense amount
      // use BigInt type to force integer arithmetic using cents
      let remaining_cents = BigInt(Math.round(amount*100))
      while (remaining_cents > 0) {
        const whole_dollars = remaining_cents / 100n
        const padded_cents = String(remaining_cents % 100n).padStart(2, '0')
        const split_amount_dollars = await text({
          message: `You have ${whole_dollars}.${padded_cents} left to split, how much would you like to split now?`,
          placeholder: '12.34',
          validate: (value) => {
            const num_dollar = Number(value)
            if (isNaN(value) || typeof value === 'undefined' || value === '') {
              return 'Please enter a number.'
            }
            const num_cents = BigInt(Math.round(num_dollar*100))
            if (num_cents > remaining_cents ) {
              return `Amount ${num_dollar} is larger than remaining left to split: ${remaining_cents / 100n}.${String(remaining_cents % 100n).padStart(2, '0')}. Please give a smaller amount.`
            }
          }
        })
        expense_cat = await autocomplete({
          message: `How should this be categorized?`,
          options: config.expense_accounts
        })
        postings.push([split_amount_dollars, expense_cat])
        remaining_cents -= BigInt(Math.round(split_amount_dollars*100))
      }
    } else {
      expense_cat = await autocomplete({
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
        if (!value || value.length === 0) {
           'Please enter a payee name.'
        }
      }
    })

    // TODO try using confirm dialogue?
    const recurring = await select({
      message: 'Is it recurring?',
      options: [
        { value: 'n', label: 'No' },
        { value: 'y', label: 'Yes' },
      ],
    })

    db.exec(`BEGIN TRANSACTION`)
    const tx_id = db.insert_tx(date, payee, null, debit_cat, amount, 0, cur_id).lastInsertRowid
    for (const p of postings) {
      db.insert_posting(p[0], p[1], tx_id, cur_id)
    }
    if (recurring === 'y') {
      const frequency = await selectKey({
        message: 'How often is it recurring?',
        options: [
          { key: 'm', value: 'm', label: 'Monthly' },
          { key: 'b', value: 'b', label: 'Bi-Weekly (every two weeks)' },
          { key: 'w', value: 'w', label: 'Weekly' },
          { key: 'a', value: 'a', label: 'Annually' },
          { key: 't', value: 't', label: 'Bi-Monthly (twice a month)' },
        ]
      })
      const ruuid = crypto.randomUUID()
      // TODO convert amount to an integer
      // const int_amount = BigInt(Math.round(amount*100))
      // TODO when split, what should the expense category be for the recurring row?
      const rx_id = db.insert_recurring(date, date, payee, amount, expense_cat, debit_cat, frequency, ruuid).lastInsertRowid
      db.insert_rtx(rx_id, tx_id)
    }
    db.exec(`COMMIT`)

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
