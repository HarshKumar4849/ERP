require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });
const { globSync } = require('glob');
const fs = require('fs');
const mongoose = require('mongoose');

async function upgrade() {
  const dbUri = process.env.DATABASE;
  if (!dbUri) {
    console.error('❌ Error: DATABASE environment variable is not defined.');
    process.exit(1);
  }

  try {
    await mongoose.connect(dbUri);
    console.log('Connected to database for upgrade check.');

    const Setting = require('../models/coreModels/Setting');
    const settingsFiles = globSync('./src/setup/defaultSettings/**/*.json');
    let addedCount = 0;
    let existingCount = 0;

    for (const filePath of settingsFiles) {
      const fileData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      for (const setting of fileData) {
        const exists = await Setting.findOne({ settingKey: setting.settingKey });
        if (!exists) {
          await new Setting(setting).save();
          addedCount++;
        } else {
          existingCount++;
        }
      }
    }

    console.log(`👍 Upgrade check complete: ${addedCount} settings added, ${existingCount} already present.`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Upgrade failed:', error);
    process.exit(1);
  }
}

upgrade();
