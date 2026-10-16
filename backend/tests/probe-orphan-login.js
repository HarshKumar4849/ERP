// PHASE 0 PROBE — read-only audit evidence, not a permanent test.
// Creates an Admin that has NO AdminPassword row (a state that can arise from
// a partially-completed registration, an OTP flow that never finished, or a
// direct database insert), then checks whether POST /login is handled safely.
process.env.DATABASE = process.env.DATABASE || 'mongodb://127.0.0.1:27017/tecmotiv_qa_dos_probe';

const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.DATABASE);
  const Admin = mongoose.model('Admin', new mongoose.Schema({ name: String, email: String, role: String, enabled: Boolean, removed: Boolean }, { collection: 'admin' }));

  const email = 'qa-orphan-admin@example.com';
  await mongoose.connection.collection('admin').deleteMany({ email });

  await mongoose.connection.collection('admin').insertOne({
    name: 'Orphan',
    surname: 'Admin',
    email,
    role: 'ADMIN',
    enabled: true,
    removed: false,
  });

  const passwordRows = await mongoose.connection.collection('adminpassword').countDocuments({ email });
  console.log(`orphan admin created: ${email}`);
  console.log(`adminpassword rows for that email: ${passwordRows}`);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});