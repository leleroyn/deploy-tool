<div align="center">

# 🚀 Deploy Tool

**一套面向运维场景的 Web 可视化发布平台**

将 Shell 运维脚本包装为完整的 Web 管理系统，无需登录服务器，即可在浏览器中完成应用部署、备份、端口检测等全套操作。

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-支持-2496ED?logo=docker&logoColor=white)](https://www.docker.com)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

</div>

---

## 📖 项目简介

Deploy Tool 将 4 个 Shell 运维脚本封装为一套完整的 **Web 管理平台**，核心理念是：

> **Shell 脚本零改动，Web 层仅作代理调用层。**  
> 所有实际操作仍由 `script/` 下的 Bash 脚本完成，后端通过 `child_process.spawn` 调用，保持脚本逻辑的可独立测试性。

无论是一键部署到多台服务器、备份远程应用目录、检测服务端口，还是查看历史操作日志，都可以通过浏览器完成。

---

## ✨ 功能特性

| 功能 | 描述 |
|------|------|
| 🖥️ **实时终端输出** | 所有操作通过 WebSocket 将 ANSI 彩色日志推送到前端 xterm.js 终端 |
| 🔒 **部署安全保护** | 部署前自动检测今日备份状态，未备份时禁用部署按钮，防止误操作丢失数据 |
| 📦 **部署包上传** | 支持拖拽上传 `.zip` / `.tar.gz` / `.tar`，压缩包自动解压；支持直接上传 `.jar` 等任意格式 |
| 🌐 **多服务器支持** | 单个项目可配置多台服务器，一次操作按顺序覆盖所有节点 |
| ⏱️ **任务队列** | 同一时间只允许一个任务运行，避免并发冲突 |
| ⚙️ **在线配置编辑** | 通过 Web 设置页直接编辑 `config.ini`，无需登录服务器 |
| 🐳 **Docker 一键部署** | 多阶段 Dockerfile 构建，单容器单端口，开箱即用 |
| 🔑 **JWT 认证** | 密码通过环境变量配置，无状态 JWT token 认证 |

---

## 🗺️ 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        浏览器 (Web 前端)                      │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │  登录页   │ │  仪表盘   │ │  部署页   │ │   备份页      │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
│  ┌──────────────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │   端口检测页       │ │  日志页  │ │     设置页        │   │
│  └──────────────────┘ └──────────┘ └──────────────────┘   │
│              │  HTTP REST API         │  WebSocket         │
└──────────────┼────────────────────────┼────────────────────┘
               ▼                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Node.js 后端 (Express)                     │
│                                                             │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │ 认证中间 │  │  路由层   │  │  任务队列 │  │ WebSocket │  │
│  │  件(JWT) │  │(projects │  │(taskRunne│  │  Server   │  │
│  └─────────┘  │ tasks,   │  │   r.ts)  │  │(wsServer) │  │
│               │ deploy,  │  └────┬─────┘  └─────┬─────┘  │
│               │ logs,ssh)│       │               │        │
│               └──────────┘       │  实时日志推送  │        │
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
│         └───────────────┼──────────────────┘               │
│                    读取 config.ini                           │
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

## 📋 功能流程图

```
部署流程：
  选择项目 → Preflight 检查 → 上传部署包(可选) → 执行部署
                  ↓                                    ↓
            检查今日备份状态                  打包 → scp上传 → SSH解压 → 重启服务
            未备份 → 禁用部署

备份流程：
  选择项目/全部 → 执行备份 → SSH到目标服务器 → tar打包 → 保存到 backup_dir

端口检测流程：
  选择项目/全部 → 执行检测 → SSH连接 → ss/netstat/nc 检测 → 返回 [✔]/[✘]
```

---

## 🗂️ 目录结构

```
deploy-tool/
├── script/                     ← Shell 脚本（可独立运行）
│   ├── config.ini              ← 项目配置文件（INI 格式）
│   ├── deploy.sh               ← 部署脚本
│   ├── backup_pj.sh            ← 备份脚本
│   ├── check_ports.sh          ← 端口检测脚本
│   └── deploy-tool-ui.sh       ← 交互式命令行菜单
├── server/                     ← 后端（Node.js + TypeScript）
│   └── src/
│       ├── index.ts            ← 入口，Express + WebSocket
│       ├── auth.ts             ← JWT 认证中间件
│       ├── config/
│       │   └── iniManager.ts   ← config.ini 读写封装
│       ├── routes/             ← REST API 路由
│       │   ├── auth.ts         ← POST /api/login
│       │   ├── projects.ts     ← GET /api/projects
│       │   ├── tasks.ts        ← 任务触发（部署/备份/端口检测）
│       │   ├── deploy.ts       ← Preflight / 文件上传 / 删除
│       │   ├── logs.ts         ← 历史日志读取
│       │   └── ssh.ts          ← SSH 配置读写
│       ├── tasks/
│       │   └── taskRunner.ts   ← 任务队列 + child_process 封装
│       └── ws/
│           └── wsServer.ts     ← WebSocket 实时日志推送
├── web/                        ← 前端（React 18 + Vite）
│   └── src/
│       ├── pages/              ← 页面组件
│       │   ├── LoginPage.tsx
│       │   ├── Dashboard.tsx
│       │   ├── DeployPage.tsx
│       │   ├── BackupPage.tsx
│       │   ├── PortCheckPage.tsx
│       │   ├── LogsPage.tsx
│       │   └── SettingsPage.tsx
│       ├── components/         ← 公共组件（终端、任务状态等）
│       ├── store/              ← Zustand 全局状态
│       ├── api/                ← HTTP + WebSocket 封装
│       └── types/              ← TypeScript 类型定义
├── Dockerfile                  ← 多阶段构建
├── docker-compose.yml          ← Docker 一键启动
└── README.md
```

---

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 后端运行时 | Node.js 20 + TypeScript |
| 后端框架 | Express 4 |
| 实时通信 | WebSocket (ws) |
| 文件上传 | multer |
| 前端框架 | React 18 |
| 构建工具 | Vite 5 |
| 样式 | Tailwind CSS 3 |
| 路由 | React Router v6 |
| 状态管理 | Zustand |
| 终端渲染 | xterm.js |
| 容器化 | Docker + Docker Compose |

---

## 🚀 快速开始

### 方式一：Docker 部署（推荐）

**前提：** 服务器已安装 Docker，且 `~/.ssh/id_rsa` 已配置并可 SSH 到目标服务器。

**第一步：克隆项目**

```bash
git clone https://github.com/your-username/deploy-tool.git
cd deploy-tool
```

**第二步：配置 config.ini**

```bash
# 编辑配置文件，填入你的项目信息
nano script/config.ini
```

配置示例：

```ini
[ssh]
user = root
key  = /root/.ssh/id_rsa

[my-app]
server      = 192.168.1.100,192.168.1.101   # 多台服务器用逗号分隔
remote_dir  = /opt/project/my-app
backup_dir  = /opt/backup
local_dir   = /path/to/local/build
restart_cmd = docker restart my-app
bind-port   = 8080,3306
```

**第三步：启动容器**

```bash
mkdir -p logs

docker run -d \
  --name deploy-tool \
  --restart unless-stopped \
  -p 3001:3001 \
  -u root \
  -e DEPLOY_PASSWORD=你的密码 \
  -e SCRIPT_DIR=/app/script \
  -e CONFIG_FILE=/app/config.ini \
  -e SKIP_SSH_INIT=1 \
  -e LOG_BASE_DIR=/app/logs \
  -v "$(pwd)/script/config.ini:/app/config.ini:ro" \
  -v "$(pwd)/script:/app/script:ro" \
  -v "/root/.ssh:/root/.ssh:ro" \
  -v "$(pwd)/logs:/app/logs" \
  leleroyn/deploy-tool:0.1
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

### config.ini 字段说明

| 字段 | 必填 | 说明 |
|------|------|------|
| `server` | ✅ | 目标服务器 IP，多台用逗号分隔 |
| `remote_dir` | ✅ | 远程应用目录 |
| `backup_dir` | ✅（备份时） | 远程备份存放路径 |
| `local_dir` | ✅（部署时） | 本地部署包所在目录 |
| `exclude` | ❌ | 打包时排除的路径，默认 `logs,log,tmp,temp,*.log` |
| `restart_cmd` | ❌ | 部署完成后在远程服务器执行的重启命令 |
| `bind-port` | ✅（端口检测） | 要检测的端口号，多个用逗号分隔 |

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DEPLOY_PASSWORD` | `admin123` | Web 登录密码 |
| `SCRIPT_DIR` | `../script` | Shell 脚本目录 |
| `CONFIG_FILE` | `${SCRIPT_DIR}/config.ini` | 配置文件路径 |
| `LOG_BASE_DIR` | `SCRIPT_DIR` | 日志存放目录 |
| `SKIP_SSH_INIT` | 未设置 | 设为 `1` 跳过 ssh-agent 初始化（Docker 必须设置） |

---

## 📡 API 文档

所有接口需携带 `Authorization: Bearer <token>` 请求头（登录接口除外）。

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/login` | 登录，返回 JWT token |
| `GET` | `/api/projects` | 获取项目列表 |
| `POST` | `/api/tasks/run` | 触发任务（deploy/backup/check_ports） |
| `GET` | `/api/tasks/:id` | 获取任务详情 |
| `GET` | `/api/deploy/preflight/:project` | 部署前检查 |
| `POST` | `/api/deploy/upload/:project` | 上传部署包 |
| `GET` | `/api/logs/:filename` | 获取历史日志 |
| `GET` | `/api/config/raw` | 获取配置文件内容 |
| `PUT` | `/api/config/raw` | 保存配置文件 |

### WebSocket 实时日志

```js
// 连接
const ws = new WebSocket('ws://host/ws')

// 订阅任务
ws.send(JSON.stringify({ type: 'subscribe', taskId: '<task-uuid>' }))

// 接收日志（data 为 ANSI 字符串，可直接写入 xterm.js）
// { type: 'log',      data: '\u001b[32m[✔] 部署成功\u001b[0m\r\n' }
// { type: 'complete', data: 'success' | 'failure' }
```

---

## 🐚 Shell 脚本独立使用

所有脚本均可脱离 Web 服务独立运行：

```bash
# 部署
./script/deploy.sh <项目名>
DRY_RUN=1 ./script/deploy.sh <项目名>    # 干跑模式

# 备份
./script/backup_pj.sh <项目名>
./script/backup_pj.sh all                 # 备份所有项目

# 端口检测
./script/check_ports.sh <项目名>
./script/check_ports.sh all

# 交互式菜单
./script/deploy-tool-ui.sh
```

---

## ❓ 常见问题

**Q：执行操作报退出码 255 / SSH 无响应**  
A：SSH agent 未在后端进程环境中生效。开发模式下，在启动后端的同一终端执行 `eval $(ssh-agent -s) && ssh-add`。

**Q：前端报 ECONNREFUSED 127.0.0.1:3001**  
A：后端未启动，检查是否看到 `Deploy Tool Server running on http://localhost:3001`。

**Q：上传压缩包后没有自动解压**  
A：容器内缺少 `unzip`，重新构建镜像：`docker compose up -d --build`。

**Q：修改 config.ini 后不生效（Docker 模式）**  
A：Docker 模式下配置文件直接挂载，内容修改立即生效；若修改了环境变量（如密码），需重建容器。

**Q：开放防火墙端口**

```bash
# Ubuntu/Debian
sudo ufw allow 3001

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=3001/tcp && sudo firewall-cmd --reload
```

---

## 📄 License

[MIT](LICENSE)

---

<div align="center">
  <sub>如有问题请提 <a href="https://github.com/your-username/deploy-tool/issues">Issue</a></sub>
</div>
