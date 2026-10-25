import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleCases } from '../lib/data.js';
import {
  applyUploadedSource,
  portfolioSamples,
  blankCase,
  normalizeCase,
  prepareCaseUpdate,
} from '../lib/case-model.js';
import { evaluateCase } from '../lib/engine.js';
const actor = 'reviewer@example.test';
test('canonicalization preserves an unchanged financial revision when explaining a sample exception', () => {
  const c = portfolioSamples()[0];
  const next = structuredClone(c);
  next.resolutions['payment-mismatch'] = {
    note: 'Separately supported non-working-capital amount, confirmed in the source.',
  };
  const saved = prepareCaseUpdate(c, next, actor, 'resolve').caseData;
  assert.equal(saved.revision, 1);
  assert.equal(evaluateCase(saved).canComplete, true);
  assert.equal(evaluateCase(saved).variance, 1500000);
});
test('changing the payment invalidates explanations and the previous reviewer decision', () => {
  const c = portfolioSamples()[1];
  c.review = {
    decision: 'retain',
    revision: 1,
    reviewer: actor,
    at: '2026-10-24T00:00:00Z',
    rationale: 'Reviewed and confirmed in the source records.',
  };
  c.resolutions = { counterparty: { note: 'A prior counterparty explanation.' } };
  const next = structuredClone(c);
  next.payment.amount = '95000.00';
  const saved = prepareCaseUpdate(c, next, actor, 'edit').caseData;
  assert.equal(saved.revision, 2);
  assert.equal(saved.review, null);
  assert.deepEqual(saved.resolutions, {});
  assert.equal(evaluateCase(saved).variance, -500000);
});
test('owner labels, deadlines and comments preserve a completed financial review', () => {
  const c = portfolioSamples()[4];
  const next = { ...c, assignee: 'QC reviewer', dueDate: '2026-11-03' };
  const saved = prepareCaseUpdate(c, next, actor, 'metadata').caseData;
  assert.equal(saved.revision, c.revision);
  assert.deepEqual(saved.review, c.review);
  const note = prepareCaseUpdate(
    saved,
    { ...saved, notes: [{ text: 'Follow up on the closing package.' }] },
    actor,
    'note',
  ).caseData;
  assert.equal(note.notes[0].author, actor);
  assert.equal(note.review.decision, 'retain');
});
test('completion is enforced independently of the client; escalation is available with open checks', () => {
  const c = portfolioSamples()[2];
  const attempt = {
    ...c,
    review: { decision: 'retain', rationale: 'The reviewer claims this is complete.', revision: 1 },
  };
  assert.throws(() => prepareCaseUpdate(c, attempt, actor, 'decision'), /open checks/);
  attempt.review.decision = 'escalate';
  attempt.review.reviewer = 'Forged identity';
  attempt.review.at = '2000-01-01';
  const saved = prepareCaseUpdate(c, attempt, actor, 'decision', '2026-10-24T15:00:00Z').caseData;
  assert.equal(saved.review.reviewer, actor);
  assert.equal(saved.review.at, '2026-10-24T15:00:00Z');
  assert.equal(evaluateCase(saved).state, 'escalated');
});
test('blank live cases do not come with fabricated evidence or confirmations', () => {
  const c = blankCase({ name: 'A business', buyer: 'Buyer LLC', seller: 'Seller LLC' });
  const e = evaluateCase(c);
  assert.equal(e.sourceCount, 0);
  assert.equal(c.policyConfirmed, false);
  assert.equal(c.mappingConfirmed, false);
  assert.equal(e.canComplete, false);
  assert.equal(c.accounts[0].amount, '');
  assert.equal(c.sample, false);
});
test('import normalization restricts explanations to actual nonblocking checks', () => {
  const c = sampleCases()[0];
  c.resolutions = {
    policy: { note: 'This should never override required policy confirmation.' },
    'payment-mismatch': { note: 'A sufficiently documented payment difference.' },
  };
  const n = normalizeCase(c);
  assert(!n.resolutions.policy);
  assert(n.resolutions['payment-mismatch']);
});
test('all six example cases produce the portfolio counts shown to a reviewer', () => {
  const evaluated = portfolioSamples().map(evaluateCase);
  assert.equal(evaluated.filter((e) => e.state === 'reviewed').length, 2);
  assert.equal(evaluated.filter((e) => e.state === 'ready').length, 1);
  assert.equal(
    evaluated.reduce((sum, e) => sum + e.sourceCount, 0),
    23,
  );
});

test('a PDF upload never erases an excerpt the reviewer already entered', () => {
  const c = portfolioSamples()[0];
  const before = structuredClone(c.documents.payment);
  assert(before.available && before.text.trim());
  applyUploadedSource(c, 'payment', { name: 'wire.pdf', ext: 'pdf' });
  assert.deepEqual(c.documents.payment, before);
});
test('a PDF without an excerpt is unavailable until the reviewer enters one', () => {
  const c = blankCase();
  applyUploadedSource(c, 'payment', { name: 'wire.pdf', ext: 'pdf' });
  assert.equal(c.documents.payment.title, 'wire.pdf');
  assert.equal(c.documents.payment.available, false);
  assert.equal(c.documents.payment.text, '');
});
test('TXT and CSV uploads supply the source excerpt', () => {
  const c = blankCase();
  applyUploadedSource(c, 'balance', { name: 'balances.csv', ext: 'csv', text: 'Cash,100.00\n' });
  assert.equal(c.documents.balance.type, 'csv');
  assert.equal(c.documents.balance.available, true);
  applyUploadedSource(c, 'agreement', { name: 'terms.txt', ext: 'txt', text: 'Target: 10.00' });
  assert.equal(c.documents.agreement.type, 'text');
  assert.equal(c.documents.agreement.text, 'Target: 10.00');
});
test('uploads to an unknown source category are rejected', () => {
  const upload = { name: 'x.txt', ext: 'txt', text: 'x' };
  assert.throws(() => applyUploadedSource(blankCase(), 'constructor', upload), /source category/);
});
test('attaching a PDF original keeps the revision and the reviewer decision', () => {
  const existing = portfolioSamples()[1];
  existing.review = {
    decision: 'retain',
    revision: existing.revision,
    reviewer: actor,
    at: '2026-10-24T00:00:00Z',
    rationale: 'Reviewed and confirmed in the source records.',
  };
  const next = structuredClone(existing);
  applyUploadedSource(next, 'payment', { name: 'wire.pdf', ext: 'pdf' });
  const saved = prepareCaseUpdate(existing, next, actor, 'evidence').caseData;
  assert.equal(saved.revision, existing.revision);
  assert.equal(saved.review.decision, 'retain');
});
