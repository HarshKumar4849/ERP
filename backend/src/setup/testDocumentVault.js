const API_BASE = 'http://localhost:8888/api';
const fs = require('fs');
const path = require('path');

async function testDocumentVault() {
  console.log('====================================================');
  console.log('🧪 TESTING TECMOTIV ERP EMPLOYEE DOCUMENT VAULT API');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;
  const assert = (desc, cond) => {
    total++;
    if (cond) {
      console.log(`✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${desc}`);
    }
  };

  const login = async (email, password = 'admin123') => {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    return data.result.token;
  };

  const hrToken = await login('hr@tecmotiv.com');
  const mgtToken = await login('management@tecmotiv.com');
  const emp1Token = await login('employee1@tecmotiv.com');
  const emp2Token = await login('employee2@tecmotiv.com');
  const financeToken = await login('finance@tecmotiv.com');
  const adminToken = await login('admin.user@tecmotiv.com');

  const hrHeader = {
    Authorization: `Bearer ${hrToken}`,
    'Content-Type': 'application/json',
  };

  // 1. Test Summary
  const summaryRes = await fetch(`${API_BASE}/document/summary`, { headers: hrHeader });
  const summaryData = await summaryRes.json();
  assert(
    'GET /document/summary returns vault metrics',
    summaryRes.status === 200 && summaryData.result.total >= 4 && summaryData.result.verified >= 2
  );

  // 2. Test List Documents
  const listRes = await fetch(`${API_BASE}/document/list?page=1&items=10`, { headers: hrHeader });
  const listData = await listRes.json();
  assert(
    'GET /document/list returns paginated documents',
    listRes.status === 200 && listData.result.length >= 4 && listData.pagination.count >= 4
  );

  const sampleDoc1 = listData.result.find((d) => d.documentType === 'Aadhaar');
  const sampleDoc2 = listData.result.find((d) => d.documentType === 'PAN'); // Jane Smith (EMP-002)

  // 3. Test Filter by Document Type
  const filterTypeRes = await fetch(`${API_BASE}/document/list?documentType=Passport`, { headers: hrHeader });
  const filterTypeData = await filterTypeRes.json();
  assert(
    'GET /document/list?documentType=Passport filters correctly',
    filterTypeRes.status === 200 && filterTypeData.result.every((d) => d.documentType === 'Passport')
  );

  // 4. Test Filter by Verification Status
  const filterStatusRes = await fetch(`${API_BASE}/document/list?verificationStatus=Pending`, { headers: hrHeader });
  const filterStatusData = await filterStatusRes.json();
  assert(
    'GET /document/list?verificationStatus=Pending filters pending verification',
    filterStatusRes.status === 200 && filterStatusData.result.every((d) => d.verificationStatus === 'Pending')
  );

  // 5. Test Search by Keyword
  const searchRes = await fetch(`${API_BASE}/document/list?q=Aadhaar`, { headers: hrHeader });
  const searchData = await searchRes.json();
  assert(
    'GET /document/list?q=Aadhaar finds matching document',
    searchRes.status === 200 && searchData.result.some((d) => d.documentType === 'Aadhaar')
  );

  // 6. Test Expiry Tracking Filter
  const expiryFilterRes = await fetch(`${API_BASE}/document/list?expiryStatus=valid`, { headers: hrHeader });
  const expiryFilterData = await expiryFilterRes.json();
  assert(
    'GET /document/list?expiryStatus=valid returns valid documents',
    expiryFilterRes.status === 200 && expiryFilterData.result.length > 0
  );

  // 7. Test Upload New Document (multipart/form-data)
  const tempFilePath = path.resolve('src/storage/vault/temp-test-upload.pdf');
  fs.writeFileSync(tempFilePath, '%PDF-1.4 test document content for upload testing');

  const fileBuffer = fs.readFileSync(tempFilePath);
  const blob = new Blob([fileBuffer], { type: 'application/pdf' });
  const formData = new FormData();
  formData.append('employee', sampleDoc1.employee._id);
  formData.append('documentType', 'Employment Agreement');
  formData.append('issueDate', '2022-02-01');
  formData.append('remarks', 'Automated test agreement upload');
  formData.append('file', blob, 'Employment_Agreement_JohnDoe.pdf');

  const uploadRes = await fetch(`${API_BASE}/document/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${hrToken}`,
    },
    body: formData,
  });
  const uploadData = await uploadRes.json();
  assert(
    'POST /document/upload uploads document into private vault',
    uploadRes.status === 200 && uploadData.result.documentType === 'Employment Agreement'
  );

  const createdDocId = uploadData.result._id;

  // 8. Test Read Document Metadata
  const readRes = await fetch(`${API_BASE}/document/read/${createdDocId}`, { headers: hrHeader });
  const readData = await readRes.json();
  assert(
    'GET /document/read/:id returns populated document metadata',
    readRes.status === 200 && readData.result.file.originalName === 'Employment_Agreement_JohnDoe.pdf'
  );

  // 9. Test Secure Download / View
  const downloadRes = await fetch(`${API_BASE}/document/download/${createdDocId}`, {
    headers: { Authorization: `Bearer ${hrToken}` },
  });
  const downloadBlob = await downloadRes.blob();
  assert(
    'GET /document/download/:id securely streams file content',
    downloadRes.status === 200 && downloadRes.headers.get('content-type') === 'application/pdf' && downloadBlob.size > 0
  );

  // 10. Test Document Verification by HR
  const verifyRes = await fetch(`${API_BASE}/document/verify/${createdDocId}`, {
    method: 'PATCH',
    headers: hrHeader,
    body: JSON.stringify({
      verificationStatus: 'Verified',
      verificationRemarks: 'All pages signed and countersigned.',
    }),
  });
  const verifyData = await verifyRes.json();
  assert(
    'PATCH /document/verify/:id updates verification status and logs verifier',
    verifyRes.status === 200 && verifyData.result.verificationStatus === 'Verified' && verifyData.result.verifiedByName === 'Sarah Connor'
  );

  // 11. Test Update Document Metadata
  const updateRes = await fetch(`${API_BASE}/document/update/${createdDocId}`, {
    method: 'PATCH',
    headers: hrHeader,
    body: JSON.stringify({
      remarks: 'Updated agreement notes',
    }),
  });
  const updateData = await updateRes.json();
  assert(
    'PATCH /document/update/:id updates remarks',
    updateRes.status === 200 && updateData.result.remarks === 'Updated agreement notes'
  );

  // 12. Test Soft Delete
  const delRes = await fetch(`${API_BASE}/document/delete/${createdDocId}`, {
    method: 'DELETE',
    headers: hrHeader,
  });
  assert('DELETE /document/delete/:id soft deletes document', delRes.status === 200);

  // ==========================================
  // SECURITY & RBAC ENFORCEMENT TESTS
  // ==========================================

  // TEST 13: Employee 1 can access own document
  const emp1AccessOwn = await fetch(`${API_BASE}/document/read/${sampleDoc1._id}`, {
    headers: { Authorization: `Bearer ${emp1Token}` },
  });
  assert(
    'Employee can access own document metadata (200 OK)',
    emp1AccessOwn.status === 200
  );

  // TEST 14: Employee 1 downloading own document
  const emp1DownloadOwn = await fetch(`${API_BASE}/document/download/${sampleDoc1._id}`, {
    headers: { Authorization: `Bearer ${emp1Token}` },
  });
  assert(
    'Employee can download own document stream (200 OK)',
    emp1DownloadOwn.status === 200
  );

  // TEST 15: Employee 1 BLOCKED from accessing Employee 2's document (Jane Smith)
  const emp1AccessOther = await fetch(`${API_BASE}/document/read/${sampleDoc2._id}`, {
    headers: { Authorization: `Bearer ${emp1Token}` },
  });
  assert(
    'Employee 1 BLOCKED from accessing Employee 2 document (403 Forbidden)',
    emp1AccessOther.status === 403
  );

  // TEST 16: Employee 1 BLOCKED from downloading Employee 2's document
  const emp1DownloadOther = await fetch(`${API_BASE}/document/download/${sampleDoc2._id}`, {
    headers: { Authorization: `Bearer ${emp1Token}` },
  });
  assert(
    'Employee 1 BLOCKED from downloading Employee 2 document stream (403 Forbidden)',
    emp1DownloadOther.status === 403
  );

  // TEST 17: Employee BLOCKED from uploading or verifying documents
  const empVerifyBlocked = await fetch(`${API_BASE}/document/verify/${sampleDoc1._id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${emp1Token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ verificationStatus: 'Verified' }),
  });
  assert(
    'Employee BLOCKED from verifying documents (403 Forbidden)',
    empVerifyBlocked.status === 403
  );

  // TEST 18: Finance role BLOCKED from accessing employee documents
  const finAccessBlocked = await fetch(`${API_BASE}/document/read/${sampleDoc1._id}`, {
    headers: { Authorization: `Bearer ${financeToken}` },
  });
  assert(
    'Finance role BLOCKED from employee document vault (403 Forbidden)',
    finAccessBlocked.status === 403
  );

  // TEST 19: Management role has unrestricted access across all documents
  const mgtAccess = await fetch(`${API_BASE}/document/read/${sampleDoc2._id}`, {
    headers: { Authorization: `Bearer ${mgtToken}` },
  });
  assert(
    'Management role can access all employee documents (200 OK)',
    mgtAccess.status === 200
  );

  console.log('\n====================================================');
  console.log(`📊 RESULTS: ${passed}/${total} DOCUMENT VAULT TESTS PASSED`);
  console.log('====================================================\n');

  process.exit(passed === total ? 0 : 1);
}

testDocumentVault().catch((err) => {
  console.error(err);
  process.exit(1);
});
