import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sum } from './totals.mjs';

test('the sum of an empty list is zero', () => assert.equal(sum([]), 0));
test('mixed signs and single values retain their result', () => {
  assert.equal(sum([1, 2, -3, 7]), 7);
  assert.equal(sum([-8]), -8);
});
