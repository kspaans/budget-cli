// BUGS
// - [ ] pressing enter instead of `e` to enter an expense crashes
// - [ ] screen needs to be large enough to list all expense categories,
//   need autocomplete!
// - [ ] `new Date()` is in UTC
// - [ ] better date validation
// - [ ] unsettled top-level await when pressing Ctrl-D during prompts
// - [ ] can't use true/false in selectKey()?

// TODO autocomplete (needs inquirer)
// TODO list of recurring expenses, ask to add them
// TODO get list of accounts from JSON, workflow to create them
// TODO edit transactions
// TODO support splitting TX e.g. costco or amazon
// TODO have it integrate with Wave API (for corp???)

import { intro, cancel, isCancel, log, note, outro, select, selectKey, text } from '@clack/prompts';
import fs from 'node:fs'
import { setTimeout } from 'node:timers/promises'

/**
 * {
 *   transactions: [ {amount:1, account:"a", isPosted:true}, ...],
 *   recurring: [ {start_date:'2000-01-02', frequency:'biweekly'}, ...]
 *   ... 
 * }
 */
import db from './.ledger.json' with { 'type': 'json' }

const tasks = []

const a2tx = (tx) => {
  const credit_string = String(Number(tx.amount).toFixed(2)).padStart(56 - tx.credit.length, ' ')
  const debit_string =  String(     (-tx.amount).toFixed(2)).padStart(56 - tx.debit.length,  ' ')
  return `${tx.date} ${tx.isPosted ? '*' : ' '} ${tx.payee}\n` +
    `  ${tx.credit}${credit_string} CAD\n` +
    `  ${tx.debit}${debit_string} CAD\n`
}

intro(`LEDGER INTERACTIVE ACCOUNTING`);

const projectType = await selectKey({ // maybe try `select()` instead so enter works?
  message: 'What do you want to do?',
  initialValue: 'e',
  options: [
    { key: '_', value: '_', label: 'I\'m not sure what to do...', hint: 'We can help!' },
    { key: 'e', value: 'e', label: 'Enter an expense', hint: 'e' },
    { key: 'r', value: 'r', label: 'Reconcile CSV' },
    { key: 'c', value: 'c', label: 'Credit Card Statement' },
    { key: 'i', value: 'i', label: 'Record Income or transfer' },
    { key: 'p', value: 'p', label: 'Mark transactions as Posted' },
    { key: 'q', value: 'q', label: 'Exit', hint: 'niiiiice work' },
  ],
});

const out = fs.createWriteStream('./expenses.dat')
  .on("end", async () => {
    await setTimeout(500);
    rest()
  });

const quit = () => {
  note(
    db.transactions
      .sort((a,b) => ((a.date < b.date) ? -1 : 1))
      .map(a2tx)
      .join('\n'),
    'Recorded transactions:'
  )
  fs.writeFileSync('.ledger.json', JSON.stringify({
    transactions: db.transactions.sort((a,b) => ((a.date < b.date) ? -1 : 1)),
    ...db
  }, null, '  '))
  fs.writeFileSync('2budget.dat',
    db.transactions
      .sort((a,b) => ((a.date < b.date) ? -1 : 1))
      .map(a2tx)
      .join('\n')
  )
}

if (projectType === 'q') {
  quit()
  outro(`You're all set!`);
  out.end()
  process.exit(0)
}

if (projectType === 'e') {
  while (true) {
    const date = await text({
      message: 'When did the expense occur?',
      placeholder: (new Date()).toISOString().split('T')[0],
      initialValue: (new Date()).toISOString().split('T')[0],
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

    const amount = await text({
      message: 'OK, what\'s the amount?',
      placeholder: "12.34",
      validate: (value) => {
        const num = Number(value)
        if (isNaN(value) || typeof value === 'undefined' || value === '') {
          return 'Please enter a number.'
        }
      }
    })
    const expense_cat = await select({
      message: `How should this be categorized?`,
      options: [
        { key: 'm', value: 'Expenses:Misc', label: 'Misc Expense' },
        { key: 'g', value: 'Expenses:Groceries', label: 'Groceries' },
        { key: 'f', value: 'Expenses:Food', label: 'Food' },
        { key: 'c', value: 'Expenses:Coffee', label: 'Coffee', hint: 'oh no' },
        { value: 'Expenses:Clothing', value: 'Clothing' },
        { value: 'Expenses:Electricity', value: 'Electricity' },
        { value: 'Expenses:Food', value: 'Food' },
        { value: 'Expenses:Gifts', value: 'Gifts' },
        { value: 'Expenses:Groceries', value: 'Groceries' },
        { value: 'Expenses:Health', value: 'Health' },
        { value: 'Expenses:Insurance', value: 'Insurance' },
        { value: 'Expenses:Interest', value: 'Interest' },
        { value: 'Expenses:Internet', value: 'Internet' },
        { value: 'Expenses:Medical', value: 'Medical' },
        { value: 'Expenses:Mortgage', value: 'Mortgage' },
        { value: 'Expenses:Pets', value: 'Pets' },
        { value: 'Expenses:Rent', value: 'Rent' },
        { value: 'Expenses:Sports', value: 'Sports' },
        { value: 'Expenses:Subscriptions', value: 'Subscriptions' },
        { value: 'Expenses:Tax', value: 'Tax' },
        { value: 'Expenses:Transport:Gas', value: 'Gas' },
        { value: 'Expenses:Transport:Insurance', value: 'Car Insurance' },
        { value: 'Expenses:Transport:Loan', value: 'Car Loan' },
        { value: 'Expenses:Transport:Maint', value: 'Car Maintenance' },
        { value: 'Expenses:Transport:Tolls', value: 'Road Tolls' },
        { value: 'Expenses:Transport:Parking', value: 'Parking' },
        { value: 'Expenses:Wireless', value: 'Wireless' },
      ],
    })

    let debit_cat = await select({
        message: 'Debit from where?',
        options: [
          { value: 'Assets:Bob\'s Chequing', label: 'Bob\'s Chequing' },
          { value: 'Assets:Alice\'s Savings', label: 'Alice\'s Savings' },
          { value: 'Assets:Shared Savings', label: 'Shared Savings' },
          { value: 'CC', label: 'Credit Card' },
        ],
      })

    if (debit_cat === 'CC') {
      debit_cat =  await select({
        message: 'Which card?',
        options: [
          { value: 'Liabilities:CC:Amex', label: 'Amex' },
          { value: 'Liabilities:CC:MBNA', label: 'MBNA' },
          { value: 'Liabilities:CC:Neo', label: 'Neo Financial MC' },
          { value: 'Liabilities:CC:RBCCash', label: 'RBC Cashback' },
        ],
      })
    }

    const payee = await text({
      message: 'Payee?',
      placeholder: "Bob's Burgers",
      validate: (value) => {
        if (value.length === 0) {
          return 'Please enter a payee name.'
        }
      }
    })

    db.transactions.push({
      date, payee, amount, credit: expense_cat, debit: debit_cat
    })

    const credit_string = String(amount).padStart(56 - expense_cat.length, ' ')
    const debit_string = String(-amount).padStart(56 - debit_cat.length, ' ')
    const tx = `${date}   ${payee}\n` +
      `  ${expense_cat}${credit_string} CAD\n` +
      `  ${debit_cat}${debit_string} CAD\n`
    note(tx, 'Ledger Entry:')
    out.write(tx)
    out.write('\n')

    if (isCancel(expense_cat)) {

      cancel('Ok, leaving for now')
      out.end()
      process.exit(0)
    }

    const projectType = await select({
      message: 'What do you want to do next?',
      options: [
        { value: 'e', label: 'Enter another expense' },
        { value: 'q', label: 'Exit', hint: 'niiiiice work' },
      ],
    });
    if (projectType === 'q') {
      quit()
      break
    }
  }
  outro(`You're all set!`);
  out.end()
  process.exit(0)
} 

if (projectType === 'c') {
  const prev_bal = await text({
    message: 'What was the previous balance?',
    placeholder: "1,234.56",
    validate: (value) => {
      const num = Number(value)
      if (isNaN(value) || typeof value === 'undefined') {
        return 'Please enter a number.'
      }
    }
  })
  const curr_bal = await text({
    message: 'What is the current balance?',
    placeholder: "1,234.56",
    validate: (value) => {
      const num = Number(value)
      if (isNaN(value) || typeof value === 'undefined') {
        return 'Please enter a number.'
      }
    }
  })
  const min_pay = await text({
    message: 'What is the minimum payment?',
    placeholder: "123.45",
    validate: (value) => {
      const num = Number(value)
      if (isNaN(value) || typeof value === 'undefined') {
        return 'Please enter a number.'
      }
    }
  })
  const due = await text({
    message: 'When is the minimum payment due?',
    placeholder: "1970-01-01",
    /*validate: (value) => {
      const num = Number(value)
      if (isNaN(num) || typeof value === 'undefined') {
        return 'Please enter a number.'
      }
    }*/
  })
}

if (projectType === 'p') {
  note('Mark transactions as posted or not.')
  for await (const tx of db.transactions) {
     const value = await selectKey({
      message: `${tx.isPosted ? 'POSTED' : ''} ${tx.date} - ${tx.payee} - ${tx.debit} ?`,
      options: [
        { key: 'p', value: 'p', label: 'Posted' },
        { key: 'n', value: 'n', label: 'Not Posted' }
      ],
    })
    tx.isPosted = value === 'p'
  }

  quit()
  outro(`You're all set!`);
  out.end()
  process.exit(0)
}

process.exit(0)
