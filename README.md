# CloseTrace

A private acquisition working-capital review application. The portfolio overview, searchable review queue, reconciliation workspace, evidence library, reviewer notes, decision history, and printable packages share a deterministic calculation engine.

## Workspaces

The **Demo workspace** contains six explicitly fictional cases. Changes are stored on the current device. Demo file originals use IndexedDB; case snapshots use localStorage. Legacy device-only reviews are retained in the demo portfolio when valid.

The **My workspace** option uses dispatch-owned ChatGPT sign-in. Case records are stored in D1 and original files in R2. Every API operation requires the authenticated visitor ID and scopes reads and writes to that ID. The Site audience remains owner-private. The app does not invite external users or provide a shared team workspace. The API trusts identity headers injected by the hosting platform. As defense in depth, set the TRUSTED_PROXY_SECRET binding and have the trusted proxy send it in x-closetrace-proxy-secret; the API then ignores identity headers on any request without it.

## Review behavior

Amounts are calculated in integer cents with range checks. Reviewers enter and verify financial values, account mappings, policy applicability, and document excerpts. Closing-date seller-to-buyer working-capital refunds are supported. Mixed and future-performance terms require escalation; buyer-to-seller adjustments are flagged as outside this calculation.

Required source excerpts, confirmations, and measurement dates gate completion. Nonblocking differences can receive a documented explanation without changing the financial amounts. Financial or source edits clear prior explanations and decisions and increment the financial revision. Comments, owner labels, and due dates preserve the financial revision.

The server records reviewer identity and time, maintains append-only activity records, and uses conditional version updates to reject stale writes. This is review history, not a tamper-proof or independently certified compliance audit.

## Evidence and exports

PDF, UTF-8 TXT, and CSV files up to 10 MB are supported, with at most 50 original attachments per case. TXT/CSV uploads supply the source excerpt. PDFs are stored for inspection; a reviewer supplies the excerpt, and uploading a PDF never replaces an excerpt that is already entered. No automated OCR, AI extraction, bank integration, payment execution, or automated legal classification is implemented.

Review packages open at /report with a printable calculation, findings, source excerpts, reviewer decision, notes, and history. Use the browser's Print / save PDF control. JSON snapshots contain source excerpts and file metadata, not original file binaries. Imports create new cases and clear old decisions, confirmations, comments, and attachment references.

## Development and verification

- npm test — calculation, workflow, export, and storage-helper tests (27).
- node tests/api-check.mjs — 22 integration checks using isolated Miniflare D1/R2 bindings, including authentication, owner isolation, stale writes, completion enforcement, file upload/download (including PDF excerpt preservation), error handling, proxy-secret enforcement, and cross-origin rejection.
- npm run lint — ESLint with the Next.js flat config. npm run format / npm run format:check — Prettier for app/, lib/, and tests/.
- node node_modules/typescript/bin/tsc --noEmit — type check.
- Use the Sites skill build and preview helpers. The hosting manifest declares DB and BUCKET.
- Schema changes belong in db/schema.ts. Generate and inspect migrations with npm run db:generate. Applied migration history is immutable.

Local preview migrations and hosted migrations are separate. Publishing through Sites applies the schema-only migrations to hosted storage. No development fixtures are seeded into the live database.

The interface supports small screens, keyboard search (Cmd/Ctrl+K), focus-trapped dialogs, explicit labels, reduced motion, and a separate fictional portfolio. Policy references are provided for a qualified reviewer to verify applicability.
