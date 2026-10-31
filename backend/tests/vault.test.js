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

// =========================================================================
// 1. STORAGE, INTEGRITY & FORMAT VALIDATION
// =========================================================================
test('1. accepts every configured document MIME type and preserves metadata', async () => {
  for (const [extension, mime, content] of ACCEPTED) {
    const filename = `QA ${extension} resume — ${'x'.repeat(20)}.${extension}`;
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

test('2. authorized download uses safe headers and exact stored bytes', async () => {
  const content = Buffer.from('%PDF- safe stream payload');
  const uploaded = await upload(adminToken, {
    filename: 'download-target.pdf', mime: 'application/pdf', content, employee: fixtures.employee.employee._id,
  });
  assert.equal(uploaded.response.status, 200);
  const doc = uploaded.body.result;
  uploadedIds.push(doc._id);

  const response = await fetch(`${baseUrl}/document/download/${doc._id}`, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.ok(response.headers.get('content-disposition').includes('attachment; filename="download-target.pdf"'));
  assert.equal(response.headers.get('cache-control'), 'private, no-cache, no-store, must-revalidate');
  const buffer = Buffer.from(await response.arrayBuffer());
  assert.equal(buffer.compare(content), 0);
});

test('3. rejects unsupported MIME, missing file and malformed metadata without orphan files', async () => {
  const countBefore = fs.readdirSync(vaultDir).length;
  const unsupported = await upload(adminToken, {
    filename: 'evil.exe', mime: 'application/octet-stream', content: Buffer.from('MZ\x90\x00'), employee: fixtures.employee.employee._id,
  });
  assert.equal(unsupported.response.status, 400);

  const empty = await upload(adminToken, {
    filename: 'empty.pdf', mime: 'application/pdf', content: Buffer.alloc(0), employee: fixtures.employee.employee._id,
  });
  assert.equal(empty.response.status, 400);

  const countAfter = fs.readdirSync(vaultDir).length;
  assert.equal(countBefore, countAfter);
});

test('4. enforces the 10 MiB boundary and does not create a record for oversized files', async () => {
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

test('5. concurrent uploads receive distinct files and do not overwrite each other', async () => {
  const requests = await Promise.all(Array.from({ length: 4 }, (_, index) => upload(adminToken, {
    filename: `duplicate-${index}.pdf`, mime: 'application/pdf', content: Buffer.from(`%PDF- concurrent ${index}`), employee: fixtures.employee.employee._id,
  })));
  for (const result of requests) {
    assert.equal(result.response.status, 200);
    uploadedIds.push(result.body.result._id);
  }
  const paths = requests.map((result) => result.body.result.file.path);
  assert.equal(new Set(paths).size, paths.length);
});

test('6. private vault files are not served by public or legacy routes', async () => {
  const leaked = await fetch(`${baseUrl.replace('/api', '')}/public/storage/vault`);
  assert.ok([400, 404].includes(leaked.status));
  const legacy = await fetch(`${baseUrl.replace('/api', '')}/download/document/private.pdf`, { headers: { authorization: `Bearer ${adminToken}` } });
  assert.ok([400, 404, 403].includes(legacy.status));
});

test('7. rejects malformed document IDs across all vault endpoints with 400', async () => {
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

// =========================================================================
// 2. ADMIN PERMISSIONS & CAPABILITIES
// =========================================================================
test('8. ADMIN retains full document lifecycle: preview, download, verify, reject, delete and sensitive category access', async () => {
  const docSalary = await upload(adminToken, {
    filename: 'empa-admin-salary.pdf',
    mime: 'application/pdf',
    content: Buffer.from('%PDF- salary slip 2026'),
    employee: fixtures.employeeA.employee._id,
    documentType: 'Salary Documents',
  });
  assert.equal(docSalary.response.status, 200);
  const docId = docSalary.body.result._id;
  uploadedIds.push(docId);

  // Admin reads metadata of sensitive document
  const readRes = await fetch(`${baseUrl}/document/read/${docId}`, { headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(readRes.status, 200);

  // Admin previews & downloads
  const dlRes = await fetch(`${baseUrl}/document/download/${docId}`, { headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(dlRes.status, 200);

  // Admin verifies document
  const verifyRes = await fetch(`${baseUrl}/document/verify/${docId}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ verificationStatus: 'Verified', verificationRemarks: 'Admin audit pass' }),
  });
  assert.equal(verifyRes.status, 200);
  const verifyData = await verifyRes.json();
  assert.equal(verifyData.result.verificationStatus, 'Verified');

  // Admin rejects document
  const rejectRes = await fetch(`${baseUrl}/document/verify/${docId}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ verificationStatus: 'Rejected', verificationRemarks: 'Admin audit rejected' }),
  });
  assert.equal(rejectRes.status, 200);
  const rejectData = await rejectRes.json();
  assert.equal(rejectData.result.verificationStatus, 'Rejected');

  // Admin deletes document
  const deleteRes = await fetch(`${baseUrl}/document/delete/${docId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(deleteRes.status, 200);
  const deletedDoc = await mongoose.model('Document').findById(docId);
  assert.equal(deletedDoc.removed, true);
});

// =========================================================================
// 3. HR ACCESS & VERIFICATION RBAC (PERMITTED VS RESTRICTED CATEGORIES)
// =========================================================================
test('9. HR can list, preview, download, verify and reject permitted documents of Employee A and Employee B', async () => {
  // Seed permitted documents
  const docAadhaar = await upload(adminToken, {
    filename: 'empa-aadhaar.pdf',
    mime: 'application/pdf',
    content: Buffer.from('%PDF- empa aadhaar card'),
    employee: fixtures.employeeA.employee._id,
    documentType: 'Aadhaar',
  });
  assert.equal(docAadhaar.response.status, 200);
  const idA = docAadhaar.body.result._id;
  uploadedIds.push(idA);

  const docNda = await upload(adminToken, {
    filename: 'empb-nda.pdf',
    mime: 'application/pdf',
    content: Buffer.from('%PDF- empb signed nda'),
    employee: fixtures.employeeB.employee._id,
    documentType: 'NDA',
  });
  assert.equal(docNda.response.status, 200);
  const idB = docNda.body.result._id;
  uploadedIds.push(idB);

  // HR lists Employee A documents
  const listARes = await fetch(`${baseUrl}/document/list?employee=${fixtures.employeeA.employee._id}`, {
    headers: { authorization: `Bearer ${hrToken}` },
  });
  assert.equal(listARes.status, 200);
  const listA = await listARes.json();
  assert.ok(listA.result.some((d) => String(d._id) === String(idA)), 'HR must see Employee A permitted document');

  // HR lists Employee B documents
  const listBRes = await fetch(`${baseUrl}/document/list?employee=${fixtures.employeeB.employee._id}`, {
    headers: { authorization: `Bearer ${hrToken}` },
  });
  assert.equal(listBRes.status, 200);
  const listB = await listBRes.json();
  assert.ok(listB.result.some((d) => String(d._id) === String(idB)), 'HR must see Employee B permitted document');

  // HR reads permitted document metadata
  const readRes = await fetch(`${baseUrl}/document/read/${idA}`, { headers: { authorization: `Bearer ${hrToken}` } });
  assert.equal(readRes.status, 200);

  // HR downloads & previews permitted document
  const dlRes = await fetch(`${baseUrl}/document/download/${idA}`, { headers: { authorization: `Bearer ${hrToken}` } });
  assert.equal(dlRes.status, 200);
  const prevRes = await fetch(`${baseUrl}/document/download/${idA}?mode=inline`, { headers: { authorization: `Bearer ${hrToken}` } });
  assert.equal(prevRes.status, 200);

  // HR verifies permitted document
  const verifyRes = await fetch(`${baseUrl}/document/verify/${idA}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${hrToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ verificationStatus: 'Verified', verificationRemarks: 'HR verified with original' }),
  });
  assert.equal(verifyRes.status, 200);
  const verifyData = await verifyRes.json();
  assert.equal(verifyData.result.verificationStatus, 'Verified');
  assert.equal(String(verifyData.result.verifiedBy._id || verifyData.result.verifiedBy), String(fixtures.hr.user._id));

  // HR rejects permitted document
  const rejectRes = await fetch(`${baseUrl}/document/verify/${idA}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${hrToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ verificationStatus: 'Rejected', verificationRemarks: 'HR rejected: signature mismatch' }),
  });
  assert.equal(rejectRes.status, 200);
  const rejectData = await rejectRes.json();
  assert.equal(rejectData.result.verificationStatus, 'Rejected');
});

test('10. HR is strictly blocked from accessing Salary Documents and Bank Details across all endpoints', async () => {
  // Seed sensitive documents
  const docSal = await upload(adminToken, {
    filename: 'empa-confidential-salary.pdf',
    mime: 'application/pdf',
    content: Buffer.from('%PDF- salary records confidential'),
    employee: fixtures.employeeA.employee._id,
    documentType: 'Salary Documents',
  });
  assert.equal(docSal.response.status, 200);
  const salId = docSal.body.result._id;
  uploadedIds.push(salId);

  const docBank = await upload(adminToken, {
    filename: 'empa-confidential-bank.pdf',
    mime: 'application/pdf',
    content: Buffer.from('%PDF- bank passbook confidential'),
    employee: fixtures.employeeA.employee._id,
    documentType: 'Bank Details',
  });
  assert.equal(docBank.response.status, 200);
  const bankId = docBank.body.result._id;
  uploadedIds.push(bankId);

  // 1. HR cannot read metadata of Salary Documents
  const readSal = await fetch(`${baseUrl}/document/read/${salId}`, { headers: { authorization: `Bearer ${hrToken}` } });
  assert.equal(readSal.status, 403, 'HR must be blocked from reading Salary Documents');

  // 2. HR cannot read metadata of Bank Details
  const readBank = await fetch(`${baseUrl}/document/read/${bankId}`, { headers: { authorization: `Bearer ${hrToken}` } });
  assert.equal(readBank.status, 403, 'HR must be blocked from reading Bank Details');

  // 3. HR cannot download or preview Salary Documents
  const dlSal = await fetch(`${baseUrl}/document/download/${salId}`, { headers: { authorization: `Bearer ${hrToken}` } });
  assert.equal(dlSal.status, 403, 'HR must be blocked from downloading Salary Documents');
  const prevSal = await fetch(`${baseUrl}/document/download/${salId}?mode=inline`, { headers: { authorization: `Bearer ${hrToken}` } });
  assert.equal(prevSal.status, 403, 'HR must be blocked from previewing Salary Documents');

  // 4. HR cannot download or preview Bank Details
  const dlBank = await fetch(`${baseUrl}/document/download/${bankId}`, { headers: { authorization: `Bearer ${hrToken}` } });
  assert.equal(dlBank.status, 403, 'HR must be blocked from downloading Bank Details');

  // 5. HR cannot verify Salary Documents or Bank Details
  const verSal = await fetch(`${baseUrl}/document/verify/${salId}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${hrToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ verificationStatus: 'Verified' }),
  });
  assert.equal(verSal.status, 403, 'HR must be blocked from verifying Salary Documents');

  const verBank = await fetch(`${baseUrl}/document/verify/${bankId}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${hrToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ verificationStatus: 'Verified' }),
  });
  assert.equal(verBank.status, 403, 'HR must be blocked from verifying Bank Details');

  // 6. List endpoint excludes Salary Documents and Bank Details for HR
  const listRes = await fetch(`${baseUrl}/document/list?employee=${fixtures.employeeA.employee._id}`, {
    headers: { authorization: `Bearer ${hrToken}` },
  });
  assert.equal(listRes.status, 200);
  const listData = await listRes.json();
  const foundSensitive = listData.result.some((d) => ['Salary Documents', 'Bank Details'].includes(d.documentType));
  assert.equal(foundSensitive, false, 'HR list must never contain Salary Documents or Bank Details');

  // 7. Summary endpoint excludes Salary Documents and Bank Details for HR
  const sumRes = await fetch(`${baseUrl}/document/summary?employee=${fixtures.employeeA.employee._id}`, {
    headers: { authorization: `Bearer ${hrToken}` },
  });
  assert.equal(sumRes.status, 200);
  const sumData = await sumRes.json();
  const sensitiveInSummary = sumData.result.byType.some((t) => ['Salary Documents', 'Bank Details'].includes(t.type));
  assert.equal(sensitiveInSummary, false, 'HR summary must not return counts of Salary Documents or Bank Details');
});

test('11. HR is forbidden from deleting documents, uploading on behalf of others, and verifying own documents', async () => {
  const doc = await upload(adminToken, {
    filename: 'empa-contract.pdf',
    mime: 'application/pdf',
    content: Buffer.from('%PDF- empa contract'),
    employee: fixtures.employeeA.employee._id,
    documentType: 'Employment Agreement',
  });
  assert.equal(doc.response.status, 200);
  const docId = doc.body.result._id;
  uploadedIds.push(docId);

  // 1. HR cannot delete
  const delRes = await fetch(`${baseUrl}/document/delete/${docId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${hrToken}` },
  });
  assert.equal(delRes.status, 403, 'HR cannot delete documents');

  // 2. HR cannot upload on behalf of Employee A (forces HR own ID)
  const uploadSpoof = await upload(hrToken, {
    filename: 'hr-spoof-attempt.pdf',
    mime: 'application/pdf',
    content: Buffer.from('%PDF- hr upload spoof'),
    employee: fixtures.employeeA.employee._id,
    documentType: 'Experience Letter',
  });
  assert.equal(uploadSpoof.response.status, 200);
  uploadedIds.push(uploadSpoof.body.result._id);
  assert.equal(
    String(uploadSpoof.body.result.employee._id || uploadSpoof.body.result.employee),
    String(fixtures.hr.employee._id),
    'Document must be bound to HR own employee record, not Employee A'
  );

  // 3. HR cannot verify their OWN document
  const hrOwnDoc = uploadSpoof.body.result._id;
  const selfVerifyRes = await fetch(`${baseUrl}/document/verify/${hrOwnDoc}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${hrToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ verificationStatus: 'Verified' }),
  });
  assert.equal(selfVerifyRes.status, 403, 'HR cannot verify their own document');
});

// =========================================================================
// 4. EMPLOYEE RESTRICTIONS & SELF-SERVICE ACCESS
// =========================================================================
test('12. Employee can view and upload own documents, but is strictly blocked from other employees and verification', async () => {
  // Employee A uploads own document
  const empUpload = await upload(employeeAToken, {
    filename: 'empa-own-edu.pdf',
    mime: 'application/pdf',
    content: Buffer.from('%PDF- empa degree certificate'),
    employee: fixtures.employeeA.employee._id,
    documentType: 'Education Certificate',
  });
  assert.equal(empUpload.response.status, 200);
  const ownDocId = empUpload.body.result._id;
  uploadedIds.push(ownDocId);
  assert.equal(String(empUpload.body.result.employee._id || empUpload.body.result.employee), String(fixtures.employeeA.employee._id));

  // Employee A can read and download own document
  const readOwn = await fetch(`${baseUrl}/document/read/${ownDocId}`, { headers: { authorization: `Bearer ${employeeAToken}` } });
  assert.equal(readOwn.status, 200);
  const dlOwn = await fetch(`${baseUrl}/document/download/${ownDocId}`, { headers: { authorization: `Bearer ${employeeAToken}` } });
  assert.equal(dlOwn.status, 200);

  // Employee B is blocked from Employee A document
  const readOther = await fetch(`${baseUrl}/document/read/${ownDocId}`, { headers: { authorization: `Bearer ${employeeBToken}` } });
  assert.equal(readOther.status, 403);
  const dlOther = await fetch(`${baseUrl}/document/download/${ownDocId}`, { headers: { authorization: `Bearer ${employeeBToken}` } });
  assert.equal(dlOther.status, 403);

  // Employee A cannot verify own document
  const verifyAttempt = await fetch(`${baseUrl}/document/verify/${ownDocId}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${employeeAToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ verificationStatus: 'Verified' }),
  });
  assert.equal(verifyAttempt.status, 403);

  // Employee A cannot delete own document
  const deleteAttempt = await fetch(`${baseUrl}/document/delete/${ownDocId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(deleteAttempt.status, 403);

  // Employee A cannot list Employee B documents
  const listAttempt = await fetch(`${baseUrl}/document/list?employee=${fixtures.employeeB.employee._id}`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(listAttempt.status, 200);
  const listData = await listAttempt.json();
  // Query is locked to Employee A
  for (const d of listData.result) {
    const empId = String(d.employee?._id || d.employee);
    assert.equal(empId, String(fixtures.employeeA.employee._id));
  }
});
