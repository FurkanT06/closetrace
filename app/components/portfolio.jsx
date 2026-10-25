'use client';
import { useMemo, useState } from 'react';
import { useWorkspace } from '../context';
import { Icon, Avatar, Button, Badge, CardHead, Empty, date, fullDate, shortMoney } from './ui';
import { evaluateCase, money, DOC_LABELS } from '../../lib/engine.js';

export function PageHeading({ eyebrow, title, description, children }) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
const needsAttention = (e) => ['needs-review', 'insufficient', 'escalated'].includes(e.state);
export function ReviewTable({ items, overview = false }) {
  const { navigate, setModal } = useWorkspace();
  if (!items.length)
    return (
      <Empty
        title="No reviews here yet"
        action={
          <Button variant="primary" icon="plus" onClick={() => setModal({ type: 'new' })}>
            Create a review
          </Button>
        }
      >
        Start with an acquisition, then add the calculation inputs and supporting documents.
      </Empty>
    );
  return (
    <div className="table-scroll">
      <table className={'review-table ' + (overview ? 'compact-table' : '')}>
        <thead>
          <tr>
            <th>
              Business <Icon name="down" size={11} />
            </th>
            <th>Review status</th>
            <th className="money-col">Expected refund</th>
            <th>Due date</th>
            <th className="owner-col">Owner</th>
            <th aria-label="Open review" />
          </tr>
        </thead>
        <tbody>
          {items.map((c, i) => {
            const e = evaluateCase(c);
            return (
              <tr key={c.id}>
                <td>
                  <button className="business-link" onClick={() => navigate('detail', c.id)}>
                    <Avatar name={c.name} index={i} className="business-avatar" />
                    <span>
                      <b>{c.name}</b>
                      <small>
                        {c.id}
                        <span>·</span>
                        {c.industry}
                      </small>
                    </span>
                  </button>
                </td>
                <td>
                  <Badge state={e.state} />
                </td>
                <td className="money-col">
                  <b className="table-amount">{money(e.expected)}</b>
                  {e.variance !== null && e.variance !== 0 && (
                    <small className="amount-difference">{money(Math.abs(e.variance))} difference</small>
                  )}
                </td>
                <td>
                  <span className="table-date">{c.dueDate ? date(c.dueDate) : 'Not set'}</span>
                </td>
                <td className="owner-col">
                  <Avatar name={c.assignee || 'You'} className="owner-avatar" />
                </td>
                <td>
                  <button
                    className="table-open"
                    aria-label={'Open ' + c.name}
                    onClick={() => navigate('detail', c.id)}
                  >
                    <Icon name="chevron" size={17} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
function ActivityRows({ items, short = false }) {
  const { navigate } = useWorkspace();
  return (
    <div className={'activity-list ' + (short ? 'short' : '')}>
      {items.map((a, i) => (
        <div className="activity-row" key={a.caseId + a.at + i}>
          <span
            className={
              'activity-symbol ' +
              (a.title.includes('decision') || a.title.includes('completed') ? 'complete' : '')
            }
          >
            <Icon
              name={
                a.title.includes('decision') ? 'filecheck' : a.title.includes('vidence') ? 'file' : 'clock'
              }
              size={16}
            />
          </span>
          <div>
            <p>
              <b>{a.title}</b>
              <span className="activity-date">{date(a.at)}</span>
            </p>
            <button className="text-link activity-case" onClick={() => navigate('detail', a.caseId)}>
              {a.caseName}
              <Icon name="arrow" size={12} />
            </button>
            {!short && <p className="activity-detail">{a.detail}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
export const allActivity = (cases) =>
  cases
    .flatMap((c) => (c.audit || []).map((a) => ({ ...a, caseId: c.id, caseName: c.name })))
    .sort((a, b) => b.at.localeCompare(a.at));

export function Overview() {
  const { cases, mode, navigate, setModal, filter, setFilter } = useWorkspace();
  const evaluated = cases.map((c) => ({ c, e: evaluateCase(c) }));
  const active = evaluated.filter((x) => x.e.state !== 'reviewed'),
    attention = evaluated.filter((x) => needsAttention(x.e));
  const complete = evaluated.length - active.length,
    ready = evaluated.filter((x) => x.e.state === 'ready').length;
  const variance = evaluated.reduce((n, x) => n + (x.e.variance === null ? 0 : Math.abs(x.e.variance)), 0);
  const docs = evaluated.reduce((n, x) => n + x.e.sourceCount, 0),
    totalDocs = cases.length * 4;
  const priority =
    evaluated.find((x) => x.e.variance !== null && x.e.variance !== 0 && x.e.state !== 'reviewed') ||
    attention[0];
  const percent = cases.length ? Math.round((complete / cases.length) * 100) : 0;
  const filtered = evaluated
    .filter(
      (x) =>
        filter === 'all' ||
        (filter === 'attention' && needsAttention(x.e)) ||
        (filter === 'ready' && x.e.state === 'ready') ||
        (filter === 'reviewed' && x.e.state === 'reviewed'),
    )
    .map((x) => x.c);
  const due = active
    .filter((x) => x.c.dueDate)
    .sort((a, b) => a.c.dueDate.localeCompare(b.c.dueDate))
    .slice(0, 2);
  return (
    <div className="page overview-page">
      <PageHeading
        eyebrow="THE COMPLETE PICTURE"
        title="Portfolio overview"
        description="Every adjustment, accounted for. Keep your next close moving."
      >
        <Button icon="upload" onClick={() => setModal({ type: 'import' })}>
          Import review
        </Button>
        <Button variant="primary" icon="plus" onClick={() => setModal({ type: 'new' })}>
          New review
        </Button>
      </PageHeading>
      <div className="metrics-grid">
        {[
          {
            label: 'Active reviews',
            value: active.length.toString().padStart(2, '0'),
            icon: 'reviews',
            note: 'Across your acquisition portfolio',
            style: 'green',
          },
          {
            label: 'Needs attention',
            value: attention.length.toString().padStart(2, '0'),
            icon: 'alert',
            note: 'Open checks or missing evidence',
            style: 'amber',
          },
          {
            label: 'Payment differences',
            value: shortMoney(variance),
            icon: 'link',
            note: 'Absolute difference from calculations',
            style: 'sage',
          },
          {
            label: 'Ready for decision',
            value: ready.toString().padStart(2, '0'),
            icon: 'filecheck',
            note: 'All required checks addressed',
            style: 'green',
          },
        ].map((m) => (
          <section key={m.label} className="metric-card">
            <div className="metric-label">
              <span>{m.label}</span>
              <span className={'metric-icon ' + m.style}>
                <Icon name={m.icon} size={17} />
              </span>
            </div>
            <div className={'metric-value ' + m.style}>{m.value}</div>
            <p>{m.note}</p>
          </section>
        ))}
      </div>
      {priority && (
        <div className="attention-banner">
          <span className="attention-icon">
            <Icon name="alert" size={22} />
          </span>
          <div>
            <b>{priority.e.variance ? 'A payment needs a closer look.' : 'A review needs your attention.'}</b>
            <p>
              {priority.c.name}
              {priority.e.variance
                ? ' has a ' +
                  money(Math.abs(priority.e.variance)) +
                  ' difference between the calculated refund and payment evidence.'
                : ' has open checks to address before a decision can be recorded.'}
            </p>
          </div>
          <button onClick={() => navigate('detail', priority.c.id)}>
            Review {priority.e.variance ? 'difference' : 'case'}
            <Icon name="right" size={17} />
          </button>
        </div>
      )}
      <div className="overview-grid">
        <div className="overview-main">
          <section className="card reviews-card">
            <CardHead
              title="Your reviews"
              subtitle={
                mode === 'demo'
                  ? 'A fictional portfolio to explore the full workflow.'
                  : 'From the first source document to the final decision.'
              }
              action={
                <button className="text-link" onClick={() => navigate('reviews')}>
                  View all reviews
                  <Icon name="arrow" size={14} />
                </button>
              }
            />
            <div className="table-toolbar">
              <div className="segmented-tabs" aria-label="Filter reviews">
                {[
                  ['all', 'All reviews', cases.length],
                  ['attention', 'Needs attention', attention.length],
                  ['ready', 'Ready', ready],
                ].map(([key, label, n]) => (
                  <button
                    key={key}
                    className={filter === key ? 'selected' : ''}
                    onClick={() => setFilter(key)}
                  >
                    {label}
                    <span>{n}</span>
                  </button>
                ))}
              </div>
              <span className="table-toolbar-hint">
                <Icon name="shield" size={13} />
                Evidence-led reviews
              </span>
            </div>
            <ReviewTable items={filtered.slice(0, 6)} overview />
            <div className="table-bottom">
              <span>
                {filtered.length} review{filtered.length === 1 ? '' : 's'} in this view
              </span>
              <span>
                USD
                <Icon name="down" size={11} />
              </span>
            </div>
          </section>
          <section className="card recent-activity">
            <CardHead
              title="The latest in your workspace"
              action={
                <button className="text-link" onClick={() => navigate('activity')}>
                  All activity
                  <Icon name="arrow" size={14} />
                </button>
              }
            />
            {allActivity(cases).length ? (
              <ActivityRows items={allActivity(cases).slice(0, 3)} short />
            ) : (
              <div className="quiet-empty">New reviews and decisions will appear here.</div>
            )}
          </section>
        </div>
        <aside className="overview-aside">
          <section className="card readiness-card">
            <CardHead title="Review readiness" subtitle="A little clarity, at a glance." />
            <div className="readiness-chart">
              <svg viewBox="0 0 160 160" aria-label={percent + '% of reviews completed'} role="img">
                <circle cx="80" cy="80" r="66" fill="none" stroke="#edf1e9" strokeWidth="11" />
                <circle
                  cx="80"
                  cy="80"
                  r="66"
                  fill="none"
                  stroke="#345f4a"
                  strokeWidth="11"
                  strokeLinecap="round"
                  pathLength="100"
                  strokeDasharray={percent + ' 100'}
                  transform="rotate(-90 80 80)"
                />
              </svg>
              <div>
                <b>
                  {percent}
                  <span>%</span>
                </b>
                <small>reviews completed</small>
              </div>
            </div>
            <div className="readiness-legend">
              {[
                ['complete', 'Reviewed', complete],
                ['ready', 'Ready for decision', ready],
                ['attention', 'Needs attention', attention.length],
              ].map(([k, l, n]) => (
                <div key={k}>
                  <span>
                    <i className={k} />
                    {l}
                  </span>
                  <b>{n.toString().padStart(2, '0')}</b>
                </div>
              ))}
            </div>
            <div className="evidence-coverage">
              <span>
                <Icon name="files" size={15} />
                Evidence coverage
                <b>
                  {docs}/{totalDocs}
                </b>
              </span>
              <div className="progress-track">
                <span style={{ width: (totalDocs ? (docs / totalDocs) * 100 : 0) + '%' }} />
              </div>
              <small>Required source excerpts available</small>
            </div>
          </section>
          <section className="card upcoming-card">
            <CardHead title="Coming up" action={<Icon name="calendar" size={17} />} />
            {due.length ? (
              due.map(({ c }, i) => (
                <button className="deadline-row" key={c.id} onClick={() => navigate('detail', c.id)}>
                  <span className="deadline-date">
                    <small>
                      {new Date(c.dueDate + 'T12:00:00Z').toLocaleString('en-US', { month: 'short' })}
                    </small>
                    <b>{Number(c.dueDate.slice(-2))}</b>
                  </span>
                  <span>
                    <b>{c.name}</b>
                    <small>Review due · {c.id}</small>
                  </span>
                  <Icon name="chevron" size={15} />
                </button>
              ))
            ) : (
              <p className="quiet-empty">No open reviews with due dates.</p>
            )}
          </section>
          <div className="insight-card">
            <div className="insight-orbit" aria-hidden="true">
              <span />
              <span />
              <span />
              <Icon name="shield" size={28} />
            </div>
            <p className="eyebrow">FROM SOURCE TO SIGN-OFF</p>
            <h3>
              Confidence is in
              <br />
              the details.
            </h3>
            <p>Trace each number. Explain each difference. Keep the full story with the file.</p>
            <button onClick={() => setModal({ type: 'guide' })}>
              See the review workflow
              <Icon name="arrow" size={15} />
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function Reviews() {
  const { cases, search, setSearch, filter, setFilter, setModal, importSnapshot } = useWorkspace();
  const [sort, setSort] = useState('due');
  const items = cases
    .filter((c) => {
      const e = evaluateCase(c);
      return (
        (filter === 'all' || (filter === 'attention' && needsAttention(e)) || e.state === filter) &&
        [c.name, c.id, c.buyer, c.seller, c.assignee].some((v) =>
          v?.toLowerCase().includes(search.toLowerCase()),
        )
      );
    })
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name)
        : sort === 'variance'
          ? Math.abs(evaluateCase(b).variance || 0) - Math.abs(evaluateCase(a).variance || 0)
          : (a.dueDate || '9999').localeCompare(b.dueDate || '9999'),
    );
  return (
    <div className="page">
      <PageHeading
        eyebrow="FROM SOURCE TO SIGN-OFF"
        title="All reviews"
        description="One place for your calculations, evidence, and reviewer decisions."
      >
        <Button icon="upload" onClick={importSnapshot}>
          Import snapshot
        </Button>
        <Button variant="primary" icon="plus" onClick={() => setModal({ type: 'new' })}>
          New review
        </Button>
      </PageHeading>
      <section className="card">
        <div className="reviews-tools">
          <label className="search-input">
            <Icon name="search" size={17} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search businesses, case IDs, or parties"
              aria-label="Search reviews"
            />
            {search && (
              <button aria-label="Clear search" onClick={() => setSearch('')}>
                <Icon name="close" size={14} />
              </button>
            )}
          </label>
          <label className="select-label">
            <Icon name="filter" size={15} />
            <select aria-label="Review status" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="attention">Needs attention</option>
              <option value="ready">Ready for decision</option>
              <option value="reviewed">Reviewed</option>
              <option value="insufficient">Evidence missing</option>
              <option value="escalated">Escalated</option>
            </select>
          </label>
          <label className="select-label">
            <span>Sort:</span>
            <select aria-label="Sort reviews" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="due">Due date</option>
              <option value="name">Business name</option>
              <option value="variance">Largest difference</option>
            </select>
          </label>
        </div>
        {items.length ? (
          <ReviewTable items={items} />
        ) : (
          <Empty
            icon="search"
            title={cases.length ? 'No matching reviews' : 'Your first review starts here'}
            action={
              cases.length ? (
                <Button
                  onClick={() => {
                    setSearch('');
                    setFilter('all');
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button variant="primary" icon="plus" onClick={() => setModal({ type: 'new' })}>
                  Create a review
                </Button>
              )
            }
          >
            {cases.length
              ? 'Try a different name, case ID, or review status.'
              : 'Add an acquisition and build a review supported by the source documents.'}
          </Empty>
        )}
        <div className="table-bottom">
          <span>
            {items.length} of {cases.length} reviews
          </span>
          <span>Amounts in USD</span>
        </div>
      </section>
    </div>
  );
}

export function EvidenceLibrary() {
  const { cases, setModal, navigate } = useWorkspace();
  const [query, setQuery] = useState(''),
    [category, setCategory] = useState('all');
  const docs = cases.flatMap((c) => Object.keys(DOC_LABELS).map((key) => ({ c, key, d: c.documents[key] })));
  const filtered = docs.filter(
    ({ c, key, d }) =>
      (category === 'all' || category === 'missing'
        ? category !== 'missing' || !d.available || !d.text.trim()
        : key === category) && (c.name + d.title + c.id).toLowerCase().includes(query.toLowerCase()),
  );
  const missing = docs.filter((x) => !x.d.available || !x.d.text.trim()).length;
  return (
    <div className="page">
      <PageHeading
        eyebrow="THE STORY BEHIND THE NUMBERS"
        title="Evidence library"
        description="Find the source behind a calculation. Keep every supporting document in context."
      >
        <Button variant="primary" icon="upload" onClick={() => setModal({ type: 'upload-select' })}>
          Add evidence
        </Button>
      </PageHeading>
      <div className="library-stats">
        <span>
          <Icon name="files" />
          {docs.length - missing} source excerpts available
        </span>
        <span>
          <Icon name="clip" />
          {cases.reduce((n, c) => n + (c.attachments || []).length, 0)} uploaded files
        </span>
        <span className={missing ? 'amber-text' : ''}>
          <Icon name="alert" />
          {missing} missing excerpts
        </span>
      </div>
      <section className="card">
        <div className="reviews-tools">
          <label className="search-input">
            <Icon name="search" size={17} />
            <input
              placeholder="Search documents or businesses"
              aria-label="Search evidence"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label className="select-label">
            <Icon name="filter" size={15} />
            <select
              value={category}
              aria-label="Evidence category"
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">All sources</option>
              {Object.entries(DOC_LABELS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
              <option value="missing">Missing excerpts</option>
            </select>
          </label>
        </div>
        <div className="library-document-grid">
          {filtered.map(({ c, key, d }) => (
            <article className={'document-tile ' + (!d.available ? 'missing-doc' : '')} key={c.id + key}>
              <div className="document-top">
                <span className={'document-icon ' + (key === 'balance' ? 'spreadsheet' : '')}>
                  <Icon name={key === 'balance' ? 'sheet' : 'file'} size={23} />
                </span>
                <span className={'source-tag ' + (!d.available || !d.text.trim() ? 'missing' : '')}>
                  {d.available && d.text.trim()
                    ? c.sample
                      ? 'Sample source'
                      : 'Source excerpt'
                    : 'Excerpt needed'}
                </span>
              </div>
              <small>{DOC_LABELS[key]}</small>
              <h3>{d.title}</h3>
              <button className="text-link" onClick={() => navigate('detail', c.id)}>
                {c.name}
                <Icon name="arrow" size={12} />
              </button>
              <div className="document-bottom">
                <span>{d.ref || 'No reference set'}</span>
                <button onClick={() => setModal({ type: 'source', cid: c.id, key })}>
                  {d.available && d.text.trim() ? 'Inspect source' : 'Add source'}
                  <Icon name="chevron" size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
        {!filtered.length && (
          <Empty icon="search" title="No sources found">
            Add a review or try a different search.
          </Empty>
        )}
      </section>
      <p className="page-footnote">
        <Icon name="info" size={13} />
        Calculation inputs and document excerpts require reviewer verification. Uploaded PDFs are stored for
        inspection; text is entered by a reviewer.
      </p>
    </div>
  );
}

export function Activity() {
  const { cases } = useWorkspace();
  const [query, setQuery] = useState('');
  const items = useMemo(
    () =>
      allActivity(cases).filter((a) =>
        (a.caseName + a.title + a.detail).toLowerCase().includes(query.toLowerCase()),
      ),
    [cases, query],
  );
  return (
    <div className="page">
      <PageHeading
        eyebrow="EVERY STEP, IN CONTEXT"
        title="Workspace activity"
        description="Follow the reviews, source changes, and decisions behind your portfolio."
      />
      <section className="card activity-page-card">
        <div className="reviews-tools">
          <label className="search-input">
            <Icon name="search" size={17} />
            <input
              aria-label="Search activity"
              value={query}
              placeholder="Search activity or businesses"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <span className="muted small">{items.length} recorded events</span>
        </div>
        {items.length ? (
          <ActivityRows items={items} />
        ) : (
          <Empty icon="activity" title="No activity to show">
            Review events will appear here as work progresses.
          </Empty>
        )}
      </section>
    </div>
  );
}

export function Settings() {
  const { mode, user, connection, cases, setModal, switchMode, importSnapshot, refresh, busy } =
    useWorkspace();
  return (
    <div className="page settings-page">
      <PageHeading
        eyebrow="A PLACE FOR THE DETAILS"
        title="Workspace settings"
        description="Your workspace, saved data, and review defaults."
      />
      <section className="card settings-card">
        <CardHead title="Your workspace" subtitle="Private access is managed through your site's audience." />
        <div className="settings-row">
          <div>
            <b>Current workspace</b>
            <p>
              {mode === 'demo'
                ? 'Fictional reviews, saved on this device.'
                : 'Your signed-in reviews, stored in the hosted database.'}
            </p>
          </div>
          <span className="source-tag">{mode === 'demo' ? 'Demo' : 'Saved workspace'}</span>
        </div>
        <div className="settings-row">
          <div>
            <b>Account</b>
            <p>{user?.email || 'Sign in to access saved reviews and document storage.'}</p>
          </div>
          <Button
            icon={user ? 'refresh' : 'signin'}
            disabled={busy}
            onClick={user ? refresh : () => setModal({ type: 'sign-in' })}
          >
            {user ? 'Refresh connection' : 'Sign in'}
          </Button>
        </div>
        <div className="settings-row">
          <div>
            <b>Saved cases</b>
            <p>{cases.length} reviews in this workspace. Uploaded files stay linked to their case.</p>
          </div>
          <Button onClick={() => switchMode(mode === 'demo' ? 'live' : 'demo')}>
            {mode === 'demo' ? 'Open my workspace' : 'Explore demo'}
          </Button>
        </div>
      </section>
      <section className="card settings-card">
        <CardHead title="Data & portability" />
        <div className="settings-row">
          <div>
            <b>Import a review snapshot</b>
            <p>Bring in a CloseTrace JSON export. Prior decisions are cleared for a fresh review.</p>
          </div>
          <Button icon="upload" onClick={importSnapshot}>
            Import JSON
          </Button>
        </div>
        <div className="settings-row">
          <div>
            <b>Review packages</b>
            <p>
              Open any case to print its calculation, findings, sources, and decision or export a JSON
              snapshot.
            </p>
          </div>
          <Button icon="reviews" onClick={() => setModal({ type: 'export-select' })}>
            Choose review
          </Button>
        </div>
        <div className="settings-row">
          <div>
            <b>Document storage</b>
            <p>
              PDF, TXT, and CSV · up to 10 MB per file. PDF excerpts and calculation inputs are entered by the
              reviewer.
            </p>
          </div>
          <span className="muted">
            <Icon name="lock" size={20} />
          </span>
        </div>
        {mode === 'demo' && (
          <div className="settings-row">
            <div>
              <b>Restore the fictional portfolio</b>
              <p>Replace this device&apos;s demo changes with the six original example reviews.</p>
            </div>
            <Button onClick={() => setModal({ type: 'reset' })}>Reset demo</Button>
          </div>
        )}
      </section>
      <div className="settings-note">
        <Icon name="shield" size={20} />
        <div>
          <b>Review support, with a human decision.</b>
          <p>
            CloseTrace checks entered amounts and evidence availability. The reviewer confirms contract
            interpretation, account mapping, and governing policy. Recorded history supports the review record
            and is not a compliance certification.
          </p>
        </div>
      </div>
    </div>
  );
}
