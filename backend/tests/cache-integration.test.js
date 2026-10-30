const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(rootDir, '.env.qa') });

const { connectDb, disconnectDb } = require('../src/database');
const cacheService = require('../src/services/cacheService');
const qa = require('./qa-env');
const { seedFixtures, cleanupFixtures, emailFor } = require('./fixtures');

test('Selective Cache HTTP Integration Suite', async (t) => {
  let app;
  let server;
  let port;
  let baseUrl;
  let fixtures;
  let adminToken;
  let DepartmentModel;

  // In-memory mock redis store
  const store = new Map();
  const mockRedisClient = {
    async get(k) {
      return store.get(k) || null;
    },
    async set(k, v) {
      store.set(k, v);
      return 'OK';
    },
    async del(k) {
      return store.delete(k) ? 1 : 0;
    },
    async incr(k) {
      const cur = parseInt(store.get(k) || '1', 10);
      const next = cur + 1;
      store.set(k, String(next));
      return next;
    },
    async quit() {
      return 'OK';
    },
  };

  t.before(async () => {
    fixtures = await seedFixtures();
    await connectDb();

    DepartmentModel = require('../src/models/appModels/Department');
    await DepartmentModel.deleteMany({ name: 'QA Cache Dept' });
    await DepartmentModel.create({ name: 'QA Cache Dept', code: 'QACD', enabled: true, removed: false });

    app = require('../src/app');
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}/api`;

    // Obtain Admin token
    const loginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailFor('admin'), password: qa.PASSWORD }),
    });
    const loginData = await loginRes.json();
    adminToken = loginData.result?.token;
    assert.ok(adminToken, 'Admin token must be obtained');
  });

  t.after(async () => {
    cacheService._resetForTesting(null);
    if (DepartmentModel) {
      await DepartmentModel.deleteMany({ name: 'QA Cache Dept' });
    }
    if (server) await new Promise((resolve) => server.close(resolve));
    if (fixtures) await cleanupFixtures(fixtures);
    await disconnectDb(true);
  });

  t.beforeEach(() => {
    store.clear();
    cacheService._resetForTesting(mockRedisClient);
  });

  const authHeaders = () => ({
    Authorization: `Bearer ${adminToken}`,
  });

  // Test A: Health endpoint reflects Redis status informatively
  await t.test('A. /api/health reports Redis status without failing when healthy', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'healthy');
    assert.strictEqual(body.redis, 'connected');
  });

  // Test B: Department listAll caching flow (MISS -> HIT -> Invalidation)
  await t.test('B. Department listAll caches response and invalidates on version increment', async () => {
    // 1. Initial read should be MISS
    const res1 = await fetch(`${baseUrl}/department/listAll`, { headers: authHeaders() });
    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res1.headers.get('x-cache'), 'MISS', 'First read should be cache MISS');
    const body1 = await res1.json();
    assert.strictEqual(body1.success, true);
    assert.ok(body1.result.length > 0, 'Should return seeded departments');

    // 2. Second read should be HIT
    const res2 = await fetch(`${baseUrl}/department/listAll`, { headers: authHeaders() });
    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.headers.get('x-cache'), 'HIT', 'Second read should be cache HIT');
    const body2 = await res2.json();
    assert.deepStrictEqual(body2.result, body1.result, 'Cached result must match MongoDB result');

    // 3. Mutate department (incrementVersion)
    await cacheService.incrementVersion('department');

    // 4. Third read must be fresh MISS under new version
    const res3 = await fetch(`${baseUrl}/department/listAll`, { headers: authHeaders() });
    assert.strictEqual(res3.status, 200);
    assert.strictEqual(res3.headers.get('x-cache'), 'MISS', 'Read after version increment should be cache MISS');
  });

  // Test C: Setting controller public allowlist vs private exclusion
  await t.test('C. Public settings are cached, private/unlisted settings bypass cache', async () => {
    // Public setting in allowlist
    const resPublic1 = await fetch(`${baseUrl}/setting/readBySettingKey/app_name`, { headers: authHeaders() });
    if (resPublic1.status === 200) {
      assert.strictEqual(resPublic1.headers.get('x-cache'), 'MISS');

      const resPublic2 = await fetch(`${baseUrl}/setting/readBySettingKey/app_name`, { headers: authHeaders() });
      assert.strictEqual(resPublic2.status, 200);
      assert.strictEqual(resPublic2.headers.get('x-cache'), 'HIT');
    }

    // Unlisted / sensitive key
    const resPrivate = await fetch(`${baseUrl}/setting/readBySettingKey/app_email_password`, { headers: authHeaders() });
    assert.strictEqual(resPrivate.headers.get('x-cache'), null, 'Sensitive keys must never set X-Cache or touch Redis');
  });

  // Test D: Mid-request Redis disconnection falls back to MongoDB seamlessly
  await t.test('D. When Redis disconnects mid-flight, endpoint succeeds via MongoDB fallback', async () => {
    cacheService._resetForTesting(null); // Redis drops

    const res = await fetch(`${baseUrl}/department/listAll`, { headers: authHeaders() });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(res.headers.get('x-cache'), null, 'Fallback to MongoDB should not have X-Cache header');
  });
});
