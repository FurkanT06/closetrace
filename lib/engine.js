const MAX = BigInt(Number.MAX_SAFE_INTEGER);
const DOCS = ['agreement', 'balance', 'adjustment', 'payment'];
export const DOC_LABELS = {
  agreement: 'Purchase agreement',
  balance: 'Closing balance sheet',
  adjustment: 'Adjustment statement',
  payment: 'Payment evidence',
};

export function parseMoney(value) {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value).trim();
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(s)) return null;
  const negative = s.startsWith('-');
  const parts = s.replace(/^-/, '').split('.');
  const n = BigInt(parts[0]) * 100n + BigInt((parts[1] || '').padEnd(2, '0'));
  if (n > MAX) return null;
  return Number(negative ? -n : n);
}

export function money(cents, decimals = false) {
  if (cents === null || cents === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals || cents % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function safe(n) {
  return n > MAX || n < -MAX ? null : Number(n);
}
function isoDate(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v || '')) return false;
  const d = new Date(v + 'T00:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
}
function requiredString(v, label, max = 200) {
  if (typeof v !== 'string' || !v.trim() || v.length > max)
    throw new Error(label + ' is missing or too long.');
}
function optionalMoney(v, label) {
  if (v !== '' && v !== null && parseMoney(v) === null)
    throw new Error(label + ' must be a decimal amount with at most two decimal places.');
}
export function validateCase(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) throw new Error('A case object is required.');
  requiredString(c.id, 'Case ID', 80);
  requiredString(c.name, 'Business name', 120);
  requiredString(c.buyer, 'Buyer', 160);
  requiredString(c.seller, 'Seller', 160);
  if (c.currency !== 'USD') throw new Error('This prototype supports USD cases only.');
  if (!isoDate(c.closingDate) || !isoDate(c.measurementDate) || !isoDate(c.balanceDate))
    throw new Error('Use valid dates in YYYY-MM-DD format.');
  optionalMoney(c.target, 'Working capital target');
  optionalMoney(c.statementAmount, 'Adjustment statement amount');
  if (parseMoney(c.statementAmount) < 0) throw new Error('Use a nonnegative seller refund amount.');
  if (!['closing', 'mixed', 'performance', 'unconfirmed'].includes(c.clauseType))
    throw new Error('Unknown payment term type.');
  if (typeof c.mappingConfirmed !== 'boolean' || typeof c.policyConfirmed !== 'boolean')
    throw new Error('Confirmation fields must be true or false.');
  if (!Array.isArray(c.accounts) || !c.accounts.length || c.accounts.length > 100)
    throw new Error('Provide between 1 and 100 balance sheet accounts.');
  const ids = new Set();
  for (const a of c.accounts) {
    requiredString(a.id, 'Account ID', 80);
    if (ids.has(a.id)) throw new Error('Duplicate account ID: ' + a.id);
    ids.add(a.id);
    requiredString(a.label, 'Account label', 160);
    requiredString(a.ref, 'Account source reference', 120);
    if (!['asset', 'liability'].includes(a.kind) || typeof a.included !== 'boolean')
      throw new Error('Each account needs an asset/liability type and inclusion flag.');
    optionalMoney(a.amount, a.label);
  }
  if (!c.payment || typeof c.payment !== 'object') throw new Error('Provide a payment record.');
  optionalMoney(c.payment.amount, 'Payment amount');
  if (parseMoney(c.payment.amount) < 0) throw new Error('Seller refund amounts must be nonnegative.');
  if (typeof c.payment.from !== 'string' || typeof c.payment.to !== 'string')
    throw new Error('Provide payment counterparties.');
  for (const k of DOCS) {
    const d = c.documents?.[k];
    if (!d || typeof d.available !== 'boolean' || typeof d.text !== 'string' || d.text.length > 200000)
      throw new Error('Invalid ' + DOC_LABELS[k] + ' document.');
    requiredString(d.title, 'Document title', 200);
  }
  if (!Number.isInteger(c.revision) || c.revision < 1)
    throw new Error('A positive case revision is required.');
  return structuredClone(c);
}

export function evaluateCase(c) {
  const findings = [];
  const add = (id, title, detail, source, blocking = false, missing = false) => {
    const note = typeof c.resolutions?.[id]?.note === 'string' ? c.resolutions[id].note : '';
    findings.push({
      id,
      title,
      detail,
      source,
      blocking,
      missing,
      resolved: !blocking && note.trim().length >= 10,
      note,
    });
  };
  for (const k of DOCS)
    if (!c.documents?.[k]?.available || !c.documents[k].text.trim())
      add(
        'missing-' + k,
        DOC_LABELS[k] + ' missing',
        'Add the source exhibit before recording a completed review.',
        k,
        true,
        true,
      );
  if (!c.mappingConfirmed)
    add(
      'mapping',
      'Account mapping unconfirmed',
      'Confirm which accounts the purchase agreement includes in working capital.',
      'balance',
      true,
    );
  if (!c.policyConfirmed)
    add(
      'policy',
      'Governing policy unconfirmed',
      'A reviewer must confirm the governing policy and loan-file applicability.',
      'agreement',
      true,
    );
  if (c.clauseType !== 'closing')
    add(
      'clause',
      c.clauseType === 'mixed'
        ? 'Mixed payment terms'
        : c.clauseType === 'performance'
          ? 'Performance-based payment term'
          : 'Payment terms unconfirmed',
      'This calculation covers closing-date working-capital refunds. Separate future-performance components and refer the classification for specialist review.',
      'agreement',
      true,
    );
  if (c.balanceDate !== c.measurementDate)
    add(
      'balance-date',
      'Balance sheet date differs',
      'The balance sheet measures ' +
        c.balanceDate +
        '; the agreement specifies ' +
        c.measurementDate +
        '. A later preparation date alone is not a discrepancy.',
      'balance',
      true,
    );
  let total = 0n;
  let incomplete = false;
  for (const a of c.accounts) {
    if (!a.included) continue;
    const n = parseMoney(a.amount);
    if (n === null) {
      incomplete = true;
      add(
        'amount-' + a.id,
        'Missing amount: ' + a.label,
        'Enter an amount supported by the closing balance sheet.',
        'balance',
        true,
        true,
      );
    } else total += BigInt(n) * (a.kind === 'asset' ? 1n : -1n);
  }
  const delivered = incomplete ? null : safe(total);
  if (!incomplete && delivered === null)
    add(
      'range',
      'Calculation exceeds supported range',
      'Reduce the amount range or use a specialist calculation before continuing.',
      'balance',
      true,
    );
  const target = parseMoney(c.target);
  if (target === null)
    add(
      'target',
      'Working capital target missing',
      'Confirm the contractual target and add the amount.',
      'agreement',
      true,
      true,
    );
  const difference = target !== null && delivered !== null ? safe(BigInt(target) - BigInt(delivered)) : null;
  if (target !== null && delivered !== null && difference === null)
    add(
      'difference-range',
      'Adjustment exceeds supported range',
      'The adjustment cannot be represented safely in this prototype.',
      'adjustment',
      true,
    );
  if (difference !== null && difference < 0)
    add(
      'surplus',
      'Buyer-to-seller adjustment',
      'Delivered working capital exceeds the target by ' +
        money(-difference) +
        '. This prototype reviews seller-to-buyer refunds only.',
      'adjustment',
      true,
    );
  const expected = difference !== null && difference >= 0 ? difference : null;
  const statement = parseMoney(c.statementAmount);
  if (statement === null)
    add(
      'statement',
      'Adjustment amount missing',
      'Add the refund amount claimed on the adjustment statement.',
      'adjustment',
      true,
      true,
    );
  if (expected !== null && statement !== null && expected !== statement)
    add(
      'statement-mismatch',
      'Adjustment calculation differs',
      'The statement claims ' +
        money(statement) +
        '; the entered contract and balances produce ' +
        money(expected) +
        '.',
      'adjustment',
    );
  const paid = c.documents?.payment?.available ? parseMoney(c.payment.amount) : null;
  if (c.documents?.payment?.available && paid === null)
    add(
      'payment-amount',
      'Payment amount missing',
      'Add the amount shown by payment evidence.',
      'payment',
      true,
      true,
    );
  if (paid !== null && expected !== null && paid !== expected)
    add(
      'payment-mismatch',
      'Payment does not reconcile',
      'Payment evidence shows ' +
        money(paid) +
        '; the calculated refund is ' +
        money(expected) +
        '. The ' +
        money(Math.abs(paid - expected)) +
        ' difference needs an explanation.',
      'payment',
    );
  const same = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
  if (c.documents?.payment?.available && (!same(c.payment.from, c.seller) || !same(c.payment.to, c.buyer)))
    add(
      'counterparty',
      'Payment counterparties differ',
      'The entered payment payer or payee differs from the named seller and buyer. Confirm the relationship in the evidence.',
      'payment',
    );
  const open = findings.filter((f) => !f.resolved);
  const blocking = open.filter((f) => f.blocking);
  const canComplete = open.length === 0;
  let state = open.some((f) => f.missing) ? 'insufficient' : open.length ? 'needs-review' : 'ready';
  if (c.review?.revision === c.revision && c.review?.decision === 'escalate') state = 'escalated';
  else if (
    canComplete &&
    c.review?.revision === c.revision &&
    ['retain', 'principal'].includes(c.review?.decision)
  )
    state = 'reviewed';
  return {
    delivered,
    target,
    expected,
    paid,
    statement,
    variance: paid !== null && expected !== null ? safe(BigInt(paid) - BigInt(expected)) : null,
    findings,
    open,
    blocking,
    canComplete,
    state,
    sourceCount: DOCS.filter((k) => c.documents?.[k]?.available && c.documents[k].text.trim()).length,
  };
}

export const STATE_LABELS = {
  'needs-review': 'Needs review',
  insufficient: 'Evidence missing',
  ready: 'Ready for decision',
  reviewed: 'Reviewed',
  escalated: 'Escalated',
};
