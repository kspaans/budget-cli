# Budget Expenses Entry CLI

A tool to help speed up your budgeting and expense entry using the Clack CLI
framework, SQLite, and Node.js.

## Getting Started

To get started, install Node.js v25 or higher. Then run:

```
npm install
cp .accounts.sample .accounts.json
node index.mjs
```

Then simply follow the prompts. Expense entry (`e`) is the most thorough. The
`.ledger.db` file saves your recorded transactions between sessions.

### Accounts

If you'd like to customize the account names and prompts, edit the
`.accounts.json` file.

## See Also

This tool outputs the [Ledger][0] file format. It is a double-entry accounting
enging using plaintext files and a CLI tool. You can install the Ledger
executable and then run e.g. a balance report using `ledger -f expenses.dat bal`

[0]: https://ledger-cli.org
