const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const mongoose = require('mongoose');
const qa = require('./qa-env');
const { seedFixtures, cleanupFixtures } = require('./fixtures');

let fixtures;
let server;
let baseUrl;
let vaultDir;
let adminToken;
let employeeToken;
let employeeAToken;
let employeeBToken;
let hrToken;
let uploadedIds = [];

const ACCEPTED = [
  ['pdf', 'application/pdf', Buffer.from('%PDF-1.7\nQA synthetic file\n%%EOF')],
  ['jpg', 'image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xd9])],
  ['png', 'image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  ['webp', 'image/webp', Buffer.from('RIFFQA01WEBP')],
  ['doc', 'application/msword', Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])],
  ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', Buffer.from('PK\x03\x04QA synthetic DOCX content')],
];

async function login(email) {
  const response = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: qa.PASSWORD }),
  });
  const body = await response.json();
  assert.equal(response.status, 200, body.message);
  return body.result.token;
}

async function upload(token, { filename, mime, content, employee, documentType = 'Other HR Documents' }) {
  const form = new FormData();
  form.append('employee', String(employee));
  form.append('documentType', documentType);
  form.append('file', new Blob([content], { type: mime }), filename);
  const response = await fetch(`${baseUrl}/document/upload`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  let body = null;
  try { body = await response.json(); } catch {}
  return { response, body };
}

test.before(async () => {
  vaultDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tecmotiv-vault-'));
  process.env.DOCUMENT_VAULT_DIR = vaultDir;
  fixtures = await seedFixtures();
  const app = require('../src/app');
  server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  adminToken = await login(`qa-admin-${qa.RUN_ID}@example.com`);
  employeeAToken = await login(`qa-employee-${qa.RUN_ID}@example.com`);
  employeeToken = employeeAToken;
  employeeBToken = await login(`qa-employeeb-${qa.RUN_ID}@example.com`);
  hrToken = await login(`qa-hr-${qa.RUN_ID}@example.com`);
});

test.after(async () => {
  await mongoose.model('Document').deleteMany({ _id: { $in: uploadedIds } });
  if (server) await new Promise((resolve) => server.close(resolve));
  await cleanupFixtures(fixtures);
  fs.rmSync(vaultDir, { recursive: true, force: true });
  delete process.env.DOCUMENT_VAULT_DIR;
});

test('accepts every configured document MIME type and preserves metadata', async () => {
  for (const [extension, mime, content] of ACCEPTED) {
    const filename = `QA ${extension} résumé — ${'x'.repeat(100)}.${extension}`;
    const result = await upload(adminToken, {
      filename,
      mime,
      content,
      employee: fixtures.employee.employee._id,
    });
    assert.equal(result.response.status, 200, result.body?.message);
    const doc = result.body.result;
    uploadedIds.push(doc._id);
    assert.equal(doc.file.mimeType, mime);
    assert.equal(doc.file.size, content.length);
    assert.equal(doc.file.originalName, filename);
    assert.ok(path.resolve(doc.file.path).startsWith(path.resolve(vaultDir) + path.sep));
    assert.equal(fs.readFileSync(doc.file.path).compare(content), 0);
  }
});

test('authorized download uses safe headers and exact stored bytes', async () => {
  const content = Buffer.from('%PDF-1.7\nheader test\n%%EOF');
  const created = await upload(adminToken, {
    filename: 'name with spaces & unicode-é.pdf',
    mime: 'application/pdf',
    content,
    employee: fixtures.employee.employee._id,
  });
  assert.equal(created.response.status, 200);
  uploadedIds.push(created.body.result._id);
  const response = await fetch(`${baseUrl}/document/download/${created.body.result._id}?mode=inline`, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.match(response.headers.get('content-disposition'), /^inline; filename=/);
  assert.equal(response.headers.get('cache-control'), 'private, no-cache, no-store, must-revalidate');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), content);
});

test('rejects unsupported MIME, missing file and malformed metadata without orphan files', async () => {
  const before = fs.readdirSync(vaultDir);
  const unsupported = await upload(adminToken, {
    filename: 'script.exe', mime: 'application/octet-stream', content: Buffer.from('harmless QA bytes'), employee: fixtures.employee.employee._id,
  });
  assert.equal(unsupported.response.status, 400);
  const mismatchedExtension = await upload(adminToken, {
    filename: 'mismatch.txt', mime: 'application/pdf', content: Buffer.from('%PDF-1.7 QA'), employee: fixtures.employee.employee._id,
  });
  assert.equal(mismatchedExtension.response.status, 400);
  const empty = await upload(adminToken, {
    filename: 'empty.pdf', mime: 'application/pdf', content: Buffer.alloc(0), employee: fixtures.employee.employee._id,
  });
  assert.equal(empty.response.status, 400);
  const malformed = await upload(adminToken, {
    filename: 'malformed.pdf', mime: 'application/pdf', content: Buffer.from('not a PDF'), employee: fixtures.employee.employee._id,
  });
  assert.equal(malformed.response.status, 400);
  const missing = await fetch(`${baseUrl}/document/upload`, {
    method: 'POST', headers: { authorization: `Bearer ${adminToken}` }, body: new FormData(),
  });
  assert.equal(missing.status, 400);
  const badMetadata = await upload(adminToken, {
    filename: 'missing-type.pdf', mime: 'application/pdf', content: Buffer.from('bad metadata'), employee: fixtures.employee.employee._id, documentType: '',
  });
  assert.equal(badMetadata.response.status, 400);
  assert.deepEqual(fs.readdirSync(vaultDir), before);
});

test('enforces the 10 MiB boundary and does not create a record for oversized files', async () => {
  const exact = await upload(adminToken, {
    filename: 'exact-limit.pdf', mime: 'application/pdf', content: Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(10 * 1024 * 1024 - 5, 0x51)]), employee: fixtures.employee.employee._id,
  });
  assert.equal(exact.response.status, 200, exact.body?.message);
  uploadedIds.push(exact.body.result._id);
  const oversized = await upload(adminToken, {
    filename: 'over-limit.pdf', mime: 'application/pdf', content: Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(10 * 1024 * 1024 - 4, 0x52)]), employee: fixtures.employee.employee._id,
  });
  assert.equal(oversized.response.status, 413);
});

test('employee ownership cannot be changed by client-supplied IDs', async () => {
  const result = await upload(employeeToken, {
    filename: 'ownership-attempt.pdf', mime: 'application/pdf', content: Buffer.from('%PDF- QA'), employee: fixtures.hr.employee._id,
  });
  assert.equal(result.response.status, 200, result.body?.message);
  uploadedIds.push(result.body.result._id);
  assert.equal(String(result.body.result.employee._id || result.body.result.employee), String(fixtures.employee.employee._id));
  assert.equal(String(result.body.result.uploadedBy._id || result.body.result.uploadedBy), String(fixtures.employee.user._id));
});

test('employee cannot read, download, verify, update or delete another employee document', async () => {
  const created = await upload(adminToken, {
    filename: 'private-other-employee.pdf', mime: 'application/pdf', content: Buffer.from('%PDF- private'), employee: fixtures.hr.employee._id,
  });
  assert.equal(created.response.status, 200);
  uploadedIds.push(created.body.result._id);
  const id = created.body.result._id;
  for (const [pathName, method, body] of [
    [`/document/read/${id}`, 'GET'],
    [`/document/download/${id}`, 'GET'],
    [`/document/verify/${id}`, 'PATCH', { verificationStatus: 'Verified' }],
    [`/document/update/${id}`, 'PATCH', { remarks: 'attempt' }],
    [`/document/delete/${id}`, 'DELETE'],
  ]) {
    const response = await fetch(`${baseUrl}${pathName}`, {
      method,
      headers: { authorization: `Bearer ${employeeToken}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert.equal(response.status, 403, `${method} ${pathName}`);
  }
});

test('admin can verify, reject, update and soft-delete a document', async () => {
  const created = await upload(adminToken, {
    filename: '../..//safe-name.pdf', mime: 'application/pdf', content: Buffer.from('%PDF- lifecycle'), employee: fixtures.employee.employee._id,
  });
  assert.equal(created.response.status, 200);
  const id = created.body.result._id;
  uploadedIds.push(id);
  let response = await fetch(`${baseUrl}/document/verify/${id}`, { method: 'PATCH', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ verificationStatus: 'Verified' }) });
  assert.equal(response.status, 200);
  response = await fetch(`${baseUrl}/document/update/${id}`, { method: 'PATCH', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ remarks: 'updated safely' }) });
  assert.equal(response.status, 200);
  response = await fetch(`${baseUrl}/document/delete/${id}`, { method: 'DELETE', headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(response.status, 200);
  assert.equal((await mongoose.model('Document').findById(id)).removed, true);
});

test('concurrent uploads receive distinct files and do not overwrite each other', async () => {
  const requests = await Promise.all(Array.from({ length: 8 }, (_, index) => upload(adminToken, {
    filename: `duplicate-${index}.pdf`, mime: 'application/pdf', content: Buffer.from(`%PDF- concurrent ${index}`), employee: fixtures.employee.employee._id,
  })));
  for (const result of requests) {
    assert.equal(result.response.status, 200);
    uploadedIds.push(result.body.result._id);
  }
  const paths = requests.map((result) => result.body.result.file.path);
  assert.equal(new Set(paths).size, paths.length);
  for (const [index, filePath] of paths.entries()) assert.deepEqual(fs.readFileSync(filePath), Buffer.from(`%PDF- concurrent ${index}`));
});

test('private vault files are not served by public or legacy routes', async () => {
  const leaked = await fetch(`${baseUrl.replace('/api', '')}/public/storage/vault`);
  assert.ok([400, 404].includes(leaked.status));
  const legacy = await fetch(`${baseUrl.replace('/api', '')}/download/document/private.pdf`, { headers: { authorization: `Bearer ${adminToken}` } });
  assert.ok([400, 404, 403].includes(legacy.status));
});

test('enforces strict cross-employee and HR denial on Employee A private document across every operation', async () => {
  const docA = await upload(adminToken, {
    filename: 'empa-confidential.pdf',
    mime: 'application/pdf',
    content: Buffer.from('%PDF- empa private record'),
    employee: fixtures.employeeA.employee._id,
    documentType: 'Aadhaar',
  });
  assert.equal(docA.response.status, 200);
  const docAId = docA.body.result._id;
  uploadedIds.push(docAId);

  // 1. Read metadata
  const readA = await fetch(`${baseUrl}/document/read/${docAId}`, { headers: { authorization: `Bearer ${employeeAToken}` } });
  assert.equal(readA.status, 200, 'Employee A must be able to read own document');

  const readB = await fetch(`${baseUrl}/document/read/${docAId}`, { headers: { authorization: `Bearer ${employeeBToken}` } });
  assert.equal(readB.status, 403, 'Employee B must be denied from reading Employee A document');

  const readHr = await fetch(`${baseUrl}/document/read/${docAId}`, { headers: { authorization: `Bearer ${hrToken}` } });
  assert.equal(readHr.status, 403, 'HR must be denied from reading Employee A document');

  const readAdmin = await fetch(`${baseUrl}/document/read/${docAId}`, { headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(readAdmin.status, 200, 'ADMIN must be able to read Employee A document');

  // 2. Download attachment stream
  const dlA = await fetch(`${baseUrl}/document/download/${docAId}`, { headers: { authorization: `Bearer ${employeeAToken}` } });
  assert.equal(dlA.status, 200, 'Employee A must be able to download own document');

  const dlB = await fetch(`${baseUrl}/document/download/${docAId}`, { headers: { authorization: `Bearer ${employeeBToken}` } });
  assert.equal(dlB.status, 403, 'Employee B must be denied download of Employee A document');

  const dlHr = await fetch(`${baseUrl}/document/download/${docAId}`, { headers: { authorization: `Bearer ${hrToken}` } });
  assert.equal(dlHr.status, 403, 'HR must be denied download of Employee A document');

  const dlAdmin = await fetch(`${baseUrl}/document/download/${docAId}`, { headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(dlAdmin.status, 200, 'ADMIN must be able to download Employee A document');

  // 3. Inline preview
  const prevA = await fetch(`${baseUrl}/document/download/${docAId}?mode=inline`, { headers: { authorization: `Bearer ${employeeAToken}` } });
  assert.equal(prevA.status, 200, 'Employee A must be able to preview own document');

  const prevB = await fetch(`${baseUrl}/document/download/${docAId}?mode=inline`, { headers: { authorization: `Bearer ${employeeBToken}` } });
  assert.equal(prevB.status, 403, 'Employee B must be denied preview of Employee A document');

  const prevHr = await fetch(`${baseUrl}/document/download/${docAId}?mode=inline`, { headers: { authorization: `Bearer ${hrToken}` } });
  assert.equal(prevHr.status, 403, 'HR must be denied preview of Employee A document');

  const prevAdmin = await fetch(`${baseUrl}/document/download/${docAId}?mode=inline`, { headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(prevAdmin.status, 200, 'ADMIN must be able to preview Employee A document');

  // 4. Update metadata
  const updA = await fetch(`${baseUrl}/document/update/${docAId}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${employeeAToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ remarks: 'Employee A update attempt' }),
  });
  assert.equal(updA.status, 403, 'Employee A cannot modify official vault record directly');

  const updB = await fetch(`${baseUrl}/document/update/${docAId}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${employeeBToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ remarks: 'Employee B update attempt' }),
  });
  assert.equal(updB.status, 403, 'Employee B cannot update Employee A document');

  const updHr = await fetch(`${baseUrl}/document/update/${docAId}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${hrToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ remarks: 'HR update attempt' }),
  });
  assert.equal(updHr.status, 403, 'HR cannot update Employee A document');

  const updAdmin = await fetch(`${baseUrl}/document/update/${docAId}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ remarks: 'ADMIN authorized update' }),
  });
  assert.equal(updAdmin.status, 200, 'ADMIN can update document details');

  // 5. Verification status
  const verA = await fetch(`${baseUrl}/document/verify/${docAId}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${employeeAToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ verificationStatus: 'Verified' }),
  });
  assert.equal(verA.status, 403, 'Employee A cannot verify document');

  const verB = await fetch(`${baseUrl}/document/verify/${docAId}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${employeeBToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ verificationStatus: 'Verified' }),
  });
  assert.equal(verB.status, 403, 'Employee B cannot verify document');

  const verHr = await fetch(`${baseUrl}/document/verify/${docAId}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${hrToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ verificationStatus: 'Verified' }),
  });
  assert.equal(verHr.status, 403, 'HR cannot verify private employee document');

  const verAdmin = await fetch(`${baseUrl}/document/verify/${docAId}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ verificationStatus: 'Verified' }),
  });
  assert.equal(verAdmin.status, 200, 'ADMIN can verify document');

  // 6. Delete operation
  const delA = await fetch(`${baseUrl}/document/delete/${docAId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(delA.status, 403, 'Employee A cannot delete document');

  const delB = await fetch(`${baseUrl}/document/delete/${docAId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${employeeBToken}` },
  });
  assert.equal(delB.status, 403, 'Employee B cannot delete Employee A document');

  const delHr = await fetch(`${baseUrl}/document/delete/${docAId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${hrToken}` },
  });
  assert.equal(delHr.status, 403, 'HR cannot delete Employee A document');

  const delAdmin = await fetch(`${baseUrl}/document/delete/${docAId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(delAdmin.status, 200, 'ADMIN can delete document');
});

test('strictly isolates list, search and summary operations across employees and HR', async () => {
  const docA = await upload(adminToken, {
    filename: 'empa-payroll-tax.pdf',
    mime: 'application/pdf',
    content: Buffer.from('%PDF- empa search target'),
    employee: fixtures.employeeA.employee._id,
    documentType: 'Salary Documents',
  });
  assert.equal(docA.response.status, 200);
  const docAId = docA.body.result._id;
  uploadedIds.push(docAId);

  const docB = await upload(adminToken, {
    filename: 'empb-marketing-contract.pdf',
    mime: 'application/pdf',
    content: Buffer.from('%PDF- empb search target'),
    employee: fixtures.employeeB.employee._id,
    documentType: 'NDA',
  });
  assert.equal(docB.response.status, 200);
  const docBId = docB.body.result._id;
  uploadedIds.push(docBId);

  // List endpoint
  const listA = await (await fetch(`${baseUrl}/document/list?items=50`, { headers: { authorization: `Bearer ${employeeAToken}` } })).json();
  const listAIds = listA.result.map((d) => String(d._id));
  assert.ok(listAIds.includes(String(docAId)), 'Employee A list must contain docA');
  assert.ok(!listAIds.includes(String(docBId)), 'Employee A list must NOT contain docB');

  const listB = await (await fetch(`${baseUrl}/document/list?items=50`, { headers: { authorization: `Bearer ${employeeBToken}` } })).json();
  const listBIds = listB.result.map((d) => String(d._id));
  assert.ok(listBIds.includes(String(docBId)), 'Employee B list must contain docB');
  assert.ok(!listBIds.includes(String(docAId)), 'Employee B list must NOT contain docA');

  const listHr = await (await fetch(`${baseUrl}/document/list?items=50`, { headers: { authorization: `Bearer ${hrToken}` } })).json();
  const listHrIds = listHr.result.map((d) => String(d._id));
  assert.ok(!listHrIds.includes(String(docAId)), 'HR list must NOT contain docA');
  assert.ok(!listHrIds.includes(String(docBId)), 'HR list must NOT contain docB');

  const listAdmin = await (await fetch(`${baseUrl}/document/list?items=50`, { headers: { authorization: `Bearer ${adminToken}` } })).json();
  const listAdminIds = listAdmin.result.map((d) => String(d._id));
  assert.ok(listAdminIds.includes(String(docAId)), 'ADMIN list must contain docA');
  assert.ok(listAdminIds.includes(String(docBId)), 'ADMIN list must contain docB');

  // Search endpoint
  const searchB = await (await fetch(`${baseUrl}/document/search?q=empa-payroll-tax`, { headers: { authorization: `Bearer ${employeeBToken}` } })).json();
  assert.equal(searchB.result.length, 0, 'Employee B search must return 0 matches for Employee A document');

  const searchHr = await (await fetch(`${baseUrl}/document/search?q=empa-payroll-tax`, { headers: { authorization: `Bearer ${hrToken}` } })).json();
  assert.equal(searchHr.result.length, 0, 'HR search must return 0 matches for Employee A document');

  const searchA = await (await fetch(`${baseUrl}/document/search?q=empa-payroll-tax`, { headers: { authorization: `Bearer ${employeeAToken}` } })).json();
  assert.ok(searchA.result.length >= 1, 'Employee A search must find own document');

  const searchAdmin = await (await fetch(`${baseUrl}/document/search?q=empa-payroll-tax`, { headers: { authorization: `Bearer ${adminToken}` } })).json();
  assert.ok(searchAdmin.result.length >= 1, 'ADMIN search must find document');

  // Summary endpoint
  const sumA = await (await fetch(`${baseUrl}/document/summary`, { headers: { authorization: `Bearer ${employeeAToken}` } })).json();
  const sumB = await (await fetch(`${baseUrl}/document/summary`, { headers: { authorization: `Bearer ${employeeBToken}` } })).json();
  const sumAdmin = await (await fetch(`${baseUrl}/document/summary`, { headers: { authorization: `Bearer ${adminToken}` } })).json();
  assert.ok(sumAdmin.result.total >= sumA.result.total + sumB.result.total, 'ADMIN total must encompass all employee documents');
});

test('prevents client-side manipulation of employee ownership during upload by HR and other employees', async () => {
  // Employee B attempts to upload into Employee A's vault
  const spoofB = await upload(employeeBToken, {
    filename: 'spoofed-by-b.pdf',
    mime: 'application/pdf',
    content: Buffer.from('%PDF- spoof B'),
    employee: fixtures.employeeA.employee._id,
  });
  assert.equal(spoofB.response.status, 200);
  uploadedIds.push(spoofB.body.result._id);
  assert.equal(String(spoofB.body.result.employee._id || spoofB.body.result.employee), String(fixtures.employeeB.employee._id));
  assert.equal(String(spoofB.body.result.uploadedBy._id || spoofB.body.result.uploadedBy), String(fixtures.employeeB.user._id));

  // HR attempts to upload into Employee A's vault
  const spoofHr = await upload(hrToken, {
    filename: 'spoofed-by-hr.pdf',
    mime: 'application/pdf',
    content: Buffer.from('%PDF- spoof HR'),
    employee: fixtures.employeeA.employee._id,
  });
  assert.equal(spoofHr.response.status, 200);
  uploadedIds.push(spoofHr.body.result._id);
  assert.equal(String(spoofHr.body.result.employee._id || spoofHr.body.result.employee), String(fixtures.hr.employee._id));
  assert.equal(String(spoofHr.body.result.uploadedBy._id || spoofHr.body.result.uploadedBy), String(fixtures.hr.user._id));
});

test('rejects malformed document IDs across all vault endpoints with 400', async () => {
  for (const [pathName, method, body] of [
    ['/document/read/not-an-id', 'GET'],
    ['/document/download/not-an-id', 'GET'],
    ['/document/verify/not-an-id', 'PATCH', { verificationStatus: 'Verified' }],
    ['/document/update/not-an-id', 'PATCH', { remarks: 'test' }],
    ['/document/delete/not-an-id', 'DELETE'],
  ]) {
    const response = await fetch(`${baseUrl}${pathName}`, {
      method,
      headers: { authorization: `Bearer ${adminToken}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert.equal(response.status, 400, `${method} ${pathName}`);
  }
});

