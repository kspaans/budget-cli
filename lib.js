import { select, text } from '@clack/prompts'

import db from './db.mjs'

// returns decimal "dollars"
/**
 * @return number
 */
const amount_prompt = async (message) => {
  return text({
    message,
    placeholder: "12.34",
    validate: (value) => {
      const num = Number(value)
      if (typeof value === 'undefined' || isNaN(num) || value === '') {
        return 'Please enter a number.'
      }
      return ''
    }
  })
}

const currency_prompt = async(message) => {
  const currencies = db.db.currencies().map(c => {
    return {
      value: c.cur_id,
      label: `${c.cur_code} (${c.cur_name})`,
    }
  })
  return await select({
    message,
    options: currencies
  })
}

/**
 * @returns string
 */
const date_prompt = async (message) => {
  return await text({
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
  })
}

export {
  amount_prompt,
  currency_prompt,
  date_prompt,
}
