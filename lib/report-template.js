import { evaluateCase, money, parseMoney, DOC_LABELS, STATE_LABELS } from './engine.js';
import { POLICY_SOURCES } from './data.js';
const esc = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (s) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[s],
  );
export function reviewReport(c) {
  const e = evaluateCase(c);
  const labels = {
    retain: 'Retain for working capital',
    principal: 'Apply to loan principal',
    escalate: 'Escalate for specialist review',
  };
  const row = (l, v) => '<tr><td>' + esc(l) + '</td><td>' + esc(v) + '</td></tr>';
  const section = (n, title) => '<h2><span>' + n + '</span>' + title + '</h2>';
  const notice = c.sample
    ? 'Fictional example review. Sample exhibits and decisions demonstrate the workflow.'
    : 'Review record based on reviewer-entered inputs and source excerpts. Verify the originals and governing policy.';
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>CloseTrace review · ' +
    esc(c.id) +
    '</title><style>' +
    '@page{size:A4;margin:19mm}*{box-sizing:border-box}body{font:12px/1.8 system-ui,sans-serif;color:#354d3c;max-width:830px;margin:45px auto;padding:0 35px}header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #dce5d4;padding-bottom:21px}.brand{font-size:21px;letter-spacing:-.8px;color:#25462f}.label{font-size:9px;letter-spacing:1.4px;color:#8ca177;text-transform:uppercase}.eyebrow{font-size:9px;letter-spacing:1px;color:#91a17e;margin-top:32px}h1{font-size:31px;line-height:1.4;font-weight:550;letter-spacing:-1px;color:#294831;margin:10px 0}h2{display:flex;align-items:center;gap:11px;margin-top:34px;border-bottom:1px solid #dce5d4;padding-bottom:11px;font-size:17px;font-weight:550;letter-spacing:-.3px;break-after:avoid}h2>span{font-size:9px;color:#8ea675;border:1px solid #e0e9d5;background:#f4f7ee;border-radius:4px;padding:1px 6px}h3{font-size:12px;line-height:1.7;margin-bottom:7px}p{margin:7px 0}.notice{padding:14px 17px;background:#f3f7ec;border:1px solid #e0e8d7;border-radius:7px;font-size:10px;line-height:1.9;margin:23px 0}.muted{color:#93a183;font-size:10px}.summary{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #dfe8d6;border-radius:8px;overflow:hidden;margin:24px 0}.summary>div{padding:16px 18px}.summary>div+div{border-left:1px solid #dfe8d6}.summary small{display:block;color:#93a77c;font-size:9px}.summary b{display:block;font-size:23px;font-weight:500;letter-spacing:-.6px;color:#45693b;margin-top:8px}table{width:100%;border-collapse:collapse;font-size:11px}td,th{padding:10px 9px;border-bottom:1px solid #e8eddf;text-align:left;vertical-align:top}th{font-size:9px;color:#94a57f;font-weight:500;background:#f9fbf5}td:last-child{text-align:right;font-variant-numeric:tabular-nums}pre{font:10px/1.9 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere;background:#f8faf4;border:1px solid #e6ecdc;border-radius:6px;padding:17px}article{break-inside:avoid;margin:18px 0}a{color:#638447;text-decoration:none}.finding{border-left:2px solid #c0d2a6;padding-left:14px}.rationale{background:#f6f9f0;border:1px solid #e3ecd7;padding:18px;border-radius:7px}.rationale p{white-space:pre-wrap;overflow-wrap:anywhere}.foot{margin-top:40px;padding:20px 0;border-top:1px solid #dfe8d4;font-size:8px;line-height:1.9;color:#9dac8b}@media print{body{margin:0;padding:0;max-width:none;font-size:10px}h1{font-size:28px}h2{margin-top:26px}pre{font-size:8px}.notice{background:none}.summary b{font-size:21px}article{break-inside:auto}h3{break-after:avoid}header{padding-bottom:17px}}' +
    '</style></head><body><header><b class="brand">CloseTrace.</b><span class="label">Acquisition review package</span></header><p class="eyebrow">' +
    esc(c.id) +
    ' / REVISION ' +
    c.revision +
    '</p><h1>' +
    esc(c.name) +
    '</h1><p class="muted">' +
    esc(c.industry) +
    ' · Closed ' +
    esc(c.closingDate) +
    ' · Generated ' +
    esc(new Date().toISOString()) +
    '</p><p class="notice"><b>' +
    esc(notice) +
    '</b><br>This package records a reviewer recommendation. It does not certify legal compliance or execute a payment. Uploaded original files are maintained separately from the excerpts in this report.</p>' +
    '<div class="summary"><div><small>Calculated seller refund</small><b>' +
    esc(money(e.expected)) +
    '</b></div><div><small>Payment in evidence</small><b>' +
    esc(money(e.paid)) +
    '</b></div><div><small>Payment difference</small><b>' +
    esc(money(e.variance)) +
    '</b></div></div>' +
    section('01', 'Review at a glance') +
    '<table>' +
    row('Status', STATE_LABELS[e.state]) +
    row('Buyer', c.buyer) +
    row('Seller', c.seller) +
    row('Review owner label', c.assignee || 'You') +
    row('Review due date', c.dueDate || 'Not set') +
    row('Governing policy confirmed', c.policyConfirmed ? 'Yes' : 'No') +
    row('Account mapping confirmed', c.mappingConfirmed ? 'Yes' : 'No') +
    '</table>' +
    section('02', 'Reconciliation') +
    '<table>' +
    row('Contractual target', money(e.target)) +
    row('Delivered working capital', money(e.delivered)) +
    row('Calculated seller refund', money(e.expected)) +
    row('Statement refund', money(e.statement)) +
    row('Payment received', money(e.paid)) +
    row('Payment minus calculated refund', money(e.variance)) +
    '</table><h3>Account mapping</h3><table><tr><th>Account / source reference</th><th>Entered amount</th></tr>' +
    c.accounts
      .map((a) =>
        row(
          a.label + ' / ' + a.ref + (a.included ? '' : ' (excluded)'),
          money(
            parseMoney(a.amount) === null ? null : parseMoney(a.amount) * (a.kind === 'liability' ? -1 : 1),
          ),
        ),
      )
      .join('') +
    '</table>' +
    section('03', 'Findings & explanations') +
    (e.findings.length
      ? e.findings
          .map(
            (f) =>
              '<article class="finding"><h3>' +
              esc(f.title) +
              ' · ' +
              (f.resolved ? 'Documented exception' : 'Open' + (f.blocking ? ' / completion blocked' : '')) +
              '</h3><p>' +
              esc(f.detail) +
              '</p><p class="muted">Source: ' +
              esc(DOC_LABELS[f.source]) +
              '</p>' +
              (f.note ? '<p><b>Reviewer explanation:</b> ' + esc(f.note) + '</p>' : '') +
              '</article>',
          )
          .join('')
      : '<p>No discrepancies found in the entered values.</p>') +
    section('04', 'Reviewer decision') +
    (c.review?.revision === c.revision
      ? '<div class="rationale"><b>' +
        esc(labels[c.review.decision]) +
        '</b><p class="muted">' +
        esc(c.review.reviewer) +
        ' · ' +
        esc(c.review.at) +
        '</p><p>' +
        esc(c.review.rationale) +
        '</p></div>'
      : '<p>No current reviewer decision recorded.</p>') +
    section('05', 'Policy references') +
    POLICY_SOURCES.map(
      (p) =>
        '<p><a href="' +
        p.url +
        '" target="_blank" rel="noreferrer">' +
        esc(p.title) +
        '</a><br><small class="muted">' +
        esc(p.label) +
        '</small></p>',
    ).join('') +
    section('06', 'Source exhibits') +
    Object.keys(DOC_LABELS)
      .map(
        (k) =>
          '<article><h3>' +
          esc(c.documents[k].title) +
          '</h3><p class="muted">' +
          esc(c.documents[k].ref || DOC_LABELS[k]) +
          '</p><pre>' +
          esc(c.documents[k].available ? c.documents[k].text : 'Source unavailable') +
          '</pre></article>',
      )
      .join('') +
    (c.attachments?.length
      ? '<h3>Original attachments</h3><table>' +
        c.attachments
          .map((f) => row(f.name, Math.ceil(f.size / 1000) + ' KB · ' + DOC_LABELS[f.category]))
          .join('') +
        '</table>'
      : '') +
    section('07', 'Reviewer notes & history') +
    (c.notes || [])
      .map(
        (n) =>
          '<article><b>' +
          esc(n.author) +
          '</b><span class="muted"> · ' +
          esc(n.at) +
          '</span><p>' +
          esc(n.text) +
          '</p></article>',
      )
      .join('') +
    (c.audit || [])
      .map(
        (a) =>
          '<article><b>' +
          esc(a.title) +
          '</b><p class="muted">' +
          esc(a.at) +
          '</p><p>' +
          esc(a.detail) +
          '</p></article>',
      )
      .join('') +
    '<p class="foot">CLOSETRACE / PRIVATE REVIEW RECORD<br>Figures reflect this snapshot only. Changes to calculation inputs or source excerpts require a fresh reviewer decision. This exported document can be edited independently of the saved workspace.</p></body></html>'
  );
}
