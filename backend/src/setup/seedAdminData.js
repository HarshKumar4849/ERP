require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function seedAdminData() {
  try {
    await mongoose.connect(process.env.DATABASE || 'mongodb://127.0.0.1:27017/tecmotiv-erp');
    console.log('✅ Connected to MongoDB');

    const Admin = require('../models/coreModels/Admin');
    const Employee = require('../models/appModels/Employee');
    const Asset = require('../models/appModels/Asset');
    const OfficeOperation = require('../models/appModels/OfficeOperation');

    const adminUser = await Admin.findOne({ role: 'ADMIN' }) || await Admin.findOne();
    const employees = await Employee.find({ removed: false }).limit(4);

    if (employees.length === 0) {
      console.log('⚠️ No employees found for asset assignment.');
      process.exit(0);
    }

    // Clear existing assets and office ops
    await Asset.deleteMany({});
    await OfficeOperation.deleteMany({});

    console.log('🖥️ Seeding Employee Assets across lifecycle (Available -> Issued -> Returned -> Maintenance)...');

    const assetsToSeed = [
      // 1. ISSUED ASSETS
      {
        name: 'Apple MacBook Pro 16" (M3 Max, 36GB, 1TB)',
        assetId: 'TM-AST-1001',
        category: 'Laptop',
        brand: 'Apple',
        model: 'MacBook Pro 16',
        serialNumber: 'C02G8792MD6R',
        cost: 249000,
        status: 'Issued',
        condition: 'Good',
        employee: employees[0]._id,
        employeeName: `${employees[0].name} ${employees[0].surname || ''}`.trim(),
        employeeCode: employees[0].employeeId || 'TM-EMP-001',
        dateIssued: new Date('2026-02-15'),
        expectedReturnDate: new Date('2027-02-15'),
        remarks: 'Issued for Principal Architecture and high-performance compilation.',
        location: 'Bangalore HQ - Floor 3',
        history: [
          {
            action: 'CREATED',
            date: new Date('2026-02-10'),
            condition: 'New',
            performedBy: adminUser._id,
            performedByName: 'Admin Operations',
            remarks: 'Procured brand new from Apple Enterprise Distributor.',
          },
          {
            action: 'ASSIGNED',
            employee: employees[0]._id,
            employeeName: `${employees[0].name} ${employees[0].surname || ''}`.trim(),
            date: new Date('2026-02-15'),
            condition: 'Good',
            performedBy: adminUser._id,
            performedByName: 'Admin Operations',
            remarks: 'Issued with laptop sleeve and 140W USB-C power brick.',
          },
        ],
      },
      {
        name: 'Dell UltraSharp 27" 4K USB-C Hub Monitor',
        assetId: 'TM-AST-1002',
        category: 'Monitor',
        brand: 'Dell',
        model: 'U2723QE',
        serialNumber: 'CN-0K752M-74261',
        cost: 48000,
        status: 'Issued',
        condition: 'Good',
        employee: employees[0]._id,
        employeeName: `${employees[0].name} ${employees[0].surname || ''}`.trim(),
        employeeCode: employees[0].employeeId || 'TM-EMP-001',
        dateIssued: new Date('2026-03-01'),
        remarks: 'Dual screen setup for senior engineer workstation.',
        location: 'Desk B-42',
        history: [
          {
            action: 'CREATED',
            date: new Date('2026-02-20'),
            condition: 'New',
            performedBy: adminUser._id,
            performedByName: 'Admin Operations',
            remarks: 'Cataloged in monitor inventory.',
          },
          {
            action: 'ASSIGNED',
            employee: employees[0]._id,
            employeeName: `${employees[0].name} ${employees[0].surname || ''}`.trim(),
            date: new Date('2026-03-01'),
            condition: 'Good',
            performedBy: adminUser._id,
            performedByName: 'Admin Operations',
            remarks: 'Deployed to workstation desk.',
          },
        ],
      },
      {
        name: 'ThinkPad X1 Carbon Gen 11 (i7, 32GB)',
        assetId: 'TM-AST-1003',
        category: 'Laptop',
        brand: 'Lenovo',
        model: 'X1 Carbon Gen 11',
        serialNumber: 'PF3N921A',
        cost: 165000,
        status: 'Issued',
        condition: 'Good',
        employee: employees[1] ? employees[1]._id : employees[0]._id,
        employeeName: employees[1] ? `${employees[1].name} ${employees[1].surname || ''}`.trim() : 'Jane Smith',
        employeeCode: employees[1]?.employeeId || 'TM-EMP-002',
        dateIssued: new Date('2026-04-10'),
        remarks: 'Standard lightweight executive laptop.',
        location: 'Bangalore HQ',
        history: [
          {
            action: 'CREATED',
            date: new Date('2026-04-01'),
            condition: 'New',
            performedBy: adminUser._id,
            performedByName: 'Admin Operations',
            remarks: 'Corporate batch procurement.',
          },
          {
            action: 'ASSIGNED',
            employee: employees[1] ? employees[1]._id : employees[0]._id,
            employeeName: employees[1] ? `${employees[1].name} ${employees[1].surname || ''}`.trim() : 'Jane Smith',
            date: new Date('2026-04-10'),
            condition: 'Good',
            performedBy: adminUser._id,
            performedByName: 'Admin Operations',
            remarks: 'Issued on joining.',
          },
        ],
      },

      // 2. AVAILABLE ASSETS (IN INVENTORY)
      {
        name: 'Apple MacBook Air 15" M2 (16GB, 512GB)',
        assetId: 'TM-AST-1004',
        category: 'Laptop',
        brand: 'Apple',
        model: 'MacBook Air 15',
        serialNumber: 'C02G9981LL7Q',
        cost: 134000,
        status: 'Available',
        condition: 'New',
        location: 'IT Storage Vault - Cabinet 2',
        remarks: 'Reserved for upcoming new joiner in Product Management.',
        history: [
          {
            action: 'CREATED',
            date: new Date('2026-09-01'),
            condition: 'New',
            performedBy: adminUser._id,
            performedByName: 'Admin Operations',
            remarks: 'Provisioned with base MDM image.',
          },
        ],
      },
      {
        name: 'Sony WH-1000XM5 Noise Canceling Headphones',
        assetId: 'TM-AST-1005',
        category: 'Equipment',
        brand: 'Sony',
        model: 'WH-1000XM5',
        serialNumber: 'SN-781920-55',
        cost: 29900,
        status: 'Available',
        condition: 'New',
        location: 'IT Accessories Locker',
        remarks: 'Available for multimedia or executive loan.',
        history: [
          {
            action: 'CREATED',
            date: new Date('2026-09-10'),
            condition: 'New',
            performedBy: adminUser._id,
            performedByName: 'Admin Operations',
            remarks: 'Standard corporate audio peripheral inventory.',
          },
        ],
      },
      {
        name: 'Herman Miller Aeron Ergonomic Task Chair',
        assetId: 'TM-AST-1006',
        category: 'Furniture',
        brand: 'Herman Miller',
        model: 'Aeron Size B',
        serialNumber: 'HM-AER-9921',
        cost: 95000,
        status: 'Available',
        condition: 'Good',
        location: 'Floor 3 Storage',
        remarks: 'Inspected and certified ready for deployment.',
        history: [
          {
            action: 'CREATED',
            date: new Date('2026-01-10'),
            condition: 'Good',
            performedBy: adminUser._id,
            performedByName: 'Admin Operations',
            remarks: 'Facility furniture audit inventory.',
          },
        ],
      },

      // 3. RETURNED ASSETS
      {
        name: 'HP EliteBook 840 G9 (i5, 16GB)',
        assetId: 'TM-AST-1007',
        category: 'Laptop',
        brand: 'HP',
        model: 'EliteBook 840',
        serialNumber: '5CG2491K11',
        cost: 89000,
        status: 'Returned',
        condition: 'Fair',
        returnDate: new Date('2026-09-28'),
        remarks: 'Returned upon project completion. Data wiped and sanitized.',
        location: 'IT Depository',
        history: [
          {
            action: 'CREATED',
            date: new Date('2025-06-10'),
            condition: 'New',
            performedBy: adminUser._id,
            performedByName: 'Admin Operations',
            remarks: 'Initial inventory.',
          },
          {
            action: 'ASSIGNED',
            employee: employees[2] ? employees[2]._id : employees[0]._id,
            employeeName: employees[2] ? `${employees[2].name} ${employees[2].surname || ''}`.trim() : 'Contractor',
            date: new Date('2025-06-15'),
            condition: 'Good',
            performedBy: adminUser._id,
            performedByName: 'Admin Operations',
            remarks: 'Issued for consulting engagement.',
          },
          {
            action: 'RETURNED',
            date: new Date('2026-09-28'),
            condition: 'Fair',
            performedBy: adminUser._id,
            performedByName: 'Admin Operations',
            remarks: 'Returned in fair condition with minor case wear. Full secure wipe completed.',
          },
        ],
      },

      // 4. IN MAINTENANCE ASSETS
      {
        name: 'Epson EcoTank L6270 Color Multi-Function Printer',
        assetId: 'TM-AST-1008',
        category: 'Equipment',
        brand: 'Epson',
        model: 'L6270',
        serialNumber: 'EP-PRNT-3341',
        cost: 26500,
        status: 'Maintenance',
        condition: 'Damaged',
        maintenanceIssue: 'Paper feeder roller jam and printhead realignment needed.',
        maintenanceVendor: 'Epson Service Hub Bangalore',
        maintenanceCost: 3500,
        maintenanceStartDate: new Date('2026-10-02'),
        location: 'Epson Authorized Center',
        remarks: 'Expected return by next Monday.',
        history: [
          {
            action: 'CREATED',
            date: new Date('2025-11-01'),
            condition: 'New',
            performedBy: adminUser._id,
            performedByName: 'Admin Operations',
            remarks: 'Department shared printer.',
          },
          {
            action: 'SENT_TO_MAINTENANCE',
            date: new Date('2026-10-02'),
            condition: 'Damaged',
            performedBy: adminUser._id,
            performedByName: 'Admin Operations',
            remarks: 'Sent for printhead maintenance & roller replacement under AMC contract.',
          },
        ],
      },
    ];

    await Asset.insertMany(assetsToSeed);
    console.log(`✅ Seeded ${assetsToSeed.length} assets.`);

    // 2. SEED OFFICE OPERATIONS ACROSS ALL 9 REQUIRED CATEGORIES
    console.log('🏢 Seeding Office Management records across all 9 required categories...');

    const officeOpsToSeed = [
      {
        title: 'Silicon Park Corporate Headquarters Lease (Floor 3 & 4)',
        category: 'Rent',
        vendor: 'Silicon Realty Infra Pvt. Ltd.',
        vendorContact: '+91 98450 11223 (leasing@siliconpark.com)',
        amount: 450000,
        frequency: 'Monthly',
        dueDate: new Date('2026-11-01'),
        status: 'Active',
        location: 'Outer Ring Road, Bangalore',
        responsiblePerson: 'VP of Operations',
        notes: 'Commercial lease for 12,000 sq.ft. Includes 40 reserved basement car parking bays.',
        createdBy: adminUser._id,
      },
      {
        title: 'Central HVAC & Air Filtration AMC Maintenance',
        category: 'Office Facilities',
        vendor: 'Carrier Aircon Solutions',
        vendorContact: 'service@carrierindia.com',
        amount: 32000,
        frequency: 'Quarterly',
        dueDate: new Date('2026-10-25'),
        status: 'Scheduled',
        location: 'All Floors',
        responsiblePerson: 'Facilities Manager',
        notes: 'Comprehensive quarterly compressor servicing and HEPA filter replacements.',
        createdBy: adminUser._id,
      },
      {
        title: 'Daily Deep Cleaning, Sanitization & Waste Management',
        category: 'Housekeeping',
        vendor: 'CleanWorks Facility Services',
        vendorContact: 'ops@cleanworks.in',
        amount: 65000,
        frequency: 'Monthly',
        dueDate: new Date('2026-10-31'),
        status: 'Active',
        location: 'Campus Wide',
        responsiblePerson: 'Housekeeping Lead',
        notes: '6 full-time housekeeping personnel covering day & evening shifts.',
        createdBy: adminUser._id,
      },
      {
        title: 'Monthly Beverage, Coffee Beans & Healthy Snack Restock',
        category: 'Pantry',
        vendor: 'Lavazza & FreshCafé Enterprises',
        vendorContact: 'orders@freshcafe.com',
        amount: 42000,
        frequency: 'Monthly',
        dueDate: new Date('2026-10-20'),
        status: 'In Progress',
        location: 'Cafeteria & 3rd Floor Breakout Pantry',
        responsiblePerson: 'Pantry Coordinator',
        notes: 'Organic Arabica coffee beans, oat milk, green tea cartons, and dry snacks.',
        createdBy: adminUser._id,
      },
      {
        title: 'Office Stationery, Whiteboards, Notebooks & Desk Kits',
        category: 'Stationery',
        vendor: 'OfficeMart Wholesale Supplies',
        vendorContact: 'sales@officemart.in',
        amount: 15500,
        frequency: 'Monthly',
        dueDate: new Date('2026-10-15'),
        status: 'Completed',
        location: 'Supply Storage',
        responsiblePerson: 'Admin Executive',
        notes: 'Welcome kits, branded TecMotiv notebooks, highlighters, post-its, and print paper.',
        createdBy: adminUser._id,
      },
      {
        title: 'Cisco Meraki High-Speed Access Points & Network Switch',
        category: 'Equipment',
        vendor: 'NetworkPro Telecommunications',
        vendorContact: 'enterprise@networkpro.com',
        amount: 185000,
        frequency: 'One-time',
        dueDate: new Date('2026-08-30'),
        status: 'Completed',
        location: 'Server Room',
        responsiblePerson: 'IT Infrastructure Lead',
        notes: 'Upgraded backbone Wi-Fi 6 APs across meeting pods and main working bays.',
        createdBy: adminUser._id,
      },
      {
        title: 'Quarterly Hardware Depreciation & Inventory Valuation Audit',
        category: 'Assets',
        vendor: 'Grant & Myers Asset Advisory',
        vendorContact: 'audits@grantmyers.in',
        amount: 50000,
        frequency: 'Quarterly',
        dueDate: new Date('2026-12-15'),
        status: 'Scheduled',
        location: 'All Office Locations',
        responsiblePerson: 'Finance & Admin Desk',
        notes: 'Physical asset tagging, barcoding, and fixed asset registry verification.',
        createdBy: adminUser._id,
      },
      {
        title: 'Enterprise Vendor Contracts & Statutory Service Agreements',
        category: 'Vendors',
        vendor: 'Multiple Empaneled Service Partners',
        vendorContact: 'vendors@tecmotiv.com',
        amount: 25000,
        frequency: 'Annual',
        dueDate: new Date('2026-12-31'),
        status: 'Active',
        location: 'Administration Vault',
        responsiblePerson: 'Head of Procurement',
        notes: 'Vendor performance scorecards, NDAs, and annual renewal compliance.',
        createdBy: adminUser._id,
      },
      {
        title: 'UPS Backup Generators & Diesel Generator Bi-Weekly Checks',
        category: 'Maintenance',
        vendor: 'PowerTech Diesel & Energy',
        vendorContact: 'emergency@powertech.in',
        amount: 28000,
        frequency: 'Monthly',
        dueDate: new Date('2026-10-18'),
        status: 'Pending',
        location: 'Basement Sub-Station',
        responsiblePerson: 'Electrical Engineer',
        notes: 'Fuel level topping, load-bank automated testing, and emergency cutover dry-run.',
        createdBy: adminUser._id,
      },
    ];

    await OfficeOperation.insertMany(officeOpsToSeed);
    console.log(`✅ Seeded ${officeOpsToSeed.length} office management records across all 9 categories.`);

    process.exit(0);
  } catch (err) {
    console.error('Seed Admin error:', err);
    process.exit(1);
  }
}

seedAdminData();
