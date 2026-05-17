import { select, text } from '@clack/prompts'

import Database from './db.mjs'

/**
 * returns decimal "dollars"
 *
 * @param message {string}
 * @returns {Promise<number>}
 */
const amount_prompt = async (message) => {
  return Number(await text({
    message,
    placeholder: "12.34",
    validate: (value) => {
      const num = Number(value)
      if (typeof value === 'undefined' || isNaN(num) || value === '') {
        return 'Please enter a number.'
      }
      return ''
    }
  }))
}


/**
 * @param db {Database}
 * @param message {string}
 * @returns {Promise<number>}
 */
const currency_prompt = async(db, message) => {
  /**
   * @param c {Currency}
   */
  const make_currency_option = (c) => {
    return {
      value: c.cur_id,
      label: `${c.cur_code} (${c.cur_name})`,
    }
  }
  const currencies = db.currencies().map(make_currency_option)
  return Number(await select({
    message,
    options: currencies
  }))
}

/**
 * @param message {string}
 * @returns {Promise<string>}
 */
const date_prompt = async (message) => {
  return String(await text({
    message,
    placeholder: (new Date()).toLocaleDateString(),
    initialValue: (new Date()).toLocaleDateString(),
    validate: (d) => {
      if (typeof d === 'undefined' || d === '') {
        return 'Please enter a date.'
      }
      const result = Date.parse(d)
      if (isNaN(result)) {
        return 'Please enter a valid date in YYYY-MM-DD format.'
      }
      return ''
    }
  }))
}

export {
  amount_prompt,
  currency_prompt,
  date_prompt,
}
