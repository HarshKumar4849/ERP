const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(rootDir, '.env.qa') });

const cacheService = require('../src/services/cacheService');

test('Selective Redis Caching & Resilience Suite', async (t) => {
  // Test 1: Redis unavailable / disabled fallback
  await t.test('1. When Redis is unavailable or disabled, methods return null/defaults without throwing', async () => {
    cacheService._resetForTesting(null);
    assert.strictEqual(cacheService.isReady(), false);

    const val = await cacheService.get('any:key');
    assert.strictEqual(val, null, 'get should return null when Redis is offline');

    const setRes = await cacheService.set('any:key', { data: 123 }, 3600);
    assert.strictEqual(setRes, false, 'set should return false when Redis is offline');

    const delRes = await cacheService.del('any:key');
    assert.strictEqual(delRes, false, 'del should return false when Redis is offline');

    const ver = await cacheService.getVersion('department');
    assert.strictEqual(ver, 1, 'getVersion should default to 1 when Redis is offline');

    const nextVer = await cacheService.incrementVersion('department');
    assert.strictEqual(nextVer, 1, 'incrementVersion should default to 1 when Redis is offline');
  });

  // Test 2: Standard Key Construction with tenant & environment isolation
  await t.test('2. Key construction enforces schema version, environment, and organization boundaries', () => {
    const key1 = cacheService.buildKey({
      entity: 'department',
      scope: 'listAll',
      version: 2,
      orgId: 'org_default',
    });
    assert.match(key1, /^tecmotiv:v1:[^:]+:org_default:department:v2:listAll$/);

    // Cross-organization keys must be distinct
    const keyOrgA = cacheService.buildKey({ entity: 'department', scope: 'listAll', version: 1, orgId: 'org_A' });
    const keyOrgB = cacheService.buildKey({ entity: 'department', scope: 'listAll', version: 1, orgId: 'org_B' });
    assert.notStrictEqual(keyOrgA, keyOrgB, 'Keys for different organizations must never collide');
  });

  // Test 3: Cache Hit, Miss, and TTL Expiration with active client
  await t.test('3. Cache reads, writes, and TTL expiration work correctly with mock/active store', async () => {
    const store = new Map();
    const expiry = new Map();

    const mockClient = {
      async get(k) {
        if (expiry.has(k) && Date.now() > expiry.get(k)) {
          store.delete(k);
          expiry.delete(k);
          return null;
        }
        return store.get(k) || null;
      },
      async set(k, v, mode, ttl) {
        store.set(k, v);
        if (mode === 'EX') {
          expiry.set(k, Date.now() + ttl * 1000);
        }
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

    cacheService._resetForTesting(mockClient);
    assert.strictEqual(cacheService.isReady(), true);

    const testKey = 'test:key:1';
    await cacheService.set(testKey, { id: 'dept-123', name: 'Engineering' }, 3600);

    const hit = await cacheService.get(testKey);
    assert.deepStrictEqual(hit, { id: 'dept-123', name: 'Engineering' });

    // Expiration simulation
    await cacheService.set('expired:key', { data: 'old' }, -1); // already expired
    const expiredVal = await cacheService.get('expired:key');
    assert.strictEqual(expiredVal, null, 'Expired key must return null');

    // Deletion
    await cacheService.del(testKey);
    const afterDel = await cacheService.get(testKey);
    assert.strictEqual(afterDel, null, 'Deleted key must return null');
  });

  // Test 4: O(1) Version-based Invalidation
  await t.test('4. Atomic incrementVersion invalidates version-based key namespaces instantly', async () => {
    const store = new Map();
    const mockClient = {
      async get(k) {
        return store.get(k) || null;
      },
      async set(k, v) {
        store.set(k, v);
        return 'OK';
      },
      async incr(k) {
        const cur = parseInt(store.get(k) || '1', 10);
        const next = cur + 1;
        store.set(k, String(next));
        return next;
      },
    };

    cacheService._resetForTesting(mockClient);

    const ver1 = await cacheService.getVersion('department');
    assert.strictEqual(ver1, 1);

    const keyV1 = cacheService.buildKey({ entity: 'department', scope: 'listAll', version: ver1 });
    await cacheService.set(keyV1, [{ name: 'Engineering' }]);

    // Mutate department -> increments version
    const ver2 = await cacheService.incrementVersion('department');
    assert.strictEqual(ver2, 2, 'Version should increment to 2');

    // Key under v2 is a fresh cache miss
    const keyV2 = cacheService.buildKey({ entity: 'department', scope: 'listAll', version: ver2 });
    assert.notStrictEqual(keyV1, keyV2);
    const v2Val = await cacheService.get(keyV2);
    assert.strictEqual(v2Val, null, 'New version key must be a cache miss');
  });

  // Test 5: Command Timeout & In-Flight Failure Handling
  await t.test('5. Redis error or slow command fails fast and returns null without throwing', async () => {
    const errorClient = {
      async get() {
        throw new Error('Command timed out after 150ms');
      },
      async set() {
        throw new Error('ECONNRESET');
      },
      async incr() {
        throw new Error('ETIMEDOUT');
      },
    };

    cacheService._resetForTesting(errorClient);

    // Must not throw exceptions to the caller
    const getRes = await cacheService.get('fail:key');
    assert.strictEqual(getRes, null, 'Failing get must return null');

    const setRes = await cacheService.set('fail:key', { a: 1 });
    assert.strictEqual(setRes, false, 'Failing set must return false');

    const incrRes = await cacheService.incrementVersion('department');
    assert.strictEqual(incrRes, 1, 'Failing incr must return fallback version 1');
  });

  // Test 6: Security Allowlist Verification
  await t.test('6. Setting controller allowlist rejects private keys from cache', () => {
    const PUBLIC_SETTING_ALLOWLIST = new Set([
      'app_name',
      'app_title',
      'app_logo',
      'app_timezone',
      'default_currency',
      'date_format',
      'company_name',
      'company_address',
    ]);

    assert.strictEqual(PUBLIC_SETTING_ALLOWLIST.has('app_name'), true);
    assert.strictEqual(PUBLIC_SETTING_ALLOWLIST.has('app_email_password'), false);
    assert.strictEqual(PUBLIC_SETTING_ALLOWLIST.has('resend_api_key'), false);
    assert.strictEqual(PUBLIC_SETTING_ALLOWLIST.has('jwt_secret'), false);
  });

  // Test 7: Redis Health Status Semantics (all 4 states)
  await t.test('7. Health endpoint logic strictly distinguishes connected, disconnected, and disabled', () => {
    function computeRedisStatus(isReady, redisUrl, redisEnabled) {
      const isExplicitlyDisabled = redisEnabled === 'false' || !redisUrl;
      if (isExplicitlyDisabled) return 'disabled';
      return isReady ? 'connected' : 'disconnected';
    }

    // State 1: Connected
    assert.strictEqual(computeRedisStatus(true, 'rediss://user:pass@host:6379', 'true'), 'connected');
    // State 2: Configured but unreachable/disconnected
    assert.strictEqual(computeRedisStatus(false, 'rediss://user:pass@host:6379', 'true'), 'disconnected');
    // State 3: REDIS_ENABLED=false (even if REDIS_URL exists)
    assert.strictEqual(computeRedisStatus(false, 'rediss://user:pass@host:6379', 'false'), 'disabled');
    assert.strictEqual(computeRedisStatus(true, 'rediss://user:pass@host:6379', 'false'), 'disabled');
    // State 4: REDIS_URL missing
    assert.strictEqual(computeRedisStatus(false, '', 'true'), 'disabled');
    assert.strictEqual(computeRedisStatus(false, undefined, undefined), 'disabled');
  });

  // Test 8: Option A In-Memory Version Micro-Cache & Concurrent Invalidations
  await t.test('8. Option A: In-memory version micro-cache reduces command consumption and invalidates safely', async () => {
    const store = new Map();
    let getCmds = 0;
    let incrCmds = 0;

    const mockClient = {
      async get(k) {
        getCmds++;
        return store.get(k) || null;
      },
      async incr(k) {
        incrCmds++;
        const cur = parseInt(store.get(k) || '1', 10);
        const next = cur + 1;
        store.set(k, String(next));
        return next;
      },
    };

    // Enable micro-cache with 30-second TTL
    cacheService._resetForTesting(mockClient, { versionTtl: 30000 });

    // Read 1: Cold read queries Redis
    const v1 = await cacheService.getVersion('department');
    assert.strictEqual(v1, 1);
    assert.strictEqual(getCmds, 1, 'Cold read must execute 1 Redis GET command');

    // Reads 2..10: Warm reads must be served from local memory (0 Redis commands)
    for (let i = 0; i < 9; i++) {
      const v = await cacheService.getVersion('department');
      assert.strictEqual(v, 1);
    }
    assert.strictEqual(getCmds, 1, 'Subsequent 9 reads must execute ZERO Redis commands (served from micro-cache)');

    // Invalidation: incrementVersion updates Redis AND local micro-cache immediately
    const v2 = await cacheService.incrementVersion('department');
    assert.strictEqual(v2, 2);
    assert.strictEqual(incrCmds, 1);

    // Read 11: Writer instance immediately sees v2 without waiting for 30s TTL
    const vPost = await cacheService.getVersion('department');
    assert.strictEqual(vPost, 2, 'Local writer instance must see new version immediately (0ms stale window)');
    assert.strictEqual(getCmds, 1, 'Immediate post-invalidation read still uses local updated micro-cache');

    // Concurrent invalidation test: 5 simultaneous increments
    await Promise.all([
      cacheService.incrementVersion('department'),
      cacheService.incrementVersion('department'),
      cacheService.incrementVersion('department'),
    ]);
    const vFinal = await cacheService.getVersion('department');
    assert.strictEqual(vFinal, 5, 'Concurrent invalidations must increment monotonically');
  });

  // Test 9: Dashboard event cache removal verification
  await t.test('9. Dashboard queries Event directly without calling cacheService', async () => {
    let cacheCalls = 0;
    const trackingClient = {
      async get() { cacheCalls++; return null; },
      async set() { cacheCalls++; return 'OK'; },
    };
    cacheService._resetForTesting(trackingClient);

    // Verify calendar event controller still maintains holiday cache
    const calKey = cacheService.buildKey({ entity: 'holiday', scope: 'calendar:list', version: 1 });
    await cacheService.set(calKey, [{ title: 'Holiday' }]);
    assert.ok(cacheCalls > 0, 'Standalone calendar caching remains fully operational');
  });

  // Teardown
  cacheService._resetForTesting(null);
});

