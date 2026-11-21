import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const { formatItem } = await import(pathToFileURL(path.join(process.cwd(), 'format.mjs')));
const item = { name: 'Tea', price: 2.5 };

test('existing callers and explicit undefined keep exact legacy output', () => {
  assert.equal(formatItem(item), 'Tea: 2.50');
  assert.equal(formatItem(item, undefined), 'Tea: 2.50');
  assert.equal(formatItem(item, {}), 'Tea: 2.50');
  assert.equal(formatItem({ name: 'Free', price: 0 }), 'Free: 0.00');
});

test('optional currency changes only the suffix', () => {
  assert.equal(formatItem(item, { currency: 'IDR' }), 'Tea: 2.50 IDR');
  assert.equal(formatItem(item, { currency: 'JPY' }), 'Tea: 2.50 JPY');
});
