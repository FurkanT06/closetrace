'use client';
import { uuid } from '../lib/ids.js';
import { useState, useEffect, useRef } from 'react';
import { WorkspaceContext } from './context';
import { Icon, Logo, Avatar, Button, IconButton, Empty } from './components/ui';
import { Overview, Reviews, EvidenceLibrary, Activity, Settings } from './components/portfolio';
import ReviewDetail from './components/review';
import Dialogs from './components/dialogs';
import { evaluateCase, DOC_LABELS } from '../lib/engine.js';
import {
  applyUploadedSource,
  portfolioSamples,
  normalizeCase,
  prepareCaseUpdate,
} from '../lib/case-model.js';
import { storageGet, storageSet } from '../lib/safe-storage.js';
import { storeDemoFile } from '../lib/demo-files.js';

const DEMO_KEY = 'closetrace-portfolio-v2';
const labels = {
  overview: 'Overview',
  reviews: 'All reviews',
  evidence: 'Evidence library',
  activity: 'Activity',
  settings: 'Workspace settings',
  detail: 'Review workspace',
};
async function api(path, options = {}) {
  const r = await fetch('/api/' + path, {
    ...options,
    headers: options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(data.error || 'The request could not be completed.');
    e.status = r.status;
    throw e;
  }
  return data;
}
export default function Workspace() {
  const [cases, setCases] = useState(() => portfolioSamples());
  const [mode, setMode] = useState('demo'),
    [user, setUser] = useState(null),
    [savedCases, setSavedCases] = useState([]);
  const [page, setPage] = useState('overview'),
    [selected, setSelected] = useState(null),
    [tab, setTab] = useState('reconciliation');
  const [modal, setModalState] = useState(null),
    [toast, setToast] = useState(null),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  const [connection, setConnection] = useState('checking'),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all');
  const [mobileMenu, setMobileMenu] = useState(false),
    [workspaceMenu, setWorkspaceMenu] = useState(false);
  const lock = useRef(false),
    modeRef = useRef('demo'),
    importRef = useRef(null);
  const demoRef = useRef(portfolioSamples()),
    focusBeforeDialog = useRef(null);
  const setModal = (next) => {
    if (next && !modal) focusBeforeDialog.current = document.activeElement;
    setModalState(next);
  };
  const notify = (message, error = false) => setToast({ message, error, key: Date.now() });

  useEffect(() => {
    try {
      const data = JSON.parse(localStorage.getItem(DEMO_KEY) || 'null');
      if (Array.isArray(data)) {
        demoRef.current = data.map(normalizeCase);
        setCases(demoRef.current);
      } else {
        const legacy = JSON.parse(localStorage.getItem('closetrace-demo-v1') || 'null');
        if (Array.isArray(legacy) && legacy.length) {
          const extra = portfolioSamples();
          const prior = legacy.map((c) => normalizeCase({ ...c, sample: true }));
          demoRef.current = [...prior, ...extra.filter((c) => !prior.some((p) => p.id === c.id))];
          setCases(demoRef.current);
        }
      }
    } catch {
      /* Keep the fictional portfolio if earlier device data is invalid. */
    }
    const restoreRoute = () => {
      const [p, id] = location.hash.slice(1).split('/');
      if (p === 'review' && id) {
        setSelected(decodeURIComponent(id));
        setPage('detail');
      } else if (labels[p] && p !== 'detail') {
        setPage(p);
        setSelected(null);
      }
    };
    restoreRoute();
    window.addEventListener('popstate', restoreRoute);
    api('workspace')
      .then((data) => {
        setUser(data.user);
        setSavedCases(data.cases);
        setConnection('connected');
        if (storageGet('closetrace-workspace-mode') === 'live') {
          modeRef.current = 'live';
          setMode('live');
          setCases(data.cases);
        }
      })
      .catch((e) => setConnection(e.status === 401 ? 'signed-out' : 'unavailable'))
      .finally(() => setLoaded(true));
    return () => window.removeEventListener('popstate', restoreRoute);
  }, []);
  useEffect(() => {
    const key = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setModal({ type: 'command' });
      }
      if (e.key === 'Escape') {
        setModal(null);
        setWorkspaceMenu(false);
        setMobileMenu(false);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (modal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      focusBeforeDialog.current?.focus?.();
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [Boolean(modal)]);
  const navigate = (p, id = null) => {
    setPage(p);
    setSelected(id);
    setTab('reconciliation');
    setMobileMenu(false);
    setSearch('');
    setFilter('all');
    history.pushState({}, '', '#' + (id ? 'review/' + encodeURIComponent(id) : p));
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const switchMode = (next) => {
    if (lock.current) {
      notify('Wait for the current change to finish before switching workspaces.');
      return;
    }
    if (next === 'live' && !user) {
      setModal({ type: 'sign-in' });
      setWorkspaceMenu(false);
      return;
    }
    if (mode === 'demo') demoRef.current = cases;
    setCases(next === 'demo' ? demoRef.current : savedCases);
    setMode(next);
    modeRef.current = next;
    storageSet('closetrace-workspace-mode', next);
    setWorkspaceMenu(false);
    navigate('overview');
  };
  const persistDemo = (next) => {
    try {
      localStorage.setItem(DEMO_KEY, JSON.stringify(next));
      demoRef.current = next;
    } catch {
      throw new Error('This browser is out of storage. Export your reviews before continuing.');
    }
  };
  const applySaved = (c) => {
    const next = cases.some((x) => x.id === c.id) ? cases.map((x) => (x.id === c.id ? c : x)) : [c, ...cases];
    if (modeRef.current === 'demo') persistDemo(next);
    else setSavedCases(next);
    setCases(next);
    return c;
  };
  const saveCase = async (input, action = 'edit') => {
    if (lock.current) throw new Error('Wait for the current change to finish saving.');
    lock.current = true;
    setBusy(true);
    try {
      const existing = cases.find((x) => x.id === input.id);
      let c;
      if (modeRef.current === 'demo') {
        c = prepareCaseUpdate(existing, input, 'Demo reviewer', existing ? action : 'create').caseData;
        c.sample = input.sample;
        c.attachments = input.attachments || existing?.attachments || [];
        c._version = (existing?._version || 0) + 1;
      } else {
        const data = await api(existing ? 'cases/' + input.id : 'cases', {
          method: existing ? 'PUT' : 'POST',
          body: JSON.stringify({ caseData: input, action, expectedVersion: existing?._version }),
        });
        c = data.caseData;
      }
      return applySaved(c);
    } finally {
      setBusy(false);
      lock.current = false;
    }
  };
  const uploadFile = async (c, category, file) => {
    if (file.size === 0 || file.size > 10000000)
      throw new Error('Choose a nonempty file smaller than 10 MB.');
    const ext = file.name.split('.').at(-1).toLowerCase();
    if (!['pdf', 'txt', 'csv'].includes(ext)) throw new Error('Choose a PDF, TXT, or CSV file.');
    if (modeRef.current === 'demo') {
      let text = '';
      const bytes = await file.arrayBuffer();
      if (ext === 'pdf') {
        if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-')
          throw new Error('This file does not appear to be a PDF.');
      } else {
        text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        if (text.length > 200000 || text.includes('\u0000'))
          throw new Error('Use a text source under 200,000 characters.');
      }
      const id = uuid();
      await storeDemoFile(id, file);
      const next = structuredClone(c);
      applyUploadedSource(next, category, { name: file.name, ext, text });
      next.attachments = [
        {
          id,
          category,
          name: file.name,
          size: file.size,
          mime: ext === 'pdf' ? 'application/pdf' : 'text/plain',
          createdAt: new Date().toISOString(),
          local: true,
        },
        ...(c.attachments || []),
      ];
      return saveCase(next, 'evidence');
    }
    if (lock.current) throw new Error('Wait for the current change to finish.');
    lock.current = true;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('category', category);
      form.append('expectedVersion', c._version);
      const data = await api('cases/' + c.id + '/files', { method: 'POST', body: form });
      return applySaved(data.caseData);
    } finally {
      setBusy(false);
      lock.current = false;
    }
  };
  const refresh = async () => {
    if (mode === 'demo') {
      notify('The demo portfolio is saved on this device.');
      return;
    }
    setBusy(true);
    try {
      const data = await api('workspace');
      setCases(data.cases);
      setSavedCases(data.cases);
      setConnection('connected');
      notify('Your workspace is up to date.');
    } catch (e) {
      notify(e.message, true);
    } finally {
      setBusy(false);
    }
  };
  const exportJSON = (c) => {
    const blob = new Blob([JSON.stringify({ schemaVersion: 1, caseData: c }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = c.id + '-review.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Review snapshot exported.');
  };
  const report = (c) => {
    try {
      localStorage.setItem('closetrace-report-' + c.id, JSON.stringify(c));
      window.open('/report?id=' + encodeURIComponent(c.id), '_blank', 'noopener');
    } catch {
      notify('The report is too large for this browser. Export the JSON snapshot instead.', true);
    }
  };
  const importFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      if (file.size > 1000000) throw new Error('Choose a review JSON file under 1 MB.');
      const data = JSON.parse(await file.text());
      if (data.schemaVersion !== 1 || !data.caseData) throw new Error('Choose a CloseTrace review snapshot.');
      const c = normalizeCase(data.caseData);
      c.id = 'CT-' + uuid().slice(0, 8).toUpperCase();
      c.review = null;
      c.resolutions = {};
      c.notes = [];
      c.audit = [];
      c.attachments = [];
      c.policyConfirmed = false;
      c.mappingConfirmed = false;
      const saved = await saveCase(c, 'create');
      navigate('detail', saved.id);
      notify('Snapshot imported. Confirm the policy and account mapping before review.');
    } catch (e) {
      notify(e instanceof SyntaxError ? 'This file is not valid JSON.' : e.message, true);
    }
  };
  const resetDemo = () => {
    const next = portfolioSamples();
    persistDemo(next);
    setCases(next);
    navigate('overview');
    setModal(null);
    notify('The fictional portfolio has been restored.');
  };
  const context = {
    cases,
    mode,
    user,
    page,
    selected,
    tab,
    setTab,
    modal,
    setModal,
    notify,
    busy,
    loaded,
    connection,
    search,
    setSearch,
    filter,
    setFilter,
    navigate,
    saveCase,
    uploadFile,
    exportJSON,
    report,
    refresh,
    resetDemo,
    switchMode,
    importSnapshot: () => importRef.current.click(),
  };
  const activeCount = cases.filter((c) => evaluateCase(c).state !== 'reviewed').length;
  const current = cases.find((c) => c.id === selected);
  return (
    <WorkspaceContext.Provider value={context}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <div className={'app-layout ' + (mobileMenu ? 'mobile-open' : '')} inert={modal ? true : undefined}>
        <aside className="sidebar" aria-label="Main navigation">
          <button
            className="brand-button"
            onClick={() => navigate('overview')}
            aria-label="CloseTrace overview"
          >
            <Logo />
          </button>
          <div className="workspace-switcher">
            <button
              className="workspace-current"
              aria-label={
                'Switch workspace. Current: ' + (mode === 'demo' ? 'Demo workspace' : 'My workspace')
              }
              title="Switch workspace"
              aria-expanded={workspaceMenu}
              onClick={() => setWorkspaceMenu(!workspaceMenu)}
            >
              <span className="workspace-symbol">
                <Icon name="building" size={16} />
              </span>
              <span>
                <b>{mode === 'demo' ? 'Demo workspace' : 'My workspace'}</b>
                <small>SBA acquisition reviews</small>
              </span>
              <Icon name="down" size={14} />
            </button>
            {workspaceMenu && (
              <div className="workspace-options">
                <button onClick={() => switchMode('demo')}>
                  <Icon name="eye" />
                  Fictional portfolio{mode === 'demo' && <Icon name="check" />}
                </button>
                <button onClick={() => switchMode('live')}>
                  <Icon name="lock" />
                  My saved workspace{mode === 'live' && <Icon name="check" />}
                </button>
              </div>
            )}
          </div>
          <p className="nav-section">WORKSPACE</p>
          <nav>
            {['overview', 'reviews', 'evidence', 'activity'].map((p) => (
              <button
                key={p}
                aria-label={'Navigate to ' + labels[p]}
                title={labels[p]}
                className={
                  'nav-item ' + (page === p || (p === 'reviews' && page === 'detail') ? 'active' : '')
                }
                onClick={() => navigate(p)}
              >
                <Icon name={p} />
                <span>{labels[p]}</span>
                {p === 'reviews' && <b className="nav-count">{activeCount}</b>}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-guide">
              <span className="guide-symbol">
                <Icon name="shield" size={22} />
              </span>
              <h3>A clearer path to close.</h3>
              <p>Every calculation connected to its supporting evidence.</p>
              <button onClick={() => setModal({ type: 'guide' })}>
                Explore the review guide
                <Icon name="arrow" size={15} />
              </button>
            </div>
            <button
              aria-label="Workspace settings"
              title="Workspace settings"
              className={'nav-item ' + (page === 'settings' ? 'active' : '')}
              onClick={() => navigate('settings')}
            >
              <Icon name="settings" />
              <span>Workspace settings</span>
            </button>
            <div className="sidebar-profile">
              <Avatar name={user?.name || 'Furkan'} />
              <div>
                <b>{user?.name?.includes('@') ? user.name.split('@')[0] : user?.name || 'Furkan'}</b>
                <small>{mode === 'demo' ? 'Exploring CloseTrace' : 'Private workspace'}</small>
              </div>
              <Icon name="shield" size={16} />
            </div>
          </div>
        </aside>
        {mobileMenu && (
          <button
            className="sidebar-scrim"
            aria-label="Close navigation"
            onClick={() => setMobileMenu(false)}
          />
        )}
        <div className="main-shell">
          <header className="topbar">
            <div className="topbar-left">
              <button
                className="mobile-menu icon-button"
                aria-label="Open navigation"
                onClick={() => setMobileMenu(!mobileMenu)}
              >
                <Icon name="menu" />
              </button>
              <span className="breadcrumb-home">Workspace</span>
              <Icon name="chevron" size={13} />
              <span>{labels[page]}</span>
            </div>
            <div className="topbar-right">
              <button
                className="global-search"
                aria-label="Find a review"
                onClick={() => setModal({ type: 'command' })}
              >
                <Icon name="search" size={16} />
                <span>Find a review</span>
                <kbd>⌘ K</kbd>
              </button>
              <span className={'workspace-tag ' + (mode === 'demo' ? '' : 'live')}>
                <span />
                {mode === 'demo' ? 'Fictional portfolio' : 'Private workspace'}
              </span>
              <IconButton icon="help" label="Open review guide" onClick={() => setModal({ type: 'guide' })} />
              <span className="topbar-divider" />
              <Avatar name={user?.name || 'Furkan'} />
            </div>
          </header>
          <main id="main-content" tabIndex={-1}>
            {page === 'overview' && <Overview />}
            {page === 'reviews' && <Reviews />}
            {page === 'evidence' && <EvidenceLibrary />}
            {page === 'activity' && <Activity />}
            {page === 'settings' && <Settings />}
            {page === 'detail' &&
              (current ? (
                <ReviewDetail c={current} />
              ) : (
                <Empty
                  title="This review isn't in this workspace"
                  action={<Button onClick={() => navigate('reviews')}>View all reviews</Button>}
                >
                  Switch workspaces or open another review.
                </Empty>
              ))}
          </main>
          <footer className="app-footer">
            <span>
              <span className={'save-dot ' + (busy ? 'pending' : '')} />
              {busy
                ? 'Saving your changes…'
                : mode === 'demo'
                  ? 'Demo changes saved on this device'
                  : connection === 'connected'
                    ? 'Saved to your private workspace'
                    : 'Connection unavailable'}
            </span>
            <span>
              Considered decisions. Clearer closes.<span className="footer-brand">CloseTrace</span>
            </span>
          </footer>
        </div>
      </div>
      <Dialogs />
      {toast && (
        <div
          key={toast.key}
          role={toast.error ? 'alert' : 'status'}
          className={'toast ' + (toast.error ? 'error' : '')}
        >
          <Icon name={toast.error ? 'alert' : 'success'} />
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} aria-label="Dismiss notification">
            <Icon name="close" size={14} />
          </button>
        </div>
      )}
      <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={importFile} />
    </WorkspaceContext.Provider>
  );
}
