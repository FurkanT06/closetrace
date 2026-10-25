'use client';
import { useState, useEffect } from 'react';
import { useWorkspace } from '../context';
import { Icon, Avatar, Button, Badge, CardHead, date, fullDate, size } from './ui';
import { evaluateCase, parseMoney, money, DOC_LABELS } from '../../lib/engine.js';
import { POLICY_SOURCES } from '../../lib/data.js';

export function SourceDocuments({ c }) {
  const { setModal } = useWorkspace();
  return (
    <div className="source-documents">
      <div className="section-intro">
        <div>
          <h2>Evidence, in context.</h2>
          <p>Inspect the sources behind this review. Add an excerpt for each required document.</p>
        </div>
        <Button icon="upload" onClick={() => setModal({ type: 'upload', cid: c.id })}>
          Upload document
        </Button>
      </div>
      <div className="case-document-grid">
        {Object.entries(DOC_LABELS).map(([key, label]) => {
          const d = c.documents[key],
            available = d.available && d.text.trim();
          return (
            <article className={'document-tile ' + (!available ? 'missing-doc' : '')} key={key}>
              <div className="document-top">
                <span className={'document-icon ' + (key === 'balance' ? 'spreadsheet' : '')}>
                  <Icon name={key === 'balance' ? 'sheet' : 'file'} size={25} />
                </span>
                <span className={'source-tag ' + (!available ? 'missing' : '')}>
                  {available ? (c.sample ? 'Sample source' : 'Excerpt available') : 'Excerpt needed'}
                </span>
              </div>
              <small>{label}</small>
              <h3>{d.title}</h3>
              <p className="document-excerpt">
                {available
                  ? d.text.split('\n').filter(Boolean).slice(0, 3).join(' · ')
                  : 'Add the document and a reviewer-verified excerpt to complete this check.'}
              </p>
              <div className="document-bottom">
                <span>{d.ref || 'No reference set'}</span>
                <button onClick={() => setModal({ type: 'source', cid: c.id, key })}>
                  {available ? 'Inspect source' : 'Add source'}
                  <Icon name="chevron" size={14} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {c.attachments?.length > 0 && (
        <section className="card attachments-card">
          <CardHead title="Uploaded files" subtitle="Original attachments stay with this review." />
          <div className="attachment-list">
            {c.attachments.map((f) => (
              <button
                key={f.id}
                className="attachment-row"
                onClick={() => setModal({ type: 'source', cid: c.id, key: f.category, fileId: f.id })}
              >
                <span className="document-icon small-icon">
                  <Icon name="file" size={19} />
                </span>
                <span>
                  <b>{f.name}</b>
                  <small>
                    {DOC_LABELS[f.category]} · {size(f.size)} · {date(f.createdAt)}
                  </small>
                </span>
                <Icon name="eye" size={17} />
              </button>
            ))}
          </div>
        </section>
      )}
      <p className="inline-note">
        <Icon name="shield" size={15} />
        PDF files are available for inspection. A reviewer enters the source excerpt and confirms the
        financial inputs.
      </p>
    </div>
  );
}
function ReviewHistory({ c }) {
  const { saveCase, busy, notify } = useWorkspace();
  const [note, setNote] = useState('');
  const addNote = async (e) => {
    e.preventDefault();
    try {
      await saveCase({ ...c, notes: [...(c.notes || []), { text: note }] }, 'note');
      setNote('');
      notify('Comment added to the review.');
    } catch (e) {
      notify(e.message, true);
    }
  };
  return (
    <div className="history-grid">
      <section className="card">
        <CardHead title="Review history" subtitle={'The record for ' + c.id} />
        <div className="case-timeline">
          {[...(c.audit || [])].reverse().map((a, i) => (
            <article key={a.at + i}>
              <span className="timeline-mark">
                <Icon name={a.title.includes('decision') ? 'filecheck' : 'clock'} size={15} />
              </span>
              <div>
                <small>{date(a.at)}</small>
                <h3>{a.title}</h3>
                <p>{a.detail}</p>
              </div>
            </article>
          ))}
          {!c.audit?.length && <p className="quiet-empty">Events will appear as the review progresses.</p>}
        </div>
      </section>
      <section className="card comments-card">
        <CardHead title="Reviewer notes" subtitle="Keep context and follow-up questions with the file." />
        <div className="comments-list">
          {c.notes?.length ? (
            c.notes.map((n) => (
              <article className="comment" key={n.id}>
                <Avatar name={n.author} />
                <div>
                  <b>{n.author}</b>
                  <small>{date(n.at)}</small>
                  <p>{n.text}</p>
                </div>
              </article>
            ))
          ) : (
            <p className="quiet-empty">No comments yet. Add the context the next reviewer should know.</p>
          )}
        </div>
        <form className="comment-form" onSubmit={addNote}>
          <label htmlFor="review-comment">Add a note</label>
          <textarea
            id="review-comment"
            value={note}
            maxLength={4000}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add context, a question, or the next action…"
            required
          />
          <Button variant="primary" icon="message" disabled={busy || !note.trim()}>
            Add comment
          </Button>
        </form>
      </section>
    </div>
  );
}
function Decision({ c, e }) {
  const { saveCase, busy, notify, mode } = useWorkspace();
  const [decision, setDecision] = useState('retain'),
    [rationale, setRationale] = useState('');
  useEffect(() => {
    setDecision(c.review?.decision || 'retain');
    setRationale(c.review?.rationale || '');
  }, [c.id, c.revision, c.review?.at]);
  const submit = async (event) => {
    event.preventDefault();
    try {
      await saveCase({ ...c, review: { decision, rationale, revision: c.revision } }, 'decision');
      notify(
        decision === 'escalate' ? 'Review escalated for specialist attention.' : 'Reviewer decision saved.',
      );
    } catch (err) {
      notify(err.message, true);
    }
  };
  return (
    <section className="card decision-card">
      <CardHead title="Reviewer decision" subtitle="A considered decision, with the evidence attached." />
      {c.review?.revision === c.revision && (
        <div className="recorded-decision">
          <Icon name={c.review.decision === 'escalate' ? 'warning' : 'shield'} size={19} />
          <div>
            <b>{c.review.decision === 'escalate' ? 'Escalation recorded' : 'Decision recorded'}</b>
            <p>
              {c.review.reviewer} · {date(c.review.at)}
            </p>
          </div>
        </div>
      )}
      <form onSubmit={submit}>
        <fieldset>
          <legend>Recommended treatment</legend>
          {[
            [
              'retain',
              'Retain as working capital',
              'The documented closing adjustment supports operating liquidity.',
            ],
            ['principal', 'Apply to loan principal', 'Record the reviewer’s policy-based treatment.'],
            [
              'escalate',
              'Refer for specialist review',
              'Seek guidance on terms, evidence, or policy applicability.',
            ],
          ].map(([v, l, h]) => (
            <label className={'decision-option ' + (decision === v ? 'selected' : '')} key={v}>
              <input
                type="radio"
                name="decision"
                value={v}
                checked={decision === v}
                onChange={() => setDecision(v)}
              />
              <span>
                <b>{l}</b>
                <small>{h}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <label className="form-field">
          <span>Decision rationale</span>
          <textarea
            aria-label="Decision rationale"
            placeholder="Explain how the sources and governing policy support this treatment…"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            minLength={10}
            maxLength={6000}
            required
          />
        </label>
        {!e.canComplete && decision !== 'escalate' && (
          <p className="decision-blocked">
            <Icon name="lock" size={14} />
            Address {e.open.length} open check{e.open.length === 1 ? '' : 's'} before recording a completed
            review.
          </p>
        )}
        <Button
          variant="primary"
          icon={busy ? 'spinner' : decision === 'escalate' ? 'arrow' : 'filecheck'}
          disabled={busy || rationale.trim().length < 10 || (!e.canComplete && decision !== 'escalate')}
        >
          {busy
            ? 'Saving…'
            : decision === 'escalate'
              ? 'Record escalation'
              : c.review
                ? 'Update decision'
                : 'Record decision'}
        </Button>
        <p className="decision-footnote">
          {mode === 'demo'
            ? 'Recorded as Demo reviewer on this device.'
            : 'Recorded with your signed-in identity.'}{' '}
          This records a recommendation; funds remain under lender control.
        </p>
      </form>
    </section>
  );
}
export default function ReviewDetail({ c }) {
  const { navigate, setModal, tab, setTab, report } = useWorkspace();
  const e = evaluateCase(c);
  const safeTotal = (kind) => {
    const rows = c.accounts.filter((a) => a.included && a.kind === kind);
    if (rows.some((a) => parseMoney(a.amount) === null)) return null;
    const total = rows.reduce((sum, a) => sum + BigInt(parseMoney(a.amount)), 0n);
    return total > BigInt(Number.MAX_SAFE_INTEGER) || total < -BigInt(Number.MAX_SAFE_INTEGER)
      ? null
      : Number(total);
  };
  const checks = [
    {
      label: 'Required source excerpts',
      hint: e.sourceCount + ' of 4 available',
      ok: e.sourceCount === 4,
      icon: 'files',
      action: () => setTab('documents'),
    },
    {
      label: 'Closing measurement date',
      hint: c.balanceDate === c.measurementDate ? 'Dates align' : 'Measurement date differs',
      ok: c.balanceDate === c.measurementDate,
      icon: 'calendar',
    },
    {
      label: 'Account mapping',
      hint: c.mappingConfirmed ? 'Confirmed by reviewer' : 'Confirmation required',
      ok: c.mappingConfirmed,
      icon: 'checklist',
    },
    {
      label: 'Payment term classification',
      hint:
        c.clauseType === 'closing'
          ? 'Closing-date adjustment'
          : c.clauseType === 'mixed'
            ? 'Mixed terms · specialist review'
            : 'Review classification',
      ok: c.clauseType === 'closing',
      icon: 'filecheck',
    },
    {
      label: 'Governing policy',
      hint: c.policyConfirmed ? 'Applicability confirmed' : 'Confirmation required',
      ok: c.policyConfirmed,
      icon: 'shield',
    },
  ];
  const openSource = (key, ref) => setModal({ type: 'source', cid: c.id, key, ref });
  return (
    <div className="page detail-page">
      <div className="review-back">
        <button onClick={() => navigate('reviews')}>
          <Icon name="back" size={15} />
          All reviews
        </button>
        <span>{c.id}</span>
        <span>Revision {c.revision}</span>
        {c.sample && <span className="sample-label">Fictional case</span>}
      </div>
      <div className="case-page-heading">
        <div className="case-business">
          <Avatar name={c.name} className="case-business-avatar" />
          <div>
            <div className="case-title-line">
              <h1>{c.name}</h1>
              <Badge state={e.state} />
            </div>
            <p>
              {c.industry}
              <span>·</span>Closed {fullDate(c.closingDate)}
            </p>
          </div>
        </div>
        <div className="heading-actions">
          <Button icon="edit" onClick={() => setModal({ type: 'edit', cid: c.id })}>
            Edit inputs
          </Button>
          <Button variant="primary" icon="download" onClick={() => report(c)}>
            Review package
          </Button>
        </div>
      </div>
      <div className="case-meta">
        <span>
          <Icon name="building" size={14} />
          Buyer: <b>{c.buyer}</b>
        </span>
        <button onClick={() => setModal({ type: 'metadata', cid: c.id })}>
          <Icon name="calendar" size={14} />
          Due {c.dueDate ? date(c.dueDate) : 'date not set'}
          <Icon name="edit" size={12} />
        </button>
        <button onClick={() => setModal({ type: 'metadata', cid: c.id })}>
          <Avatar name={c.assignee || 'You'} className="tiny-avatar" />
          {c.assignee || 'You'}
          <Icon name="down" size={12} />
        </button>
      </div>
      <div className="case-summary">
        {[
          ['Contractual target', e.target, 'agreement', 'As specified in the agreement'],
          ['Delivered working capital', e.delivered, 'balance', 'Included assets less liabilities'],
          ['Calculated seller refund', e.expected, 'adjustment', 'Target less delivered capital'],
          [
            'Payment in evidence',
            e.paid,
            'payment',
            e.variance === null
              ? 'Awaiting payment evidence'
              : e.variance === 0
                ? 'Reconciles with calculation'
                : money(Math.abs(e.variance)) + ' ' + (e.variance > 0 ? 'above' : 'below') + ' calculation',
          ],
        ].map(([label, value, source, hint], i) => (
          <div key={label} className={'case-summary-item ' + (i === 3 && e.variance ? 'has-variance' : '')}>
            <button onClick={() => openSource(source)}>
              {label}
              <Icon name="arrow" size={12} />
            </button>
            <b>{money(value)}</b>
            <small>
              {i === 3 && e.variance !== null && <Icon name={e.variance ? 'alert' : 'check'} size={12} />}{' '}
              {hint}
            </small>
          </div>
        ))}
      </div>
      <div className="case-tabs" role="tablist" aria-label="Review sections">
        {[
          ['reconciliation', 'Reconciliation', null],
          ['documents', 'Source documents', e.sourceCount + '/4'],
          ['history', 'History & notes', c.audit?.length || 0],
        ].map(([v, l, n]) => (
          <button
            key={v}
            role="tab"
            aria-selected={tab === v}
            aria-controls={'panel-' + v}
            id={'tab-' + v}
            className={tab === v ? 'selected' : ''}
            onClick={() => setTab(v)}
          >
            {l}
            {n !== null && <span>{n}</span>}
          </button>
        ))}
        <span className="case-tab-right">
          <Icon name="lock" size={13} />
          Private review
        </span>
      </div>
      <div
        role="tabpanel"
        id={'panel-' + tab}
        aria-labelledby={'tab-' + tab}
        className="case-panel"
        key={tab}
      >
        {tab === 'documents' ? (
          <SourceDocuments c={c} />
        ) : tab === 'history' ? (
          <ReviewHistory c={c} />
        ) : (
          <div className="reconciliation-layout">
            <div className="reconciliation-main">
              <section className="card calculation-card">
                <CardHead
                  title="Working capital reconciliation"
                  subtitle={'Measured as of ' + fullDate(c.measurementDate)}
                  action={
                    <button className="text-link" onClick={() => setModal({ type: 'edit', cid: c.id })}>
                      Edit mapping
                      <Icon name="edit" size={13} />
                    </button>
                  }
                />
                <div className="calculation-description">
                  <span className="calculation-label">
                    <Icon name="checklist" size={15} />
                    THE CALCULATION TRAIL
                  </span>
                  <p>Start with the closing balances. Follow each amount to its source.</p>
                </div>
                <table className="calculation-table">
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Source</th>
                      <th>Included amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['asset', 'liability'].map((kind) => (
                      <FragmentRows
                        key={kind}
                        kind={kind}
                        c={c}
                        openSource={openSource}
                        total={safeTotal(kind)}
                      />
                    ))}
                    <tr className="net-row">
                      <td>Delivered working capital</td>
                      <td />
                      <td>{money(e.delivered)}</td>
                    </tr>
                    <tr className="target-row">
                      <td>Contractual working capital target</td>
                      <td>
                        <button className="source-chip" onClick={() => openSource('agreement')}>
                          {c.documents.agreement.ref || 'Agreement'}
                          <Icon name="arrow" size={11} />
                        </button>
                      </td>
                      <td>{money(e.target)}</td>
                    </tr>
                    <tr className="calculated-refund">
                      <td>
                        <span className="calculated-check">
                          <Icon name="checks" size={17} />
                        </span>
                        Calculated seller refund
                      </td>
                      <td />
                      <td>{money(e.expected)}</td>
                    </tr>
                  </tbody>
                </table>
                <div className="calculation-note">
                  <Icon name="info" size={15} />
                  <p>
                    Only included accounts contribute to the calculation. An explanation documents a
                    difference and leaves the amounts unchanged.
                  </p>
                </div>
              </section>
              <section className="card payment-card">
                <CardHead
                  title="Follow the payment"
                  subtitle="Compare the adjustment statement with the payment evidence."
                />
                <div className="payment-flow">
                  <div>
                    <span className="payment-step">01</span>
                    <small>Calculated refund</small>
                    <b>{money(e.expected)}</b>
                    <button onClick={() => openSource('balance')}>
                      View calculation sources
                      <Icon name="arrow" size={12} />
                    </button>
                  </div>
                  <Icon name="right" size={18} />
                  <div>
                    <span className="payment-step">02</span>
                    <small>Statement refund</small>
                    <b>{money(e.statement)}</b>
                    <button onClick={() => openSource('adjustment')}>
                      Adjustment statement
                      <Icon name="arrow" size={12} />
                    </button>
                  </div>
                  <Icon name="right" size={18} />
                  <div className={e.variance ? 'payment-different' : ''}>
                    <span className="payment-step">03</span>
                    <small>Payment in evidence</small>
                    <b>{money(e.paid)}</b>
                    <button onClick={() => openSource('payment')}>
                      Inspect payment
                      <Icon name="arrow" size={12} />
                    </button>
                  </div>
                </div>
                <div
                  className={
                    'payment-result ' + (e.variance ? 'difference' : e.variance === 0 ? 'matches' : '')
                  }
                >
                  <Icon name={e.variance ? 'alert' : e.variance === 0 ? 'success' : 'clock'} size={17} />
                  <span>
                    {e.variance === null
                      ? 'Payment evidence is needed to complete reconciliation.'
                      : e.variance === 0
                        ? 'The payment matches the calculated refund.'
                        : money(Math.abs(e.variance)) +
                          ' payment difference requires a documented explanation.'}
                  </span>
                </div>
                <div className="counterparties">
                  <div>
                    <small>PAID BY</small>
                    <b>{c.payment.from || 'Not entered'}</b>
                  </div>
                  <Icon name="right" size={15} />
                  <div>
                    <small>RECEIVED BY</small>
                    <b>{c.payment.to || 'Not entered'}</b>
                  </div>
                </div>
              </section>
              <section className="card policy-card">
                <CardHead title="Policy references" action={<Icon name="shield" size={18} />} />
                <div className="policy-links">
                  {POLICY_SOURCES.map((p) => (
                    <a key={p.url} href={p.url} target="_blank" rel="noreferrer">
                      <span>
                        <b>{p.title}</b>
                        <small>{p.label}</small>
                      </span>
                      <Icon name="external" size={15} />
                    </a>
                  ))}
                </div>
                <p>
                  Confirm the policy version and its applicability to this loan file with your qualified
                  reviewer.
                </p>
              </section>
            </div>
            <aside className="review-aside">
              <section className="card checks-card">
                <CardHead
                  title="Review checks"
                  subtitle={
                    e.open.length
                      ? e.open.length + ' open ' + (e.open.length === 1 ? 'check' : 'checks') + ' to address'
                      : 'All required checks addressed'
                  }
                  action={
                    <span className={'check-count ' + (!e.open.length ? 'clear' : '')}>
                      {e.open.length ? e.open.length : <Icon name="check" size={15} />}
                    </span>
                  }
                />
                {e.findings.length > 0 && (
                  <div className="findings-list">
                    {e.findings.map((f) => (
                      <article
                        key={f.id}
                        className={'finding ' + (f.resolved ? 'resolved' : f.blocking ? 'blocking' : '')}
                      >
                        <div className="finding-title">
                          <Icon name={f.resolved ? 'success' : f.blocking ? 'lock' : 'alert'} size={16} />
                          <b>{f.title}</b>
                        </div>
                        <p>{f.detail}</p>
                        {f.resolved && (
                          <div className="resolution-note">
                            <b>Reviewer explanation</b>
                            <p>{f.note}</p>
                          </div>
                        )}
                        <div className="finding-actions">
                          <button onClick={() => openSource(f.source)}>
                            View source
                            <Icon name="arrow" size={12} />
                          </button>
                          {!f.blocking ? (
                            <button onClick={() => setModal({ type: 'resolve', cid: c.id, findingId: f.id })}>
                              {f.resolved ? 'Edit explanation' : 'Explain difference'}
                              <Icon name="edit" size={12} />
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                setModal({
                                  type: f.id.startsWith('missing-') ? 'source' : 'edit',
                                  cid: c.id,
                                  key: f.source,
                                })
                              }
                            >
                              {f.id.startsWith('missing-') ? 'Add source' : 'Review inputs'}
                              <Icon name="chevron" size={12} />
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
                <div className="checklist">
                  {checks.map((ch, i) => (
                    <button
                      key={ch.label}
                      className="checklist-row"
                      onClick={ch.action || (() => setModal({ type: 'edit', cid: c.id }))}
                    >
                      <span className={'checklist-status ' + (ch.ok ? 'ok' : '')}>
                        <Icon name={ch.ok ? 'check' : 'circle'} size={13} />
                      </span>
                      <span>
                        <b>{ch.label}</b>
                        <small>{ch.hint}</small>
                      </span>
                      <Icon name="chevron" size={12} />
                    </button>
                  ))}
                </div>
              </section>
              <Decision c={c} e={e} />
            </aside>
          </div>
        )}
      </div>
      <div className="case-bottom-note">
        <Icon name="shield" size={15} />
        <span>Source-backed calculations. Human-reviewed decisions.</span>
        <button onClick={() => setModal({ type: 'export', cid: c.id })}>
          Export options
          <Icon name="download" size={13} />
        </button>
      </div>
    </div>
  );
}
function FragmentRows({ kind, c, openSource, total }) {
  return (
    <>
      {c.accounts
        .filter((a) => a.kind === kind)
        .map((a) => (
          <tr key={a.id} className={!a.included ? 'excluded-account' : ''}>
            <td>
              <span className={'account-sign ' + kind}>{kind === 'asset' ? '+' : '−'}</span>
              {a.label}
              {!a.included && <small className="excluded-label">Excluded</small>}
            </td>
            <td>
              <button className="source-chip" onClick={() => openSource('balance', a.ref)}>
                {a.ref}
                <Icon name="arrow" size={10} />
              </button>
            </td>
            <td>{a.included ? money(parseMoney(a.amount)) : '—'}</td>
          </tr>
        ))}
      <tr className="subtotal-row">
        <td>{kind === 'asset' ? 'Included current assets' : 'Less included current liabilities'}</td>
        <td />
        <td>{money(total)}</td>
      </tr>
    </>
  );
}
