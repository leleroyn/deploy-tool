/**
 * 日志归档功能测试
 * 运行: npm test (即 npx tsx tests/verify.ts)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as http from 'http';

// ============================================================
// 测试基础设施
// ============================================================

let passed = 0;
let failed = 0;
let total = 0;

function assert(condition: boolean, message: string): void {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

function assertEqual(actual: any, expected: any, message: string): void {
  total++;
  if (actual === expected) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message} (expected: ${expected}, got: ${actual})`);
  }
}

function assertContains(haystack: string, needle: string, message: string): void {
  total++;
  if (haystack.includes(needle)) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message} ("${haystack}" does not contain "${needle}")`);
  }
}

function httpGet(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(data) }));
    }).on('error', reject);
  });
}

function httpDelete(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: 'DELETE' }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(data) }));
    });
    req.on('error', reject);
    req.end();
  });
}

function createTestServer(mockUser: any | null): Promise<{ base: string; close: () => void }> {
  return new Promise((resolve) => {
    void Promise.resolve().then(async () => {
      const { default: Express } = await import('express');
      const app = Express();

      if (mockUser) {
        app.use('/api/logs', (req: any, _res: any, next: any) => {
          req.user = mockUser;
          next();
        });
      }

      delete require.cache[require.resolve('../src/routes/logs')];
      const logsRouter = require('../src/routes/logs');
      app.use('/api/logs', logsRouter.default || logsRouter);

      const server = app.listen(0, () => {
        const port = (server.address() as any).port;
        resolve({
          base: `http://localhost:${port}`,
          close: () => server.close(() => {}),
        });
      });
    });
  });
}

// ============================================================
// 创建临时测试目录
// ============================================================

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'log-archive-test-'));
const logDir = path.join(testDir, 'logs');
const archiveBaseDir = path.join(logDir, 'archives');

fs.mkdirSync(logDir, { recursive: true });
process.env.LOG_BASE_DIR = logDir;

console.log(`测试目录: ${testDir}`);
console.log(`日志目录: ${logDir}`);
console.log('');

// ============================================================
// 主测试流程
// ============================================================

(async () => {
  // 创建测试日志文件
  const testLogContent = '测试日志内容\n第二行日志\n第三行日志\n';
  const deployLogPath = path.join(logDir, 'deploy.log');
  fs.writeFileSync(deployLogPath, testLogContent);
  fs.writeFileSync(path.join(logDir, 'backup_pj.log'), '');
  fs.writeFileSync(path.join(logDir, 'check_ports.log'), '');
  fs.writeFileSync(path.join(logDir, 'exec_remote_script.log'), '');

  assert(fs.existsSync(deployLogPath), '测试日志文件已创建');
  assertEqual(fs.statSync(deployLogPath).size, Buffer.byteLength(testLogContent), '日志文件大小正确');

  // 创建管理员服务器
  const adminServer = await createTestServer({
    id: 'test-user',
    username: 'testadmin',
    role: 'system_admin',
  });
  const base = adminServer.base;

  // --- 测试 2.1: GET /api/logs/files ---
  console.log('');
  console.log('【测试 2.1】GET /api/logs/files');

  {
    const res = await httpGet(`${base}/api/logs/files`);
    assertEqual(res.body.success, true, '返回 success: true');
    assert(Array.isArray(res.body.data), '返回 data 数组');
    assertEqual(res.body.data.length, 4, '返回 4 个日志文件');

    const deployEntry = res.body.data.find((e: any) => e.key === 'deploy');
    assert(deployEntry != null, '找到 deploy 日志条目');
    assert('archiveCount' in deployEntry, 'deploy 条目包含 archiveCount 字段');
    assertEqual(deployEntry.archiveCount, 0, 'deploy 归档数量为 0（尚未归档）');
    assert(deployEntry.size > 0, 'deploy 日志文件大小大于 0');

    const backupEntry = res.body.data.find((e: any) => e.key === 'backup');
    assert(backupEntry != null, '找到 backup 日志条目');
    assertEqual(backupEntry.archiveCount, 0, 'backup 归档数量为 0');
  }

  // --- 测试 2.2: DELETE /api/logs/deploy (归档) ---
  console.log('');
  console.log('【测试 2.2】DELETE /api/logs/deploy (归档)');

  {
    const res = await httpDelete(`${base}/api/logs/deploy`);
    assertEqual(res.body.success, true, '归档请求成功');

    const deployArchiveDir = path.join(archiveBaseDir, 'deploy');
    assert(fs.existsSync(deployArchiveDir), '归档目录已创建');

    const archiveFiles = fs.readdirSync(deployArchiveDir);
    assertEqual(archiveFiles.length, 1, '归档目录有 1 个文件');

    const archiveFile = archiveFiles[0];
    assertContains(archiveFile, 'deploy.', '归档文件名包含 deploy');
    assertContains(archiveFile, '.log', '归档文件以 .log 结尾');

    const archiveContent = fs.readFileSync(path.join(deployArchiveDir, archiveFile), 'utf-8');
    assertEqual(archiveContent, testLogContent, '归档文件内容与原日志一致');

    const originalContent = fs.readFileSync(deployLogPath, 'utf-8');
    assertEqual(originalContent, '', '原日志文件已被清空');
  }

  // --- 测试 2.3: GET /api/logs/files (归档后) ---
  console.log('');
  console.log('【测试 2.3】GET /api/logs/files (归档后)');

  {
    const res = await httpGet(`${base}/api/logs/files`);
    const deployEntry = res.body.data.find((e: any) => e.key === 'deploy');
    assertEqual(deployEntry.archiveCount, 1, 'deploy 归档数量更新为 1');
    assertEqual(deployEntry.size, 0, 'deploy 日志文件大小为 0');
  }

  // --- 测试 2.4: GET /api/logs/deploy/archives ---
  console.log('');
  console.log('【测试 2.4】GET /api/logs/deploy/archives');

  {
    const res = await httpGet(`${base}/api/logs/deploy/archives`);
    assertEqual(res.body.success, true, '归档列表请求成功');
    assert(Array.isArray(res.body.data), '返回归档列表数组');
    assertEqual(res.body.data.length, 1, '归档列表有 1 个文件');

    const archive = res.body.data[0];
    assert('filename' in archive, '归档条目包含 filename');
    assert('size' in archive, '归档条目包含 size');
    assert('createdAt' in archive, '归档条目包含 createdAt');
    assert(archive.size > 0, '归档文件大小大于 0');
  }

  // --- 测试 2.5: 多次归档 ---
  console.log('');
  console.log('【测试 2.5】多次归档');

  {
    const newContent = '新的日志内容\n';
    fs.writeFileSync(deployLogPath, newContent);

    // 短暂延迟确保毫秒级时间戳不同
    await new Promise((r) => setTimeout(r, 10));

    const res = await httpDelete(`${base}/api/logs/deploy`);
    assertEqual(res.body.success, true, '第二次归档成功');

    const deployArchiveDir = path.join(archiveBaseDir, 'deploy');
    const archiveFiles = fs.readdirSync(deployArchiveDir);
    assertEqual(archiveFiles.length, 2, '归档目录有 2 个文件');

    const filesRes = await httpGet(`${base}/api/logs/files`);
    const deployEntry = filesRes.body.data.find((e: any) => e.key === 'deploy');
    assertEqual(deployEntry.archiveCount, 2, 'deploy 归档数量更新为 2');
  }

  // --- 测试 2.6: 归档列表排序 ---
  console.log('');
  console.log('【测试 2.6】归档列表排序（按时间倒序）');

  {
    const res = await httpGet(`${base}/api/logs/deploy/archives`);
    assertEqual(res.body.data.length, 2, '归档列表有 2 个文件');
    const time1 = new Date(res.body.data[0].createdAt).getTime();
    const time2 = new Date(res.body.data[1].createdAt).getTime();
    assert(time1 >= time2, '归档列表按时间倒序排列');
  }

  // --- 测试 2.7: 空文件归档 ---
  console.log('');
  console.log('【测试 2.7】空文件归档');

  {
    const res = await httpDelete(`${base}/api/logs/deploy`);
    assertEqual(res.body.success, true, '空文件归档请求成功');

    const deployArchiveDir = path.join(archiveBaseDir, 'deploy');
    const archiveFiles = fs.readdirSync(deployArchiveDir);
    assertEqual(archiveFiles.length, 2, '空文件归档不增加归档文件数');
  }

  // --- 测试 2.8: 无效日志类型 ---
  console.log('');
  console.log('【测试 2.8】无效日志类型');

  {
    const res = await httpGet(`${base}/api/logs/invalid_type`);
    assertEqual(res.body.success, false, '无效类型返回失败');
    assertContains(res.body.error, '不存在', '错误信息提示类型不存在');

    const archivesRes = await httpGet(`${base}/api/logs/invalid_type/archives`);
    assertEqual(archivesRes.body.success, false, '无效类型归档列表返回失败');
  }

  // --- 测试 2.9: 读取日志内容 ---
  console.log('');
  console.log('【测试 2.9】GET /api/logs/deploy (读取日志内容)');

  {
    fs.writeFileSync(deployLogPath, '测试读取内容\n');
    const res = await httpGet(`${base}/api/logs/deploy`);
    assertEqual(res.body.success, true, '读取日志内容成功');
    assertContains(res.body.data, '测试读取内容', '日志内容正确');
  }

  // --- 测试 2.10: 其他类型日志归档 ---
  console.log('');
  console.log('【测试 2.10】其他类型日志归档');

  {
    const backupContent = '备份日志测试内容\n';
    fs.writeFileSync(path.join(logDir, 'backup_pj.log'), backupContent);

    const res = await httpDelete(`${base}/api/logs/backup`);
    assertEqual(res.body.success, true, 'backup 归档成功');

    const backupArchiveDir = path.join(archiveBaseDir, 'backup');
    assert(fs.existsSync(backupArchiveDir), 'backup 归档目录已创建');

    const backupArchives = fs.readdirSync(backupArchiveDir);
    assertEqual(backupArchives.length, 1, 'backup 有 1 个归档文件');

    const backupArchive = fs.readFileSync(path.join(backupArchiveDir, backupArchives[0]), 'utf-8');
    assertEqual(backupArchive, backupContent, 'backup 归档内容正确');
  }

  // --- 测试 2.11: 权限控制 ---
  console.log('');
  console.log('【测试 2.11】非管理员归档权限拒绝');

  {
    // 未登录用户
    const noAuthServer = await createTestServer(null);
    const noAuthRes = await httpDelete(`${noAuthServer.base}/api/logs/deploy`);
    assertEqual(noAuthRes.statusCode, 403, '未登录用户归档返回 403');
    assertEqual(noAuthRes.body.success, false, '未登录用户归档失败');
    assertContains(noAuthRes.body.error, '权限不足', '错误信息提示权限不足');
    noAuthServer.close();

    // ops_admin 用户
    const opsServer = await createTestServer({
      id: 'ops-user',
      username: 'opsadmin',
      role: 'ops_admin',
    });
    const opsRes = await httpDelete(`${opsServer.base}/api/logs/deploy`);
    assertEqual(opsRes.statusCode, 403, 'ops_admin 用户归档返回 403');
    assertEqual(opsRes.body.success, false, 'ops_admin 用户归档失败');
    opsServer.close();
  }

  // --- 汇总 ---
  adminServer.close();
  fs.rmSync(testDir, { recursive: true, force: true });

  console.log('');
  console.log('='.repeat(50));
  console.log(`测试完成: ${passed} 通过, ${failed} 失败, 共 ${total} 项`);
  console.log('='.repeat(50));

  process.exit(failed > 0 ? 1 : 0);
})();