const mongoose = require('mongoose');

/**
 * Ensures MongoDB indexes for Employee and Admin models are correctly configured.
 * Specifically converts legacy whole-collection unique indexes on `email` to
 * partial unique indexes ({ unique: true, partialFilterExpression: { removed: false } }).
 *
 * This allows soft-deleted accounts (removed: true) to release the email address
 * so that re-registration with the same email succeeds without duplicate key errors,
 * while strictly guaranteeing uniqueness among all active accounts (removed: false).
 */
const ensureIndexes = async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return;
    }

    const empColl = mongoose.connection.collection('employees');
    const adminColl = mongoose.connection.collection('admins');

    // 1. Employee email index check & migration
    try {
      const empIndexes = await empColl.indexes();
      const existingEmailIndex = empIndexes.find((idx) => idx.name === 'email_1');

      if (existingEmailIndex && !existingEmailIndex.partialFilterExpression) {
        console.log('🔄 Migrating legacy non-partial email_1 index on employees collection...');
        await empColl.dropIndex('email_1');
        await empColl.createIndex(
          { email: 1 },
          { unique: true, partialFilterExpression: { removed: false }, name: 'email_1' }
        );
        console.log('✅ Migrated employees email_1 index to partial unique index.');
      } else if (!existingEmailIndex) {
        await empColl.createIndex(
          { email: 1 },
          { unique: true, partialFilterExpression: { removed: false }, name: 'email_1' }
        );
      }
    } catch (empIdxErr) {
      console.warn('⚠️ Notice during employee index synchronization:', empIdxErr.message);
    }

    // 2. Admin email index check & migration
    try {
      const adminIndexes = await adminColl.indexes();
      const existingAdminEmailIndex = adminIndexes.find((idx) => idx.name === 'email_1');

      if (existingAdminEmailIndex && !existingAdminEmailIndex.partialFilterExpression) {
        console.log('🔄 Migrating legacy non-partial email_1 index on admins collection...');
        await adminColl.dropIndex('email_1');
        await adminColl.createIndex(
          { email: 1 },
          { unique: true, partialFilterExpression: { removed: false }, name: 'email_1' }
        );
        console.log('✅ Migrated admins email_1 index to partial unique index.');
      } else if (!existingAdminEmailIndex) {
        await adminColl.createIndex(
          { email: 1 },
          { unique: true, partialFilterExpression: { removed: false }, name: 'email_1' }
        );
      }
    } catch (adminIdxErr) {
      console.warn('⚠️ Notice during admin index synchronization:', adminIdxErr.message);
    }
  } catch (err) {
    console.warn('⚠️ ensureIndexes encountered an issue:', err.message);
  }
};

module.exports = ensureIndexes;
