const mongoose = require('mongoose');
const qa = require('./qa-env');

(async () => {
  await mongoose.connect(qa.DATABASE);
  const cols = await mongoose.connection.db.collections();
  let lingering = 0;
  for (const c of cols) {
    const count = await c.countDocuments({
      $or: [
        { email: { $regex: /qa-/i } },
        { employeeId: { $regex: /qa-/i } },
      ],
    });
    if (count > 0) {
      console.log(`Lingering in ${c.collectionName}: ${count}`);
      lingering += count;
    }
  }
  console.log(`Total lingering audit fixtures: ${lingering}`);
  await mongoose.disconnect();
  process.exit(lingering === 0 ? 0 : 1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
