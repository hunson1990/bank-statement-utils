# bank-statement-utils

[![npm version](https://img.shields.io/npm/v/bank-statement-utils.svg)](https://www.npmjs.com/package/bank-statement-utils)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Zero-dependency TypeScript utilities for turning bank CSV rows into a consistent
transaction shape. It handles common date formats, localized amounts,
debit/credit columns, header aliases, and running-balance checks.

For PDF-to-Excel and PDF-to-CSV conversion, visit
[Bank Statement Converter](https://bankstatementconverter.work/).

Published on npm as
[bank-statement-utils](https://www.npmjs.com/package/bank-statement-utils).

## Install

```bash
npm install bank-statement-utils
```

## Normalize a row

```ts
import { normalizeRow } from 'bank-statement-utils';

const transaction = normalizeRow(
  {
    'Transaction Date': '17/11/2026',
    Details: 'Coffee shop',
    Debit: '18.50',
    Credit: '',
    Balance: '981.50',
  },
  {
    dateFormat: 'DD/MM/YYYY',
    defaultCurrency: 'USD',
  },
);

// {
//   date: '2026-11-17',
//   description: 'Coffee shop',
//   amount: -18.5,
//   balance: 981.5,
//   currency: 'USD'
// }
```

## Map custom columns

```ts
import { normalizeRows } from 'bank-statement-utils';

const transactions = normalizeRows(rows, {
  mapping: {
    date: '交易日',
    description: '摘要',
    amount: '金额',
    balance: '余额',
  },
});
```

Each mapping accepts one header or an array of aliases. Custom aliases are
combined with the built-in English aliases.

## Validate balances

```ts
import { validateRunningBalances } from 'bank-statement-utils';

const issues = validateRunningBalances(transactions);
```

An issue is returned when `previous balance + current amount` does not match the
current balance within the specified tolerance.

## Scope

This package normalizes rows that have already been extracted from CSV or another
source. It does not read PDFs, perform OCR, or identify banks. Those operations
need format-specific extraction logic.

## License

MIT
