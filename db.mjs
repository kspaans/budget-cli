import sqlite from 'node:sqlite'

const DB_PATH = './.ledger.db'
let database
let count_currency_by_id
let insert_currency
let insert_tx
let insert_recurring
let insert_rtx
let insert_posting
let get_currencies
let get_currency_code_by_id
let get_default_currency
let get_transactions_by_date
let get_postings_by_tx_id
let get_recurring
let set_default_currency
let set_tx_posted

const db = {
  init_db: (note) => {
    database = new sqlite.DatabaseSync(DB_PATH)
    database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS transactions(
          tx_id INTEGER PRIMARY KEY AUTOINCREMENT
        , tx_date TEXT
        , tx_payee TEXT
        , tx_credit TEXT
        , tx_debit TEXT
        , tx_amount INTEGER
        , tx_posted BOOLEAN
        , cur_id INTEGER REFERENCES currencies(cur_id)
      );
      CREATE TABLE IF NOT EXISTS recurring(
          rx_id INTEGER PRIMARY KEY AUTOINCREMENT
        , rx_start_date TEXT
        , rx_date TEXT
        , rx_payee TEXT
        , rx_credit TEXT
        , rx_debit TEXT
        , rx_frequency TEXT
        , rx_amount INTEGER
        , rx_uuid TEXT
      );
      CREATE TABLE IF NOT EXISTS recurring_transactions(
          rtx_id INTEGER PRIMARY KEY AUTOINCREMENT
        , tx_id INTEGER REFERENCES transactions(tx_id)
        , rx_id INTEGER REFERENCES recurring(rx_id)
      );
      CREATE TABLE IF NOT EXISTS postings(
          pst_id INTEGER PRIMARY KEY AUTOINCREMENT
        , pst_amount INTEGER
        , pst_account TEXT
        , tx_id INTEGER REFERENCES transactions(tx_id)
        , cur_id INTEGER REFERENCES currencies(cur_id)
      );
      CREATE TABLE IF NOT EXISTS currencies(
          cur_id INTEGER PRIMARY KEY AUTOINCREMENT
        , cur_code TEXT
        , cur_name TEXT
      );
      CREATE TABLE IF NOT EXISTS default_currency(
          cur_id INTEGER REFERENCES currencies(cur_id)
      );
    `)
    note(
      `Done running db init\n` +
      `there are ${database.prepare('SELECT COUNT(tx_id) AS rows FROM transactions').get().rows} rows in the DB currently`
    )

    count_currency_by_id = database.prepare(`
      SELECT COUNT(transactions.tx_id) AS cur_count
      FROM transactions
      INNER JOIN postings
      ON postings.tx_id = transactions.tx_id
      WHERE transactions.cur_id = ?
      OR postings.cur_id = ?
    `)

    insert_currency = database.prepare(`
      INSERT INTO currencies(
          cur_code
        , cur_name
      )
      VALUES (?,?)
      RETURNING cur_id
    `)

    insert_tx = database.prepare(`
      INSERT INTO transactions(
          tx_date
        , tx_payee
        , tx_credit
        , tx_debit
        , tx_amount
        , tx_posted
        , cur_id
      )
      VALUES (?,?,?,?,?,?,?)
      RETURNING tx_id
    `)

    insert_recurring = database.prepare(`
      INSERT INTO recurring(
          rx_start_date
        , rx_date
        , rx_payee
        , rx_amount
        , rx_credit
        , rx_debit
        , rx_frequency
        , rx_uuid
      )
      VALUES (?,?,?,?,?,?,?,?)
      RETURNING rx_id
    `)

    insert_rtx = database.prepare(`
      INSERT INTO recurring_transactions(
          rx_id
        , tx_id
      )
      VALUES (?,?)
    `)

    insert_posting = database.prepare(`
      INSERT INTO postings(
          pst_amount
        , pst_account
        , tx_id
        , cur_id
      )
      VALUES (?,?,?,?)
    `)

    get_currencies = database.prepare(`
      SELECT *
      FROM currencies
    `)

    get_currency_code_by_id = database.prepare(`
      SELECT cur_code
      FROM currencies
      WHERE cur_id = ?
    `)

    get_default_currency = database.prepare(`
      SELECT cur_id
      FROM default_currency
    `)

    get_transactions_by_date = database.prepare(`
      SELECT *
      FROM transactions
      ORDER BY tx_date ASC
    `)

    get_postings_by_tx_id = database.prepare(`
      SELECT *
      FROM postings
      WHERE tx_id = ?
    `)

    get_recurring = database.prepare(`
      SELECT *
      FROM recurring
    `)

    set_default_currency = database.prepare(`
      UPDATE default_currency
      SET cur_id = ?
    `)

    set_tx_posted = database.prepare(`
      UPDATE transactions
      SET tx_posted = ?
      WHERE tx_id = ?
    `)
  },

  exec: (query) => database.exec(query),

  insert_tx: (date, payee, credit_cat, debit_cat, amount, posted, currency_id) => insert_tx.run(date, payee, credit_cat, debit_cat, amount, posted, currency_id),

  insert_recurring: (start_date, date, payee, amount, expense_cat, debit_cat, frequency, ruuid) => insert_recurring.run(start_date, date, payee, amount, expense_cat, debit_cat, frequency, ruuid),

  insert_rtx: (rx_id, tx_id) => insert_rtx.run(rx_id, tx_id),

  insert_posting: (amount, account, tx_id, cur_id) => insert_posting.run(amount, account, tx_id, cur_id),

  transactions: () => {
    return get_transactions_by_date.all()
  },

  postings_for_tx: (tx_id) => {
    return get_postings_by_tx_id.all(tx_id)
  },

  recurring: () => {
    return get_recurring.all()
  },

  count_currency: (cur_id) => {
    return count_currency_by_id.get(cur_id, cur_id)
  },

  currencies: () => {
    return get_currencies.all()
  },

  currency_code: (cur_id) => {
    return get_currency_code_by_id.get(cur_id)
  },

  default_currency: () => {
    return get_default_currency.get()
  },

  insert_currency: (code, name, isDefault) => {
    const cur_id = insert_currency.run(code, name)
    if (isDefault) {
      set_default_currency.run(cur_id)
    }
  },

  mark_tx_as_posted: (isPosted, tx_id) => {
    return set_tx_posted.run(isPosted, tx_id)
  },
}

export default {
  db
}
