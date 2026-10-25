import { uuid } from './ids.js';
import { validateCase, evaluateCase, DOC_LABELS } from './engine.js';
import { sampleCases, makeCase } from './data.js';

export const CASE_ACTIONS = {
  create: 'Review created',
  edit: 'Review inputs updated',
  evidence: 'Evidence added',
  resolve: 'Exception documented',
  decision: 'Reviewer decision recorded',
  note: 'Comment added',
  metadata: 'Review details updated',
};
export const financialSnapshot = (c) =>
  JSON.stringify([
    c.name,
    c.buyer,
    c.seller,
    c.target,
    c.statementAmount,
    c.closingDate,
    c.measurementDate,
    c.balanceDate,
    c.clauseType,
    c.policyConfirmed,
    c.mappingConfirmed,
    c.accounts,
    c.payment,
    c.documents,
  ]);
const short = (v, max = 160) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
export function normalizeCase(input) {
  const valid = validateCase(input);
  if (!/^CT-[A-Za-z0-9-]{1,70}$/.test(valid.id)) throw new Error('Use a CloseTrace case ID.');
  const docs = Object.fromEntries(
    Object.keys(DOC_LABELS).map((k) => [
      k,
      {
        title: valid.documents[k].title,
        available: valid.documents[k].available,
        type: valid.documents[k].type === 'csv' ? 'csv' : 'text',
        ref: short(valid.documents[k].ref, 120),
        text: valid.documents[k].text,
      },
    ]),
  );
  const resolutions = {};
  for (const f of evaluateCase({ ...valid, resolutions: {} }).findings) {
    const note = short(valid.resolutions?.[f.id]?.note, 4000);
    if (!f.blocking && note.length >= 10) resolutions[f.id] = { note };
  }
  const review =
    valid.review && ['retain', 'principal', 'escalate'].includes(valid.review.decision)
      ? {
          decision: valid.review.decision,
          rationale: short(valid.review.rationale, 6000),
          reviewer: short(valid.review.reviewer),
          at: short(valid.review.at, 40),
          revision: valid.review.revision,
        }
      : null;
  return {
    id: valid.id,
    name: valid.name.trim(),
    buyer: valid.buyer.trim(),
    seller: valid.seller.trim(),
    industry: short(valid.industry) || 'Acquisition',
    currency: 'USD',
    closingDate: valid.closingDate,
    measurementDate: valid.measurementDate,
    balanceDate: valid.balanceDate,
    target: valid.target,
    statementAmount: valid.statementAmount,
    clauseType: valid.clauseType,
    policyConfirmed: valid.policyConfirmed,
    mappingConfirmed: valid.mappingConfirmed,
    accounts: valid.accounts.map((a) => ({
      id: a.id,
      label: a.label,
      kind: a.kind,
      amount: a.amount,
      included: a.included,
      ref: a.ref,
    })),
    payment: {
      amount: valid.payment.amount,
      from: short(valid.payment.from, 160),
      to: short(valid.payment.to, 160),
    },
    documents: docs,
    revision: valid.revision,
    resolutions,
    review,
    manual: Boolean(valid.manual),
    sample: Boolean(valid.sample),
    assignee: short(valid.assignee) || 'You',
    dueDate: /^\d{4}-\d{2}-\d{2}$/.test(valid.dueDate || '') ? valid.dueDate : '',
    notes: Array.isArray(valid.notes)
      ? valid.notes
          .slice(-200)
          .filter((n) => typeof n.text === 'string')
          .map((n) => ({
            id: short(n.id, 80),
            text: short(n.text, 4000),
            author: short(n.author),
            at: short(n.at, 40),
          }))
      : [],
    audit: Array.isArray(valid.audit)
      ? valid.audit
          .slice(-300)
          .filter((a) => typeof a.title === 'string')
          .map((a) => ({ at: short(a.at, 40), title: short(a.title), detail: short(a.detail, 4000) }))
      : [],
    attachments: Array.isArray(valid.attachments) ? valid.attachments : [],
    _version: Number.isInteger(valid._version) ? valid._version : 0,
  };
}

export function prepareCaseUpdate(existing, input, actor, action, now = new Date().toISOString()) {
  if (!CASE_ACTIONS[action]) throw new Error('Unknown review action.');
  const c = normalizeCase(input);
  if (existing && existing.id !== c.id) throw new Error('Case ID cannot change.');
  const changed = existing && financialSnapshot(normalizeCase(existing)) !== financialSnapshot(c);
  if (!existing || changed) {
    c.revision = existing ? existing.revision + 1 : 1;
    c.resolutions = {};
    c.review = null;
  } else {
    c.revision = existing.revision;
    c.review = existing.review;
    if (action !== 'resolve') c.resolutions = existing.resolutions;
    if (action === 'resolve') {
      for (const f of evaluateCase(c).findings.filter((f) => f.resolved))
        c.resolutions[f.id] = { note: f.note, reviewer: actor, at: now };
    }
    if (action === 'decision') {
      const review = normalizeCase(input).review;
      if (!review || review.rationale.length < 10)
        throw new Error('Add a rationale of at least 10 characters.');
      if (review.decision !== 'escalate' && !evaluateCase(c).canComplete)
        throw new Error('Address the open checks before completing this review.');
      c.review = { ...review, reviewer: actor, revision: c.revision, at: now };
    }
  }
  c.notes = existing?.notes || [];
  if (action === 'note') {
    const proposed = normalizeCase(input).notes.at(-1);
    if (!proposed?.text) throw new Error('Write a comment first.');
    c.notes = [...c.notes, { id: uuid(), text: proposed.text, author: actor, at: now }].slice(-200);
  }
  const detail = changed
    ? 'Calculation inputs changed. Previous explanations and decisions were cleared.'
    : action === 'decision'
      ? c.review.rationale
      : action === 'note'
        ? c.notes.at(-1).text
        : action === 'resolve'
          ? 'A reviewer recorded an explanation for a nonblocking difference.'
          : action === 'metadata'
            ? 'Assignment or due date updated.'
            : 'Source records and review details saved.';
  c.audit = [...(existing?.audit || []), { at: now, title: CASE_ACTIONS[action], detail }].slice(-300);
  return { caseData: c, event: { title: CASE_ACTIONS[action], detail, actor, at: now } };
}

// Records an uploaded original on a case. TXT and CSV uploads supply the source excerpt. A PDF cannot
// (there is no text extraction), so it must never erase an excerpt a reviewer already entered.
// The server and the demo workspace both call this so they cannot drift apart.
export function applyUploadedSource(c, category, { name, ext, text = '' }) {
  if (!Object.hasOwn(DOC_LABELS, category)) throw new Error('Choose a document and its source category.');
  const current = c.documents[category];
  if (ext === 'pdf' && current?.available && current.text.trim()) return c;
  c.documents[category] = {
    title: name,
    text,
    available: Boolean(text.trim()),
    type: ext === 'csv' ? 'csv' : 'text',
    ref: 'Uploaded source',
  };
  return c;
}

export function portfolioSamples() {
  const extras = [
    makeCase({
      id: 'CT-0265',
      name: 'Juniper Dental Group',
      buyer: 'Juniper Acquisition LLC',
      seller: 'Juniper Dental Holdings',
      industry: 'Healthcare',
      target: '250000.00',
      statementAmount: '0.00',
      accounts: [
        {
          id: 'ar',
          label: 'Trade receivables',
          kind: 'asset',
          amount: '300000.00',
          included: true,
          ref: 'B2',
        },
        {
          id: 'ap',
          label: 'Trade payables',
          kind: 'liability',
          amount: '50000.00',
          included: true,
          ref: 'B3',
        },
      ],
      payment: { amount: '0.00', from: 'Juniper Dental Holdings', to: 'Juniper Acquisition LLC' },
    }),
    makeCase({
      id: 'CT-0266',
      name: 'Evergreen Home Care',
      buyer: 'Evergreen Acquisition LLC',
      seller: 'Evergreen Founders LLC',
      industry: 'Home services',
    }),
  ];
  extras.forEach((c) => {
    c.review = {
      decision: 'retain',
      reviewer: 'Demo reviewer',
      rationale:
        'Fictional review: the entered closing balances and seller payment reconcile to the agreed working-capital target.',
      revision: 1,
      at: '2026-10-23T15:00:00Z',
    };
    c.audit.push({
      at: '2026-10-23T15:00:00Z',
      title: 'Reviewer decision recorded',
      detail: 'Sample review completed with the supporting calculation and exhibits.',
    });
  });
  return [...sampleCases(), ...extras].map((c, i) => ({
    ...c,
    sample: true,
    dueDate: ['2026-10-28', '2026-10-29', '2026-10-30', '2026-11-02', '2026-10-23', '2026-10-23'][i],
    assignee: 'You',
    notes: [],
    attachments: [],
    _version: 0,
  }));
}

export function blankCase(values = {}) {
  const c = makeCase({
    id: 'CT-' + uuid().slice(0, 8).toUpperCase(),
    name: '',
    buyer: '',
    seller: '',
    industry: '',
    closingDate: new Date().toISOString().slice(0, 10),
    measurementDate: new Date().toISOString().slice(0, 10),
    balanceDate: new Date().toISOString().slice(0, 10),
    target: '',
    statementAmount: '',
    policyConfirmed: false,
    mappingConfirmed: false,
    clauseType: 'unconfirmed',
    payment: { amount: '', from: '', to: '' },
    manual: true,
    audit: [],
    notes: [],
    resolutions: {},
    review: null,
    ...values,
  });
  c.accounts = c.accounts.map((a) => ({ ...a, amount: '' }));
  c.documents = Object.fromEntries(
    Object.entries(DOC_LABELS).map(([k, title]) => [
      k,
      { title, available: false, text: '', type: 'text', ref: '' },
    ]),
  );
  c.sample = false;
  c.assignee = 'You';
  c.dueDate = '';
  c.attachments = [];
  return c;
}
