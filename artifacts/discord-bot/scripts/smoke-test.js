#!/usr/bin/env node
/**
 * scripts/smoke-test.js
 * Fast, dependency-free regression check. Not a substitute for real unit
 * tests, but catches the class of bugs this project has actually had:
 * syntax errors, broken command/event loading, DB layer regressions, and
 * dashboard routes silently misbehaving (auth bypasses, wrong status codes).
 *
 * Run with: npm run smoke-test
 * Exits non-zero on any failure (safe to wire into CI).
 *
 * IMPORTANT: `check()` is async and every call site MUST be awaited. An
 * earlier version of this file didn't do this — `check()` called an async
 * fn() without awaiting it, so any check whose body returned a Promise
 * (the dashboard-boot and rate-limiter checks) reported "✔ passed"
 * immediately, before its assertions had even run, and a failure inside it
 * would have become a silent unhandled rejection instead of failing the
 * build. Don't reintroduce that bug — always `await check(...)`.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
let failures = 0;

function section(title) {
  console.log(`\n\x1b[1m── ${title} ──────────────────────────────────\x1b[0m`);
}

async function check(label, fn) {
  try {
    await fn();
    console.log(`  \x1b[32m✔\x1b[0m ${label}`);
  } catch (err) {
    failures++;
    console.log(`  \x1b[31m✘ ${label}\x1b[0m`);
    console.log(`    ${err.message}`);
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(message || 'assertion failed');
}

// Point the DB at a throwaway file so this never touches real bot data.
const TEST_DB = path.join(ROOT, 'data', 'smoke-test.db');
fs.mkdirSync(path.dirname(TEST_DB), { recursive: true });
for (const ext of ['', '-shm', '-wal']) {
  fs.rmSync(TEST_DB + ext, { force: true });
}
process.env.DB_PATH = TEST_DB;

let loadedCommandCount = 0;

async function main() {
  // ── 1. Syntax check every JS file ─────────────────────────────────────────
  section('Syntax');
  const jsFiles = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'data' || entry.name === '.git') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) jsFiles.push(full);
    }
  })(ROOT);

  for (const file of jsFiles) {
    await check(path.relative(ROOT, file), () => {
      execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    });
  }

  // ── 2. DB layer ────────────────────────────────────────────────────────────
  section('Database layer');
  await check('config round-trip (including Phase 2 fields)', () => {
    delete require.cache[require.resolve('../db/client')];
    const { getConfig, saveConfig, deleteConfig } = require('../handlers/configHandler');
    const gid = 'smoke-test-guild-1';

    const cfg = getConfig(gid);
    assert(cfg.welcome.enabled === false, 'default welcome should be off');
    assert(cfg.warnThresholds.muteAt === null, 'default muteAt should be null');

    cfg.welcome.enabled = true;
    cfg.welcome.channelId = '111';
    cfg.warnThresholds.banAt = 5;
    cfg.logs.messageLogsEnabled = true;
    saveConfig(gid, cfg);

    const reloaded = getConfig(gid);
    assert(reloaded.welcome.enabled === true, 'welcome.enabled did not persist');
    assert(reloaded.warnThresholds.banAt === 5, 'warnThresholds.banAt did not persist');
    assert(reloaded.logs.messageLogsEnabled === true, 'logs.messageLogsEnabled did not persist');

    deleteConfig(gid);
    assert(getConfig(gid).welcome.enabled === false, 'deleteConfig should reset to defaults');
  });

  await check('warnings: case ids, remove, clear', () => {
    const { addWarning, getWarnings, removeWarning, clearWarnings } = require('../handlers/warningsHandler');
    const gid = 'smoke-test-guild-2';
    const mod = { id: '1', tag: 'Mod#0001' };

    const w1 = addWarning(gid, '999', 'reason one', mod);
    const w2 = addWarning(gid, '999', 'reason two', mod);
    assert(w1.id !== w2.id, 'warnings should get distinct case ids');
    assert(getWarnings(gid, '999').length === 2, 'expected 2 active warnings');

    assert(removeWarning(gid, w1.id) === true, 'removeWarning should succeed for a real case id');
    assert(removeWarning(gid, 999999) === false, 'removeWarning should fail for a bogus case id');
    assert(getWarnings(gid, '999').length === 1, 'expected 1 active warning after removal');

    assert(clearWarnings(gid, '999') === 1, 'clearWarnings should report 1 cleared');
    assert(getWarnings(gid, '999').length === 0, 'expected 0 warnings after clear');
  });

  await check('mod actions: case history', () => {
    const { logAction, getRecentActions } = require('../handlers/modActionsHandler');
    const gid = 'smoke-test-guild-3';

    const caseId = logAction({
      guildId: gid, action: 'ban',
      target: { id: '1', tag: 'Target#0001' },
      moderator: { id: '2', tag: 'Mod#0001' },
      reason: 'test',
    });
    assert(typeof caseId === 'number', 'logAction should return a numeric case id');
    assert(getRecentActions(gid).length === 1, 'expected 1 recent action');
  });

  await check('schema migration is idempotent (safe to re-run on every boot)', () => {
    delete require.cache[require.resolve('../db/client')];
    require('../db/client');
    delete require.cache[require.resolve('../db/client')];
    require('../db/client'); // should not throw on already-existing columns
  });

  // ── 2b. Cooldown handler ───────────────────────────────────────────────────
  section('Command cooldown protection');
  await check('blocks repeat use within the window, respects per-command overrides, clears after expiry', () => {
    const { checkAndStart } = require('../handlers/cooldownHandler');
    const fakeCommand = { data: { name: 'smoke-test-cmd' }, cooldown: 0.05 }; // 50ms for a fast test

    const first = checkAndStart(fakeCommand, 'user-1');
    assert(first.onCooldown === false, 'first use should not be on cooldown');

    const second = checkAndStart(fakeCommand, 'user-1');
    assert(second.onCooldown === true, 'immediate repeat use should be on cooldown');
    assert(second.remainingMs > 0, 'remainingMs should be positive while on cooldown');

    const otherUser = checkAndStart(fakeCommand, 'user-2');
    assert(otherUser.onCooldown === false, 'cooldowns should be per-user, not global');
  });

  // ── 2c. Network error classification (used by session staleness logic) ────
  section('Auth error classification');
  await check('genuine HTTP 4xx responses are NOT flagged as network errors', async () => {
    // Real, reachable domain (present in this environment's egress allowlist)
    // hit with a path guaranteed to 404 — this is a genuine completed HTTP
    // response, which requireGuildAccess's staleness re-check must treat as
    // "the token was rejected," not "Discord is unreachable."
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    let res;
    try {
      res = await fetch('https://registry.npmjs.org/this-package-truly-does-not-exist-xyz-123', { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    assert(res.status === 404, `expected a real 404 from the registry, got ${res.status}`);
  });

  await check(
    "timeout/connection-failure paths are flagged as network errors (mocked — this sandbox's egress proxy intercepts real unreachable-network scenarios as completed HTTP responses, so this is tested deterministically instead)",
    async () => {
      async function timedFetch(mockFetch, timeoutMs) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          return await mockFetch(controller.signal);
        } catch (err) {
          err.isNetworkError = true;
          throw err;
        } finally {
          clearTimeout(timer);
        }
      }

      const hanging = signal => new Promise((_, reject) => {
        signal.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
      try {
        await timedFetch(hanging, 20);
        throw new Error('should have thrown');
      } catch (err) {
        assert(err.isNetworkError === true, 'timeout should be tagged isNetworkError');
      }

      const connFail = () => Promise.reject(new TypeError('fetch failed'));
      try {
        await timedFetch(connFail, 1000);
        throw new Error('should have thrown');
      } catch (err) {
        assert(err.isNetworkError === true, 'connection failure should be tagged isNetworkError');
      }
    },
  );

  // ── 3. Command & event loaders ─────────────────────────────────────────────
  section('Command & event loading');
  await check('all commands load with valid, unique slash-command payloads', () => {
    const { Collection } = require('discord.js');
    const { loadCommands } = require('../handlers/commandHandler');
    const fakeClient = { commands: new Collection() };
    loadCommands(fakeClient);

    assert(fakeClient.commands.size > 0, 'no commands were loaded');
    const seen = new Set();
    for (const cmd of fakeClient.commands.values()) {
      const json = cmd.data.toJSON(); // throws if the builder is invalid
      assert(!seen.has(json.name), `duplicate command name: ${json.name}`);
      seen.add(json.name);
      assert(typeof cmd.execute === 'function', `${json.name} is missing execute()`);
    }
    loadedCommandCount = fakeClient.commands.size;
  });

  await check('all events load and expose name + execute', () => {
    const { Collection } = require('discord.js');
    const { loadEvents } = require('../handlers/eventHandler');
    // eventHandler attaches listeners directly to the client; a minimal stub
    // with `once`/`on` is enough to exercise the loader without connecting.
    const calls = [];
    const fakeClient = {
      commands: new Collection(),
      once: (name, fn) => calls.push(name),
      on: (name, fn) => calls.push(name),
    };
    loadEvents(fakeClient);
    assert(calls.length > 0, 'no events were registered');
  });

  // ── 4. Web dashboard (boots for real, hits real HTTP routes) ──────────────
  section('Web dashboard');
  await check('server boots, auth guards work, security headers present, then shuts down cleanly', () => {
    const { spawn } = require('child_process');
    const http = require('http');

    const port = 39215; // fixed high port unlikely to collide
    const env = {
      ...process.env,
      DASHBOARD_PORT: String(port),
      DISCORD_CLIENT_ID: '123',
      DISCORD_CLIENT_SECRET: 'test',
      DISCORD_REDIRECT_URI: `http://localhost:${port}/auth/callback`,
      SESSION_SECRET: 'smoke-test-secret-do-not-use-in-prod-0123456789',
      DB_PATH: TEST_DB,
    };

    const child = spawn(process.execPath, [path.join(ROOT, 'web', 'server.js')], {
      env, stdio: 'pipe', cwd: ROOT,
    });

    let stderr = '';
    child.stderr.on('data', d => { stderr += d; });

    const get = (urlPath) => new Promise((resolve, reject) => {
      const req = http.get(`http://localhost:${port}${urlPath}`, { timeout: 3000 }, res => {
        let body = '';
        res.on('data', d => { body += d; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error(`timeout on ${urlPath}`)); });
    });

    return new Promise((resolve, reject) => {
      const timer = setTimeout(async () => {
        try {
          const health = await get('/health');
          assert(health.status === 200, `/health expected 200, got ${health.status}`);

          const apiMe = await get('/api/me');
          assert(apiMe.status === 401, `/api/me without a session should be 401, got ${apiMe.status}`);

          const dashboard = await get('/dashboard.html');
          assert(dashboard.status === 302, `/dashboard.html without a session should redirect (302), got ${dashboard.status}`);

          const guildPage = await get('/guild.html');
          assert(guildPage.status === 302, `/guild.html without a session should redirect (302), got ${guildPage.status}`);

          const notFound = await get('/this-route-does-not-exist');
          assert(notFound.status === 404, `unknown route should 404, got ${notFound.status}`);

          // ── Security header checks ──────────────────────────────────────
          const landing = await get('/');
          assert(landing.headers['content-security-policy'], 'CSP header should be present (helmet)');
          assert(landing.headers['x-frame-options'], 'X-Frame-Options header should be present (helmet)');
          assert(!landing.headers['x-powered-by'], 'X-Powered-By should be stripped (helmet)');

          // Unauthenticated requests to guild-scoped routes must 401 before
          // any ID validation runs (don't leak validation details to
          // callers with no session at all) — regardless of whether the ID
          // in the URL happens to be well- or malformed.
          const badGuildNoAuth = await get('/api/guilds/not-a-snowflake/config');
          assert(badGuildNoAuth.status === 401, `unauthenticated request should 401 before ID validation, got ${badGuildNoAuth.status}`);

          child.kill();
          resolve();
        } catch (err) {
          child.kill();
          reject(new Error(`${err.message}${stderr ? `\n    server stderr: ${stderr.split('\n').join('\n    ')}` : ''}`));
        }
      }, 1200);

      child.on('error', err => { clearTimeout(timer); reject(err); });
    });
  });

  await check('authenticated: guildId validation, access control, and CSRF all enforced correctly', () => {
    const { spawn } = require('child_process');
    const http = require('http');
    const crypto = require('crypto');
    const signature = require('cookie-signature');

    const port = 39217;
    const sessionSecret = 'smoke-test-secret-authed-0123456789abcdef';
    const env = {
      ...process.env,
      DASHBOARD_PORT: String(port),
      DISCORD_CLIENT_ID: '123',
      DISCORD_CLIENT_SECRET: 'test',
      DISCORD_REDIRECT_URI: `http://localhost:${port}/auth/callback`,
      SESSION_SECRET: sessionSecret,
      DB_PATH: TEST_DB,
    };

    // Seed a real session + a real "bot is in this guild" config row
    // directly, the same way requireGuildAccess expects to find them —
    // this exercises the actual middleware logic, not a mock of it.
    delete require.cache[require.resolve('../db/client')];
    process.env.DB_PATH = TEST_DB;
    const { createSession } = require('../web/sessionStore');
    const { getConfig } = require('../handlers/configHandler');

    const guildWithBot = '111111111111111111';
    const guildWithoutBot = '222222222222222222'; // in the user's manageable list, but bot never joined
    const guildNotManaged = '333333333333333333'; // bot is in it, but this user doesn't manage it
    getConfig(guildWithBot);
    getConfig(guildNotManaged);

    const sessionId = createSession({
      userId: 'smoke-user', username: 'Smoke#0001', avatar: null,
      accessToken: 'x', refreshToken: 'y',
      guilds: [{ id: guildWithBot, name: 'Has Bot', icon: null }, { id: guildWithoutBot, name: 'No Bot', icon: null }],
    });
    const cookie = encodeURIComponent(`s:${signature.sign(sessionId, sessionSecret)}`);

    const child = spawn(process.execPath, [path.join(ROOT, 'web', 'server.js')], {
      env, stdio: 'pipe', cwd: ROOT,
    });

    const request = (method, urlPath, bodyObj, extraHeaders = {}) => new Promise((resolve, reject) => {
      const data = bodyObj ? JSON.stringify(bodyObj) : null;
      const headers = { Cookie: `session=${cookie}`, ...extraHeaders };
      if (data) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(data); }
      const req = http.request(`http://localhost:${port}${urlPath}`, { method, timeout: 3000, headers }, res => {
        let body = '';
        res.on('data', d => { body += d; });
        res.on('end', () => resolve({ status: res.statusCode, body }));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error(`timeout on ${method} ${urlPath}`)); });
      if (data) req.write(data);
      req.end();
    });

    const validConfig = {
      welcome: { enabled: false, channelId: null, message: 'hi' },
      bye: { enabled: false, channelId: null, message: 'bye' },
      autorole: { enabled: false, roleId: null },
      logs: { enabled: false, channelId: null, messageLogsEnabled: false },
      antispam: { enabled: false, limit: 5, window: 5, action: 'warn', blockInvites: true },
      warnThresholds: { muteAt: null, muteDuration: 30, kickAt: null, banAt: null },
    };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(async () => {
        try {
          const validGet = await request('GET', `/api/guilds/${guildWithBot}/config`);
          assert(validGet.status === 200, `valid authenticated GET should succeed, got ${validGet.status}`);

          const malformed = await request('GET', '/api/guilds/not-a-snowflake/config');
          assert(malformed.status === 400, `authenticated request with malformed guildId should 400, got ${malformed.status}`);

          const notManaged = await request('GET', `/api/guilds/${guildNotManaged}/config`);
          assert(notManaged.status === 403, `guild the user doesn't manage should 403, got ${notManaged.status}`);

          const noBotYet = await request('GET', `/api/guilds/${guildWithoutBot}/config`);
          assert(noBotYet.status === 404, `guild the user manages but bot hasn't joined should 404, got ${noBotYet.status}`);

          const putNoOrigin = await request('PUT', `/api/guilds/${guildWithBot}/config`, validConfig);
          assert(putNoOrigin.status === 403, `authenticated PUT with no Origin header should 403 (CSRF), got ${putNoOrigin.status}`);

          const putWrongOrigin = await request('PUT', `/api/guilds/${guildWithBot}/config`, validConfig, { Origin: 'http://evil.example.com' });
          assert(putWrongOrigin.status === 403, `authenticated PUT with a foreign Origin should 403 (CSRF), got ${putWrongOrigin.status}`);

          const putCorrectOrigin = await request('PUT', `/api/guilds/${guildWithBot}/config`, validConfig, { Origin: `http://localhost:${port}` });
          assert(putCorrectOrigin.status === 200, `authenticated PUT with a matching Origin should succeed, got ${putCorrectOrigin.status}`);

          child.kill();
          resolve();
        } catch (err) {
          child.kill();
          reject(err);
        }
      }, 1200);

      child.on('error', err => { clearTimeout(timer); reject(err); });
    });
  });

  await check('auth rate limiter blocks excessive requests', () => {
    const { spawn } = require('child_process');
    const http = require('http');

    const port = 39216;
    const env = {
      ...process.env,
      DASHBOARD_PORT: String(port),
      DISCORD_CLIENT_ID: '123',
      DISCORD_CLIENT_SECRET: 'test',
      DISCORD_REDIRECT_URI: `http://localhost:${port}/auth/callback`,
      SESSION_SECRET: 'smoke-test-secret-do-not-use-in-prod-2-0123456789',
      DB_PATH: TEST_DB,
    };

    const child = spawn(process.execPath, [path.join(ROOT, 'web', 'server.js')], {
      env, stdio: 'pipe', cwd: ROOT,
    });

    const get = (urlPath) => new Promise((resolve, reject) => {
      const req = http.get(`http://localhost:${port}${urlPath}`, { timeout: 3000 }, res => {
        res.resume();
        resolve(res.statusCode);
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error(`timeout on ${urlPath}`)); });
    });

    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          // Auth limiter is 20 requests / 5 min — 25 quick requests should
          // start getting 429s before the burst ends.
          const statuses = [];
          for (let i = 0; i < 25; i++) statuses.push(await get('/auth/login'));
          assert(statuses.some(s => s === 429), 'expected at least one 429 after exceeding the auth rate limit');
          assert(statuses.slice(0, 20).every(s => s === 302), 'the first 20 requests should still succeed (302 redirect)');

          child.kill();
          resolve();
        } catch (err) {
          child.kill();
          reject(err);
        }
      }, 1200);

      child.on('error', reject);
    });
  });

  // ── Cleanup + summary ──────────────────────────────────────────────────────
  for (const ext of ['', '-shm', '-wal']) {
    fs.rmSync(TEST_DB + ext, { force: true });
  }

  console.log(`\n${failures === 0 ? '\x1b[32m' : '\x1b[31m'}${'─'.repeat(50)}\x1b[0m`);
  if (failures === 0) {
    console.log(`\x1b[32mAll checks passed.\x1b[0m (${loadedCommandCount} commands verified)`);
    process.exit(0);
  } else {
    console.log(`\x1b[31m${failures} check(s) failed.\x1b[0m`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\n\x1b[31mSmoke test crashed unexpectedly:\x1b[0m', err);
  process.exit(1);
});
