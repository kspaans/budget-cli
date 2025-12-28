import { text } from '@clack/prompts'

const amount_prompt = async (message) => {
  return text({
    message,
    placeholder: "12.34",
    validate: (value) => {
      const num = Number(value)
      if (isNaN(value) || typeof value === 'undefined' || value === '') {
        return 'Please enter a number.'
      }
    }
  })
}

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
      if (isNaN(result) || result === 'Invalid Date') {
        return 'Please enter a valid date in YYYY-MM-DD format.'
      }
    }
  })
}

export {
  amount_prompt,
  date_prompt,
}
