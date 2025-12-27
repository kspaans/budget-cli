import sqlite from 'node:sqlite'

const DB_PATH = './.ledger.db'
let database
let insert_tx
let insert_recurring
let insert_rtx

const db = {
  init_db: (note) => {
    database = new sqlite.DatabaseSync(DB_PATH)
    const result = database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS transactions(
          tx_id INTEGER PRIMARY KEY AUTOINCREMENT
        , tx_date TEXT
        , tx_payee TEXT
        , tx_credit TEXT
        , tx_debit TEXT
        , tx_amount INTEGER
        , tx_posted BOOLEAN
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
      )
    `)
    note(`running db init: ${result}`)

    note(`there are ${database.prepare('SELECT COUNT(tx_id) FROM transactions').all().length} rows in the DB currently`)

    insert_tx = database.prepare(`
      INSERT INTO transactions(
          tx_date
        , tx_payee
        , tx_credit
        , tx_debit
        , tx_amount
        , tx_posted
      )
      VALUES (?,?,?,?,?,?)
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
  },

  exec: (query) => database.exec(query),

  insert_tx: (date, payee, credit_cat, debit_cat, amount, posted) => insert_tx.run(date, payee, credit_cat, debit_cat, amount, posted),

  insert_recurring: (start_date, date, payee, amount, expense_cat, debit_cat, frequency, ruuid) => insert_recurring.run(start_date, date, payee, amount, expense_cat, debit_cat, frequency, ruuid),

  insert_rtx: (rx_id, tx_id) => insert_rtx.run(rx_id, tx_id),

  transactions: () => {
    // TODO sort by date ascending
    return database.exec(`
      SELECT * FROM transactions
    `)
  },
}

export default {
  db
}
