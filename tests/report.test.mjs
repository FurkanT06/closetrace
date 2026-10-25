import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewReport } from '../lib/report-template.js';
import { sampleCases } from '../lib/data.js';
test('the report includes the reconciled amounts, all four exhibits and unreviewed state', () => {
  const html = reviewReport(sampleCases()[0]);
  assert(html.includes('$15,000'));
  assert(html.includes('$100,000'));
  assert(html.includes('$115,000'));
  assert(html.includes('No current reviewer decision recorded.'));
  for (const phrase of [
    'ASSET PURCHASE AGREEMENT',
    'Trade receivables',
    'PURCHASE PRICE ADJUSTMENT',
    'SAMPLE TRANSFER CONFIRMATION',
  ])
    assert(html.includes(phrase));
});
test('untrusted case text is escaped in printable exports', () => {
  const c = sampleCases()[0];
  c.name = '<script>alert("test")</script>';
  c.documents.payment.text = '<img src=x onerror=alert(1)>';
  const html = reviewReport(c);
  assert(!html.includes('<script>'));
  assert(!html.includes('<img src=x'));
  assert(html.includes('&lt;script&gt;'));
  assert(html.includes('&lt;img'));
});
