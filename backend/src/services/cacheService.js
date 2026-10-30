/**
 * Centralized, Non-Blocking, Fail-Safe Redis Cache Service
 * TecMotiv ERP - Phase 2B Selective Caching
 *
 * Guarantees:
 * 1. Redis is strictly optional. If unavailable, falls back to MongoDB with zero user-facing errors.
 * 2. Fail-fast bounded command timeout (150ms) to ensure HTTP threads are never blocked.
 * 3. O(1) Version-based invalidation (zero expensive KEYS or SCAN commands).
 * 4. Zero credentials exposed in logs.
 */

let Redis;
try {
  Redis = require('ioredis');
} catch (e) {
  // If ioredis is somehow missing, continue with Redis disabled
}

const REDIS_URL = process.env.REDIS_URL || '';
const REDIS_ENABLED = process.env.REDIS_ENABLED === 'false' ? false : Boolean(REDIS_URL);
const REDIS_KEY_PREFIX = process.env.REDIS_KEY_PREFIX || 'tecmotiv';
const ENVIRONMENT = process.env.NODE_ENV || 'development';
const SCHEMA_VERSION = 'v1';

let client = null;
let isConnected = false;
let connectionAttempted = false;
let overrideEnabled = null;

// Sanitizes Redis URL for secure logging (masks username:password)
function sanitizeUrl(url) {
  if (!url) return '';
  return url.replace(/:\/\/([^@]+)@/, '://***:***@');
}

/**
 * Initializes Redis client singleton with fail-fast options
 */
function initClient() {
  if (!REDIS_ENABLED || !Redis || !REDIS_URL) {
    return null;
  }
  if (client) {
    return client;
  }

  const isTls = REDIS_URL.startsWith('rediss://');

  const options = {
    lazyConnect: true,
    connectTimeout: 2000,
    commandTimeout: 150,
    maxRetriesPerRequest: 0,
    enableOfflineQueue: false,
    retryStrategy: (times) => {
      // Exponential backoff capped at 5 seconds
      return Math.min(times * 200, 5000);
    },
  };

  if (isTls) {
    options.tls = {};
  }

  try {
    client = new Redis(REDIS_URL, options);

    client.on('connect', () => {
      isConnected = true;
      console.log(`[CacheService] Connected to Redis (${sanitizeUrl(REDIS_URL)})`);
    });

    client.on('ready', () => {
      isConnected = true;
    });

    client.on('error', (err) => {
      isConnected = false;
      // Log concise error without stack trace or credentials
      console.warn(`[CacheService] Redis notice: ${err.message || 'connection issue'}`);
    });

    client.on('close', () => {
      isConnected = false;
    });

    client.on('end', () => {
      isConnected = false;
    });

    // Initiate non-blocking connection
    if (!connectionAttempted) {
      connectionAttempted = true;
      client.connect().catch((err) => {
        isConnected = false;
        console.warn(`[CacheService] Initial Redis connection bypassed: ${err.message}. Using direct database.`);
      });
    }

    return client;
  } catch (initErr) {
    console.warn(`[CacheService] Failed to initialize Redis client: ${initErr.message}`);
    client = null;
    isConnected = false;
    return null;
  }
}

// Lazy initialization
initClient();

/**
 * Checks whether Redis is ready and available
 */
function isReady() {
  const enabled = overrideEnabled !== null ? overrideEnabled : REDIS_ENABLED;
  return enabled && Boolean(client) && isConnected;
}

/**
 * Constructs a standardized, tenant- and environment-isolated cache key
 *
 * Format: tecmotiv:<schemaVersion>:<environment>:<orgId>:<entity>:<scope>
 */
function buildKey({ entity, scope, version = null, orgId = 'org_default' }) {
  const versionSegment = version !== null ? `:v${version}` : '';
  return `${REDIS_KEY_PREFIX}:${SCHEMA_VERSION}:${ENVIRONMENT}:${orgId}:${entity}${versionSegment}:${scope}`;
}

/**
 * Returns current version counter for an entity (defaults to 1)
 *
 * Key format: tecmotiv:<schemaVersion>:<environment>:<orgId>:<entity>:version
 */
async function getVersion(entity, orgId = 'org_default') {
  if (!isReady()) return 1;
  const versionKey = `${REDIS_KEY_PREFIX}:${SCHEMA_VERSION}:${ENVIRONMENT}:${orgId}:${entity}:version`;
  try {
    const val = await client.get(versionKey);
    const parsed = parseInt(val, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  } catch (err) {
    return 1;
  }
}

/**
 * Atomically increments the version counter for an entity (O(1) Invalidation)
 * Instantly invalidates all versioned collection caches for this entity.
 */
async function incrementVersion(entity, orgId = 'org_default') {
  if (!isReady()) return 1;
  const versionKey = `${REDIS_KEY_PREFIX}:${SCHEMA_VERSION}:${ENVIRONMENT}:${orgId}:${entity}:version`;
  try {
    const nextVer = await client.incr(versionKey);
    return nextVer;
  } catch (err) {
    console.warn(`[CacheService] Error incrementing version for ${entity}:`, err.message);
    return 1;
  }
}

/**
 * Retrieves a cached JSON object
 * Returns null on cache miss, timeout, or Redis error.
 */
async function get(key) {
  if (!isReady()) return null;
  try {
    const data = await client.get(key);
    if (!data) return null;
    return JSON.parse(data);
  } catch (err) {
    // Fail silently to MongoDB
    return null;
  }
}

/**
 * Stores a value in Redis with a TTL in seconds
 * Fails silently without throwing if Redis errors.
 */
async function set(key, value, ttlSeconds = 3600) {
  if (!isReady() || value === undefined || value === null) return false;
  try {
    const serialized = JSON.stringify(value);
    await client.set(key, serialized, 'EX', ttlSeconds);
    return true;
  } catch (err) {
    console.warn(`[CacheService] Set notice for ${key}:`, err.message);
    return false;
  }
}

/**
 * Deletes an explicit cache key (O(1))
 */
async function del(key) {
  if (!isReady()) return false;
  try {
    await client.del(key);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Cleanly disconnects the Redis client (used during graceful shutdown)
 */
async function disconnect() {
  if (client) {
    try {
      console.log('[CacheService] Disconnecting Redis client...');
      await client.quit();
    } catch (err) {
      try {
        client.disconnect();
      } catch (e) {}
    } finally {
      client = null;
      isConnected = false;
      connectionAttempted = false;
    }
  }
}

/**
 * Resets client instance (primarily for automated test harnesses)
 */
function _resetForTesting(mockClient = null) {
  if (mockClient) {
    client = mockClient;
    isConnected = true;
    overrideEnabled = true;
  } else {
    client = null;
    isConnected = false;
    connectionAttempted = false;
    overrideEnabled = null;
  }
}

module.exports = {
  isReady,
  buildKey,
  getVersion,
  incrementVersion,
  get,
  set,
  del,
  disconnect,
  _resetForTesting,
};
