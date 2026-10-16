require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const { generate: uniqueId } = require('shortid');

mongoose.connect(process.env.DATABASE || 'mongodb://127.0.0.1:27017/tecmotiv-erp');

async function seedRbacData() {
  try {
    const Admin = require('../models/coreModels/Admin');
    const AdminPassword = require('../models/coreModels/AdminPassword');
    const Department = require('../models/appModels/Department');
    const Designation = require('../models/appModels/Designation');
    const Location = require('../models/appModels/Location');
    const Project = require('../models/appModels/Project');
    const Employee = require('../models/appModels/Employee');
    const Salary = require('../models/appModels/Salary');
    const Leave = require('../models/appModels/Leave');
    const Attendance = require('../models/appModels/Attendance');
    const Document = require('../models/appModels/Document');
    const LeaveBalance = require('../models/appModels/LeaveBalance');

    // 1. SEED DEPARTMENTS
    const deptData = [
      { name: 'Executive', code: 'EXC', description: 'Executive Leadership & Management' },
      { name: 'Human Resources', code: 'HR', description: 'Talent Acquisition & Employee Operations' },
      { name: 'Finance', code: 'FIN', description: 'Financial Planning & Accounting' },
      { name: 'Administration', code: 'ADM', description: 'Infrastructure, Facilities & Office Admin' },
      { name: 'Engineering', code: 'ENG', description: 'Product Development & Software Engineering' },
      { name: 'Marketing', code: 'MKT', description: 'Brand, Growth & Communications' },
      { name: 'Operations', code: 'OPS', description: 'Business Operations & Supply Chain' },
    ];

    const departments = {};
    for (const d of deptData) {
      let dept = await Department.findOne({ name: d.name });
      if (!dept) {
        dept = await new Department(d).save();
      }
      departments[d.name] = dept;
    }
    console.log('👍 Seeded Departments');

    // 2. SEED LOCATIONS
    const locData = [
      {
        name: 'New York Headquarters',
        code: 'NYC-HQ',
        type: 'Headquarters',
        city: 'New York',
        state: 'NY',
        country: 'United States',
        address: '350 5th Ave, Empire State Building',
      },
      {
        name: 'San Francisco Tech Hub',
        code: 'SFO-HUB',
        type: 'Innovation Hub',
        city: 'San Francisco',
        state: 'CA',
        country: 'United States',
        address: '500 Howard St, Suite 400',
      },
      {
        name: 'London Regional Office',
        code: 'LON-OFF',
        type: 'Branch Office',
        city: 'London',
        country: 'United Kingdom',
        address: '100 Bishopsgate',
      },
      {
        name: 'Remote - Global',
        code: 'REM-GLB',
        type: 'Remote',
        city: 'Virtual',
        country: 'Global',
        address: 'Work from Anywhere',
      },
    ];

    const locations = {};
    for (const l of locData) {
      let loc = await Location.findOne({ name: l.name });
      if (!loc) {
        loc = await new Location(l).save();
      }
      locations[l.name] = loc;
    }
    console.log('👍 Seeded Locations');

    // 3. SEED DESIGNATIONS
    const desigData = [
      { name: 'Managing Director', code: 'MD', dept: 'Executive', level: 'Executive' },
      { name: 'Head of People', code: 'HOP', dept: 'Human Resources', level: 'Director' },
      { name: 'HR Manager', code: 'HRM', dept: 'Human Resources', level: 'Manager' },
      { name: 'HR Specialist', code: 'HRS', dept: 'Human Resources', level: 'Mid' },
      { name: 'HR Generalist', code: 'HRG', dept: 'Human Resources', level: 'Mid' },
      { name: 'Talent Acquisition Lead', code: 'TAL', dept: 'Human Resources', level: 'Lead' },
      { name: 'Finance Controller', code: 'FC', dept: 'Finance', level: 'Manager' },
      { name: 'Systems Administrator', code: 'SA', dept: 'Administration', level: 'Lead' },
      { name: 'VP of Engineering', code: 'VPE', dept: 'Engineering', level: 'Director' },
      { name: 'Senior Software Engineer', code: 'SSE', dept: 'Engineering', level: 'Senior' },
      { name: 'Full Stack Developer', code: 'FSD', dept: 'Engineering', level: 'Mid' },
      { name: 'DevOps Engineer', code: 'DOE', dept: 'Engineering', level: 'Senior' },
      { name: 'Marketing Lead', code: 'ML', dept: 'Marketing', level: 'Lead' },
      { name: 'Operations Lead', code: 'OL', dept: 'Operations', level: 'Lead' },
    ];

    const designations = {};
    for (const dg of desigData) {
      let desig = await Designation.findOne({ name: dg.name });
      if (!desig) {
        desig = await new Designation({
          name: dg.name,
          code: dg.code,
          department: departments[dg.dept]?._id,
          departmentName: dg.dept,
          level: dg.level,
        }).save();
      }
      designations[dg.name] = desig;
    }
    console.log('👍 Seeded Designations');

    // 4. SEED PROJECTS
    const projData = [
      {
        name: 'TecMotiv ERP Core Migration',
        code: 'TM-ERP-01',
        description: 'Migration to modern role-based ERP & HR architecture',
        department: 'Engineering',
        status: 'active',
      },
      {
        name: 'Cloud Infrastructure Modernization',
        code: 'TM-CLD-02',
        description: 'Multi-region AWS cluster deployment and container orchestration',
        department: 'Engineering',
        status: 'active',
      },
      {
        name: 'Employee Engagement 360',
        code: 'TM-HR-03',
        description: 'Internal performance, rewards, and recognition portal',
        department: 'Human Resources',
        status: 'planning',
      },
    ];

    const projects = {};
    for (const p of projData) {
      let proj = await Project.findOne({ name: p.name });
      if (!proj) {
        proj = await new Project(p).save();
      }
      projects[p.name] = proj;
    }
    console.log('👍 Seeded Projects');

    // 5. SEED USERS / ADMIN ACCOUNTS
    const usersToCreate = [
      {
        email: 'management@tecmotiv.com',
        name: 'Marcus',
        surname: 'Vance',
        role: 'MANAGEMENT',
        department: 'Executive',
        designation: 'Managing Director',
        employeeId: 'MGT-001',
      },
      {
        email: 'hr@tecmotiv.com',
        name: 'Sarah',
        surname: 'Connor',
        role: 'HR',
        department: 'Human Resources',
        designation: 'Head of People',
        employeeId: 'HR-001',
      },
      {
        email: 'finance@tecmotiv.com',
        name: 'Frank',
        surname: 'Miller',
        role: 'FINANCE',
        department: 'Finance',
        designation: 'Finance Controller',
        employeeId: 'FIN-001',
      },
      {
        email: 'admin.user@tecmotiv.com',
        name: 'Alex',
        surname: 'Mercer',
        role: 'ADMIN',
        department: 'Administration',
        designation: 'Systems Administrator',
        employeeId: 'ADM-001',
      },
      {
        email: 'depthead@tecmotiv.com',
        name: 'David',
        surname: 'Head',
        role: 'DEPARTMENT_HEAD',
        department: 'Engineering',
        designation: 'VP of Engineering',
        employeeId: 'ENG-001',
      },
      {
        email: 'employee1@tecmotiv.com',
        name: 'John',
        surname: 'Doe',
        role: 'EMPLOYEE',
        department: 'Engineering',
        designation: 'Senior Software Engineer',
        employeeId: 'EMP-001',
      },
      {
        email: 'employee2@tecmotiv.com',
        name: 'Jane',
        surname: 'Smith',
        role: 'EMPLOYEE',
        department: 'Marketing',
        designation: 'Marketing Lead',
        employeeId: 'EMP-002',
      },
    ];

    const createdUsers = {};
    for (const u of usersToCreate) {
      let existingUser = await Admin.findOne({ email: u.email.toLowerCase() });
      if (!existingUser) {
        existingUser = await new Admin({
          ...u,
          enabled: true,
        }).save();

        const newAdminPassword = new AdminPassword();
        const salt = uniqueId();
        const passwordHash = newAdminPassword.generateHash(salt, 'admin123');

        await new AdminPassword({
          password: passwordHash,
          emailVerified: true,
          salt,
          user: existingUser._id,
        }).save();
        console.log(`Created user: ${u.email} (${u.role})`);
      } else {
        existingUser.role = u.role;
        existingUser.department = u.department;
        existingUser.designation = u.designation;
        existingUser.employeeId = u.employeeId;
        await existingUser.save();
        console.log(`Updated user: ${u.email} (${u.role})`);
      }
      createdUsers[u.email] = existingUser;
    }

    const mainAdmin = await Admin.findOne({ email: 'admin@admin.com' });
    if (mainAdmin) {
      mainAdmin.role = 'MANAGEMENT';
      await mainAdmin.save();
    }

    // 6. SEED COMPREHENSIVE EMPLOYEE MASTER PROFILES
    const emp1 = createdUsers['employee1@tecmotiv.com'];
    const emp2 = createdUsers['employee2@tecmotiv.com'];
    const mgtUser = createdUsers['management@tecmotiv.com'];
    const hrUser = createdUsers['hr@tecmotiv.com'];
    const deptHeadUser = createdUsers['depthead@tecmotiv.com'];

    // Clear existing for clean reload
    await Employee.deleteMany({
      email: {
        $in: [
          'management@tecmotiv.com',
          'hr@tecmotiv.com',
          'finance@tecmotiv.com',
          'admin.user@tecmotiv.com',
          'depthead@tecmotiv.com',
          'employee1@tecmotiv.com',
          'employee2@tecmotiv.com',
        ],
      },
    });

    // 6a. Management Employee
    const mgtEmp = await new Employee({
      employeeId: 'MGT-001',
      name: 'Marcus',
      surname: 'Vance',
      gender: 'Male',
      birthDate: new Date('1982-04-12'),
      phone: '+1-555-0010',
      personalEmail: 'marcus.vance@gmail.com',
      email: 'management@tecmotiv.com',
      address: '742 Evergreen Terrace, New York, NY',
      emergencyContact: { name: 'Elena Vance', phone: '+1-555-9011', relationship: 'Spouse' },
      joiningDate: new Date('2020-01-15'),
      department: departments['Executive']?._id,
      departmentName: 'Executive',
      designation: designations['Managing Director']?._id,
      designationName: 'Managing Director',
      employmentType: 'Full Time',
      probationPeriod: 'None',
      confirmationDate: new Date('2020-04-15'),
      workLocation: locations['New York Headquarters']?._id,
      workLocationName: 'New York Headquarters',
      status: 'Active',
      skills: ['Strategic Planning', 'Leadership', 'P&L Management', 'Enterprise Scaling'],
      qualifications: ['MBA - Harvard Business School', 'B.S. Economics'],
      certifications: ['Certified Corporate Director'],
      experience: '18 Years',
      linkedin: 'https://linkedin.com/in/marcus-vance',
      areasOfExpertise: ['Corporate Strategy', 'Executive Management'],
      currentResponsibilities: 'Leading global organization vision, operations, and strategic initiatives.',
      user: mgtUser._id,
    }).save();

    // 6b. HR Head
    const hrEmp = await new Employee({
      employeeId: 'HR-001',
      name: 'Sarah',
      surname: 'Connor',
      gender: 'Female',
      birthDate: new Date('1988-08-24'),
      phone: '+1-555-0020',
      personalEmail: 'sarah.connor@gmail.com',
      email: 'hr@tecmotiv.com',
      address: '12 Baker Street, New York, NY',
      emergencyContact: { name: 'John Connor', phone: '+1-555-9022', relationship: 'Son' },
      joiningDate: new Date('2021-03-01'),
      department: departments['Human Resources']?._id,
      departmentName: 'Human Resources',
      designation: designations['Head of People']?._id,
      designationName: 'Head of People',
      reportingManager: mgtEmp._id,
      employmentType: 'Full Time',
      probationPeriod: 'None',
      confirmationDate: new Date('2021-06-01'),
      workLocation: locations['New York Headquarters']?._id,
      workLocationName: 'New York Headquarters',
      status: 'Active',
      skills: ['Talent Strategy', 'People Analytics', 'Compensation & Benefits', 'Conflict Resolution'],
      qualifications: ['M.S. Human Resource Management', 'B.A. Psychology'],
      certifications: ['SHRM-SCP', 'PHR'],
      experience: '12 Years',
      linkedin: 'https://linkedin.com/in/sarah-connor',
      areasOfExpertise: ['HR Operations', 'Employee Experience'],
      currentResponsibilities: 'Directing global talent acquisition, culture, and employee operations.',
      user: hrUser._id,
    }).save();

    // 6c. VP Engineering (Dept Head)
    const engHeadEmp = await new Employee({
      employeeId: 'ENG-001',
      name: 'David',
      surname: 'Head',
      gender: 'Male',
      birthDate: new Date('1985-11-03'),
      phone: '+1-555-0050',
      personalEmail: 'david.head@gmail.com',
      email: 'depthead@tecmotiv.com',
      address: '45 Mission Blvd, San Francisco, CA',
      emergencyContact: { name: 'Laura Head', phone: '+1-555-9055', relationship: 'Spouse' },
      joiningDate: new Date('2021-06-15'),
      department: departments['Engineering']?._id,
      departmentName: 'Engineering',
      designation: designations['VP of Engineering']?._id,
      designationName: 'VP of Engineering',
      reportingManager: mgtEmp._id,
      employmentType: 'Full Time',
      probationPeriod: 'None',
      confirmationDate: new Date('2021-09-15'),
      workLocation: locations['San Francisco Tech Hub']?._id,
      workLocationName: 'San Francisco Tech Hub',
      status: 'Active',
      skills: ['Distributed Systems', 'Cloud Architecture', 'Engineering Leadership', 'Microservices'],
      qualifications: ['M.S. Computer Science - Stanford', 'B.S. Software Engineering'],
      certifications: ['AWS Solutions Architect Professional', 'CKA Kubernetes'],
      experience: '15 Years',
      linkedin: 'https://linkedin.com/in/david-head-tech',
      areasOfExpertise: ['System Architecture', 'High Scale Engineering'],
      assignedProjects: [projects['TecMotiv ERP Core Migration']?._id],
      currentResponsibilities: 'Leading engineering delivery, system architecture, and tech roadmap.',
      user: deptHeadUser._id,
    }).save();

    // 6d. Employee 1 (John Doe - Senior Software Engineer)
    const empProfile1 = await new Employee({
      employeeId: 'EMP-001',
      name: 'John',
      surname: 'Doe',
      gender: 'Male',
      birthDate: new Date('1992-05-18'),
      phone: '+1-555-0101',
      personalEmail: 'john.doe.personal@gmail.com',
      email: 'employee1@tecmotiv.com',
      address: '100 Silicon Way, Tech City, CA',
      emergencyContact: { name: 'Mary Doe', phone: '+1-555-9101', relationship: 'Sister' },
      joiningDate: new Date('2022-02-01'),
      department: departments['Engineering']?._id,
      departmentName: 'Engineering',
      designation: designations['Senior Software Engineer']?._id,
      designationName: 'Senior Software Engineer',
      reportingManager: engHeadEmp._id,
      employmentType: 'Full Time',
      probationPeriod: '3 Months',
      confirmationDate: new Date('2022-05-01'),
      workLocation: locations['San Francisco Tech Hub']?._id,
      workLocationName: 'San Francisco Tech Hub',
      status: 'Active',
      skills: ['React.js', 'Node.js', 'MongoDB', 'Express', 'TypeScript', 'Docker'],
      qualifications: ['B.Tech Computer Science'],
      certifications: ['AWS Developer Associate', 'MongoDB Certified Professional'],
      experience: '7 Years',
      linkedin: 'https://linkedin.com/in/john-doe-dev',
      areasOfExpertise: ['Full Stack Development', 'RESTful API Design'],
      assignedProjects: [
        projects['TecMotiv ERP Core Migration']?._id,
        projects['Cloud Infrastructure Modernization']?._id,
      ],
      currentResponsibilities: 'Core backend development, API integration, and frontend components.',
      bankDetails: {
        bankName: 'Chase Bank',
        accountNumber: 'XXXX-XXXX-4589',
        routingOrIfsc: '021000021',
      },
      user: emp1._id,
    }).save();

    // 6e. Employee 2 (Jane Smith - Marketing Lead)
    const empProfile2 = await new Employee({
      employeeId: 'EMP-002',
      name: 'Jane',
      surname: 'Smith',
      gender: 'Female',
      birthDate: new Date('1994-09-30'),
      phone: '+1-555-0202',
      personalEmail: 'jane.smith.personal@gmail.com',
      email: 'employee2@tecmotiv.com',
      address: '200 Madison Ave, New York, NY',
      emergencyContact: { name: 'Robert Smith', phone: '+1-555-9202', relationship: 'Father' },
      joiningDate: new Date('2023-01-10'),
      department: departments['Marketing']?._id,
      departmentName: 'Marketing',
      designation: designations['Marketing Lead']?._id,
      designationName: 'Marketing Lead',
      reportingManager: mgtEmp._id,
      employmentType: 'Full Time',
      probationPeriod: '3 Months',
      confirmationDate: new Date('2023-04-10'),
      workLocation: locations['New York Headquarters']?._id,
      workLocationName: 'New York Headquarters',
      status: 'Active',
      skills: ['Digital Marketing', 'Growth Marketing', 'SEO/SEM', 'Brand Strategy', 'Content Ops'],
      qualifications: ['B.A. Mass Communication & Media'],
      certifications: ['Google Ads Certified', 'HubSpot Inbound Marketing'],
      experience: '5 Years',
      linkedin: 'https://linkedin.com/in/jane-smith-marketing',
      areasOfExpertise: ['Performance Marketing', 'Inbound Acquisition'],
      currentResponsibilities: 'Spearheading product marketing campaigns and corporate communications.',
      bankDetails: {
        bankName: 'Bank of America',
        accountNumber: 'XXXX-XXXX-8921',
        routingOrIfsc: '026009593',
      },
      user: emp2._id,
    }).save();

    console.log('👍 Seeded full Employee Master profiles (Management, HR, Dept Head, Employee 1, Employee 2)');

    // 7. SEED CONFIDENTIAL SALARY RECORDS
    await Salary.deleteMany({ user: { $in: [emp1._id, emp2._id] } });

    const salary1 = await new Salary({
      user: emp1._id,
      employee: empProfile1._id,
      month: 'October',
      year: 2026,
      basicSalary: 4500,
      allowances: 1000,
      deductions: 500,
      netSalary: 5000,
      status: 'paid',
      currency: 'USD',
      notes: 'October 2026 Compensation for John Doe (CONFIDENTIAL)',
    }).save();

    const salary2 = await new Salary({
      user: emp2._id,
      employee: empProfile2._id,
      month: 'October',
      year: 2026,
      basicSalary: 5200,
      allowances: 1200,
      deductions: 400,
      netSalary: 6000,
      status: 'paid',
      currency: 'USD',
      notes: 'October 2026 Compensation for Jane Smith (CONFIDENTIAL)',
    }).save();

    console.log(`👍 Seeded confidential salaries: ${salary1._id}, ${salary2._id}`);

    // 8. SEED LEAVE BALANCES & MULTI-STAGE LEAVE REQUESTS
    await Leave.deleteMany({ employee: { $in: [empProfile1._id, empProfile2._id] } });
    await LeaveBalance.deleteMany({ employee: { $in: [empProfile1._id, empProfile2._id] } });

    // Seed balances
    await new LeaveBalance({
      employee: empProfile1._id,
      user: emp1._id,
      year: 2026,
      balances: {
        'Casual Leave': { allocated: 12, used: 2, pending: 1 },
        'Sick Leave': { allocated: 10, used: 0, pending: 0 },
        'Earned/Privilege Leave': { allocated: 15, used: 0, pending: 0 },
        'Compensatory Off': { allocated: 2, used: 0, pending: 0 },
        'Half Day': { allocated: 6, used: 0, pending: 0 },
        'Work From Home': { allocated: 24, used: 2, pending: 0 },
        'Unpaid Leave': { allocated: 0, used: 0, pending: 0 },
        Other: { allocated: 5, used: 0, pending: 0 },
      },
    }).save();

    await new LeaveBalance({
      employee: empProfile2._id,
      user: emp2._id,
      year: 2026,
      balances: {
        'Casual Leave': { allocated: 12, used: 0, pending: 0 },
        'Sick Leave': { allocated: 10, used: 1, pending: 1 },
        'Earned/Privilege Leave': { allocated: 15, used: 0, pending: 0 },
        'Compensatory Off': { allocated: 2, used: 0, pending: 0 },
        'Half Day': { allocated: 6, used: 0, pending: 0 },
        'Work From Home': { allocated: 24, used: 3, pending: 0 },
        'Unpaid Leave': { allocated: 0, used: 0, pending: 0 },
        Other: { allocated: 5, used: 0, pending: 0 },
      },
    }).save();

    // 8a. John Doe - Approved Leave (Past/Synced)
    const leave1 = await new Leave({
      user: emp1._id,
      employee: empProfile1._id,
      department: 'Engineering',
      leaveType: 'Casual Leave',
      fromDate: new Date('2026-10-12'),
      toDate: new Date('2026-10-13'),
      daysCount: 2,
      reason: 'Attending family wedding ceremony',
      reportingManager: deptHeadUser?._id ? empProfile1.reportingManager : null,
      reportingManagerUser: deptHeadUser?._id,
      status: 'Approved',
      managerApproval: {
        status: 'Approved',
        approver: deptHeadUser?._id,
        approverName: 'David Head',
        remarks: 'Approved, sprint handover confirmed',
        timestamp: new Date('2026-10-01'),
      },
      hrApproval: {
        status: 'Approved',
        approver: hrUser?._id,
        approverName: 'Sarah Connor',
        remarks: 'Approved and logged in central HR roster',
        timestamp: new Date('2026-10-02'),
      },
      approvalHistory: [
        {
          step: 'MANAGER',
          approver: deptHeadUser?._id,
          approverName: 'David Head',
          status: 'Approved',
          remarks: 'Approved by Reporting Manager',
          timestamp: new Date('2026-10-01'),
        },
        {
          step: 'HR',
          approver: hrUser?._id,
          approverName: 'Sarah Connor',
          status: 'Approved',
          remarks: 'Approved by HR',
          timestamp: new Date('2026-10-02'),
        },
      ],
    }).save();

    // 8b. John Doe - Pending Manager Approval (Awaiting David Head)
    const leave2 = await new Leave({
      user: emp1._id,
      employee: empProfile1._id,
      department: 'Engineering',
      leaveType: 'Casual Leave',
      fromDate: new Date('2026-10-25'),
      toDate: new Date('2026-10-25'),
      daysCount: 1,
      reason: 'Personal administrative appointment',
      reportingManager: empProfile1.reportingManager,
      reportingManagerUser: deptHeadUser?._id,
      status: 'Pending Manager Approval',
    }).save();

    // 8c. Jane Smith - Pending HR Approval (Manager already approved, awaiting HR)
    const leave3 = await new Leave({
      user: emp2._id,
      employee: empProfile2._id,
      department: 'Marketing',
      leaveType: 'Sick Leave',
      fromDate: new Date('2026-10-20'),
      toDate: new Date('2026-10-20'),
      daysCount: 1,
      reason: 'Scheduled diagnostic checkup and rest',
      reportingManager: empProfile2.reportingManager,
      status: 'Pending HR Approval',
      managerApproval: {
        status: 'Approved',
        approverName: 'Marcus Vance',
        remarks: 'Take care, approved',
        timestamp: new Date('2026-10-05'),
      },
      approvalHistory: [
        {
          step: 'MANAGER',
          approverName: 'Marcus Vance',
          status: 'Approved',
          remarks: 'Approved by Department Head',
          timestamp: new Date('2026-10-05'),
        },
      ],
    }).save();

    console.log(`👍 Seeded leave balances and requests: ${leave1._id}, ${leave2._id}, ${leave3._id}`);

    // 9. SEED EMPLOYEE DOCUMENT VAULT RECORDS
    await Document.deleteMany({ employee: { $in: [empProfile1._id, empProfile2._id] } });

    const doc1 = await new Document({
      employee: empProfile1._id,
      employeeId: empProfile1.employeeId,
      employeeName: `${empProfile1.name} ${empProfile1.surname}`.trim(),
      documentType: 'Aadhaar',
      file: {
        fileName: 'sample-aadhaar-1001.pdf',
        originalName: 'JohnDoe_Aadhaar_Card.pdf',
        path: 'src/storage/vault/sample-aadhaar-1001.pdf',
        mimeType: 'application/pdf',
        size: 245000,
      },
      issueDate: new Date('2019-01-10'),
      verificationStatus: 'Verified',
      verifiedBy: hrUser._id,
      verifiedByName: 'Sarah Connor',
      verifiedAt: new Date('2022-02-05'),
      verificationRemarks: 'Government ID verified via portal.',
      remarks: 'Primary Identity Verification Document',
      uploadedBy: hrUser._id,
      uploadedByName: 'Sarah Connor',
      uploadedAt: new Date('2022-02-01'),
    }).save();

    const doc2 = await new Document({
      employee: empProfile1._id,
      employeeId: empProfile1.employeeId,
      employeeName: `${empProfile1.name} ${empProfile1.surname}`.trim(),
      documentType: 'Passport',
      file: {
        fileName: 'sample-passport-1001.pdf',
        originalName: 'JohnDoe_Passport_International.pdf',
        path: 'src/storage/vault/sample-passport-1001.pdf',
        mimeType: 'application/pdf',
        size: 512000,
      },
      issueDate: new Date('2018-05-15'),
      expiryDate: new Date('2028-05-14'),
      verificationStatus: 'Verified',
      verifiedBy: hrUser._id,
      verifiedByName: 'Sarah Connor',
      verifiedAt: new Date('2022-02-05'),
      verificationRemarks: 'Valid till 2028.',
      remarks: 'Required for global customer onsite travels',
      uploadedBy: hrUser._id,
      uploadedByName: 'Sarah Connor',
      uploadedAt: new Date('2022-02-01'),
    }).save();

    const doc3 = await new Document({
      employee: empProfile1._id,
      employeeId: empProfile1.employeeId,
      employeeName: `${empProfile1.name} ${empProfile1.surname}`.trim(),
      documentType: 'NDA',
      file: {
        fileName: 'sample-nda-1001.pdf',
        originalName: 'TecMotiv_Standard_NDA_Signed.pdf',
        path: 'src/storage/vault/sample-nda-1001.pdf',
        mimeType: 'application/pdf',
        size: 180000,
      },
      issueDate: new Date('2022-02-01'),
      verificationStatus: 'Verified',
      verifiedBy: hrUser._id,
      verifiedByName: 'Sarah Connor',
      verifiedAt: new Date('2022-02-02'),
      verificationRemarks: 'Executed on onboarding date.',
      remarks: 'Standard Employee Intellectual Property and Non-Disclosure Agreement',
      uploadedBy: hrUser._id,
      uploadedByName: 'Sarah Connor',
      uploadedAt: new Date('2022-02-01'),
    }).save();

    const doc4 = await new Document({
      employee: empProfile2._id,
      employeeId: empProfile2.employeeId,
      employeeName: `${empProfile2.name} ${empProfile2.surname}`.trim(),
      documentType: 'PAN',
      file: {
        fileName: 'sample-pan-1002.pdf',
        originalName: 'JaneSmith_PAN_Card.pdf',
        path: 'src/storage/vault/sample-pan-1002.pdf',
        mimeType: 'application/pdf',
        size: 320000,
      },
      issueDate: new Date('2017-08-20'),
      verificationStatus: 'Pending',
      remarks: 'Submitted for verification by HR',
      uploadedBy: hrUser._id,
      uploadedByName: 'Sarah Connor',
      uploadedAt: new Date('2023-01-12'),
    }).save();

    console.log(`👍 Seeded Document Vault records (${doc1._id}, ${doc2._id}, ${doc3._id}, ${doc4._id})`);

    // 10. SEED ATTENDANCE RECORDS (Phase 5)
    await Attendance.deleteMany({ employee: { $in: [empProfile1._id, empProfile2._id] } });

    const todayDate = new Date();
    const curYear = todayDate.getFullYear();
    const curMonth = todayDate.getMonth();
    const curDay = todayDate.getDate();

    const attendanceRecordsToSeed = [
      // Today: John Doe is currently checked in (Office)
      {
        employee: empProfile1._id,
        user: emp1._id,
        department: 'Engineering',
        date: new Date(curYear, curMonth, curDay, 0, 0, 0),
        dateString: `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(curDay).padStart(2, '0')}`,
        loginTime: new Date(curYear, curMonth, curDay, 9, 15, 0),
        clockIn: new Date(curYear, curMonth, curDay, 9, 15, 0),
        workMode: 'Office',
        status: 'Present',
        remarks: 'Working on core backend ERP services',
      },
      // Today: Jane Smith checked in and completed day (WFH)
      {
        employee: empProfile2._id,
        user: emp2._id,
        department: 'Marketing',
        date: new Date(curYear, curMonth, curDay, 0, 0, 0),
        dateString: `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(curDay).padStart(2, '0')}`,
        loginTime: new Date(curYear, curMonth, curDay, 9, 0, 0),
        logoutTime: new Date(curYear, curMonth, curDay, 17, 30, 0),
        clockIn: new Date(curYear, curMonth, curDay, 9, 0, 0),
        clockOut: new Date(curYear, curMonth, curDay, 17, 30, 0),
        totalHours: 8.5,
        workMode: 'Work From Home',
        status: 'Present',
        remarks: 'Approved remote work day for Q4 campaign launch',
      },
      // Yesterday: John Doe (Client Visit)
      {
        employee: empProfile1._id,
        user: emp1._id,
        department: 'Engineering',
        date: new Date(curYear, curMonth, Math.max(1, curDay - 1), 0, 0, 0),
        dateString: `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(Math.max(1, curDay - 1)).padStart(2, '0')}`,
        loginTime: new Date(curYear, curMonth, Math.max(1, curDay - 1), 9, 30, 0),
        logoutTime: new Date(curYear, curMonth, Math.max(1, curDay - 1), 18, 0, 0),
        totalHours: 8.5,
        workMode: 'Client Visit',
        status: 'Present',
        remarks: 'Onsite architectural review at client headquarters',
      },
      // 2 days ago: John Doe (Late Login)
      {
        employee: empProfile1._id,
        user: emp1._id,
        department: 'Engineering',
        date: new Date(curYear, curMonth, Math.max(1, curDay - 2), 0, 0, 0),
        dateString: `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(Math.max(1, curDay - 2)).padStart(2, '0')}`,
        loginTime: new Date(curYear, curMonth, Math.max(1, curDay - 2), 10, 45, 0),
        logoutTime: new Date(curYear, curMonth, Math.max(1, curDay - 2), 19, 15, 0),
        totalHours: 8.5,
        workMode: 'Office',
        status: 'Late Login',
        remarks: 'Delayed due to morning subway signal failure',
      },
      // 3 days ago: John Doe (Half Day)
      {
        employee: empProfile1._id,
        user: emp1._id,
        department: 'Engineering',
        date: new Date(curYear, curMonth, Math.max(1, curDay - 3), 0, 0, 0),
        dateString: `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(Math.max(1, curDay - 3)).padStart(2, '0')}`,
        loginTime: new Date(curYear, curMonth, Math.max(1, curDay - 3), 9, 0, 0),
        logoutTime: new Date(curYear, curMonth, Math.max(1, curDay - 3), 12, 45, 0),
        totalHours: 3.75,
        workMode: 'Office',
        status: 'Half Day',
        remarks: 'Left early for personal emergency',
      },
      // 4 days ago: John Doe (Work From Home)
      {
        employee: empProfile1._id,
        user: emp1._id,
        department: 'Engineering',
        date: new Date(curYear, curMonth, Math.max(1, curDay - 4), 0, 0, 0),
        dateString: `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(Math.max(1, curDay - 4)).padStart(2, '0')}`,
        loginTime: new Date(curYear, curMonth, Math.max(1, curDay - 4), 9, 0, 0),
        logoutTime: new Date(curYear, curMonth, Math.max(1, curDay - 4), 17, 30, 0),
        totalHours: 8.5,
        workMode: 'Work From Home',
        status: 'Present',
        remarks: 'Remote sprint planning & code reviews',
      },
      // Yesterday: Jane Smith (Event)
      {
        employee: empProfile2._id,
        user: emp2._id,
        department: 'Marketing',
        date: new Date(curYear, curMonth, Math.max(1, curDay - 1), 0, 0, 0),
        dateString: `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(Math.max(1, curDay - 1)).padStart(2, '0')}`,
        loginTime: new Date(curYear, curMonth, Math.max(1, curDay - 1), 8, 30, 0),
        logoutTime: new Date(curYear, curMonth, Math.max(1, curDay - 1), 17, 0, 0),
        totalHours: 8.5,
        workMode: 'Event',
        status: 'Present',
        remarks: 'Annual Tech Expo representation',
      },
      // 2 days ago: Jane Smith (Early Logout)
      {
        employee: empProfile2._id,
        user: emp2._id,
        department: 'Marketing',
        date: new Date(curYear, curMonth, Math.max(1, curDay - 2), 0, 0, 0),
        dateString: `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(Math.max(1, curDay - 2)).padStart(2, '0')}`,
        loginTime: new Date(curYear, curMonth, Math.max(1, curDay - 2), 9, 0, 0),
        logoutTime: new Date(curYear, curMonth, Math.max(1, curDay - 2), 15, 0, 0),
        totalHours: 6.0,
        workMode: 'Office',
        status: 'Early Logout',
        remarks: 'Doctor appointment in the afternoon',
      },
    ];

    for (const att of attendanceRecordsToSeed) {
      await new Attendance(att).save();
    }
    console.log(`👍 Seeded ${attendanceRecordsToSeed.length} attendance records across employees`);

    console.log('🎉 TecMotiv ERP Employee Master & RBAC test data seeding completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding data:', err);
    process.exit(1);
  }
}

seedRbacData();
