import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMoney, evaluateCase, validateCase } from '../lib/engine.js';
import { sampleCases, makeCase } from '../lib/data.js';

test('decimal parsing preserves cents and rejects ambiguous or unsafe values', () => {
  assert.equal(parseMoney('0.10'), 10);
  assert.equal(parseMoney('-10.05'), -1005);
  for (const v of ['', '1.001', 'NaN', '1e6', '9,000', '900719925474099.99'])
    assert.equal(parseMoney(v), null);
});
test('the sample calculation finds exactly the $15,000 discrepancy', () => {
  const e = evaluateCase(sampleCases()[0]);
  assert.equal(e.delivered, 40000000);
  assert.equal(e.expected, 10000000);
  assert.equal(e.variance, 1500000);
  assert.deepEqual(
    e.open.map((f) => f.id),
    ['payment-mismatch'],
  );
  assert.equal(e.state, 'needs-review');
});
test('a matching case awaits a human decision', () => {
  const c = sampleCases()[1];
  assert.equal(evaluateCase(c).state, 'ready');
  c.review = { revision: c.revision, decision: 'retain' };
  assert.equal(evaluateCase(c).state, 'reviewed');
  c.revision += 1;
  assert.equal(evaluateCase(c).state, 'ready');
});
test('missing evidence blocks completion, even with a resolution note', () => {
  const c = sampleCases()[3];
  c.resolutions['missing-payment'] = { note: 'We acknowledge that this source is unavailable.' };
  const e = evaluateCase(c);
  assert.equal(e.state, 'insufficient');
  assert.equal(e.paid, null);
  assert.equal(e.canComplete, false);
});
test('future performance and mixed clauses remain blocked', () => {
  for (const clauseType of ['mixed', 'performance', 'unconfirmed']) {
    const e = evaluateCase(makeCase({ clauseType }));
    assert(e.blocking.some((f) => f.id === 'clause'));
  }
});
test('source measurement date matters; later preparation date is allowed', () => {
  const c = makeCase();
  assert(!evaluateCase(c).findings.some((f) => f.id === 'balance-date'));
  c.balanceDate = '2026-10-16';
  assert(evaluateCase(c).blocking.some((f) => f.id === 'balance-date'));
});
test('empty included account does not silently become zero; excluded accounts do not affect totals', () => {
  const c = makeCase();
  c.accounts[0].amount = '';
  assert.equal(evaluateCase(c).delivered, null);
  c.accounts[0].included = false;
  assert.equal(evaluateCase(c).delivered, 12000000);
});
test('negative working capital is valid; buyer-to-seller adjustments are out of scope', () => {
  const c = makeCase();
  c.accounts = [
    { id: 'one', label: 'Payables', kind: 'liability', included: true, amount: '100.10', ref: 'B2' },
  ];
  c.target = '0.00';
  assert.equal(evaluateCase(c).expected, 10010);
  c.accounts[0].kind = 'asset';
  assert.equal(evaluateCase(c).expected, null);
  assert(evaluateCase(c).blocking.some((f) => f.id === 'surplus'));
});
test('a documented nonblocking exception can proceed; input edits must clear that note in the UI', () => {
  const c = sampleCases()[0];
  c.resolutions['payment-mismatch'] = {
    note: 'Sample explanation: the extra amount is separately documented.',
  };
  assert.equal(evaluateCase(c).canComplete, true);
});
test('overflow in aggregated amounts is blocked', () => {
  const c = makeCase();
  c.accounts = [1, 2].map((id) => ({
    id: String(id),
    label: 'Asset ' + id,
    kind: 'asset',
    included: true,
    amount: '90071992547409.91',
    ref: 'B' + id,
  }));
  assert.equal(evaluateCase(c).delivered, null);
  assert(evaluateCase(c).blocking.some((f) => f.id === 'range'));
});
test('imports reject invalid dates, unsupported currency and duplicate account IDs', () => {
  for (const edit of [
    (c) => (c.balanceDate = '2026-02-30'),
    (c) => (c.currency = 'EUR'),
    (c) => c.accounts.push(structuredClone(c.accounts[0])),
  ]) {
    const c = makeCase();
    edit(c);
    assert.throws(() => validateCase(c));
  }
  assert.equal(validateCase(makeCase()).id, 'CT-0261');
});
