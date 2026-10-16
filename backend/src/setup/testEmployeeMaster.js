const API_BASE = 'http://localhost:8888/api';

async function testEmployeeMaster() {
  console.log('====================================================');
  console.log('🧪 TESTING TECMOTIV ERP EMPLOYEE MASTER API & WORKFLOWS');
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

  // Helper login
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
  const authHeader = {
    Authorization: `Bearer ${hrToken}`,
    'Content-Type': 'application/json',
  };

  // 1. Test Summary
  const summaryRes = await fetch(`${API_BASE}/employee/summary`, { headers: authHeader });
  const summaryData = await summaryRes.json();
  assert('GET /employee/summary returns stats', summaryRes.status === 200 && summaryData.result.total >= 5);

  // 2. Test Paginated List
  const listRes = await fetch(`${API_BASE}/employee/list?page=1&items=5`, { headers: authHeader });
  const listData = await listRes.json();
  assert(
    'GET /employee/list returns paginated results',
    listRes.status === 200 && listData.result.length > 0 && listData.pagination.page === 1
  );

  // 3. Test Search
  const searchRes = await fetch(`${API_BASE}/employee/list?q=John`, { headers: authHeader });
  const searchData = await searchRes.json();
  assert(
    'GET /employee/list?q=John returns matching employee',
    searchRes.status === 200 && searchData.result.some((e) => e.name === 'John')
  );

  // 4. Test Filter by Department
  const filterDeptRes = await fetch(`${API_BASE}/employee/list?department=Engineering`, { headers: authHeader });
  const filterDeptData = await filterDeptRes.json();
  assert(
    'GET /employee/list?department=Engineering returns only Engineering',
    filterDeptRes.status === 200 && filterDeptData.result.every((e) => e.departmentName === 'Engineering')
  );

  // 5. Test Filter by Status
  const filterStatusRes = await fetch(`${API_BASE}/employee/list?status=Active`, { headers: authHeader });
  const filterStatusData = await filterStatusRes.json();
  assert(
    'GET /employee/list?status=Active returns active employees',
    filterStatusRes.status === 200 && filterStatusData.result.every((e) => e.status === 'Active')
  );

  // 6. Test Sorting
  const sortRes = await fetch(`${API_BASE}/employee/list?sortBy=name&sortValue=1`, { headers: authHeader });
  const sortData = await sortRes.json();
  assert(
    'GET /employee/list?sortBy=name&sortValue=1 sorts alphabetically',
    sortRes.status === 200 && sortData.result.length > 1
  );

  // 7. Test Create Employee
  const randNum = Math.floor(1000 + Math.random() * 9000);
  const testEmpId = `TM-${randNum}`;
  const testEmail = `emily.test.${randNum}@tecmotiv.com`;

  const newEmpPayload = {
    employeeId: testEmpId,
    name: 'Emily',
    surname: 'Blunt',
    email: testEmail,
    personalEmail: 'emily.blunt.personal@gmail.com',
    phone: '+1-555-7788',
    gender: 'Female',
    department: 'Engineering',
    designation: 'Senior Software Engineer',
    employmentType: 'Full Time',
    status: 'Probation',
    skills: ['Python', 'FastAPI', 'PostgreSQL', 'Machine Learning'],
    qualifications: ['M.S. in AI - Carnegie Mellon'],
    certifications: ['AWS Certified Machine Learning Specialist'],
    experience: '6 Years',
    currentResponsibilities: 'Leading ML pipeline optimization and data engineering.',
    emergencyContact: {
      name: 'John Blunt',
      phone: '+1-555-9988',
      relationship: 'Brother',
    },
  };

  const createRes = await fetch(`${API_BASE}/employee/create`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify(newEmpPayload),
  });
  const createData = await createRes.json();
  assert(
    'POST /employee/create creates new employee with resolved relationships',
    createRes.status === 200 && createData.result.employeeId === testEmpId && createData.result.departmentName === 'Engineering'
  );

  const createdId = createData.result._id;

  // 8. Test Read Employee by ID
  const readRes = await fetch(`${API_BASE}/employee/read/${createdId}`, { headers: authHeader });
  const readData = await readRes.json();
  assert(
    'GET /employee/read/:id returns populated employee profile',
    readRes.status === 200 && readData.result.email === testEmail
  );

  // 9. Test Update Employee
  const updateRes = await fetch(`${API_BASE}/employee/update/${createdId}`, {
    method: 'PATCH',
    headers: authHeader,
    body: JSON.stringify({
      phone: '+1-555-7799',
      status: 'Active',
      probationPeriod: 'Completed',
    }),
  });
  const updateData = await updateRes.json();
  assert(
    'PATCH /employee/update/:id updates fields',
    updateRes.status === 200 && updateData.result.phone === '+1-555-7799' && updateData.result.status === 'Active'
  );

  // 10. Test Quick Status Change
  const statusRes = await fetch(`${API_BASE}/employee/status/${createdId}`, {
    method: 'PATCH',
    headers: authHeader,
    body: JSON.stringify({
      status: 'On Notice',
      exitDate: '2026-11-30',
      reasonForExit: 'Pursuing higher studies',
    }),
  });
  const statusData = await statusRes.json();
  assert(
    'PATCH /employee/status/:id updates status and exit details',
    statusRes.status === 200 && statusData.result.status === 'On Notice'
  );

  // 11. Test List All (Dropdown items)
  const listAllRes = await fetch(`${API_BASE}/employee/listAll`, { headers: authHeader });
  const listAllData = await listAllRes.json();
  assert(
    'GET /employee/listAll returns all active employees',
    listAllRes.status === 200 && Array.isArray(listAllData.result) && listAllData.result.length >= 6
  );

  // 12. Test Soft Delete
  const delRes = await fetch(`${API_BASE}/employee/delete/${createdId}`, {
    method: 'DELETE',
    headers: authHeader,
  });
  assert('DELETE /employee/delete/:id soft deletes employee', delRes.status === 200);

  // 13. Test Deleted is removed from active list
  const verifyListRes = await fetch(`${API_BASE}/employee/list?q=${testEmpId}`, { headers: authHeader });
  const verifyListData = await verifyListRes.json();
  assert(
    'Soft deleted employee is excluded from list',
    verifyListRes.status === 200 && verifyListData.result.length === 0
  );

  // 14. Test Organization Structure Endpoints
  const deptRes = await fetch(`${API_BASE}/department/listAll`, { headers: authHeader });
  const deptData = await deptRes.json();
  assert('GET /department/listAll returns departments', deptRes.status === 200 && deptData.result.length >= 5);

  const desigRes = await fetch(`${API_BASE}/designation/listAll`, { headers: authHeader });
  const desigData = await desigRes.json();
  assert('GET /designation/listAll returns designations', desigRes.status === 200 && desigData.result.length >= 5);

  const locRes = await fetch(`${API_BASE}/location/listAll`, { headers: authHeader });
  const locData = await locRes.json();
  assert('GET /location/listAll returns locations', locRes.status === 200 && locData.result.length >= 4);

  console.log('\n====================================================');
  console.log(`📊 RESULTS: ${passed}/${total} EMPLOYEE MASTER API TESTS PASSED`);
  console.log('====================================================\n');

  process.exit(passed === total ? 0 : 1);
}

testEmployeeMaster().catch((err) => {
  console.error(err);
  process.exit(1);
});
