import { spawn, ChildProcess } from 'child_process';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

const PORT = 3999;
const BASE = `http://localhost:${PORT}`;
const DB_PATH = path.join(process.cwd(), 'database.sqlite');
const DB_BACKUP = path.join(process.cwd(), 'database.sqlite.test_backup');

let server: ChildProcess | null = null;
let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ ${msg}`);
    failed++;
  }
}

function request(method: string, urlPath: string, body?: any, token?: string): Promise<{ status: number; data: any }> {
  return new Promise((resolve) => {
    const url = new URL(urlPath, BASE);
    const data = body ? JSON.stringify(body) : undefined;
    const opts: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      timeout: 5000,
    };
    const req = http.request(opts, (res) => {
      let chunks = '';
      res.on('data', (c) => (chunks += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode!, data: JSON.parse(chunks) });
        } catch {
          resolve({ status: res.statusCode!, data: chunks });
        }
      });
    });
    req.on('error', (e) => {
      console.error(`    [HTTP Error] ${e.message}`);
      resolve({ status: 0, data: {} });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, data: {} });
    });
    if (data) req.write(data);
    req.end();
  });
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await request('GET', '/api/health');
      if (res.status === 200) return true;
    } catch { /* ignore */ }
    await sleep(500);
  }
  return false;
}

async function main() {
  console.log('=== Deploy Tool Verification Tests ===\n');

  // Backup and reset database for clean test
  if (fs.existsSync(DB_PATH)) {
    fs.copyFileSync(DB_PATH, DB_BACKUP);
    fs.unlinkSync(DB_PATH);
  }

  // Start server with fresh database
  console.log('[Setup] Starting server on port', PORT);
  server = spawn('node', ['dist/index.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(PORT),
      DEPLOY_PASSWORD: 'test123',
      OTP_ENCRYPTION_KEY: 'a'.repeat(64),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const logs: Buffer[] = [];
  server.stdout?.on('data', (d) => logs.push(d));
  server.stderr?.on('data', (d) => logs.push(d));

  const started = await waitForServer();
  if (!started) {
    console.error('[ERROR] Server failed to start!');
    console.error('Server logs:', Buffer.concat(logs).toString());
    process.exit(1);
  }
  console.log('[Setup] Server is ready with fresh database\n');

  try {
    // ==========================================
    console.log('--- Test 7.1: Single Session Mechanism ---');
    // ==========================================

    const login1 = await request('POST', '/api/auth/login', { username: 'admin', password: 'test123' });
    assert(login1.status === 200, 'First login returns 200');
    assert(login1.data?.success === true, 'First login is successful');
    const token1 = login1.data?.data?.token;
    assert(!!token1, `First login returns a token (${token1?.substring(0, 8)}...)`);

    const me1 = await request('GET', '/api/auth/me', undefined, token1);
    assert(me1.status === 200, 'First token is valid');
    assert(me1.data?.data?.username === 'admin', 'First token identifies as admin');

    const login2 = await request('POST', '/api/auth/login', { username: 'admin', password: 'test123' });
    assert(login2.status === 200, 'Second login returns 200');
    const token2 = login2.data?.data?.token;
    assert(!!token2, `Second login returns a token (${token2?.substring(0, 8)}...)`);
    assert(token1 !== token2, 'Second token is different from first');

    const me1_again = await request('GET', '/api/auth/me', undefined, token1);
    assert(me1_again.status === 401, `First token is revoked after second login (status=${me1_again.status})`);
    assert(me1_again.data?.reason === 'session_revoked', `Revoked token returns session_revoked reason (reason=${me1_again.data?.reason})`);

    const me2 = await request('GET', '/api/auth/me', undefined, token2);
    assert(me2.status === 200, 'Second token is still valid');

    // ==========================================
    console.log('\n--- Test 7.2: Session Revoked Message ---');
    // ==========================================

    const errorResp = await request('GET', '/api/auth/me', undefined, token1);
    assert(errorResp.status === 401, 'Revoked session returns 401');
    assert(!!errorResp.data?.error && errorResp.data.error.includes('别处登录'), `Error message mentions login elsewhere: "${errorResp.data?.error}"`);
    assert(errorResp.data?.reason === 'session_revoked', 'Response includes session_revoked reason');

    // ==========================================
    console.log('\n--- Test 7.3: Audit Log IP Address ---');
    // ==========================================

    const logsResp = await request('GET', '/api/audit/logs', undefined, token2);
    assert(logsResp.status === 200, 'Audit logs endpoint returns 200');
    assert(Array.isArray(logsResp.data?.data), 'Audit logs returns an array');

    const auditLogs = logsResp.data?.data || [];
    assert(auditLogs.length > 0, `There are audit log entries (${auditLogs.length})`);

    const loginLogs = auditLogs.filter((l: any) => l.event_type === '登录');
    assert(loginLogs.length > 0, `There are login audit entries (${loginLogs.length})`);
    const hasIp = loginLogs.some((l: any) => l.operator_ip && l.operator_ip.length > 0);
    assert(hasIp, 'Login audit entries contain operator_ip');

    // ==========================================
    console.log('\n--- Test 7.4: IP Filter ---');
    // ==========================================

    const testIp = loginLogs[0]?.operator_ip;
    assert(!!testIp, `Can extract IP from audit log for filtering (${testIp})`);

    if (testIp) {
      const filteredResp = await request('GET', `/api/audit/logs?operatorIp=${encodeURIComponent(testIp)}`, undefined, token2);
      assert(filteredResp.status === 200, 'IP filter endpoint returns 200');
      const filteredLogs = filteredResp.data?.data || [];
      assert(filteredLogs.length > 0, `IP filter returns matching entries (${filteredLogs.length})`);
      const allMatchIp = filteredLogs.every((l: any) => l.operator_ip === testIp);
      assert(allMatchIp, 'All filtered entries match the IP');

      const noMatchResp = await request('GET', '/api/audit/logs?operatorIp=999.888.777.666', undefined, token2);
      assert(noMatchResp.status === 200, 'Non-matching IP filter returns 200');
      assert(noMatchResp.data?.data?.length === 0, 'Non-matching IP filter returns empty array');
    }

    // ==========================================
    console.log('\n--- Test: Trust Proxy & Health ---');
    // ==========================================

    const healthResp = await request('GET', '/api/health');
    assert(healthResp.status === 200, 'Health check works');
    assert(healthResp.data?.data?.status === 'ok', 'Health check returns ok');

  } catch (err: any) {
    console.error('\n[ERROR] Test execution failed:', err.message);
    console.error(err.stack);
  } finally {
    if (server) {
      server.kill('SIGTERM');
      await sleep(500);
      try { server.kill('SIGKILL'); } catch { /* ignore */ }
    }
    // Restore original database
    if (fs.existsSync(DB_BACKUP)) {
      try { fs.unlinkSync(DB_PATH); } catch { /* ignore */ }
      fs.copyFileSync(DB_BACKUP, DB_PATH);
      fs.unlinkSync(DB_BACKUP);
      console.log('[Cleanup] Restored original database');
    }
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
