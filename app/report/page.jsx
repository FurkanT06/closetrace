'use client';
import { useEffect, useRef, useState } from 'react';
import { reviewReport } from '../../lib/report-template.js';
import { normalizeCase } from '../../lib/case-model.js';
import { Logo, Icon, Button } from '../components/ui';
import { storageGet, storageSet, storageRemove } from '../../lib/safe-storage.js';
export default function ReportPage() {
  const [record, setRecord] = useState(null),
    [error, setError] = useState(''),
    [printNote, setPrintNote] = useState(''),
    frame = useRef(null);
  const printReport = () => {
    const win = frame.current?.contentWindow;
    if (!win) return;
    try {
      win.focus(); // Safari prints the surrounding page instead of the report unless the frame has focus.
      win.print();
    } catch {
      setPrintNote(
        'This browser blocked printing from the page. Use the browser menu to print or save a PDF.',
      );
    }
  };
  useEffect(() => {
    try {
      const id = new URLSearchParams(location.search).get('id');
      const key = 'closetrace-report-' + id;
      const text = storageGet(key) || storageGet(key, 'sessionStorage');
      if (!text) throw new Error('Open the review package from a case in your workspace.');
      storageSet(key, text, 'sessionStorage');
      storageRemove(key);
      setRecord(normalizeCase(JSON.parse(text)));
    } catch (e) {
      setError(e.message);
    }
  }, []);
  return (
    <div className="report-page">
      <header className="report-topbar">
        <Logo />
        <span>Review package{record && ' · ' + record.id}</span>
        {printNote && <span role="status">{printNote}</span>}
        <Button variant="primary" icon="download" disabled={!record} onClick={printReport}>
          Print / save PDF
        </Button>
      </header>
      {error ? (
        <div className="report-error">
          <Icon name="alert" size={30} />
          <h1>Open this report from your workspace.</h1>
          <p>{error}</p>
          <a className="button primary" href="/">
            Return to CloseTrace
          </a>
        </div>
      ) : record ? (
        <iframe
          ref={frame}
          title={'Review package for ' + record.name}
          srcDoc={reviewReport(record)}
          sandbox="allow-same-origin allow-modals"
          className="report-frame"
        />
      ) : (
        <div className="report-error">Preparing your review package…</div>
      )}
    </div>
  );
}
