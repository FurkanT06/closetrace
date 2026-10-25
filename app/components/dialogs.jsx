'use client';
import { uuid } from '../../lib/ids.js';
import { useState, useEffect, useRef } from 'react';
import { useWorkspace } from '../context';
import { Icon, Logo, Avatar, Button, Badge, date, size } from './ui';
import { blankCase } from '../../lib/case-model.js';
import { DOC_LABELS, evaluateCase } from '../../lib/engine.js';
import { loadDemoFile } from '../../lib/demo-files.js';
import { storageSet } from '../../lib/safe-storage.js';

function Frame({ title, eyebrow, subtitle, children, wide = false, drawer = false, compact = false }) {
  const { setModal, busy } = useWorkspace();
  const panel = useRef(null);
  useEffect(() => {
    const root = panel.current;
    const focusable = () =>
      [
        ...root.querySelectorAll(
          'button, [href], input:not([type=hidden]), select, textarea, [tabindex="0"]',
        ),
      ].filter((e) => !e.disabled && e.getClientRects().length);
    const first = root.querySelector('[data-autofocus]') || focusable()[0];
    first?.focus();
    const trap = (e) => {
      if (e.key !== 'Tab') return;
      const els = focusable(),
        first = els[0],
        last = els.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    root.addEventListener('keydown', trap);
    return () => root.removeEventListener('keydown', trap);
  }, []);
  return (
    <div
      className={'modal-overlay ' + (drawer ? 'drawer-overlay' : '')}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) setModal(null);
      }}
    >
      <section
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={
          'modal ' + (wide ? 'wide ' : '') + (drawer ? 'source-drawer ' : '') + (compact ? 'compact' : '')
        }
      >
        <div className="modal-header">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2 id="modal-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={() => setModal(null)}
            disabled={busy}
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function Field({ label, children, hint, full = false }) {
  return (
    <label className={'form-field ' + (full ? 'span-full' : '')}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function ErrorMessage({ error }) {
  return error ? (
    <p className="form-error" role="alert">
      <Icon name="alert" size={16} />
      {error}
    </p>
  ) : null;
}

function CaseForm({ c }) {
  const { saveCase, setModal, navigate, setTab, busy, notify } = useWorkspace();
  const [draft, setDraft] = useState(() => structuredClone(c || blankCase()));
  const [error, setError] = useState('');
  const update = (path, value) =>
    setDraft((prev) => {
      const next = structuredClone(prev);
      let target = next;
      const parts = path.split('.');
      for (const key of parts.slice(0, -1)) target = target[key];
      target[parts.at(-1)] = value;
      return next;
    });
  const input = (path, props = {}) => {
    const value = path.split('.').reduce((v, k) => v[k], draft);
    return <input value={value ?? ''} onChange={(e) => update(path, e.target.value)} {...props} />;
  };
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const saved = await saveCase(draft, c ? 'edit' : 'create');
      setModal(null);
      navigate('detail', saved.id);
      if (!c) setTab('documents');
      notify(
        c
          ? 'Review inputs saved. Any prior decision has been cleared when inputs changed.'
          : 'Review created. Add source documents to continue.',
      );
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <Frame
      title={c ? 'Edit review inputs' : 'Start a clearer review.'}
      eyebrow={c ? c.id : 'NEW ACQUISITION REVIEW'}
      subtitle={
        c
          ? 'Confirm the contract terms and financial inputs against the source documents.'
          : 'Add the acquisition details. You can complete the calculation and evidence as you go.'
      }
      wide
    >
      <form className="modal-form" onSubmit={submit}>
        <div className="modal-body">
          <ErrorMessage error={error} />
          <div className="form-section-title">
            <span>01</span>
            <h3>Acquisition details</h3>
          </div>
          <div className="form-grid">
            <Field label="Business name">
              {input('name', {
                placeholder: 'e.g. Northstar Precision',
                required: true,
                maxLength: 120,
                'data-autofocus': true,
              })}
            </Field>
            <Field label="Industry">
              {input('industry', { placeholder: 'e.g. Manufacturing', maxLength: 160 })}
            </Field>
            <Field label="Buyer legal name">
              {input('buyer', { placeholder: 'Acquisition entity name', required: true, maxLength: 160 })}
            </Field>
            <Field label="Seller legal name">
              {input('seller', { placeholder: 'Seller entity name', required: true, maxLength: 160 })}
            </Field>
            <Field label="Closing date">
              <input
                type="date"
                value={draft.closingDate}
                required
                onChange={(e) => {
                  update('closingDate', e.target.value);
                  if (!c) {
                    update('measurementDate', e.target.value);
                    update('balanceDate', e.target.value);
                  }
                }}
              />
            </Field>
            <Field label="Review due date">{input('dueDate', { type: 'date' })}</Field>
          </div>
          <div className="form-section-title">
            <span>02</span>
            <h3>Agreement & measurement</h3>
          </div>
          <div className="form-grid">
            <Field label="Working capital target (USD)">
              {input('target', { inputMode: 'decimal', placeholder: '500000.00' })}
            </Field>
            <Field label="Adjustment statement refund (USD)">
              {input('statementAmount', { inputMode: 'decimal', placeholder: '100000.00' })}
            </Field>
            <Field label="Agreement measurement date">
              {input('measurementDate', { type: 'date', required: true })}
            </Field>
            <Field label="Balance sheet measurement date">
              {input('balanceDate', { type: 'date', required: true })}
            </Field>
            <Field label="Payment term classification" full>
              <select value={draft.clauseType} onChange={(e) => update('clauseType', e.target.value)}>
                <option value="unconfirmed">Not yet confirmed</option>
                <option value="closing">Closing-date working capital adjustment</option>
                <option value="mixed">Mixed closing and future-performance terms</option>
                <option value="performance">Future-performance payment</option>
              </select>
            </Field>
          </div>
          <div className="form-section-title">
            <span>03</span>
            <h3>Balance sheet account mapping</h3>
          </div>
          <p className="form-intro">
            Enter source amounts without commas. Include the accounts specified in the agreement.
          </p>
          <div className="account-form-header">
            <span>Include / account</span>
            <span>Type</span>
            <span>Amount (USD)</span>
            <span>Source</span>
            <span />
          </div>
          {draft.accounts.map((a, i) => (
            <div className="account-form-row" key={a.id}>
              <div className="account-include">
                <input
                  type="checkbox"
                  checked={a.included}
                  aria-label={'Include ' + a.label}
                  onChange={(e) => update('accounts.' + i + '.included', e.target.checked)}
                />
                <input
                  aria-label={'Account ' + (i + 1) + ' name'}
                  value={a.label}
                  required
                  maxLength={160}
                  onChange={(e) => update('accounts.' + i + '.label', e.target.value)}
                />
              </div>
              <select
                aria-label={a.label + ' type'}
                value={a.kind}
                onChange={(e) => update('accounts.' + i + '.kind', e.target.value)}
              >
                <option value="asset">Asset</option>
                <option value="liability">Liability</option>
              </select>
              <input
                aria-label={a.label + ' amount'}
                value={a.amount ?? ''}
                inputMode="decimal"
                placeholder="0.00"
                onChange={(e) => update('accounts.' + i + '.amount', e.target.value)}
              />
              <input
                aria-label={a.label + ' source reference'}
                required
                value={a.ref}
                maxLength={120}
                onChange={(e) => update('accounts.' + i + '.ref', e.target.value)}
              />
              <button
                className="icon-button"
                type="button"
                aria-label={'Remove ' + a.label}
                disabled={draft.accounts.length === 1}
                onClick={() => setDraft({ ...draft, accounts: draft.accounts.filter((_, j) => j !== i) })}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-link add-account"
            disabled={draft.accounts.length >= 100}
            onClick={() =>
              setDraft({
                ...draft,
                accounts: [
                  ...draft.accounts,
                  {
                    id: uuid(),
                    label: 'New account',
                    kind: 'asset',
                    amount: '',
                    included: true,
                    ref: 'New reference',
                  },
                ],
              })
            }
          >
            <Icon name="plus" size={14} />
            Add account
          </button>
          <div className="form-section-title">
            <span>04</span>
            <h3>Payment evidence inputs</h3>
          </div>
          <div className="form-grid">
            <Field label="Payment amount (USD)" full>
              {input('payment.amount', {
                inputMode: 'decimal',
                placeholder: 'Amount supported by payment evidence',
              })}
            </Field>
            <Field label="Paid by">
              {input('payment.from', { placeholder: draft.seller || 'Seller legal name', maxLength: 160 })}
            </Field>
            <Field label="Received by">
              {input('payment.to', { placeholder: draft.buyer || 'Buyer legal name', maxLength: 160 })}
            </Field>
          </div>
          <div className="form-confirmations">
            <label>
              <input
                type="checkbox"
                checked={draft.mappingConfirmed}
                onChange={(e) => update('mappingConfirmed', e.target.checked)}
              />
              <span>
                <b>Account mapping confirmed</b>I checked the included accounts against the agreement&apos;s
                definition of working capital.
              </span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.policyConfirmed}
                onChange={(e) => update('policyConfirmed', e.target.checked)}
              />
              <span>
                <b>Governing policy confirmed</b>I confirmed the applicable policy version and its relevance
                to this loan file.
              </span>
            </label>
          </div>
          <p className="inline-note">
            <Icon name="info" size={15} />
            Changing calculation inputs or source excerpts clears prior explanations and decisions so the
            updated case receives a fresh review.
          </p>
        </div>
        <div className="modal-footer">
          <span>{c ? 'Revision ' + c.revision : 'New case · USD'}</span>
          <Button type="button" onClick={() => setModal(null)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" icon={busy ? 'spinner' : 'check'} disabled={busy}>
            {busy ? 'Saving…' : c ? 'Save inputs' : 'Create review'}
          </Button>
        </div>
      </form>
    </Frame>
  );
}

function Resolve({ c, findingId }) {
  const { saveCase, setModal, busy, notify } = useWorkspace();
  const f = evaluateCase(c).findings.find((f) => f.id === findingId);
  const [note, setNote] = useState(f?.note || ''),
    [error, setError] = useState('');
  if (!f || f.blocking) return null;
  const submit = async (e) => {
    e.preventDefault();
    try {
      await saveCase({ ...c, resolutions: { ...c.resolutions, [f.id]: { note } } }, 'resolve');
      setModal(null);
      notify('Explanation saved. The original payment difference remains visible.');
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <Frame title="Document the difference" eyebrow="REVIEWER EXPLANATION" subtitle={c.name}>
      <form className="modal-form" onSubmit={submit}>
        <div className="modal-body">
          <div className="exception-summary">
            <Icon name="alert" size={20} />
            <div>
              <b>{f.title}</b>
              <p>{f.detail}</p>
            </div>
          </div>
          <Field
            label="Your explanation"
            hint="Describe what accounts for this difference and reference supporting evidence."
          >
            <textarea
              data-autofocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              minLength={10}
              maxLength={4000}
              required
              placeholder="Explain the difference and cite the relevant source…"
            />
          </Field>
          <p className="inline-note">
            <Icon name="info" size={15} />
            An explanation addresses this review check. It does not change the calculated amounts.
          </p>
          <ErrorMessage error={error} />
        </div>
        <div className="modal-footer">
          <Button type="button" onClick={() => setModal(null)}>
            Cancel
          </Button>
          <Button variant="primary" disabled={busy || note.trim().length < 10}>
            Save explanation
          </Button>
        </div>
      </form>
    </Frame>
  );
}

function Source({ c, sourceKey, reference, fileId }) {
  const { setModal, saveCase, busy, notify, mode } = useWorkspace();
  const d = c.documents[sourceKey];
  const files = (c.attachments || []).filter((f) => f.category === sourceKey);
  const selectedFile = files.find((f) => f.id === fileId) || files[0];
  const [editing, setEditing] = useState(!d.available || !d.text.trim()),
    [text, setText] = useState(d.text),
    [title, setTitle] = useState(d.title),
    [ref, setRef] = useState(d.ref || '');
  const [error, setError] = useState(''),
    [view, setView] = useState(fileId ? 'original' : 'excerpt'),
    [fileURL, setFileURL] = useState(null);
  useEffect(() => {
    let disposed = false,
      objectURL;
    setFileURL(null);
    if (selectedFile) {
      if (mode === 'live') setFileURL('/api/files/' + encodeURIComponent(selectedFile.id));
      else
        loadDemoFile(selectedFile.id)
          .then((file) => {
            if (file && !disposed) {
              objectURL = URL.createObjectURL(file);
              setFileURL(objectURL);
            }
          })
          .catch(() => {});
    }
    return () => {
      disposed = true;
      if (objectURL) URL.revokeObjectURL(objectURL);
    };
  }, [selectedFile?.id, mode]);
  const submit = async (e) => {
    e.preventDefault();
    try {
      const next = structuredClone(c);
      next.documents[sourceKey] = { ...d, title, ref, text, available: Boolean(text.trim()) };
      await saveCase(next, 'evidence');
      setModal(null);
      notify('Source excerpt saved. Review the updated calculation inputs before deciding.');
    } catch (e) {
      setError(e.message);
    }
  };
  const lines = d.text.split('\n');
  return (
    <Frame title={DOC_LABELS[sourceKey]} eyebrow={c.id + ' / SOURCE EVIDENCE'} subtitle={c.name} drawer>
      <div className="source-toolbar">
        <div className="source-view-tabs">
          <button className={view === 'excerpt' ? 'selected' : ''} onClick={() => setView('excerpt')}>
            Source excerpt
          </button>
          <button
            disabled={!selectedFile}
            className={view === 'original' ? 'selected' : ''}
            onClick={() => setView('original')}
          >
            Original file{selectedFile && <Icon name="clip" size={12} />}
          </button>
        </div>
        <Button icon="upload" onClick={() => setModal({ type: 'upload', cid: c.id, key: sourceKey })}>
          Upload
        </Button>
      </div>
      {view === 'original' ? (
        <div className="original-view">
          <div className="original-file-info">
            <Icon name="file" size={24} />
            <div>
              <b>{selectedFile?.name}</b>
              <p>
                {size(selectedFile?.size || 0)} · {selectedFile ? date(selectedFile.createdAt) : ''}
              </p>
            </div>
            {fileURL && selectedFile?.mime === 'application/pdf' && (
              <a className="button secondary" href={fileURL} target="_blank" rel="noopener noreferrer">
                Open in new tab
              </a>
            )}
            {fileURL && (
              <a
                className="button secondary"
                href={mode === 'live' ? fileURL + '?download=1' : fileURL}
                download={selectedFile?.name}
              >
                <Icon name="download" size={15} />
                Download
              </a>
            )}
          </div>
          {fileURL && selectedFile?.mime === 'application/pdf' ? (
            <iframe title={'Original document ' + selectedFile.name} src={fileURL} className="pdf-preview" />
          ) : fileURL ? (
            <div className="text-original">
              <Icon name="file" size={35} />
              <h3>Original text document</h3>
              <p>Read the source excerpt or download the original file.</p>
              <button className="text-link" onClick={() => setView('excerpt')}>
                Read excerpt
                <Icon name="right" size={15} />
              </button>
            </div>
          ) : (
            <div className="text-original">
              <Icon name="alert" size={30} />
              <p>The file is unavailable in this browser. Upload it again to inspect the original.</p>
            </div>
          )}
        </div>
      ) : editing ? (
        <form className="modal-form source-edit" onSubmit={submit}>
          <div className="modal-body">
            <div className="source-edit-note">
              <Icon name="edit" size={17} />
              <p>
                Enter the relevant text from the original document. Verify all calculation inputs against this
                source.
              </p>
            </div>
            <Field label="Source title">
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
            </Field>
            <Field label="Source reference">
              <input
                placeholder="e.g. Section 2.4 or Sheet 1, B2:B6"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                maxLength={120}
              />
            </Field>
            <Field label="Reviewer-entered source excerpt">
              <textarea
                className="source-text-editor"
                data-autofocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={200000}
                placeholder="Paste the relevant agreement terms, balance sheet rows, adjustment details, or payment confirmation…"
                required
              />
            </Field>
            <ErrorMessage error={error} />
          </div>
          <div className="modal-footer">
            <Button type="button" onClick={() => setEditing(false)}>
              Cancel edit
            </Button>
            <Button variant="primary" disabled={busy || !text.trim()}>
              Save source excerpt
            </Button>
          </div>
        </form>
      ) : (
        <>
          <div className="source-meta">
            <span className="source-tag">
              {c.sample ? 'Fictional sample exhibit' : 'Reviewer-entered excerpt'}
            </span>
            <span>{d.ref || 'Reference not set'}</span>
            <button className="text-link" onClick={() => setEditing(true)}>
              <Icon name="edit" size={13} />
              Edit excerpt
            </button>
          </div>
          <div className="source-paper">
            <div className="source-paper-head">
              <Logo compact />
              <span>REVIEW SOURCE / {sourceKey.toUpperCase()}</span>
            </div>
            <h3>{d.title}</h3>
            <div className="source-lines">
              {lines.map((line, i) => (
                <div key={i} className={reference && line.includes(reference) ? 'highlighted' : ''}>
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <p>{line || ' '}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="source-footer">
            <span>
              <Icon name="link" size={14} />
              Linked to {c.id} · revision {c.revision}
            </span>
            <button className="text-link" onClick={() => setEditing(true)}>
              Update excerpt
              <Icon name="edit" size={13} />
            </button>
          </div>
        </>
      )}
    </Frame>
  );
}

function Upload({ c, initialCategory }) {
  const { uploadFile, setModal, notify, busy, mode } = useWorkspace();
  const [category, setCategory] = useState(
    initialCategory || Object.keys(DOC_LABELS).find((k) => !c.documents[k].available) || 'agreement',
  );
  const [file, setFile] = useState(null),
    [error, setError] = useState(''),
    [drag, setDrag] = useState(false),
    [working, setWorking] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setWorking(true);
    setError('');
    try {
      await uploadFile(c, category, file);
      setModal(null);
      notify(
        file.name.toLowerCase().endsWith('.pdf')
          ? 'PDF attached. Add its source excerpt and verify the financial inputs.'
          : 'Document uploaded and its text added as the source excerpt.',
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setWorking(false);
    }
  };
  return (
    <Frame title="Add the supporting evidence" eyebrow={c.id + ' / DOCUMENT UPLOAD'} subtitle={c.name}>
      <form className="modal-form" onSubmit={submit}>
        <div className="modal-body">
          <Field label="Source category">
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {Object.entries(DOC_LABELS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <label
            className={'upload-dropzone ' + (drag ? 'dragging' : '')}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              setFile(e.dataTransfer.files[0] || null);
            }}
          >
            <input
              type="file"
              accept="application/pdf,text/plain,text/csv,.pdf,.txt,.csv"
              onChange={(e) => setFile(e.target.files[0] || null)}
            />
            <span className="upload-symbol">
              <Icon name={file ? 'filecheck' : 'upload'} size={27} />
            </span>
            <b>{file ? file.name : 'Choose a document or drop it here'}</b>
            <p>{file ? size(file.size) : 'PDF, TXT, or CSV · up to 10 MB'}</p>
            <span className="button secondary">{file ? 'Choose a different file' : 'Browse files'}</span>
          </label>
          <div className="upload-explainer">
            <Icon name="info" size={18} />
            <p>
              Text and CSV contents become the source excerpt. For PDFs, inspect the original and enter an
              excerpt before the evidence check can pass. Uploading a file clears any prior decision.
            </p>
          </div>
          <p className="small muted">
            {mode === 'demo'
              ? 'Demo uploads are stored in this browser.'
              : 'Files are saved to your signed-in workspace.'}
          </p>
          <ErrorMessage error={error} />
        </div>
        <div className="modal-footer">
          <Button type="button" onClick={() => setModal(null)} disabled={working}>
            Cancel
          </Button>
          <Button variant="primary" icon={working ? 'spinner' : 'upload'} disabled={!file || working || busy}>
            {working ? 'Uploading…' : 'Upload document'}
          </Button>
        </div>
      </form>
    </Frame>
  );
}

function Metadata({ c }) {
  const { saveCase, setModal, busy, notify } = useWorkspace();
  const [assignee, setAssignee] = useState(c.assignee || 'You'),
    [dueDate, setDueDate] = useState(c.dueDate || ''),
    [error, setError] = useState('');
  return (
    <Frame title="Review details" subtitle={c.name}>
      <form
        className="modal-form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await saveCase({ ...c, assignee, dueDate }, 'metadata');
            setModal(null);
            notify('Review details updated.');
          } catch (e) {
            setError(e.message);
          }
        }}
      >
        <div className="modal-body">
          <Field
            label="Review owner label"
            hint="For your internal record. This does not invite anyone or grant access."
          >
            <input
              data-autofocus
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              required
              maxLength={160}
            />
          </Field>
          <Field label="Review due date">
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          <ErrorMessage error={error} />
        </div>
        <div className="modal-footer">
          <Button type="button" onClick={() => setModal(null)}>
            Cancel
          </Button>
          <Button variant="primary" disabled={busy}>
            Save details
          </Button>
        </div>
      </form>
    </Frame>
  );
}
function CommandDialog() {
  const { cases, navigate, setModal } = useWorkspace();
  const [q, setQ] = useState('');
  const found = cases
    .filter((c) => (c.name + c.id + c.buyer + c.seller).toLowerCase().includes(q.toLowerCase()))
    .slice(0, 8);
  return (
    <Frame title="Find your next review" compact>
      <div className="command-search">
        <Icon name="search" size={20} />
        <input
          data-autofocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a business, case ID, or party…"
          aria-label="Find a review"
        />
      </div>
      <div className="command-results">
        <p className="eyebrow">REVIEWS</p>
        {found.map((c, i) => (
          <button
            key={c.id}
            onClick={() => {
              setModal(null);
              navigate('detail', c.id);
            }}
          >
            <Avatar name={c.name} index={i} />
            <span>
              <b>{c.name}</b>
              <small>
                {c.id} · {c.industry}
              </small>
            </span>
            <Badge state={evaluateCase(c).state} />
            <Icon name="chevron" size={15} />
          </button>
        ))}
        {!found.length && <p className="quiet-empty">No matching reviews. Try a business name or case ID.</p>}
        <p className="eyebrow">GO TO</p>
        {[
          ['overview', 'Portfolio overview'],
          ['evidence', 'Evidence library'],
          ['activity', 'Workspace activity'],
        ].map(([p, l]) => (
          <button
            key={p}
            onClick={() => {
              setModal(null);
              navigate(p);
            }}
          >
            <Icon name={p} />
            <span>{l}</span>
            <Icon name="chevron" size={15} />
          </button>
        ))}
      </div>
      <div className="command-footer">
        <span>
          <kbd>esc</kbd> to close
        </span>
        <span>All your reviews, one search.</span>
      </div>
    </Frame>
  );
}
export default function Dialogs() {
  const { modal, setModal, cases, navigate, importSnapshot, exportJSON, report, resetDemo } = useWorkspace();
  if (!modal) return null;
  const c = cases.find((c) => c.id === modal.cid);
  if (modal.type === 'new') return <CaseForm />;
  if (modal.type === 'edit' && c) return <CaseForm c={c} />;
  if (modal.type === 'metadata' && c) return <Metadata c={c} />;
  if (modal.type === 'resolve' && c) return <Resolve c={c} findingId={modal.findingId} />;
  if (modal.type === 'source' && c)
    return <Source c={c} sourceKey={modal.key} reference={modal.ref} fileId={modal.fileId} />;
  if (modal.type === 'upload' && c) return <Upload c={c} initialCategory={modal.key} />;
  if (modal.type === 'command') return <CommandDialog />;
  if (modal.type === 'upload-select' || modal.type === 'export-select')
    return (
      <Frame
        title={modal.type === 'upload-select' ? 'Which review is this for?' : 'Choose a review package'}
        subtitle="Keep every file and export connected to its acquisition."
      >
        <div className="modal-body case-picker">
          {cases.map((c, i) => (
            <button
              key={c.id}
              onClick={() =>
                setModal({ type: modal.type === 'upload-select' ? 'upload' : 'export', cid: c.id })
              }
            >
              <Avatar name={c.name} index={i} />
              <span>
                <b>{c.name}</b>
                <small>{c.id}</small>
              </span>
              <Icon name="chevron" size={17} />
            </button>
          ))}
          {!cases.length && (
            <div className="quiet-empty">
              Create a review to get started.
              <Button variant="primary" onClick={() => setModal({ type: 'new' })}>
                Create a review
              </Button>
            </div>
          )}
        </div>
      </Frame>
    );
  if (modal.type === 'export' && c)
    return (
      <Frame
        title="The full review, ready to share."
        eyebrow={c.id + ' / REVIEW PACKAGE'}
        subtitle="Take the calculation, findings, source excerpts, and decision with you."
      >
        <div className="modal-body export-options">
          <button
            onClick={() => {
              report(c);
              setModal(null);
            }}
          >
            <span className="export-symbol">
              <Icon name="filecheck" size={25} />
            </span>
            <span>
              <b>Printable review package</b>
              <p>
                A considered report with the calculation trail, findings, source excerpts, and review history.
                Print or save as PDF.
              </p>
            </span>
            <Icon name="arrow" size={18} />
          </button>
          <button
            onClick={() => {
              exportJSON(c);
              setModal(null);
            }}
          >
            <span className="export-symbol">
              <Icon name="download" size={25} />
            </span>
            <span>
              <b>Portable JSON snapshot</b>
              <p>A structured copy of the review. Uploaded file binaries are separate from the snapshot.</p>
            </span>
            <Icon name="arrow" size={18} />
          </button>
        </div>
      </Frame>
    );
  if (modal.type === 'import')
    return (
      <Frame
        title="Bring your review into focus."
        eyebrow="IMPORT A SNAPSHOT"
        subtitle="Continue from an exported CloseTrace review."
      >
        <div className="modal-body">
          <div className="import-illustration">
            <Icon name="file" size={48} />
            <Icon name="right" size={23} />
            <Logo compact />
          </div>
          <p className="body-copy">
            Choose a CloseTrace JSON snapshot under 1 MB. The import creates a new case with the entered
            inputs and source excerpts. Confirmations and prior decisions are cleared for a fresh review.
          </p>
          <p className="inline-note">
            <Icon name="clip" size={15} />
            Original uploaded files can be added again after import.
          </p>
        </div>
        <div className="modal-footer">
          <Button onClick={() => setModal(null)}>Cancel</Button>
          <Button
            variant="primary"
            icon="upload"
            onClick={() => {
              setModal(null);
              importSnapshot();
            }}
          >
            Choose JSON file
          </Button>
        </div>
      </Frame>
    );
  if (modal.type === 'reset')
    return (
      <Frame
        title="Restore the demo portfolio?"
        subtitle="This replaces demo changes on this device with the original six fictional reviews."
      >
        <div className="modal-body">
          <p className="body-copy">
            Export any demo review you want to keep before restoring the sample portfolio. Your saved
            workspace is separate.
          </p>
        </div>
        <div className="modal-footer">
          <Button onClick={() => setModal(null)}>Keep my changes</Button>
          <Button variant="primary" icon="refresh" onClick={resetDemo}>
            Restore demo
          </Button>
        </div>
      </Frame>
    );
  if (modal.type === 'sign-in')
    return (
      <Frame
        title="A workspace that stays with you."
        eyebrow="YOUR SAVED REVIEWS"
        subtitle="Sign in to save cases and documents across devices."
      >
        <div className="modal-body">
          <div className="signin-illustration">
            <Icon name="lock" size={35} />
          </div>
          <div className="signin-benefits">
            {[
              [
                'database',
                'Saved case records',
                'Keep calculations, explanations, and decisions in your private workspace.',
              ],
              ['files', 'Original documents', 'Attach PDFs, text files, and CSVs directly to each review.'],
              ['shield', 'Recorded identity', 'Save reviewer decisions with your signed-in identity.'],
            ].map(([i, t, p]) => (
              <div key={t}>
                <Icon name={i} size={21} />
                <span>
                  <b>{t}</b>
                  <p>{p}</p>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <Button onClick={() => setModal(null)}>Keep exploring</Button>
          <a
            className="button primary"
            href="/signin-with-chatgpt?return_to=%2F%23overview"
            target="_top"
            onClick={() => storageSet('closetrace-workspace-mode', 'live')}
          >
            <Icon name="signin" size={16} />
            Continue with ChatGPT
          </a>
        </div>
      </Frame>
    );
  return (
    <Frame
      title="A clearer path from source to sign-off."
      eyebrow="THE CLOSETRACE REVIEW GUIDE"
      subtitle="A focused workflow for acquisition working-capital reviews."
      wide
    >
      <div className="modal-body guide-content">
        {[
          [
            '01',
            'Start with the acquisition',
            'Add the legal parties, closing date, contractual target, and measurement date. Use the applicable agreement and lender policy as the starting point.',
            'reviews',
          ],
          [
            '02',
            'Connect the supporting evidence',
            'Add the agreement, closing balance sheet, adjustment statement, and payment confirmation. Inspect originals and enter the relevant source excerpts.',
            'files',
          ],
          [
            '03',
            'Reconcile and explain',
            'Confirm the account mapping. Check the calculated refund against the statement and payment. Document nonblocking differences and refer mixed or performance terms for specialist review.',
            'checklist',
          ],
          [
            '04',
            'Record a considered decision',
            'Once required checks are addressed, record the recommended treatment and rationale. Export a report that keeps the calculation, sources, and review history together.',
            'shield',
          ],
        ].map(([n, t, p, i]) => (
          <article key={n}>
            <span className="guide-step">{n}</span>
            <div>
              <h3>{t}</h3>
              <p>{p}</p>
            </div>
            <Icon name={i} size={22} />
          </article>
        ))}
        <div className="guide-bottom">
          <Icon name="info" size={18} />
          <p>
            CloseTrace supports a reviewer’s work. Contract interpretation, source verification, and policy
            applicability remain human review steps.
          </p>
        </div>
      </div>
      <div className="modal-footer">
        <Button
          variant="primary"
          icon="right"
          onClick={() => {
            setModal(null);
            navigate('reviews');
          }}
        >
          Open the review queue
        </Button>
      </div>
    </Frame>
  );
}
