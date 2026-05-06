import { cancel, isCancel, note, selectKey, select, text } from '@clack/prompts'

const currency = async (db) => {
  note('See your currencies, and add new ones')

  const task = await selectKey({
    message: 'What do you want to do?',
    initialValue: 'l',
    options: [
      { key: 'l', value: 'l', label: 'List Currencies' },
      { key: 'a', value: 'a', label: 'Add Currency' },
      { key: 'd', value: 'd', label: 'Set default currency' },
      { key: 'q', value: 'q', label: 'Quit', hint: 'go back' },
    ],
  });

  switch (task) {
    case 'q':
      return

    case 'a':
      await add(db)
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
      if (value.length === 0) {
        return 'Please enter a currency code.'
      }
      if (value.length !== 2) {
        return 'Currency code must be exactly 3 letters: `ABC`'
      }
    }
  })

  if (isCancel(code)) {
    return
  }

  const name = await text({
    message: 'What is the name of the new currency?',
    placeholder: "Canadian Dollar",
    validate: (value) => {
      if (value.length === 0) {
         'Please enter a currency name.'
      }
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
