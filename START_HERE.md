# CloseTrace — GitHub and portfolio guide

This is the full source snapshot of CloseTrace, not just a website screenshot. It includes the React interface, calculation engine, authenticated API handlers, database schema and migration, file handling, reports, and tests. The application was developed with substantial AI assistance and a supplied Sites/Vinext starter.

## Run on your computer

Use Node.js 22.13 or newer and npm. Extract this folder and open it in VS Code. In its terminal:

```sh
npm ci
npm test
node tests/api-check.mjs
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_remarkable_leper_queen.sql
npm run dev
```

Open the local URL printed in the terminal (normally http://localhost:5173). Apply the migration once per fresh local database, not on every startup. Local preview uses simulated sign-in; it is not a real ChatGPT account login. Demo workspace runs with fictional cases. A clean clone defaults to the portable execution profile.

The original export reported 20 unit/workflow/report tests and 16 isolated API integration checks, plus type checking, a production build, and desktop/phone/tablet browser checks. The current revision (see CHANGES.md) passes 27 tests, 22 API integration checks, type checking, lint (0 errors), and a production build in a Linux sandbox. It has not been browser-tested or installed on your Mac. The reported Safari crash has not been reproduced: likely causes were hardened (see CHANGES.md), but it should still be disclosed as an unconfirmed browser issue until you test it in Safari.

## Put it on GitHub

Create a repository named `closetrace` in your GitHub account. Do not initialize that repository with extra files. From this extracted folder:

```sh
git init
git add .
git commit -m "Initial CloseTrace portfolio source"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/closetrace.git
git push -u origin main
```

Replace YOUR_USERNAME with your actual GitHub username. Authenticate through GitHub's normal Git credential flow. These instructions do not create a repository or upload anything automatically. Keep node_modules, local databases, environment files, and credentials out of Git; .gitignore already excludes them. Preserve bundled third-party notices and licenses.

## Hosting and authentication

The original site runs on Sites/Cloudflare Workers with D1 records, R2 files, and dispatch-owned ChatGPT authentication. The original Site project ID is intentionally absent from this export. This is not a static GitHub Pages application. Local mock sign-in does not replace production authentication.

For independent hosting, configure actual D1/R2 bindings and migrations and implement a trusted authentication boundary. The API trusts identity headers injected by the hosting platform; an ordinary public deployment must prevent clients from forging those headers. Do not expose the API directly without that protection. Sites-specific publishing requires the supported Sites workflow and a correctly selected Site identity.

## Read the code in this order

1. lib/engine.js — integer-cent calculations and completion checks.
2. lib/case-model.js — validation, revisions, invalidation, and reviewer decisions.
3. lib/api.js and app/api/[...path]/route.ts — authenticated storage and uploads.
4. db/schema.ts and drizzle/ — durable case, event, and file records.
5. app/workspace.jsx — application state and workspaces.
6. app/components/ — portfolio, reconciliation, source inspection, and forms.
7. lib/report-template.js and app/report/page.jsx — printable exports.
8. tests/ — calculation, workflow, escaping, ownership, and concurrency checks.

## Resume wording

**CloseTrace | Full-stack acquisition review application**

- Developed an AI-assisted React application for acquisition working-capital reconciliation, source-document inspection, exception explanations, and reviewer decisions.
- Implemented owner-scoped D1 persistence, R2 document uploads, conditional version checks, and server-recorded reviewer identity using a supplied Cloudflare/Vinext starter.
- Verified calculation and workflow behavior with 20 automated tests and 16 API integration checks covering ownership isolation, stale writes, file access, and completion rules.

Use these bullets only after you can explain and demonstrate the underlying implementation. Do not claim paid customers, time savings, compliance certification, production readiness, or an independently authored codebase without supporting evidence.

## Master's application description

CloseTrace explores a narrow financial operations workflow: checking acquisition working-capital adjustments against contractual targets, closing balances, and seller payments. I used AI-assisted development and a supplied framework starter to build an interactive review application with source inspection, durable records, revision controls, and test coverage. My next work is to validate browser reliability and evaluate the workflow with qualified reviewers using appropriately authorized data.

Personalize this paragraph with the decisions you made, code you understand or changed, interview findings you actually recorded, and measurable results you can support. Admissions value your technical understanding, judgment, and reflection alongside the finished demonstration.

## Current limitations

- PDFs require reviewer-entered excerpts; there is no automatic OCR or AI document extraction.
- Financial inputs, policy applicability, and account inclusion require human verification.
- Working-capital seller-to-buyer refunds are supported; other payment types can require specialist review.
- Accounts have isolated personal records, not a shared team workspace.
- The hosted authenticated browser flow was not fully verified in the authoring session.
- A Safari page crash was reported after publication. Likely causes were hardened, but the crash was never reproduced, so it is not confirmed fixed.
- No payment execution, bank integration, or certified compliance audit is provided.
