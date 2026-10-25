import assert from 'node:assert/strict';
import { Miniflare } from 'miniflare';
import { readFile } from 'node:fs/promises';
import { handleAPI } from '../lib/api.js';
import { sampleCases } from '../lib/data.js';
const base = 'https://closetrace.test';
const mf = new Miniflare({
  modules: true,
  script: 'export default { fetch(){return new Response("test binding")} }',
  d1Databases: ['DB'],
  r2Buckets: ['BUCKET'],
});
const env = { DB: await mf.getD1Database('DB'), BUCKET: await mf.getR2Bucket('BUCKET') };
const sql = await readFile(new URL('../drizzle/0000_remarkable_leper_queen.sql', import.meta.url), 'utf8');
await env.DB.batch(
  sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => env.DB.prepare(s)),
);
const suffix = crypto.randomUUID().slice(0, 8),
  owner = 'qa-a-' + suffix,
  other = 'qa-b-' + suffix;
let count = 0;
async function request(path, { actor = owner, method = 'GET', body, origin } = {}) {
  const headers = actor
    ? { 'oai-authenticated-user-id': actor, 'oai-authenticated-user-email': actor + '@example.test' }
    : {};
  if (!(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (origin) headers.Origin = origin;
  const response = await handleAPI(
    new Request(base + '/api/' + path, {
      method,
      headers,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    }),
    env,
  );
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: response.status, data, headers: response.headers };
}
const pass = (title) => {
  count++;
  console.log('PASS ' + title);
};
try {
  assert.equal((await request('workspace', { actor: null })).status, 401);
  pass('anonymous workspace access is rejected');
  assert.equal((await request('cases', { actor: null, method: 'POST', body: {} })).status, 401);
  pass('anonymous case writes are rejected');
  const draft = sampleCases()[0];
  draft.id = 'CT-QA-' + suffix;
  draft.name = 'Fictional integration QA';
  let r = await request('cases', { method: 'POST', body: { caseData: draft } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  let c = r.data.caseData;
  assert.equal(c._version, 1);
  pass('case creation persists a validated review');
  r = await request('workspace');
  assert(r.data.cases.some((x) => x.id === c.id));
  pass('a fresh request retrieves the saved case');
  r = await request('workspace', { actor: other });
  assert(!r.data.cases.some((x) => x.id === c.id));
  pass('saved cases are isolated by signed-in owner');
  r = await request('cases/' + c.id, {
    actor: other,
    method: 'PUT',
    body: { caseData: c, expectedVersion: 1, action: 'metadata' },
  });
  assert.equal(r.status, 404);
  pass('another owner cannot update the case');
  r = await request('cases/' + c.id, {
    method: 'PUT',
    body: {
      caseData: {
        ...c,
        review: { decision: 'retain', rationale: 'A forged client completion attempt.', revision: 1 },
      },
      expectedVersion: c._version,
      action: 'decision',
    },
  });
  assert.equal(r.status, 400, JSON.stringify(r.data));
  pass('the server rejects completion with open checks');
  let proposed = structuredClone(c);
  proposed.resolutions['payment-mismatch'] = { note: 'Separately documented amount in this fictional test.' };
  r = await request('cases/' + c.id, {
    method: 'PUT',
    body: { caseData: proposed, expectedVersion: c._version, action: 'resolve' },
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  c = r.data.caseData;
  assert.equal(c.revision, 1);
  pass('a supported explanation preserves the financial revision');
  proposed = {
    ...c,
    review: {
      decision: 'retain',
      rationale: 'The fictional sources and entered calculation have been reviewed.',
      revision: 1,
      reviewer: 'forged@example.test',
      at: '2000-01-01',
    },
  };
  r = await request('cases/' + c.id, {
    method: 'PUT',
    body: { caseData: proposed, expectedVersion: c._version, action: 'decision' },
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  c = r.data.caseData;
  assert.equal(c.review.reviewer, owner + '@example.test');
  assert.notEqual(c.review.at, '2000-01-01');
  pass('review identity and time are assigned by the server');
  r = await request('cases/' + c.id, {
    method: 'PUT',
    body: { caseData: c, expectedVersion: 1, action: 'metadata' },
  });
  assert.equal(r.status, 409);
  pass('stale writes are rejected without overwriting newer work');
  proposed = structuredClone(c);
  proposed.payment.amount = '100000.00';
  r = await request('cases/' + c.id, {
    method: 'PUT',
    body: { caseData: proposed, expectedVersion: c._version, action: 'edit' },
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  c = r.data.caseData;
  assert.equal(c.revision, 2);
  assert.equal(c.review, null);
  assert.deepEqual(c.resolutions, {});
  pass('financial edits clear prior decisions and explanations on the server');
  const form = new FormData();
  form.append(
    'file',
    new File(['FICTIONAL PAYMENT CONFIRMATION\nUSD 100000.00\nReviewer test source.'], 'qa-payment.txt', {
      type: 'text/plain',
    }),
  );
  form.append('category', 'payment');
  form.append('expectedVersion', c._version);
  r = await request('cases/' + c.id + '/files', { method: 'POST', body: form });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  c = r.data.caseData;
  assert.equal(c.attachments.length, 1);
  assert(c.documents.payment.text.includes('FICTIONAL'));
  pass('file upload stores the original and a text source excerpt');
  const fileId = c.attachments[0].id;
  r = await request('files/' + fileId);
  assert.equal(r.status, 200);
  assert(r.data.includes('Reviewer test source.'));
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  pass('the uploaded original can be retrieved by its owner');
  r = await request('files/' + fileId, { actor: other });
  assert.equal(r.status, 404);
  pass('another owner cannot retrieve the original file');
  r = await request('cases/' + c.id, {
    method: 'PUT',
    origin: 'https://unrelated.example',
    body: { caseData: c, action: 'metadata', expectedVersion: c._version },
  });
  assert.equal(r.status, 403);
  pass('cross-origin write attempts are rejected');
  const bad = new FormData();
  bad.append('file', new File(['<script>bad</script>'], 'unsafe.html', { type: 'text/html' }));
  bad.append('category', 'payment');
  bad.append('expectedVersion', c._version);
  r = await request('cases/' + c.id + '/files', { method: 'POST', body: bad });
  assert.equal(r.status, 400);
  pass('active HTML uploads are rejected');

  // A PDF is stored for inspection but supplies no text, so it must not erase the reviewer's excerpt.
  const revisionBeforePdf = c.revision;
  const pdf = new FormData();
  pdf.append(
    'file',
    new File(['%PDF-1.4\n% fictional test document\n'], 'qa-payment.pdf', { type: 'application/pdf' }),
  );
  pdf.append('category', 'payment');
  pdf.append('expectedVersion', c._version);
  r = await request('cases/' + c.id + '/files', { method: 'POST', body: pdf });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  c = r.data.caseData;
  assert.equal(c.attachments.length, 2);
  assert(c.documents.payment.text.includes('FICTIONAL'));
  assert.equal(c.documents.payment.available, true);
  assert.equal(c.revision, revisionBeforePdf);
  pass('uploading a PDF keeps the reviewer-entered source excerpt and the revision');

  const pdfId = c.attachments.find((f) => f.mime === 'application/pdf').id;
  r = await request('files/' + pdfId);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-security-policy'), "frame-ancestors 'self'");
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  r = await request('files/' + fileId);
  assert(r.headers.get('content-security-policy').includes('sandbox'));
  pass('PDFs may be displayed inline while text originals stay sandboxed');

  const raw = (path, init, useEnv = env) => handleAPI(new Request(base + '/api/' + path, init), useEnv);
  const asOwner = {
    'oai-authenticated-user-id': owner,
    'oai-authenticated-user-email': owner + '@example.test',
  };
  let res = await raw('cases/' + c.id, {
    method: 'PUT',
    headers: { ...asOwner, 'Content-Type': 'application/json' },
    body: 'null',
  });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /JSON object/);
  pass('a JSON body that is not an object is a client error, not a server error');

  res = await raw('cases/' + c.id + '/files', {
    method: 'POST',
    headers: { ...asOwner, 'Content-Type': 'multipart/form-data; boundary=x' },
    body: 'this is not multipart data',
  });
  assert.equal(res.status, 400);
  pass('a malformed upload is a client error');

  const brokenEnv = {
    DB: {
      prepare() {
        throw new Error('invalid date range in storage layer: internal detail');
      },
    },
    BUCKET: env.BUCKET,
  };
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    res = await raw('workspace', { headers: asOwner }, brokenEnv);
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(res.status, 500);
  assert(!(await res.json()).error.includes('internal detail'));
  pass('unexpected server errors return a generic message instead of internal details');

  const guarded = { ...env, TRUSTED_PROXY_SECRET: 'test-proxy-secret' };
  res = await raw('workspace', { headers: asOwner }, guarded);
  assert.equal(res.status, 401);
  assert.equal((await res.json()).code, 'UNTRUSTED_PROXY');
  res = await raw(
    'workspace',
    { headers: { ...asOwner, 'x-closetrace-proxy-secret': 'test-proxy-secrex' } },
    guarded,
  );
  assert.equal(res.status, 401);
  res = await raw(
    'workspace',
    { headers: { ...asOwner, 'x-closetrace-proxy-secret': 'test-proxy-secret' } },
    guarded,
  );
  assert.equal(res.status, 200);
  pass('identity headers are only honored with the proxy secret when one is configured');

  console.log(count + ' API integration checks passed with isolated D1 and R2 bindings.');
} finally {
  await mf.dispose();
}
