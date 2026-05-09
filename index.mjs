// BUGS
// - [ ] null/0-len payee name crashes app
// - [ ] marking transactions as posted isn't recording in the DB
// - [ ] SQLite param 5 when inserting recurring txns that are split
// - [ ] pressing enter instead of `e` to enter an expense crashes
// - [ ] screen needs to be large enough to list all expense categories,
//   need autocomplete!
// - [ ] can't use true/false in selectKey()?
// - [ ] have list of payees so that payees can be linked, list/autocomplete
//   for payee selection

// TODO Workflows
// - [ ] have log output for when transactions are saved
// - [ ] monthly balance, expenses for budgeting
// - [ ] reconciliation
// - [ ] create list of accounts
//   - [ ] have accounts table and FKs in schema
//   - [ ] move accounts into DB
//   - [ ] have TUI workflow for managing accounts
// - [ ] edit transactions
//   - [ ] modify date of tx
// - [ ] refunds/misc income that's balanced against a different account
// - [ ] alt posting workflow that's more free to select which debit and credit accounts
//   - pick debit account
//   - pick credit account
//   - amount
//   - repeat until all postings done
//   - balance check of all postings
// - [ ] make web postings background be proportional to the size of the credit
//   relative to the whole transaction

// TODO travel
// - [] support multtiple currencies
//   - [ ] initialize one default currency
//   - [X] select currency for expense
//   - [ ] select currency for income
//   - [X] select currency for transfer?
//   - [ ] select currency for loan
//   - [ ] select currency for recurring tx
// - [X] add extra account for wise
// - [ ] support FX for converting between currencies

// TODO autocomplete (needs inquirer)
// TODO CC creation (billing dates, credit, maybe reoncile bills)
// TODO track CC available-credit
// TODO use event-sourcing model to simplify the representation,
//      reconciliation, and input of transactions and posting events
// TODO fireproof-storage for the log of transactions?
// TODO have it integrate with Wave API (for corp???)
// TODO browser extension to scrape/download from banks
// TODO parse quicken format from RBC

// TODO refactor date, amount, account etc, functions into a shared lib
// TODO figure out where to put account listing congfigs
// TODO all amounts should be integers
// TODO jsdoc typing
// TODO normalize payee, accounts
// TODO comments on transactions

import { intro, cancel, isCancel, log, note, outro, select, selectKey, text } from '@clack/prompts';
import fs from 'node:fs'
import { setTimeout } from 'node:timers/promises'

import { amount_prompt, currency_prompt, date_prompt } from './lib.js'
import currency from './currency.js'
import db from './db.mjs'
import { expense } from './expense.mjs'
import { output_txs_to_ledger as quit } from './ledger.js'
import posted from './posted.mjs'
import recurring from './recurring.mjs'
import web from './web.mjs'

let data
const config = {
  income_accounts: [],
  expense_accounts: [],
  asset_accounts: [],
  liability_accounts: [],
}

const tasks = []

intro(`LEDGER INTERACTIVE ACCOUNTING`);

db.db.init_db(note)

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

async function main_loop() {
  note(`Running website check out http://localhost:8888/`)
  const w = await web.server(db.db.transactions())
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
        { key: 'y', value: 'y', label: 'Manage currencies' },
        { key: 'q', value: 'q', label: 'Exit', hint: 'niiiiice work' },
      ],
    });

    switch (projectType) {
      case 'q':
        quit()
        outro(`You're all set!`);
        process.exit(0)

      case 't':
        // TODO what about a refund of medical expenses?
        await transfer()
        break

      case 'y':
        await currency(db.db)
        break

      case 'e': {
        await expense(db.db, config)
        break
      }

      case 'l': {
        const date = await date_prompt('When did/will the loan occur?')

        if (isCancel(date)) {
          cancel('Whoops, OK')
          break
        }

        const amount = await amount_prompt('OK, what\'s the amount?')

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
        db.db.insert_tx(date, payee, expense_cat, debit_cat, amount, 1)

        const credit_string = String(amount).padStart(56 - expense_cat.length, ' ')
        const debit_string = String(-amount).padStart(56 - debit_cat.length, ' ')
        const tx = `${date}   ${payee}\n` +
          `  ${expense_cat}${credit_string} CAD\n` +
          `  ${debit_cat}${debit_string} CAD\n`
        note(tx, 'Ledger Entry:')

        if (isCancel(expense_cat)) {
          cancel('Ok, leaving for now')
          process.exit(0)
        }

        break
      }

      case 'c': {
        const prev_bal = await amount_prompt('What was the previous balance?')

        if (isCancel(prev_bal)) {
          cancel('Whoops, OK')
          quit()
          process.exit(0)
        }

        const curr_bal = await amount_prompt('What is the current balance?')
        const min_pay = await amount_prompt('What is the minimum payment?')
        const due = await date_prompt('When is the minimum payment due?')
        break
      }

      case 'p': {
        await posted.posted(db.db)
        break;
      }

      case 'u': {
        await recurring.recurring(db.db)
        break;
      }

      case 'i': {
        const date = await date_prompt('When did the income occur?')

        if (isCancel(date)) {
          cancel('Ok, leaving for now')
          process.exit(0)
          quit()
        }

        const amount = await amount_prompt('OK, what\'s the amount?')

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

        db.db.insert_tx(date, payee, credit_cat, income_cat, amount, 0)

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

        const date = await date_prompt('When did the account open occur?')

        const asset = await select({
          message: 'Which account needs an opening balance?',
          options: config.asset_accounts,
        })

        const amount = await amount_prompt('OK, what\'s the amount?')

        // TODO convert amount to an integer
        db.db.insert_tx(date, payee, asset, debit_cat, amount, 1)

        quit()
        break;
      }
    }
  }
}

async function transfer() {
  const payee = 'Transfer'

  const date = await date_prompt('When did the transfer occur?')

  if (isCancel(date)) {
    cancel('Whoops, OK')
    return
  }

  const asset = await select({
    message: 'Where did you it transfer to?',
    options: config.asset_accounts.concat(config.liability_accounts),
  })

  const amount = await amount_prompt('OK, what\'s the amount?')

  const cur_id = await currency_prompt('Which currency was transfered?')

  const debit = await select({
    message: 'Where did the transfer come from?',
    options: config.asset_accounts,
  })

  db.db.insert_tx(date, payee, asset, debit, amount, 1, cur_id)
}

main_loop()
