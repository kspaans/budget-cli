import { autocomplete, cancel, isCancel, note, selectKey, select, text } from '@clack/prompts'

import { amount_prompt, currency_prompt, date_prompt } from './lib.js'

const currency = async (db, config) => {
  note('See your currencies, and add new ones')

  const task = await selectKey({
    message: 'What do you want to do?',
    initialValue: 'l',
    options: [
      { value: 'l', label: 'List Currencies' },
      { value: 'a', label: 'Add Currency' },
      { value: 'e', label: 'Exchange Currency' },
      { value: 'd', label: 'Set default currency' },
      { value: 'q', label: 'Quit', hint: 'go back' },
    ],
  });

  switch (task) {
    case 'q':
      return

    case 'a':
      await add(db)
      break

    case 'e':
      await exchange(db, config)
      break

    case 'l':
      await list(db)
      break
  }
}

const add = async (db) => {
  const code = await text({
    message: 'What is the code of the new currency?',
    placeholder: "CAD",
    validate: (value) => {
      if (typeof value === 'undefined' || value.length === 0) {
        return 'Please enter a currency code.'
      }
      if (value.length !== 2) {
        return 'Currency code must be exactly 3 letters: `ABC`'
      }
      return ''
    }
  })

  if (isCancel(code)) {
    return
  }

  const name = await text({
    message: 'What is the name of the new currency?',
    placeholder: "Canadian Dollar",
    validate: (value) => {
      if (typeof value === 'undefined' || value.length === 0) {
         return 'Please enter a currency name.'
      }
      return ''
    }
  })

  if (isCancel(name)) {
    return
  }

  const isDefault = await select({
    message: 'Make it the default currency?',
    options: [
      { "value": "y", "label": "Yes" },
      { "value": "n", "label": "No" },
    ]
  })

  if (isCancel(isDefault)) {
    return
  }

  db.insert_currency(code, name, isDefault === 'y')
  return
}

const exchange = async (db, config) => {
  const date = await date_prompt('When does the exchange happen?')

  if (isCancel(date)) {
    return
  }

  const account = await autocomplete({
    message: 'Which account would you like to exchange from?',
    options: config.asset_accounts,
  })

  if (isCancel(account)) {
    return
  }

  const from_amount = await amount_prompt(
    'How much would you like to exchange?'
  )

  if (isCancel(from_amount)) {
    return
  }

  const from_currency = await currency_prompt('From which currency?')

  if (isCancel(from_currency)) {
    return
  }

  const fx_amount = await amount_prompt('And exchange for how much?')

  if (isCancel(fx_amount)) {
    return
  }

  const to_currency = await currency_prompt('To which currency?')

  if (isCancel(to_currency)) {
    return
  }

  db.exec(`BEGIN TRANSACTION`)
  //
  const tx_id = db.insert_tx(date, 'Exchange', null, null, null, 1, null).lastInsertRowid
  db.insert_posting(-from_amount, account, tx_id, from_currency)
  db.insert_posting(fx_amount,   account, tx_id, to_currency )
  db.exec(`COMMIT`)
  return
}

const list = async (db) => {
  const currencies = db.currencies()
  if (currencies.length === 0) {
    cancel('No currencies available. Please add a currency.')
  } else {
    let cs = []
    for await (const c of db.currencies()) {
      const { cur_count: x } = db.count_currency(c.cur_id)
      const { cur_id: default_currency } = db.default_currency()
      cs.push(`Currency ${c.cur_code}, Default? ${(c.cur_id === default_currency) ? 'Yes' : ' No'}, Used in ${String(x).padStart(4, ' ')} transactions (${c.cur_name})`)
    }
    note(cs.join('\n'))
  }
}

export default currency
