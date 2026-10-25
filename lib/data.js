export function documents(c) {
  return {
    agreement: {
      title: 'Purchase agreement',
      type: 'text',
      available: true,
      ref: 'Section 2.4',
      text: [
        'FICTIONAL EXHIBIT — FOR PRODUCT DEMONSTRATION',
        'ASSET PURCHASE AGREEMENT',
        'Seller: ' + c.seller,
        'Buyer: ' + c.buyer,
        'Closing: ' + c.closingDate,
        '',
        'Section 2.4 — Working capital adjustment',
        'The target working capital is USD ' +
          c.target +
          '. Working capital is measured as of ' +
          c.measurementDate +
          '.',
        'Eligible accounts: trade receivables, inventory and prepaid operating costs, less trade payables and accrued operating expenses. Cash and acquisition debt are excluded.',
        'If delivered working capital is below the target, Seller shall pay Buyer the shortfall.',
        c.clauseType === 'mixed'
          ? 'Section 2.5 — Additional condition: the final seller payment is also subject to revenue performance in the 90 days after Closing. The allocation between these components is not specified.'
          : 'The adjustment in Section 2.4 measures balances delivered at Closing, independently of post-closing revenue.',
        '',
        'Reviewer policy reference: SOP 50 10 8.1 technical updates. Applicability requires human confirmation.',
      ].join('\n'),
    },
    balance: {
      title: 'Closing balance sheet',
      type: 'csv',
      available: true,
      ref: 'B2:B6',
      text: [
        'FICTIONAL EXHIBIT — USD; as of ' + c.balanceDate,
        'Account,Amount,Kind,Included,Reference',
        ...c.accounts.map((a) => [a.label, a.amount, a.kind, a.included, a.ref].join(',')),
        '',
        'Prepared on 2026-10-21; measurement date ' + c.balanceDate + '.',
      ].join('\n'),
    },
    adjustment: {
      title: 'Adjustment statement',
      type: 'text',
      available: true,
      ref: 'Line 8',
      text: [
        'FICTIONAL EXHIBIT — PURCHASE PRICE ADJUSTMENT',
        'Business: ' + c.name,
        'Measurement date: ' + c.measurementDate,
        'Contractual working capital target: USD ' + c.target,
        'Claimed seller-to-buyer refund: USD ' + c.statementAmount,
        '',
        'Line 8: Refund is stated to settle the working capital adjustment.',
        c.clauseType === 'mixed'
          ? 'The statement does not separate the revenue-related component from the closing-balance adjustment.'
          : 'No separate performance-related component is described in this sample statement.',
      ].join('\n'),
    },
    payment: {
      title: 'Payment confirmation',
      type: 'text',
      available: true,
      ref: 'Transfer details',
      text: [
        'FICTIONAL EXHIBIT — SAMPLE TRANSFER CONFIRMATION',
        'Date: 2026-10-23',
        'From: ' + c.payment.from,
        'To: ' + c.payment.to,
        'Amount: USD ' + c.payment.amount,
        'Memo: Closing working capital adjustment',
        '',
        'This exhibit is synthetic and is not a bank record.',
      ].join('\n'),
    },
  };
}

export function makeCase(overrides = {}) {
  const c = {
    id: 'CT-0261',
    name: 'Northstar Precision',
    industry: 'Manufacturing',
    buyer: 'Northstar Acquisition LLC',
    seller: 'Northstar Holdings LLC',
    currency: 'USD',
    closingDate: '2026-10-15',
    measurementDate: '2026-10-15',
    balanceDate: '2026-10-15',
    target: '500000.00',
    statementAmount: '100000.00',
    mappingConfirmed: true,
    policyConfirmed: true,
    clauseType: 'closing',
    accounts: [
      { id: 'ar', label: 'Trade receivables', kind: 'asset', amount: '280000.00', included: true, ref: 'B2' },
      { id: 'inventory', label: 'Inventory', kind: 'asset', amount: '190000.00', included: true, ref: 'B3' },
      {
        id: 'prepaid',
        label: 'Prepaid operating costs',
        kind: 'asset',
        amount: '30000.00',
        included: true,
        ref: 'B4',
      },
      { id: 'ap', label: 'Trade payables', kind: 'liability', amount: '80000.00', included: true, ref: 'B5' },
      {
        id: 'accrual',
        label: 'Accrued operating expenses',
        kind: 'liability',
        amount: '20000.00',
        included: true,
        ref: 'B6',
      },
    ],
    payment: { amount: '115000.00', from: 'Northstar Holdings LLC', to: 'Northstar Acquisition LLC' },
    revision: 1,
    resolutions: {},
    review: null,
    manual: false,
    audit: [
      {
        at: '2026-10-22T14:30:00Z',
        title: 'Sample case created',
        detail: 'Four fictional source exhibits added to the workspace.',
      },
      {
        at: '2026-10-23T16:10:00Z',
        title: 'Payment evidence added',
        detail: 'Reconciliation found a difference requiring review.',
      },
    ],
    ...overrides,
  };
  if (!overrides.payment) c.payment = { amount: '100000.00', from: c.seller, to: c.buyer };
  c.documents = documents(c);
  return c;
}

export function sampleCases() {
  const northstar = makeCase({
    payment: { amount: '115000.00', from: 'Northstar Holdings LLC', to: 'Northstar Acquisition LLC' },
  });
  const harbor = makeCase({
    id: 'CT-0262',
    name: 'Harbor Supply Co.',
    industry: 'Distribution',
    buyer: 'Harbor Acquisition LLC',
    seller: 'Harbor Partners LLC',
    audit: [
      {
        at: '2026-10-23T13:20:00Z',
        title: 'Reconciliation completed',
        detail: 'Entered amounts reconcile. Ready for a reviewer decision.',
      },
    ],
  });
  const cedar = makeCase({
    id: 'CT-0263',
    name: 'Cedarfield Services',
    industry: 'Business services',
    buyer: 'Cedarfield Acquisition LLC',
    seller: 'Cedarfield Founders LLC',
    clauseType: 'mixed',
    audit: [
      {
        at: '2026-10-23T10:10:00Z',
        title: 'Mixed clause identified',
        detail: 'The agreement combines a closing adjustment with a future revenue condition.',
      },
    ],
  });
  const banyan = makeCase({
    id: 'CT-0264',
    name: 'Banyan Equipment',
    industry: 'Equipment services',
    buyer: 'Banyan Acquisition LLC',
    seller: 'Banyan Group LLC',
    mappingConfirmed: false,
    audit: [
      {
        at: '2026-10-24T08:00:00Z',
        title: 'Evidence requested',
        detail: 'Payment confirmation and account mapping are outstanding.',
      },
    ],
  });
  banyan.documents.payment.available = false;
  banyan.documents.payment.text = '';
  return [northstar, harbor, cedar, banyan];
}

export const POLICY_SOURCES = [
  {
    title: 'SBA technical updates',
    label: 'Notice 5000-882227 · effective Oct 1, 2026',
    url: 'https://legacy.sba.gov/document/information-notice-5000-882227-issuance-technical-updates-sop-50-10-81',
  },
  {
    title: 'Working capital true-up guidance',
    label: 'Starfield & Smith · specialist interpretation',
    url: 'https://starfieldsmith.com/2026/10/best-practices-working-capital-true-ups-what-7a-lenders-need-to-know/',
  },
];
