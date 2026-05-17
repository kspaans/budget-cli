import sqlite from 'node:sqlite'

import { note } from '@clack/prompts'

const DB_PATH = './.ledger.db'

export default class Database {
  constructor() {
    this.database = new sqlite.DatabaseSync(DB_PATH)
    this.database.exec(`
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
      `there are ${this.database.prepare('SELECT COUNT(tx_id) AS rows FROM transactions').get().rows} rows in the DB currently`
    )

    this.count_currency_by_id = this.database.prepare(`
      SELECT COUNT(transactions.tx_id) AS cur_count
      FROM transactions
      INNER JOIN postings
      ON postings.tx_id = transactions.tx_id
      WHERE transactions.cur_id = ?
      OR postings.cur_id = ?
    `)

    this.db_insert_currency = this.database.prepare(`
      INSERT INTO currencies(
          cur_code
        , cur_name
      )
      VALUES (?,?)
      RETURNING cur_id
    `)

    this.db_insert_tx = this.database.prepare(`
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

    this.db_insert_recurring = this.database.prepare(`
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

    this.db_insert_rtx = this.database.prepare(`
      INSERT INTO recurring_transactions(
          rx_id
        , tx_id
      )
      VALUES (?,?)
    `)

    this.db_insert_posting = this.database.prepare(`
      INSERT INTO postings(
          pst_amount
        , pst_account
        , tx_id
        , cur_id
      )
      VALUES (?,?,?,?)
    `)

    this.get_currencies = this.database.prepare(`
      SELECT *
      FROM currencies
    `)

    this.get_currency_code_by_id = this.database.prepare(`
      SELECT cur_code
      FROM currencies
      WHERE cur_id = ?
    `)

    this.get_default_currency = this.database.prepare(`
      SELECT cur_id
      FROM default_currency
    `)

    this.get_transactions_by_date = this.database.prepare(`
      SELECT *
      FROM transactions
      ORDER BY tx_date ASC
    `)

    this.get_postings_by_tx_id = this.database.prepare(`
      SELECT *
      FROM postings
      WHERE tx_id = ?
    `)

    this.get_recurring = this.database.prepare(`
      SELECT *
      FROM recurring
    `)

    this.set_default_currency = this.database.prepare(`
      UPDATE default_currency
      SET cur_id = ?
    `)

    this.set_tx_posted = this.database.prepare(`
      UPDATE transactions
      SET tx_posted = ?
      WHERE tx_id = ?
    `)
  }

  /**
   * @param query {String}
   */
  exec(query) {
    return this.database.exec(query)
  }

  /**
   * @param date {String}
   * @param payee {String}
   * @param credit_cat {String?}
   * @param debit_cat {String?}
   * @param amount {number}
   * @param posted {number}
   * @param currency_id {number?}
   */
  insert_tx(date, payee, credit_cat, debit_cat, amount, posted, currency_id) {
    return this.db_insert_tx.run(date, payee, credit_cat, debit_cat, amount, posted, currency_id)
  }

  /**
   * @param start_date {String}
   * @param date {String}
   * @param payee {String}
   * @param amount {number}
   * @param expense_cat {String}
   * @param debit_cat {String}
   * @param frequency {String}
   * @param ruuid {String}
   */
  insert_recurring(start_date, date, payee, amount, expense_cat, debit_cat, frequency, ruuid) {
    return this.db_insert_recurring.run(start_date, date, payee, amount, expense_cat, debit_cat, frequency, ruuid)
  }

  /**
   * @param rx_id {number}
   * @param tx_id {number}
   */
  insert_rtx(rx_id, tx_id) {
    return this.db_insert_rtx.run(rx_id, tx_id)
  }

  /**
   * @param amount {number}
   * @param account {String}
   * @param tx_id {number}
   * @param cur_id {number}
   */
  insert_posting(amount, account, tx_id, cur_id) {
    return this.db_insert_posting.run(amount, account, tx_id, cur_id)
  }

  /**
   * @returns {Array<Transaction>}
   */
  transactions() {
    return this.get_transactions_by_date.all()
  }

  /**
   * @param tx_id {number}
   * @returns {Array<Posting>}
   */
  postings_for_tx(tx_id) {
    return this.get_postings_by_tx_id.all(tx_id)
  }

  /**
   * @returns {string}
   */
  recurring() {
    return this.get_recurring.all()
  }

  /**
   * @param cur_id {number}
   */
  count_currency(cur_id) {
    return this.count_currency_by_id.get(cur_id, cur_id)
  }

  /**
   * @returns {Array<Currency>}
   */
  currencies() {
    return this.get_currencies.all()
  }

  /**
   * @param cur_id {number}
   * @returns {{cur_code: string} | null}
   */
  currency_code(cur_id) {
    return this.get_currency_code_by_id.get(cur_id)
  }

  default_currency() {
    return this.get_default_currency.get()
  }

  /**
   * @param code {string}
   * @param name {string}
   * @param isDefault {boolean}
   */
  insert_currency(code, name, isDefault) {
    const cur_id = this.db_insert_currency.run(code, name)
    if (isDefault) {
      this.set_default_currency.run(cur_id)
    }
  }

  /**
   * @param isPosted {number}
   * @param tx_id {number}
   */
  mark_tx_as_posted(isPosted, tx_id) {
    return this.set_tx_posted.run(isPosted, tx_id)
  }
}
