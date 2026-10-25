'use client';
import { Logo, Button, Icon } from './components/ui';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div className="report-error" style={{ maxWidth: 540, margin: '15vh auto' }}><Logo/><div style={{ marginTop: 45 }}><Icon name="alert" size={30}/><h1>Let&apos;s get your review back on track.</h1><p>This view could not be loaded. Try again or return to your workspace.</p><div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}><Button variant="primary" icon="refresh" onClick={reset}>Try again</Button><a className="button secondary" href="/">Open workspace</a></div></div></div>;
}
