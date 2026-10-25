# Changes in this revision

## Fixed

1. **PDF uploads no longer erase a reviewer's excerpt.** Uploading a PDF replaced the whole source
   record with empty text, wiping an excerpt the reviewer had already entered. The server and the demo
   workspace now share `applyUploadedSource` (lib/case-model.js). A new API check fails against the
   original code and passes now.
2. **API errors.** Previously, any error whose message contained words like "date" or "range" was shown
   to the visitor as a 400, including internal database errors. Now only errors raised deliberately
   through `failure()` reach the visitor. Everything else is logged and answered with a generic 500.
   A JSON body that is `null` or an array, and a malformed multipart upload, are now 400s instead of 500s.
3. **Safari hardening (not confirmed).** The crash was never reproduced. Changes made to the likely suspects:
   - Browser storage goes through `lib/safe-storage.js`. Safari can throw on storage access in some
     privacy modes.
   - The report's Print button focuses the report frame first (Safari otherwise prints the wrong
     document) and catches print failures.
   - PDFs are served with `frame-ancestors 'self'` instead of a CSP `sandbox` directive, which stops
     browsers from showing PDFs inline. Text and CSV originals keep the full sandbox.
   - PDFs also get an "Open in new tab" link beside Download.
4. **Optional proxy secret.** If `TRUSTED_PROXY_SECRET` is set, identity headers are only honored on
   requests that carry it in `x-closetrace-proxy-secret`. Without it, behavior is unchanged.
5. **Readability.** app/, lib/, and tests/ are formatted with Prettier (`npm run format`). theme.css
   went from 22 lines to about 5,300. Formatting changes no behavior.
6. **Lint.** `npm run lint` could not run (no ESLint config). Added one: 0 errors, 9 warnings. Fixed the
   three unescaped apostrophes it found.

## Verification (Linux sandbox, Node 22.22)

- `npm test`: 27 pass (was 20)
- `node tests/api-check.mjs`: 22 pass (was 16)
- `tsc --noEmit`: clean
- `npm run lint`: 0 errors, 9 warnings
- `npm run build`: succeeds. The built server returned 200 for `/` and `/report`, and 401 for an
  unauthenticated `/api/workspace`.

**Not verified:** any browser (Safari included), the authenticated hosted flow, and the PDF
Content-Security-Policy change in a real browser.

## Still open

- **Safari crash.** Test in Safari (normal and Private window): switch workspaces, upload a PDF and
  open its Original file tab, open a report and press Print. If it still crashes, send the first
  error in Safari's Web Inspector console or the crash log from Console.app.
- **Lint warnings.** One is a real minor bug: the Cmd/Ctrl+K handler captures a stale `modal`, so
  focus can return to the wrong element after a dialog closes.
- **No domain validation.** Nobody who reconciles working-capital adjustments has used this yet.
- **No UI tests.** Only the engine, case model, API, and storage helpers are tested.
- **Auth.** A public deployment still needs a trusted authentication boundary. The proxy secret only
  helps if a trusted proxy sets it.
