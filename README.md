<div align="center">

# 🚀 Deploy Tool

**一套面向运维场景的 Web 可视化发布平台**

将 Shell 运维脚本包装为完整的 Web 管理系统，无需登录服务器，即可在浏览器中完成应用部署、备份、端口检测、远程维护等全套操作。

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-支持-2496ED?logo=docker&logoColor=white)](https://www.docker.com)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

</div>

---

## 📖 项目简介

Deploy Tool 为一套完整的 **Web 管理平台**，核心理念是：

无论是一键部署到多台服务器、备份远程应用目录、检测服务端口，还是远程执行运维命令，都可以通过浏览器完成。所有操作通过 WebSocket 实时推送终端输出，操作日志自动记录可追溯。

---

## ✨ 功能特性

| 功能                 | 描述                                                             |
| ------------------ | -------------------------------------------------------------- |
| 🖥️ **实时终端输出**     | 所有操作通过 WebSocket 将日志实时推送到前端，执行过程可视化                            |
| 🔒 **部署安全保护**      | 部署前自动检测今日备份状态，未备份时禁用部署按钮，防止误操作丢失数据                             |
| 📦 **部署包上传**       | 支持拖拽上传 `.zip` / `.tar.gz` / `.tar`，压缩包自动解压；支持直接上传 `.jar` 等任意格式 |
| 🌐 **多服务器支持**      | 单个项目可配置多台服务器，一次操作按顺序覆盖所有节点                                     |
| ⏱️ **任务队列**        | 同一时间只允许一个任务运行，避免并发冲突，最多保留 100 条任务记录                            |
| 🔧 **远程维护**        | 预置运维命令分组管理，支持二次确认执行、执行记录展示、实时日志输出                              |
| ⚙️ **在线配置编辑**      | 通过 Web 设置页直接编辑 `config.toml`，无需登录服务器                           |
| 🐳 **Docker 一键部署** | 多阶段 Dockerfile 构建，单容器单端口，开箱即用                                  |
| 🔑 **JWT 认证**      | 密码通过环境变量配置，无状态 JWT token 认证                                    |
| 🔐 **双因素认证**      | 运维管理员强制启用 TOTP 双因素认证（Google Authenticator 等）                      |
| ⏰ **Session 管理**   | 关闭浏览器自动失效，最大 24 小时有效期                                            |
| 👤 **用户管理**        | 头像上传、密码修改、管理员可管理用户角色、账户状态（冻结/解冻）、OTP 重置                       |
| 📋 **日志历史**        | 任务记录与脚本日志统一展示，支持按类型筛选查看                                        |

---

## 🗺️ 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        浏览器 (Web 前端)                      │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │  登录页   │ │  仪表盘   │ │  部署页   │ │   备份页      │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │  端口检测 │ │ 远程维护 │ │  日志页  │ │     设置页    │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
│              │  HTTP REST API         │  WebSocket         │
└──────────────┼────────────────────────┼────────────────────┘
               ▼                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Node.js 后端 (Express)                     │
│                                                             │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │ 认证中间 │  │  路由层   │  │  任务队列 │  │ WebSocket │  │
│  │  件(JWT) │  │(projects │  │(taskQueue│  │  Server   │  │
│  └─────────┘  │ tasks,   │  │   .ts)   │  │(wsServer) │  │
│               │ deploy,  │  └────┬─────┘  └─────┬─────┘  │
│               │ logs,ssh,│       │               │        │
│               │ commands)│       │  实时日志推送  │        │
│               └──────────┘       │               │        │
│                         ┌────────▼───────────────▼──┐     │
│                         │   child_process.spawn()    │     │
│                         └────────────┬───────────────┘     │
└──────────────────────────────────────┼─────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Shell 脚本层 (script/)                     │
│                                                             │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────────┐    │
│  │  deploy.sh  │ │backup_pj.sh  │ │ check_ports.sh   │    │
│  │  (部署脚本) │ │  (备份脚本)  │ │  (端口检测脚本)  │    │
│  └──────┬──────┘ └──────┬───────┘ └────────┬─────────┘    │
│         │               │                  │               │
│  ┌──────┴───────────────┴──────────────────┴─────────┐    │
│  │          exec_remote_script.sh                     │    │
│  │              (远程维护脚本)                         │    │
│  └──────────────────────┬─────────────────────────────┘    │
│                    读取 config.toml                           │
└──────────────────────────┬──────────────────────────────────┘
                           │ SSH
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      目标服务器集群                           │
│                                                             │
│    Server 1              Server 2            Server N       │
│  192.168.1.10          192.168.1.11        192.168.1.x      │
│  [部署/备份/检测]      [部署/备份/检测]    [部署/备份/检测]  │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 功能说明

### 页面概览

| 页面   | 描述                                   |
| ---- | ------------------------------------ |
| 仪表盘  | 项目统计、快捷操作（备份/部署/检测/远程维护）、最近任务、项目列表   |
| 备份管理 | 选择项目或全部备份，查看今日备份状态，备份文件列表            |
| 部署管理 | 上传部署包、预检备份状态、一键部署到多服务器、实时终端输出        |
| 端口检测 | 检测项目配置的端口是否在远程服务器上监听，按服务器分组展示        |
| 远程维护 | 分组管理运维命令，支持二次确认执行、执行记录、实时输出          |
| 日志历史 | 任务记录表格 + 脚本日志文件查看（部署/备份/检测/远程维护/SSH） |
| 用户管理 | 个人资料管理（头像、密码）、管理员可管理用户角色与账户状态        |
| 系统设置 | 在线编辑 config.toml、SSH 配置管理            |

### 部署流程

```
选择项目 → Preflight 检查 → 上传部署包(可选) → 执行部署
                ↓                                    ↓
          检查今日备份状态                  打包 → scp上传 → SSH解压 → 重启服务
          未备份 → 禁用部署
```

### 备份流程

```
选择项目/全部 → 执行备份 → SSH到目标服务器 → tar打包 → 保存到 backup_dir
```

### 端口检测流程

```
选择项目/全部 → 执行检测 → SSH连接 → ss/netstat 检测 → 按服务器分组展示结果
```

### 远程维护流程

```
点击执行 → 二次确认 → 创建任务 → SSH执行命令 → 实时日志输出 → 记录历史
```

---

## 🚀 快速开始

### 方式一：Docker 部署（推荐）

**前提：** 服务器已安装 Docker，且 `~/.ssh/id_rsa` 已配置并可 SSH 到目标服务器。

**第一步：克隆项目**

```bash
git clone https://github.com/your-username/deploy-tool.git
cd deploy-tool
```

**第二步：配置 config.toml**

```bash
# 编辑配置文件，填入你的项目信息
nano config.toml
```

配置示例：

```toml
[ssh]
user = "root"
key = "/root/.ssh/id_rsa"

[deploy.my-app]
server = ["192.168.1.100", "192.168.1.101"]
remote_dir = "/opt/project/my-app"
backup_dir = "/opt/backup"
local_dir = "/path/to/local/build"
restart_cmd = "docker restart my-app"
bind-port = [8080, 3306]
exclude = ["logs", "log", "tmp", "temp", "*.log", "*.logs"]

[command."查看磁盘"]
server = ["192.168.1.100"]
command = "df -h"
group = "系统信息"

[command."查看内存"]
server = ["192.168.1.100"]
command = "free -m"
group = "系统信息"
```

**第三步：启动容器**

```bash
docker run -d \
  --name deploy-tool \
  --restart unless-stopped \
  -p 3001:3001 \
  -u root \
  -e DEPLOY_PASSWORD=默认密码 \ 
  -e SKIP_SSH_INIT=1 \
  -v "$(pwd)/config.toml:/app/config.toml" \
  -v "$(pwd)/script:/app/script:ro" \
  -v "/root/.ssh:/root/.ssh:ro" \
  -v "$(pwd)/logs:/app/logs" \
  leleroyn/deploy-tool:0.1.5
```

**浏览器访问：** `http://服务器IP:3001`

---

### 方式二：本地开发环境（WSL）

**前提：** WSL（Ubuntu 24.04）中已安装 Node.js 18+。

```bash
# 终端一：启动后端（必须在同一终端加载 SSH 密钥）
eval $(ssh-agent -s)
ssh-add ~/.ssh/id_rsa
cd server && npm install && npm run dev   # 端口 3001

# 终端二：启动前端
cd web && npm install && npm run dev      # 端口 5173
```

浏览器访问：`http://localhost:5173`，默认密码：`admin123`

---

## ⚙️ 配置说明

### config.toml 字段说明

| 字段            | 必填      | 说明                                                                |
| ------------- | ------- | ----------------------------------------------------------------- |
| `server`      | ✅       | 目标服务器 IP 数组，如 `["192.168.1.100"]`                                 |
| `remote_dir`  | ✅       | 远程应用目录                                                            |
| `backup_dir`  | ✅（备份时）  | 远程备份存放路径                                                          |
| `local_dir`   | ✅（部署时）  | 本地部署包所在目录                                                         |
| `exclude`     | ❌       | 打包时排除的路径数组，默认 `["logs", "log", "tmp", "temp", "*.log", "*.logs"]` |
| `restart_cmd` | ❌       | 部署完成后在远程服务器执行的重启命令                                                |
| `bind-port`   | ✅（端口检测） | 要检测的端口号数组，如 `[8080, 3306]`                                        |

### 远程维护命令配置

| 字段        | 必填  | 说明                      |
| --------- | --- | ----------------------- |
| `server`  | ✅   | 目标服务器 IP 数组             |
| `command` | ✅   | 要执行的远程命令                |
| `group`   | ❌   | 命令分组名称，用于前端分类展示，默认"未分组" |

### 环境变量

| 变量名                  | 说明                            |
| -------------------- | ----------------------------- |
| `DEPLOY_PASSWORD`    | 登录密码（必填）                      |
| `PORT`               | 后端服务端口，默认 `3001`              |
| `SCRIPT_DIR`         | 脚本目录，默认 `/app/script`         |
| `CONFIG_FILE`        | 配置文件路径，默认 `/app/config.toml`  |
| `LOG_BASE_DIR`       | 日志目录，默认 `/app/logs`           |
| `SKIP_SSH_INIT`      | 跳过脚本内 ssh-agent 初始化，设为 `1`    |
| `OTP_ENCRYPTION_KEY`  | TOTP 密钥加密密钥（64位十六进制字符串）      |

### 双因素认证（TOTP）

运维管理员（`ops_admin`）登录时必须使用双因素认证：

**首次使用：**

1. 运维管理员首次登录后，会提示绑定双因素认证
2. 使用 Google Authenticator、Microsoft Authenticator 等 TOTP 应用扫描二维码
3. 输入应用显示的 6 位验证码完成绑定

**日常使用：**

1. 输入用户名和密码后，还需要输入 TOTP 验证码

**系统管理员（`system_admin`）不受此限制**，可以直接登录。

**恢复方式：**

如果运维管理员无法获取验证码（如手机丢失），系统管理员可以在用户管理页面重置该用户的双因素认证。

**生成 OTP_ENCRYPTION_KEY：**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Docker 部署时添加该环境变量：

```bash
docker run -d \
  --name deploy-tool \
  -e OTP_ENCRYPTION_KEY=your-generated-key \
  ...
```

---

## 📂 项目结构

```
deploy-tool/
├── config.toml                # 项目配置（TOML 格式）
├── script/                    # Shell 脚本
│   ├── deploy.sh             # 部署脚本
│   ├── backup_pj.sh          # 备份脚本
│   ├── check_ports.sh        # 端口检测脚本
│   └── exec_remote_script.sh # 远程维护脚本
├── server/                    # 后端服务
│   ├── src/
│   │   ├── config/           # 配置管理（TOML 读写）
│   │   ├── routes/           # API 路由
│   │   │   ├── auth.ts       # 认证
│   │   │   ├── users.ts      # 用户管理
│   │   │   ├── projects.ts   # 项目管理
│   │   │   ├── tasks.ts      # 任务创建
│   │   │   ├── deploy.ts     # 部署/上传
│   │   │   ├── commands.ts   # 远程维护命令
│   │   │   ├── logs.ts       # 日志查询
│   │   │   └── ssh.ts        # SSH 配置
│   │   ├── tasks/            # 任务队列
│   │   │   ├── taskQueue.ts  # 队列管理
│   │   │   └── scriptRunner.ts # 脚本执行
│   │   ├── ws/               # WebSocket
│   │   └── index.ts          # 入口
│   └── package.json
├── web/                       # 前端应用
│   ├── src/
│   │   ├── pages/            # 页面组件
│   │   │   ├── Dashboard.tsx
│   │   │   ├── DeployPage.tsx
│   │   │   ├── BackupPage.tsx
│   │   │   ├── PortCheckPage.tsx
│   │   │   ├── RemoteMaintenancePage.tsx
│   │   │   ├── LogsPage.tsx
│   │   │   ├── UserManagementPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   ├── components/       # 通用组件
│   │   ├── api/              # API 客户端
│   │   └── types.ts          # 类型定义
│   └── package.json
└── Dockerfile
```

---

## 📄 License

[MIT](LICENSE)

---

<div align="center">
  <sub>如有问题请提 <a href="https://github.com/your-username/deploy-tool/issues">Issue</a></sub>
</div>


