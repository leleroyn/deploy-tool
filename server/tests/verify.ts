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

    // ==========================================
    console.log('\n--- Test 8.1: Task Creation Persists to SQLite ---');
    // ==========================================

    // Initially, tasks table should be empty
    const initialTasks = await request('GET', '/api/tasks', undefined, token2);
    assert(initialTasks.status === 200, 'GET /api/tasks returns 200');
    assert(initialTasks.data?.data?.total === 0, `Initial tasks total is 0 (got ${initialTasks.data?.data?.total})`);
    assert(Array.isArray(initialTasks.data?.data?.tasks), 'Tasks response has tasks array');

    // Create a deploy task on bankgw-api
    const deployResp = await request('POST', '/api/tasks/deploy', { project: 'bankgw-api', dryRun: true }, token2);
    assert(deployResp.status === 200, 'Create deploy task returns 200');
    assert(deployResp.data?.success === true, 'Deploy task creation succeeds');
    const deployTask = deployResp.data?.data;
    assert(!!deployTask?.id, `Deploy task has an ID (${deployTask?.id?.substring(0, 8)}...)`);
    assert(deployTask?.type === 'deploy', 'Deploy task type is correct');
    assert(deployTask?.project === 'bankgw-api', 'Deploy task project is correct');
    assert(deployTask?.status === 'pending', `Deploy task initial status is pending (got ${deployTask?.status})`);
    assert(deployTask?.dryRun === true, 'Deploy task dryRun flag is true');
    assert(!!deployTask?.operatorId, 'Deploy task has operatorId');
    assert(deployTask?.operatorName === 'admin', 'Deploy task operatorName is admin');

    // Wait for task to execute (script will fail immediately since scripts don't exist)
    await sleep(3000);

    // Verify task is now persisted and retrievable
    const tasksAfterCreate = await request('GET', '/api/tasks', undefined, token2);
    assert(tasksAfterCreate.status === 200, 'GET /api/tasks after creation returns 200');
    assert(tasksAfterCreate.data?.data?.total >= 1, `Tasks total >= 1 after creation (got ${tasksAfterCreate.data?.data?.total})`);

    // Verify task detail retrieval
    const taskDetail = await request('GET', `/api/tasks/${deployTask.id}`, undefined, token2);
    assert(taskDetail.status === 200, `GET /api/tasks/${deployTask.id.substring(0, 8)}... returns 200`);
    assert(taskDetail.data?.data?.id === deployTask.id, 'Task detail ID matches created task');
    assert(['pending', 'running', 'success', 'failed'].includes(taskDetail.data?.data?.status), `Task status is valid (${taskDetail.data?.data?.status})`);

    // ==========================================
    console.log('\n--- Test 8.2: Task Stats Endpoint ---');
    // ==========================================

    const statsResp = await request('GET', '/api/tasks/stats', undefined, token2);
    assert(statsResp.status === 200, 'GET /api/tasks/stats returns 200');
    assert(statsResp.data?.success === true, 'Stats endpoint succeeds');
    const stats = statsResp.data?.data;
    assert(!!stats, 'Stats returns data object');
    assert('pending' in stats, 'Stats has pending count');
    assert('running' in stats, 'Stats has running count');
    assert('success' in stats, 'Stats has success count');
    assert('failed' in stats, 'Stats has failed count');
    const totalStats = (stats.pending || 0) + (stats.running || 0) + (stats.success || 0) + (stats.failed || 0);
    assert(totalStats >= 1, `Stats total >= 1 (got ${totalStats})`);

    // Create tasks on DIFFERENT projects to avoid isProjectBusy conflicts
    const backupResp = await request('POST', '/api/tasks/backup', { project: 'chatgpt-pdf' }, token2);
    assert(backupResp.status === 200, `Create backup task returns 200 (got ${backupResp.status})`);
    const backupTask = backupResp.data?.data;
    assert(!!backupTask?.id, 'Backup task has an ID');

    const checkPortsResp = await request('POST', '/api/tasks/check-ports', { project: 'bankgw-job' }, token2);
    assert(checkPortsResp.status === 200, `Create check-ports task returns 200 (got ${checkPortsResp.status})`);

    // Wait for tasks to complete
    await sleep(3000);

    // Verify stats reflect all tasks
    const statsAfterMore = await request('GET', '/api/tasks/stats', undefined, token2);
    const statsAfter = statsAfterMore.data?.data;
    const totalAfter = (statsAfter?.pending || 0) + (statsAfter?.running || 0) + (statsAfter?.success || 0) + (statsAfter?.failed || 0);
    assert(totalAfter >= 3, `Stats total >= 3 after creating 3 tasks (got ${totalAfter})`);

    // ==========================================
    console.log('\n--- Test 8.3: Task Pagination ---');
    // ==========================================

    // Create more tasks sequentially on different projects for pagination
    // Use 'all' project for backup to avoid busy conflicts with other projects
    let paginationCount = 0;
    for (let i = 0; i < 10; i++) {
      const proj = i % 2 === 0 ? 'all' : 'bankgw-api';
      const r = await request('POST', '/api/tasks/backup', { project: proj }, token2);
      if (r.status === 200) {
        paginationCount++;
      }
      // Wait for each task to finish before creating next
      await sleep(1500);
    }

    // Test page 1 with limit 2
    const page1 = await request('GET', '/api/tasks?page=1&limit=2', undefined, token2);
    assert(page1.status === 200, 'Pagination page 1 returns 200');
    assert(page1.data?.data?.tasks?.length === 2, `Page 1 returns 2 tasks (got ${page1.data?.data?.tasks?.length})`);
    const paginationTotal = page1.data?.data?.total;
    assert(paginationTotal >= 3 + paginationCount, `Total count >= expected (got ${paginationTotal}, created ${paginationCount} pagination tasks)`);

    // Test page 2 with limit 2
    const page2 = await request('GET', '/api/tasks?page=2&limit=2', undefined, token2);
    assert(page2.status === 200, 'Pagination page 2 returns 200');
    assert(page2.data?.data?.tasks?.length <= 2, `Page 2 returns <= 2 tasks (got ${page2.data?.data?.tasks?.length})`);

    // Verify pages return different tasks
    const page1Ids = page1.data?.data?.tasks.map((t: any) => t.id);
    const page2Ids = page2.data?.data?.tasks.map((t: any) => t.id);
    const noOverlap = !page1Ids.some((id: string) => page2Ids.includes(id));
    assert(noOverlap, 'Page 1 and Page 2 have no overlapping task IDs');

    // Test default pagination (no params)
    const defaultPage = await request('GET', '/api/tasks', undefined, token2);
    assert(defaultPage.status === 200, 'Default pagination returns 200');
    assert(defaultPage.data?.data?.tasks?.length <= 20, `Default limit returns <= 20 tasks (got ${defaultPage.data?.data?.tasks?.length})`);

    // Test last page
    const totalTasks = page1.data?.data?.total;
    const lastPageNum = Math.ceil(totalTasks / 2);
    const lastPage = await request('GET', `/api/tasks?page=${lastPageNum}&limit=2`, undefined, token2);
    assert(lastPage.status === 200, 'Last page returns 200');
    assert(lastPage.data?.data?.tasks?.length > 0, `Last page has tasks (got ${lastPage.data?.data?.tasks?.length})`);

    // Test beyond last page
    const beyondPage = await request('GET', `/api/tasks?page=9999&limit=2`, undefined, token2);
    assert(beyondPage.status === 200, 'Beyond last page returns 200');
    assert(beyondPage.data?.data?.tasks?.length === 0, `Beyond last page returns empty array (got ${beyondPage.data?.data?.tasks?.length})`);

    // ==========================================
    console.log('\n--- Test 8.4: Task Status Transitions Persist ---');
    // ==========================================

    // Wait for all tasks to complete
    await sleep(3000);

    // Get all tasks
    const allTasks = await request('GET', '/api/tasks?limit=100', undefined, token2);
    const allTaskList = allTasks.data?.data?.tasks || [];
    assert(allTaskList.length >= 3, `Have at least 3 tasks to check (got ${allTaskList.length})`);

    // Tasks may be running (script still executing) or completed
    const completedTasks = allTaskList.filter((t: any) => t.status === 'success' || t.status === 'failed');
    const runningTasks = allTaskList.filter((t: any) => t.status === 'running');
    const pendingTasks = allTaskList.filter((t: any) => t.status === 'pending');
    assert(completedTasks.length + runningTasks.length + pendingTasks.length >= 3, `At least 3 tasks exist (completed=${completedTasks.length}, running=${runningTasks.length}, pending=${pendingTasks.length})`);

    if (completedTasks.length > 0) {
      // Verify completed tasks have end_time and exit_code
      const firstCompleted = completedTasks[0];
      assert(!!firstCompleted?.endTime, 'Completed task has endTime');
      assert(firstCompleted?.exitCode !== undefined && firstCompleted?.exitCode !== null, `Completed task has exitCode (got ${firstCompleted?.exitCode})`);

      // Verify task detail also shows final state
      const finalDetail = await request('GET', `/api/tasks/${firstCompleted.id}`, undefined, token2);
      assert(finalDetail.data?.data?.status === firstCompleted.status, 'Task detail status matches list status');
      assert(finalDetail.data?.data?.endTime === firstCompleted.endTime, 'Task detail endTime matches list endTime');
    }

    // ==========================================
    console.log('\n--- Test 8.5: Stats Consistency ---');
    // ==========================================

    // Verify stats total matches paginated total
    const finalStats = await request('GET', '/api/tasks/stats', undefined, token2);
    const finalTasks = await request('GET', '/api/tasks?limit=100', undefined, token2);
    const statsTotal = (finalStats.data?.data?.pending || 0) + (finalStats.data?.data?.running || 0) + (finalStats.data?.data?.success || 0) + (finalStats.data?.data?.failed || 0);
    const paginatedTotal = finalTasks.data?.data?.total;
    assert(statsTotal === paginatedTotal, `Stats total (${statsTotal}) matches paginated total (${paginatedTotal})`);

    // ==========================================
    console.log('\n--- Test 8.6: Restart Recovery ---');
    // ==========================================

    // Record task count before restart
    const preRestartTotal = paginatedTotal;
    const preRestartTaskId = allTaskList[0]?.id;

    // Kill the server
    console.log('  [Restart] Killing server...');
    if (server) {
      server.kill('SIGTERM');
      await sleep(1000);
      try { server.kill('SIGKILL'); } catch { /* ignore */ }
    }
    server = null;

    // Wait for port to be released
    await sleep(2000);

    // Restart the server
    console.log('  [Restart] Starting server again...');
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
    server.stdout?.on('data', (d) => logs.push(d));
    server.stderr?.on('data', (d) => logs.push(d));

    const restarted = await waitForServer();
    assert(restarted, 'Server restarted successfully');

    // Re-login after restart
    const newLogin = await request('POST', '/api/auth/login', { username: 'admin', password: 'test123' });
    const newToken = newLogin.data?.data?.token;
    assert(!!newToken, 'Login works after restart');

    // Verify tasks survived restart
    const afterRestartTasks = await request('GET', '/api/tasks?limit=100', undefined, newToken);
    assert(afterRestartTasks.status === 200, 'GET /api/tasks works after restart');
    const afterRestartTotal = afterRestartTasks.data?.data?.total;
    assert(afterRestartTotal === preRestartTotal, `Tasks survived restart: before=${preRestartTotal}, after=${afterRestartTotal}`);

    // Verify stats survived restart
    const afterRestartStats = await request('GET', '/api/tasks/stats', undefined, newToken);
    const afterRestartStatsTotal = (afterRestartStats.data?.data?.pending || 0) + (afterRestartStats.data?.data?.running || 0) + (afterRestartStats.data?.data?.success || 0) + (afterRestartStats.data?.data?.failed || 0);
    assert(afterRestartStatsTotal === preRestartTotal, `Stats survived restart: before=${preRestartTotal}, after=${afterRestartStatsTotal}`);

    // Verify no running/pending tasks after restart (should all be recovered to failed)
    assert((afterRestartStats.data?.data?.running || 0) === 0, `No running tasks after restart (got ${afterRestartStats.data?.data?.running})`);
    assert((afterRestartStats.data?.data?.pending || 0) === 0, `No pending tasks after restart (got ${afterRestartStats.data?.data?.pending})`);

    // Verify task details survived
    if (preRestartTaskId) {
      const afterRestartDetail = await request('GET', `/api/tasks/${preRestartTaskId}`, undefined, newToken);
      assert(afterRestartDetail.status === 200, 'Task detail accessible after restart');
      assert(afterRestartDetail.data?.data?.id === preRestartTaskId, 'Task ID matches after restart');
    }

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
