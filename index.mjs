// BUGS
// - [ ] better init experience of fresh .ledger.json
//   - [ ] message saying a new file is created
//   - [ ] pre-populate the properties (txs, recurring, ...)
//   - [X] dynamic import of JSON with error message
// - [ ] pressing enter instead of `e` to enter an expense crashes
// - [ ] screen needs to be large enough to list all expense categories,
//   need autocomplete!
// - [ ] better date validation
// - [ ] can't use true/false in selectKey()?

// TODO autocomplete (needs inquirer)
// TODO CC creation (billing dates, credit, maybe reoncile bills)
// TODO track CC available-credit
// TODO use event-sourcing model to simplify the representation,
//      reconciliation, and input of transactions and posting events
// TODO fireproof-storage for the log of transactions?
// TODO workflow to create list of accounts
// TODO edit transactions
// TODO support splitting TX e.g. costco or amazon
// TODO have it integrate with Wave API (for corp???)
// TODO browser extension to scrape/download from banks
// TODO parse quicken format from RBC

import { intro, cancel, isCancel, log, note, outro, select, selectKey, text } from '@clack/prompts';
import fs from 'node:fs'
import { setTimeout } from 'node:timers/promises'

import recurring from './recurring.mjs'
import posted from './posted.mjs'
import web from './web.mjs'

/**
 * {
 *   transactions: [ {amount:1, account:"a", isPosted:true}, ...],
 *   recurring: [ {start_date:'2000-01-02', frequency:'biweekly'}, ...]
 *   ... 
 * }
 */
let db = undefined
try {
  db = await import('./.ledger.json', {with: { 'type': 'json' }})
} catch {
  throw new Error(`ERROR: \`.ledger.json\` file missing, please create it before starting`)
}

// the dynamic import has different naming
db = db.default

let data
const config = {
  amount_padding: 35,
  income_accounts: [],
  expense_accounts: [],
  asset_accounts: [],
  liability_accounts: [],
}

const tasks = []

const a2tx = (tx) => {
  const credit_string = String(Number(tx.amount).toFixed(2))
    .padStart(config.amount_padding - tx.credit.length, ' ')
  const debit_string =  String(     (-tx.amount).toFixed(2))
    .padStart(config.amount_padding - tx.debit.length,  ' ')
  const recurring_string = tx.recurring_frequency ? `  ${tx.recurring_frequency}\n` : ''
  const ruuid_string = tx.ruuid ? `  ; :ruuid: ${tx.ruuid}\n` : ''
  return `${tx.date} ${tx.isPosted ? '*' : ' '} ${tx.payee}\n` +
    recurring_string +
    ruuid_string +
    `  ${tx.credit}${credit_string} CAD\n` +
    `  ${tx.debit}${debit_string} CAD\n`
}

intro(`LEDGER INTERACTIVE ACCOUNTING`);

try {
  data = fs.readFileSync('./.accounts.json', { encoding: 'utf8' })
  const accounts = JSON.parse(data)
  config.expense_accounts   = accounts.expense_accounts
  config.income_accounts    = accounts.income_accounts
  config.asset_accounts     = accounts.asset_accounts
  config.liability_accounts = accounts.liability_accounts
} catch (err) {
  log.warn(`Error when intializing accounts`)
  if (err.code === 'ENOENT') {
    log.warn(`It looks like your .accounts.json file is missing, please creat it`)
  } else {
    log.warn(`Error code ${err.code}`)
  }
  process.exit(1)
}

const out = fs.createWriteStream('./expenses.dat')
  .on("end", async () => {
    await setTimeout(500);
    rest()
  });

const quit = () => {
  fs.writeFileSync('.ledger.json', JSON.stringify({
      transactions: db.transactions.sort((a,b) => ((a.date < b.date) ? -1 : 1)),
      ...db
    },
    null,
    '  '
  ))
  fs.writeFileSync('2budget.dat',
    db.transactions
      .sort((a,b) => ((a.date < b.date) ? -1 : 1))
      .map(a2tx)
      .join('\n')
  )
}

async function main_loop() {
  note(`Runnign website check out http://localhost:8888/`)
  const w = await web.server(db.transactions)
  while (true) {
    const projectType = await selectKey({ // maybe try `select()` instead so enter works?
      message: 'What do you want to do?',
      initialValue: 'e',
      options: [
        { key: '_', value: '_', label: 'I\'m not sure what to do...', hint: 'We can help!' },
        { key: 'e', value: 'e', label: 'Enter an expense', hint: 'e' },
        { key: 'l', value: 'l', label: 'Loan someone money', hint: 'l' },
        { key: 'r', value: 'r', label: 'Reconcile CSV' },
        { key: 'c', value: 'c', label: 'Credit Card Statement' },
        { key: 'u', value: 'u', label: 'stuff Recurring Transactions stuff...' },
        { key: 'i', value: 'i', label: 'Record Income' },
        { key: 'p', value: 'p', label: 'Mark transactions as Posted' },
        { key: 'o', value: 'o', label: 'Add or Adjust Opening Balances' },
        { key: 't', value: 't', label: 'Transfer balances between accounts' },
        { key: 'q', value: 'q', label: 'Exit', hint: 'niiiiice work' },
      ],
    });

    switch (projectType) {
      case 'q':
        quit()
        outro(`You're all set!`);
        out.end()
        process.exit(0)

      case 't':
        // TODO what about a refund of medical expenses?
        await transfer()
        break;

      case 'e': {
  while (true) {
    const date = await text({
      message: 'When did/will the expense occur?',
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

    if (isCancel(date)) {
      cancel('Whoops, OK')
      break
    }

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
      options: config.expense_accounts
    })

    let debit_cat = await select({
        message: 'Debit from where?',
        options: config.asset_accounts.concat({ value: 'CC', label: 'Credit Card' }),
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
          return 'Please enter a payee name.'
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
      db.recurring.push({
        start_date: date, date, payee, amount, credit: expense_cat,
        debit: debit_cat, frequency, ruuid
      })
    }

    db.transactions.push({
      date, payee, amount, credit: expense_cat, debit: debit_cat,
      recurring_frequency, ruuid
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
        break
      }

      case 'l': {
        const date = await text({
          message: 'When did/will the loan occur?',
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

        if (isCancel(date)) {
          cancel('Whoops, OK')
          break
        }

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

        // TODO: use `select()` with a pre-defined or dynamic list
        const loanee = await text({
          message: `Who is the loan to?`,
        })

        let debit_cat = await select({
          message: 'Debit from where?',
          options: config.asset_accounts.concat({ value: 'CC', label: 'Credit Card' }),
        })

        if (debit_cat === 'CC') {
          debit_cat =  await select({
            message: 'Which card?',
            options: config.liability_accounts,
          })
        }

        const payee = loanee
        const expense_cat = `Liabilities:${loanee}`
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

        break
      }

      case 'c': {
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

        if (isCancel(prev_bal)) {
          cancel('Whoops, OK')
          quit()
          process.exit(0)
        }

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
        break
      }

      case 'p': {
        await posted.posted(db)
        break;
      }

      case 'u': {
        await recurring.recurring(db)
        break;
      }

      case 'i': {
        const date = await text({
          message: 'When did the income occur?',
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

        if (isCancel(date)) {
          cancel('Ok, leaving for now')
          process.exit(0)
          quit()
        }

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

        const income_cat = await select({
          message: `How should this be categorized?`,
          options: config.income_accounts,
        })

        const credit_cat = await select({
            message: 'Where did it get deposited?',
            options: config.asset_accounts,
          })

        const payee = await text({
          message: 'Who paid you?',
          placeholder: "work",
          validate: (value) => {
            if (value.length === 0) {
               'Please enter a payee name.'
            }
          }
        })

        db.transactions.push({
          date, payee, amount, credit: credit_cat, debit: income_cat
        })

        if (isCancel(income_cat)) {
          cancel('Ok, leaving for now')
          process.exit(0)
          quit()
        }

        quit()
        break;
      }

      case 'o': {
        const payee = 'Opening Balances'
        const debit_cat = 'Equity:Opening Balances'

        const date = await text({
          message: 'When did the expense occur?',
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

        const asset = await select({
          message: 'Which account needs an opening balance?',
          options: config.asset_accounts,
        })

        const amount = await text({
          message: 'OK, what\'s the amount?',
          placeholder: "12.34",
          validate: (value) => {
            const num = Number(value)
            if (isNaN(value) || typeof value === 'undefined' || value === '') {
              return 'Please enter a number.'
            }
          },
        })

        db.transactions.push({
          date, payee, amount, credit: asset, debit: debit_cat
        })


        quit()
        break;
      }
    }
  }
}

async function transfer() {
  const payee = 'Transfer'

  const date = await text({
    message: 'When did the transfer occur?',
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

  const asset = await select({
    message: 'Where did you it transfer to?',
    options: config.asset_accounts.concat(config.liability_accounts),
  })

  const amount = await text({
    message: 'OK, what\'s the amount?',
    placeholder: "12.34",
    validate: (value) => {
      const num = Number(value)
      if (isNaN(value) || typeof value === 'undefined' || value === '') {
        return 'Please enter a number.'
      }
    },
  })
  const debit = await select({
    message: 'Where did the transfer come from?',
    options: config.asset_accounts,
  })

  db.transactions.push({
    date, payee, amount, credit: asset, debit
  })
}

main_loop()
