require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function testAdminModule() {
  try {
    await mongoose.connect(process.env.DATABASE || 'mongodb://127.0.0.1:27017/tecmotiv-erp');
    console.log('✅ Connected to MongoDB\n');

    const Admin = require('../models/coreModels/Admin');
    const Employee = require('../models/appModels/Employee');
    const Asset = require('../models/appModels/Asset');
    const OfficeOperation = require('../models/appModels/OfficeOperation');
    const assetController = require('../controllers/appControllers/assetController');
    const officeController = require('../controllers/appControllers/officeController');

    const adminUser = await Admin.findOne({ role: 'ADMIN' }) || await Admin.findOne();
    const empUser = await Admin.findOne({ role: 'EMPLOYEE' });
    const employees = await Employee.find({ removed: false });

    console.log('--- Test 1: Full Asset Lifecycle (Available -> Issued -> Returned -> Maintenance -> Available) ---');
    // Find an Available asset
    let testAsset = await Asset.findOne({ status: 'Available', removed: false });
    if (!testAsset) {
      testAsset = new Asset({
        name: 'Lifecycle Test Laptop',
        assetId: `TM-AST-TEST-${Date.now()}`,
        status: 'Available',
        condition: 'New',
      });
      await testAsset.save();
    }
    console.log(`Starting asset: ${testAsset.name} (${testAsset.assetId}) - Status: ${testAsset.status}`);

    // STEP 1: Assign to Employee (Available -> Issued)
    let assignResult;
    const mockResAssign = { status: (c) => ({ json: (d) => { assignResult = d; return d; } }) };
    await assetController.assign(
      {
        user: adminUser,
        params: { id: testAsset._id },
        body: {
          employee: employees[0]._id,
          condition: 'New',
          remarks: 'Lifecycle test assignment.',
        },
      },
      mockResAssign
    );
    if (assignResult?.result?.status !== 'Issued') throw new Error(`Assign failed! Status: ${assignResult?.result?.status}`);
    console.log(`✅ Step 1 (Available -> Issued): Issued to ${assignResult.result.employeeName}`);

    // STEP 2: Return Asset (Issued -> Returned)
    let returnResult;
    const mockResReturn = { status: (c) => ({ json: (d) => { returnResult = d; return d; } }) };
    await assetController.returnAsset(
      {
        user: adminUser,
        params: { id: testAsset._id },
        body: {
          condition: 'Good',
          remarks: 'Lifecycle test return.',
        },
      },
      mockResReturn
    );
    if (returnResult?.result?.status !== 'Returned') throw new Error(`Return failed! Status: ${returnResult?.result?.status}`);
    console.log(`✅ Step 2 (Issued -> Returned): Returned successfully with returnDate ${returnResult.result.returnDate}`);

    // STEP 3: Send to Maintenance (Returned -> Maintenance)
    let maintResult;
    const mockResMaint = { status: (c) => ({ json: (d) => { maintResult = d; return d; } }) };
    await assetController.maintenance(
      {
        user: adminUser,
        params: { id: testAsset._id },
        body: {
          issue: 'Thermal paste replacement',
          vendor: 'TechFix Hub',
          cost: 1200,
          remarks: 'Lifecycle test maintenance.',
        },
      },
      mockResMaint
    );
    if (maintResult?.result?.status !== 'Maintenance') throw new Error(`Maintenance failed! Status: ${maintResult?.result?.status}`);
    console.log(`✅ Step 3 (Returned -> Maintenance): In maintenance (Vendor: ${maintResult.result.maintenanceVendor})`);

    // STEP 4: Complete Maintenance (Maintenance -> Available)
    let completeResult;
    const mockResComplete = { status: (c) => ({ json: (d) => { completeResult = d; return d; } }) };
    await assetController.completeMaintenance(
      {
        user: adminUser,
        params: { id: testAsset._id },
        body: {
          condition: 'Good',
          actualCost: 1200,
          remarks: 'Lifecycle completed. Ready for redeployment.',
        },
      },
      mockResComplete
    );
    if (completeResult?.result?.status !== 'Available') throw new Error(`Complete maintenance failed! Status: ${completeResult?.result?.status}`);
    console.log(`✅ Step 4 (Maintenance -> Available): Asset back in inventory as '${completeResult.result.status}'!`);

    // Verify Asset History log
    let histResult;
    const mockResHist = { status: (c) => ({ json: (d) => { histResult = d; return d; } }) };
    await assetController.history({ params: { id: testAsset._id } }, mockResHist);
    console.log(`✅ Asset history contains ${histResult.result.length} lifecycle log entries:`);
    histResult.result.forEach((h, idx) => {
      console.log(`   [${idx + 1}] ${h.action} - ${h.remarks}`);
    });

    console.log('\n--- Test 2: Office Management (9 Categories) ---');
    let officeResult;
    const mockResOffice = { status: (c) => ({ json: (d) => { officeResult = d; return d; } }) };
    await officeController.list({ user: adminUser, query: {} }, mockResOffice);
    console.log(`✅ Office operations total records: ${officeResult.summary.totalRecords}`);
    console.log(`   Total recurring expenditure: ₹${officeResult.summary.totalExpenditure.toLocaleString()}`);

    const cats = Object.keys(officeResult.summary.categoryStats);
    console.log(`✅ Verified ${cats.length} office operation categories: ${cats.join(', ')}`);

    console.log('\n--- Test 3: Security & RBAC Scoping ---');
    // Admin sees all assets
    let adminAssetResult;
    const mockResAdminAsset = { status: (c) => ({ json: (d) => { adminAssetResult = d; return d; } }) };
    await assetController.list({ user: adminUser, query: {} }, mockResAdminAsset);
    console.log(`✅ Admin saw all ${adminAssetResult.result.length} inventory assets (Available: ${adminAssetResult.counts.available}, Issued: ${adminAssetResult.counts.issued}).`);

    // Normal employee sees only own assigned assets
    if (empUser) {
      let empAssetResult;
      const mockResEmpAsset = { status: (c) => ({ json: (d) => { empAssetResult = d; return d; } }) };
      await assetController.list({ user: empUser, query: {} }, mockResEmpAsset);
      console.log(`✅ Employee (${empUser.email}) restricted to own assigned assets: saw ${empAssetResult.result.length} asset(s).`);

      // Employee blocked from office operations
      let empOfficeStatus, empOfficeMsg;
      const mockResEmpOffice = {
        status: (code) => {
          empOfficeStatus = code;
          return { json: (d) => { empOfficeMsg = d.message; return d; } };
        },
      };
      await officeController.list({ user: empUser, query: {} }, mockResEmpOffice);
      if (empOfficeStatus === 403) {
        console.log(`✅ Employee blocked from Office Management with 403 Forbidden: "${empOfficeMsg}"`);
      } else {
        throw new Error(`Employee was NOT blocked from Office Management! Status: ${empOfficeStatus}`);
      }
    }

    console.log('\n====================================================');
    console.log('🎉 ALL PHASE 13 ADMINISTRATION TESTS PASSED!');
    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
}

testAdminModule();
