#!/usr/bin/env node
/**
 * TOML 配置解析工具
 * 为 shell 脚本提供 TOML 文件解析能力，替代 toml CLI
 * 依赖 @iarna/toml，从 /app/node_modules（Docker）或 script/node_modules（本地）加载
 *
 * 用法:
 *   node _toml_parse.js get <config_file> <dotted.path>    - 获取某个值
 *   node _toml_parse.js keys <config_file> <section>       - 获取某个 section 的所有键名
 *
 * 示例:
 *   node _toml_parse.js get config.toml ssh.user           → root
 *   node _toml_parse.js get config.toml deploy.银行网关接口.server → 192.168.2.59,192.168.2.60
 *   node _toml_parse.js keys config.toml deploy             → 银行网关接口 银行网关定时任务 ...
 *   node _toml_parse.js keys config.toml command            → 备份ZBANK数据库 自定义脚本1 ...
 */

const fs = require('fs');
const path = require('path');

// 从 /app/node_modules（Docker）或 script/node_modules（本地开发）加载
const modulePaths = [
  path.join('/app', 'node_modules'),
  path.join(__dirname, 'node_modules'),
];
let TOML;
for (const mp of modulePaths) {
  try {
    TOML = require(path.join(mp, '@iarna/toml'));
    break;
  } catch (_) {
    // continue
  }
}
if (!TOML) {
  process.exit(1);
}

const args = process.argv.slice(2);
const mode = args[0];
const configFile = args[1];

if (!configFile || !fs.existsSync(configFile)) {
  process.exit(1);
}

const content = fs.readFileSync(configFile, 'utf-8');
let data;
try {
  data = TOML.parse(content);
} catch (e) {
  process.exit(1);
}

if (mode === 'get') {
  // node _toml_parse.js get config.toml deploy.银行网关接口.server
  const dotPath = args[2];
  if (!dotPath) { process.exit(1); return; }

  const keys = dotPath.split('.');
  let val = data;
  for (const k of keys) {
    if (val === undefined || val === null) { process.exit(1); return; }
    val = val[k];
  }

  if (val === undefined || val === null) {
    process.exit(1);
    return;
  }

  if (Array.isArray(val)) {
    console.log(val.join(','));
  } else {
    console.log(String(val));
  }

} else if (mode === 'keys') {
  // node _toml_parse.js keys config.toml deploy
  const section = args[2];
  if (!section || !data[section]) { process.exit(1); return; }

  const keys = Object.keys(data[section]).sort();
  if (keys.length > 0) {
    console.log(keys.join('\n'));
  }

} else {
  process.exit(1);
}
