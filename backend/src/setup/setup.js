const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local'), override: true });
require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local', override: true });
const { globSync } = require('glob');
const fs = require('fs');
const { generate: uniqueId } = require('shortid');

const mongoose = require('mongoose');
if (process.env.DATABASE) {
  mongoose.connect(process.env.DATABASE).catch((err) => {
    console.error('Database connection error in setup:', err.message);
  });
}

async function setupApp() {
  try {
    const Admin = require('../models/coreModels/Admin');
    const AdminPassword = require('../models/coreModels/AdminPassword');

    const adminAccounts = [
      {
        email: 'admin@admin.com',
        name: 'TecMotiv',
        surname: 'Admin',
        enabled: true,
        role: 'owner',
      },
    ];

    if (process.env.EMAIL_USER && process.env.EMAIL_USER !== 'admin@admin.com') {
      adminAccounts.push({
        email: process.env.EMAIL_USER.trim().toLowerCase(),
        name: 'Harsh',
        surname: 'Kumar',
        enabled: true,
        role: 'owner',
      });
    }

    for (const account of adminAccounts) {
      let existingAdmin = await Admin.findOne({ email: account.email });
      if (!existingAdmin) {
        existingAdmin = await new Admin(account).save();
        console.log(`👍 Admin created (${account.email}) : Done!`);
      } else {
        existingAdmin.enabled = true;
        existingAdmin.removed = false;
        await existingAdmin.save();
        console.log(`ℹ️ Admin already exists (${account.email}) : Updated!`);
      }

      const salt = uniqueId();
      const newAdminPassword = new AdminPassword();
      const passwordHash = newAdminPassword.generateHash(salt, 'admin123');

      await AdminPassword.findOneAndUpdate(
        { user: existingAdmin._id },
        {
          $set: {
            password: passwordHash,
            emailVerified: true,
            salt: salt,
            user: existingAdmin._id,
            removed: false,
          },
        },
        { upsert: true, new: true }
      );
    }

    const Setting = require('../models/coreModels/Setting');
    const settingFiles = [];
    const settingsPattern = path.resolve(__dirname, 'defaultSettings/**/*.json').replace(/\\/g, '/');
    const settingsFiles = globSync(settingsPattern);

    for (const filePath of settingsFiles) {
      const file = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      settingFiles.push(...file);
    }

    const existingCount = await Setting.countDocuments();
    if (existingCount === 0) {
      await Setting.insertMany(settingFiles);
      console.log('👍 Settings created : Done!');
    } else {
      console.log('ℹ️ Settings already exist : Skipped duplicate insertion.');
    }

    console.log('🥳 Setup completed : Success!');
    process.exit(0);
  } catch (e) {
    console.log('\n🚫 Error! The Error info is below');
    console.log(e);
    process.exit(1);
  }
}

setupApp();
