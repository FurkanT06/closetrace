import { applyUploadedSource, normalizeCase, prepareCaseUpdate } from './case-model.js';
import { DOC_LABELS } from './engine.js';

// Text and CSV originals are fully sandboxed. A CSP `sandbox` directive also stops browsers from
// displaying a PDF inline (and is one suspect in the reported Safari crash), so PDFs only restrict
// who may frame them. nosniff, the fixed Content-Type, and the %PDF- signature check still apply.
const TEXT_CSP = "sandbox; default-src 'none'";
const PDF_CSP = "frame-ancestors 'self'";

const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (data, status = 200) => Response.json(data, { status, headers });
const failure = (message, status = 400) => Object.assign(new Error(message), { status });
const publicFile = (f) => ({
  id: f.id,
  caseId: f.case_id,
  category: f.category,
  name: f.name,
  mime: f.mime,
  size: f.size,
  createdAt: f.created_at,
});
const readRow = (row) => ({ ...normalizeCase(JSON.parse(row.data)), _version: row.version });
async function bodyJSON(request) {
  if (Number(request.headers.get('content-length')) > 1_000_000)
    throw failure('This review exceeds the 1 MB limit.', 413);
  const text = await request.text();
  if (new TextEncoder().encode(text).length > 1_000_000)
    throw failure('This review exceeds the 1 MB limit.', 413);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw failure('The request is not valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw failure('The request body must be a JSON object.');
  return parsed;
}
// Constant-time comparison for the optional proxy secret.
function secretMatches(given, expected) {
  if (typeof given !== 'string' || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
function actorFrom(request) {
  const id = request.headers.get('oai-authenticated-user-id');
  const email = request.headers.get('oai-authenticated-user-email');
  let name = request.headers.get('oai-authenticated-user-full-name');
  if (name && request.headers.get('oai-authenticated-user-full-name-encoding') === 'percent-encoded-utf-8') {
    try {
      name = decodeURIComponent(name);
    } catch {
      name = null;
    }
  }
  return id && email ? { id, email, name: name || email } : null;
}
async function findCase(db, owner, id) {
  const row = await db.prepare('SELECT * FROM cases WHERE owner_id = ? AND id = ?').bind(owner, id).first();
  if (!row) throw failure('This review was not found.', 404);
  return row;
}
function eventStatement(db, event, owner, id, mutation) {
  return db
    .prepare(
      'INSERT INTO events (id, owner_id, case_id, actor, title, detail, created_at) SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM cases WHERE owner_id = ? AND id = ? AND mutation_key = ?)',
    )
    .bind(
      crypto.randomUUID(),
      owner,
      id,
      event.actor,
      event.title,
      event.detail,
      event.at,
      owner,
      id,
      mutation,
    );
}
async function save(db, actor, row, candidate, action, expectedVersion, extra = []) {
  if (row && expectedVersion !== row.version)
    throw failure('A newer version was saved. Refresh this review before applying your changes.', 409);
  let prepared;
  try {
    prepared = prepareCaseUpdate(row ? readRow(row) : null, candidate, actor.name, action);
  } catch (error) {
    throw failure(error.message);
  }
  const { caseData, event } = prepared;
  caseData.attachments = []; // File metadata is authoritative in the files table.
  caseData.sample = false;
  const mutation = crypto.randomUUID(),
    version = row ? row.version + 1 : 1;
  const data = JSON.stringify(caseData);
  const write = row
    ? db
        .prepare(
          'UPDATE cases SET data = ?, version = ?, mutation_key = ?, updated_at = ? WHERE owner_id = ? AND id = ? AND version = ?',
        )
        .bind(data, version, mutation, event.at, actor.id, caseData.id, expectedVersion)
    : db
        .prepare(
          'INSERT OR IGNORE INTO cases (id, owner_id, data, version, mutation_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(caseData.id, actor.id, data, version, mutation, event.at, event.at);
  const extras = extra.map((fn) => fn(mutation));
  const result = await db.batch([
    write,
    eventStatement(db, event, actor.id, caseData.id, mutation),
    ...extras,
  ]);
  if (!result[0].meta.changes)
    throw failure('A newer version was saved. Refresh the workspace and try again.', 409);
  const files = await db
    .prepare('SELECT * FROM files WHERE owner_id = ? AND case_id = ? ORDER BY created_at DESC')
    .bind(actor.id, caseData.id)
    .all();
  return { ...caseData, _version: version, attachments: files.results.map(publicFile) };
}

export async function handleAPI(request, env) {
  try {
    const url = new URL(request.url),
      path = url.pathname.split('/').filter(Boolean).slice(1);
    // Optional defense in depth: when TRUSTED_PROXY_SECRET is configured, identity headers are only
    // honored on requests that also carry the secret, so a client cannot forge them directly.
    if (
      env.TRUSTED_PROXY_SECRET &&
      !secretMatches(request.headers.get('x-closetrace-proxy-secret'), env.TRUSTED_PROXY_SECRET)
    )
      return json(
        { error: 'This request did not come through the trusted sign-in proxy.', code: 'UNTRUSTED_PROXY' },
        401,
      );
    const actor = actorFrom(request);
    if (!actor)
      return json(
        { error: 'Sign in with ChatGPT to use your saved workspace.', code: 'SIGN_IN_REQUIRED' },
        401,
      );
    if (!['GET', 'HEAD'].includes(request.method)) {
      const origin = request.headers.get('origin');
      if (origin && origin !== url.origin) return json({ error: 'Use the app to make this change.' }, 403);
      if (request.headers.get('sec-fetch-site') === 'cross-site')
        return json({ error: 'Use the app to make this change.' }, 403);
    }
    const db = env.DB;
    if (!db) throw failure('Saved workspace storage is temporarily unavailable.', 503);
    if (path[0] === 'workspace' && request.method === 'GET') {
      const [rows, files] = await Promise.all([
        db
          .prepare('SELECT * FROM cases WHERE owner_id = ? ORDER BY updated_at DESC LIMIT 500')
          .bind(actor.id)
          .all(),
        db.prepare('SELECT * FROM files WHERE owner_id = ? ORDER BY created_at DESC').bind(actor.id).all(),
      ]);
      return json({
        user: { name: actor.name, email: actor.email },
        cases: rows.results.map((row) => ({
          ...readRow(row),
          attachments: files.results.filter((f) => f.case_id === row.id).map(publicFile),
        })),
      });
    }
    if (path[0] === 'cases' && path.length === 1 && request.method === 'POST') {
      const body = await bodyJSON(request);
      const c = await save(db, actor, null, body.caseData, 'create', null);
      return json({ caseData: c }, 201);
    }
    if (path[0] === 'cases' && path.length === 2 && request.method === 'PUT') {
      const row = await findCase(db, actor.id, path[1]),
        body = await bodyJSON(request);
      if (body.caseData?.id !== row.id) throw failure('Case ID cannot change.');
      return json({ caseData: await save(db, actor, row, body.caseData, body.action, body.expectedVersion) });
    }
    if (path[0] === 'cases' && path[2] === 'files' && path.length === 3 && request.method === 'POST') {
      if (!env.BUCKET) throw failure('Document storage is temporarily unavailable.', 503);
      const row = await findCase(db, actor.id, path[1]);
      if (Number(request.headers.get('content-length')) > 10_600_000)
        throw failure('Choose a file smaller than 10 MB.', 413);
      let form;
      try {
        form = await request.formData();
      } catch {
        throw failure('The upload could not be read. Choose the file again.');
      }
      const file = form.get('file'),
        category = form.get('category');
      if (!Object.hasOwn(DOC_LABELS, category) || !file || typeof file.arrayBuffer !== 'function')
        throw failure('Choose a document and its source category.');
      if (file.size > 10_000_000 || file.size === 0)
        throw failure('Choose a nonempty file smaller than 10 MB.', 413);
      const count = await db
        .prepare('SELECT COUNT(*) AS n FROM files WHERE owner_id = ? AND case_id = ?')
        .bind(actor.id, row.id)
        .first();
      if (count.n >= 50) throw failure('This review already has 50 attachments.');
      const name = file.name
        .split(/[\\/]/)
        .at(-1)
        .replace(/[^a-zA-Z0-9._ ()-]/g, '_')
        .slice(0, 180);
      const ext = name.toLowerCase().split('.').at(-1),
        mime = { pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv' }[ext];
      if (!mime) throw failure('Upload a PDF, TXT, or CSV file.');
      const bytes = await file.arrayBuffer();
      let text = '';
      if (ext === 'pdf') {
        if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-')
          throw failure('This file does not appear to be a PDF.');
      } else {
        try {
          text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        } catch {
          throw failure('Text and CSV files must use UTF-8 encoding.');
        }
        if (text.length > 200000 || text.includes('\u0000'))
          throw failure('Text sources must contain fewer than 200,000 characters.');
      }
      const id = crypto.randomUUID(),
        key = actor.id + '/' + row.id + '/' + id;
      const c = readRow(row);
      applyUploadedSource(c, category, { name, ext, text });
      await env.BUCKET.put(key, bytes, { httpMetadata: { contentType: mime } });
      try {
        const saved = await save(db, actor, row, c, 'evidence', Number(form.get('expectedVersion')), [
          (mutation) =>
            db
              .prepare(
                'INSERT INTO files (id, owner_id, case_id, category, name, mime, size, object_key, created_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM cases WHERE owner_id = ? AND id = ? AND mutation_key = ?)',
              )
              .bind(
                id,
                actor.id,
                row.id,
                category,
                name,
                mime,
                file.size,
                key,
                new Date().toISOString(),
                actor.id,
                row.id,
                mutation,
              ),
        ]);
        return json({ caseData: saved }, 201);
      } catch (error) {
        await env.BUCKET.delete(key);
        throw error;
      }
    }
    if (path[0] === 'files' && path.length === 2 && request.method === 'GET') {
      const file = await db
        .prepare('SELECT * FROM files WHERE owner_id = ? AND id = ?')
        .bind(actor.id, path[1])
        .first();
      if (!file || !env.BUCKET) throw failure('This document was not found.', 404);
      const object = await env.BUCKET.get(file.object_key);
      if (!object) throw failure('This document was not found.', 404);
      return new Response(object.body, {
        headers: {
          ...headers,
          'Content-Type': file.mime,
          'Content-Disposition':
            (url.searchParams.has('download') ? 'attachment' : 'inline') +
            '; filename="' +
            file.name.replace(/["\\\r\n]/g, '_') +
            '"',
          'Content-Security-Policy': file.mime === 'application/pdf' ? PDF_CSP : TEXT_CSP,
        },
      });
    }
    return json({ error: 'This action was not found.' }, 404);
  } catch (error) {
    // Only errors raised through failure() carry a status and a message meant for the visitor.
    // Anything else (database, storage, or programming errors) is logged and kept generic.
    if (Number.isInteger(error?.status)) return json({ error: error.message }, error.status);
    console.error('CloseTrace API error:', error);
    return json(
      { error: 'The change could not be saved. Your current review is still available. Please try again.' },
      500,
    );
  }
}
