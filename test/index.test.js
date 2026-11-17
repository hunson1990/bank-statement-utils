import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeRow,
  normalizeRows,
  parseAmount,
  parseDate,
  validateRunningBalances,
} from '../dist/index.js';

test('parses common amount formats', () => {
  assert.equal(parseAmount('$1,234.56'), 1234.56);
  assert.equal(parseAmount('1.234,56 EUR'), 1234.56);
  assert.equal(parseAmount('(42.10)'), -42.1);
  assert.equal(parseAmount('99.00 DR'), -99);
});

test('parses explicit date formats safely', () => {
  assert.equal(parseDate('17/11/2026', 'DD/MM/YYYY'), '2026-11-17');
  assert.equal(parseDate('11/17/2026', 'MM/DD/YYYY'), '2026-11-17');
  assert.equal(parseDate('2026-02-30'), undefined);
});

test('normalizes debit and credit columns', () => {
  assert.deepEqual(
    normalizeRow(
      {
        'Transaction Date': '17/11/2026',
        Details: 'Coffee shop',
        Debit: '18.50',
        Credit: '',
        Balance: '981.50',
      },
      { dateFormat: 'DD/MM/YYYY', defaultCurrency: 'usd' },
    ),
    {
      date: '2026-11-17',
      description: 'Coffee shop',
      amount: -18.5,
      balance: 981.5,
      currency: 'USD',
    },
  );
});

test('supports custom headers and skips invalid rows', () => {
  const rows = normalizeRows(
    [
      { '交易日': '2026-11-17', '摘要': '转账收入', '金额': '500.00' },
      { '交易日': '', '摘要': '无日期', '金额': '10.00' },
    ],
    { mapping: { date: '交易日', description: '摘要', amount: '金额' } },
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].amount, 500);
});

test('reports broken running balances', () => {
  const issues = validateRunningBalances([
    { date: '2026-11-16', description: 'Opening item', amount: 0, balance: 100 },
    { date: '2026-11-17', description: 'Purchase', amount: -20, balance: 90 },
  ]);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].expected, 80);
});
