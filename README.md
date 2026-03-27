# 项目自助发布平台 · Deploy Tool

> 一套面向运维场景的 **Web 管理平台 + Shell 脚本工具集**，支持项目部署、服务器备份、端口健康检测，提供可视化操作界面与实时终端日志输出。

---

## 目录

- [项目概述](#项目概述)
- [功能特性](#功能特性)
- [目录结构](#目录结构)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
  - [开发环境（WSL）](#开发环境wsl)
  - [生产环境（Docker）](#生产环境docker)
- [配置说明](#配置说明)
  - [config.ini 配置文件](#configini-配置文件)
  - [环境变量](#环境变量)
- [功能页面详解](#功能页面详解)
  - [登录页](#登录页)
  - [仪表盘](#仪表盘)
  - [部署页](#部署页)
  - [备份页](#备份页)
  - [端口检测页](#端口检测页)
  - [日志历史页](#日志历史页)
  - [设置页](#设置页)
- [Shell 脚本说明](#shell-脚本说明)
  - [deploy.sh](#deploysh)
  - [backup_pj.sh](#backup_pjsh)
  - [check_ports.sh](#check_portssh)
- [后端 API](#后端-api)
- [WebSocket 实时日志](#websocket-实时日志)
- [SSH 认证机制](#ssh-认证机制)
- [常见问题](#常见问题)

---

## 项目概述

本项目将原有的 4 个 Shell 运维脚本包装为完整的 **Web 管理平台**，无需登录服务器即可在浏览器中完成：

- 一键部署应用到一台或多台远程服务器
- 备份远程服务器上的应用目录
- 检测远程服务器上指定端口是否监听
- 查看历史操作日志

**核心设计原则：Shell 脚本零改动，Web 层仅作代理调用层。** 所有实际操作仍由 `script/` 下的 Bash 脚本完成，后端通过 `child_process.spawn` 调用，保持脚本逻辑的可独立测试性。

---

## 功能特性

- **实时终端输出**：所有操作通过 WebSocket 将 ANSI 彩色日志推送到前端 xterm.js 终端，与直接在终端操作体验一致
- **任务队列**：同一时间只允许一个任务运行，避免并发冲突
- **部署前检查（Preflight）**：部署前自动检测今日备份状态，未备份时禁用部署按钮，防止误操作丢失数据
- **部署包上传与自动解压**：支持拖拽上传 `.zip` / `.tar.gz` / `.tar` 压缩包，上传后自动解压到 `local_dir`，也支持直接上传 `.jar` 等任意格式
- **多服务器支持**：单个项目可配置多台服务器，一次操作按顺序覆盖所有节点
- **登录认证**：密码通过环境变量 `DEPLOY_PASSWORD` 配置，JWT token 存于 localStorage，无状态认证
- **Docker 一键部署**：多阶段 Dockerfile 构建，单容器单端口，配置文件与脚本通过 volume 挂载，不打包进镜像
- **在线配置编辑**：通过设置页直接编辑 `config.ini`，无需登录服务器

---

## 目录结构

```
deploy-tool/
├── script/                   ← Shell 脚本（不建议随意改动）
│   ├── config.ini            ← 项目配置文件（INI 格式）
│   ├── deploy.sh             ← 部署脚本
│   ├── backup_pj.sh          ← 备份脚本
│   ├── check_ports.sh        ← 端口检测脚本
│   └── deploy-tool-ui.sh     ← 交互式菜单（命令行用）
├── server/                   ← 后端（Node.js + TypeScript）
│   └── src/
│       ├── index.ts          ← 入口，Express 服务 + WebSocket
│       ├── auth.ts           ← 登录认证中间件
│       ├── types.ts          ← 共用类型定义
│       ├── config/
│       │   └── iniManager.ts ← config.ini 读写封装
│       ├── routes/
│       │   ├── auth.ts       ← POST /api/login
│       │   ├── projects.ts   ← GET /api/projects
│       │   ├── tasks.ts      ← 任务触发（部署/备份/端口检测）
│       │   ├── deploy.ts     ← 部署前检查 / 文件上传 / 文件删除
│       │   ├── logs.ts       ← 历史日志读取
│       │   └── ssh.ts        ← SSH 配置读写
│       ├── tasks/
│       │   └── taskRunner.ts ← 任务队列与 child_process 封装
│       └── ws/
│           └── wsServer.ts   ← WebSocket 服务，推送任务日志
├── web/                      ← 前端（React 18 + Vite + Tailwind CSS）
│   └── src/
│       ├── pages/
│       │   ├── LoginPage.tsx
│       │   ├── Dashboard.tsx
│       │   ├── DeployPage.tsx
│       │   ├── BackupPage.tsx
│       │   ├── PortCheckPage.tsx
│       │   ├── LogsPage.tsx
│       │   └── SettingsPage.tsx
│       ├── components/       ← 公共组件（终端输出、任务状态等）
│       ├── store/            ← Zustand 全局状态
│       ├── api/              ← HTTP + WebSocket 封装
│       └── types/            ← TypeScript 类型定义
├── Dockerfile                ← 多阶段构建
├── docker-compose.yml        ← Docker 一键部署
├── .dockerignore
└── 启动说明.md               ← 详细启动指引
```

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端运行时 | Node.js 20 + TypeScript |
| 后端框架 | Express 4 |
| 实时通信 | ws（原生 WebSocket） |
| 文件上传 | multer |
| INI 解析 | ini |
| 前端框架 | React 18 |
| 构建工具 | Vite 5 |
| 样式 | Tailwind CSS 3 |
| 路由 | React Router v6 |
| 状态管理 | Zustand |
| 终端渲染 | @xterm/xterm |
| 图标 | lucide-react |
| 容器化 | Docker + Docker Compose |

---

## 快速开始

### 开发环境（WSL）

**前提条件：** WSL（Ubuntu 24.04）中已安装 Node.js 18+。

**第一步：加载 SSH 密钥**

> 必须在启动后端的**同一个终端**里执行，否则后端无法继承 `SSH_AUTH_SOCK`，脚本调用会报错（退出码 255）。

```bash
eval $(ssh-agent -s)
ssh-add /home/ubuntu/.ssh/id_rsa
```

**第二步：启动后端**（在同一终端继续执行）

```bash
cd /mnt/f/软件项目/deploy-tool/server
npm install        # 首次运行
npm run dev        # 开发模式，端口 3001
```

**第三步：启动前端**（新开一个终端）

```bash
cd /mnt/f/软件项目/deploy-tool/web
npm install        # 首次运行
npm run dev        # 开发模式，端口 5173
```

**第四步：浏览器访问**

```
http://localhost:5173
```

默认密码：`admin123`（通过环境变量 `DEPLOY_PASSWORD` 修改）

---

### 生产环境（Docker）

**前提条件：** 服务器已安装 Docker 和 Docker Compose。

**第一步：上传项目文件到服务器**

```bash
scp -r /path/to/deploy-tool root@your-server-ip:/opt/deploy-tool
```

**第二步：修改访问密码**

编辑 `docker-compose.yml`，将 `DEPLOY_PASSWORD=admin123` 改为自定义密码。

**第三步：配置 SSH 密钥**

确保服务器上 `~/.ssh/id_rsa` 存在，且已将公钥复制到所有目标服务器：

```bash
ssh-copy-id root@目标服务器IP
```

`docker-compose.yml` 已配置将 `~/.ssh` 挂载到容器内，无需额外操作。

**第四步：构建并启动**

```bash
cd /opt/deploy-tool
docker compose up -d --build
```

**浏览器访问：**

```
http://服务器IP:3001
```

**常用管理命令：**

```bash
docker compose ps           # 查看状态
docker compose logs -f      # 实时日志
docker compose restart      # 重启（config.ini 修改后生效）
docker compose up -d --build  # 更新代码后重新构建
docker compose down         # 停止并移除容器
```

---

## 配置说明

### config.ini 配置文件

位于 `script/config.ini`，INI 格式，包含全局 SSH 配置和每个项目的配置段。

```ini
[ssh]
user = root                         # SSH 登录用户名
key  = /home/ubuntu/.ssh/id_rsa     # SSH 私钥路径（留空则不使用私钥）

[bankgw-api]
server      = 192.168.2.228         # 目标服务器 IP，多台用逗号分隔
remote_dir  = /opt/project/bankgw/bankgw-api   # 远程部署目录
backup_dir  = /opt/project/backup              # 远程备份存放目录
local_dir   = /mnt/d/项目/git/bankgw/bankgw-api/target/bankgw-api  # 本地源目录
exclude     = logs,log,tmp,temp,*.log,*.logs   # 打包/备份时排除的文件模式
restart_cmd = docker restart bankgw-api        # 部署后执行的重启命令（可选）
bind-port   = 7102                             # 端口检测时要检查的端口，多个用逗号分隔
```

**字段说明：**

| 字段 | 必填 | 说明 |
|------|------|------|
| `server` | 是 | 目标服务器 IP，支持逗号分隔多台 |
| `remote_dir` | 是（部署/备份） | 远程应用目录 |
| `backup_dir` | 是（备份） | 远程备份存放路径 |
| `local_dir` | 是（部署） | 本地部署包所在目录 |
| `exclude` | 否 | 打包时排除的路径/文件模式，默认 `logs,log,tmp,temp,*.log,*.logs` |
| `restart_cmd` | 否 | 部署完成后在远程服务器执行的命令 |
| `bind-port` | 是（端口检测） | 要检测的端口号，支持逗号分隔多个 |

> 配置文件支持在 Web 界面的**设置页**直接编辑，修改后立即生效（Docker 部署模式下需 `docker compose restart`）。

---

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DEPLOY_PASSWORD` | `admin123` | Web 界面登录密码 |
| `SCRIPT_DIR` | `../script`（相对后端） | Shell 脚本目录路径 |
| `CONFIG_FILE` | `${SCRIPT_DIR}/config.ini` | 配置文件路径 |
| `SKIP_SSH_INIT` | 未设置 | 设为 `1` 则跳过脚本内部 ssh-agent 初始化（Docker 模式必须设置） |
| `SSH_AUTH_SOCK` | 继承自宿主机 | SSH agent 套接字路径（开发模式需手动 `eval $(ssh-agent -s)` 后继承） |

---

## 功能页面详解

### 登录页

访问任意页面时若未登录，自动跳转到登录页。输入密码后后端验证并返回 JWT token，存储在 localStorage，有效期内无需重新登录。

---

### 仪表盘

展示系统整体概览：

- 已配置的项目数量
- 正在运行的任务数量
- 各项目最近一次操作的状态摘要
- 后端服务连接状态（WebSocket 心跳检测）

---

### 部署页

**工作流程：**

1. 选择项目
2. 系统自动执行**部署前检查（Preflight）**：
   - 读取备份日志，检测今日是否已成功备份所有服务器
   - 列出 `local_dir` 目录下当前的文件清单
3. 若今日未备份，「执行部署」按钮禁用，提示先完成备份
4. 若已备份，可直接点击「执行部署」，日志实时推送到终端
5. 也可先通过**上传部署包**区域上传新的构建产物再部署

**上传部署包：**

- 支持拖拽或点击上传
- `.zip` / `.tar.gz` / `.tgz` / `.tar`：上传后**自动解压**到 `local_dir`，原压缩包删除
- 其他格式（如 `.jar`）：直接保存到 `local_dir`，不做解压
- 上传大小限制：500MB
- 已上传的文件列表支持单独删除

**部署过程（`deploy.sh` 执行步骤）：**

1. 将 `local_dir` 下的文件打包为 `tar.gz`（自动排除配置的 exclude 模式）
2. 通过 `scp` 上传到目标服务器的 `/tmp/` 目录
3. SSH 到服务器执行远程解压，将内容解压到 `remote_dir`
4. 删除服务器上的临时压缩包
5. 执行 `restart_cmd`（如果配置了的话）

---

### 备份页

**工作流程：**

1. 选择项目（或选择「所有项目」批量备份）
2. 点击「执行备份」，日志实时推送到终端

**备份过程（`backup_pj.sh` 执行步骤）：**

1. SSH 到目标服务器
2. 在服务器上将 `remote_dir` 打包为 `tar.gz`，文件名格式：`<项目名>_<时间戳>.tar.gz`
3. 备份文件保存到服务器的 `backup_dir` 目录
4. 输出备份文件大小
5. 多台服务器时按顺序逐一备份

> 备份文件保留在**远程服务器**上，不会下载到本地。

---

### 端口检测页

**工作流程：**

1. 选择项目（或选择「所有项目」批量检测）
2. 点击「执行检测」，日志实时推送到终端

**检测过程（`check_ports.sh` 执行步骤）：**

1. SSH 到目标服务器
2. 依次检查 `bind-port` 中配置的每个端口是否处于监听状态
3. 检测方式：优先用 `ss`，回退到 `netstat`，最后尝试 `nc -z`
4. 每个端口显示 `[✔]` 或 `[✘]`
5. 连接超时设置为 5 秒

---

### 日志历史页

读取 `script/` 目录下的 `.log` 文件，展示历史操作记录：

- `deploy.log`：部署操作历史
- `backup_pj.log`：备份操作历史
- `check_ports.log`：端口检测历史

日志格式：`[YYYY-MM-DD HH:MM:SS] [INFO/ERROR] 操作描述`

---

### 设置页

- **SSH 配置**：查看和修改 `config.ini` 中 `[ssh]` 节的 `user` 和 `key` 字段
- **项目管理**：查看所有项目配置，支持新增、编辑、删除项目段
- **配置文件编辑**：直接编辑原始 `config.ini` 内容并保存

---

## Shell 脚本说明

所有脚本均位于 `script/` 目录，独立可用，不依赖 Web 服务。

### deploy.sh

```bash
# 部署单个项目
./script/deploy.sh <项目名>

# 干跑模式（只打印命令，不实际执行）
DRY_RUN=1 ./script/deploy.sh <项目名>
```

**执行逻辑：**

1. 读取 `config.ini` 中项目的 `server`、`local_dir`、`remote_dir`、`exclude`、`restart_cmd`
2. 遍历所有服务器，对每台服务器依次执行：打包 → scp 上传 → SSH 解压 → 清理临时文件 → 执行重启命令
3. 任意步骤失败则跳过当前服务器，继续处理下一台
4. 退出码：全部成功为 `0`，任意失败为 `1`

---

### backup_pj.sh

```bash
# 备份单个项目
./script/backup_pj.sh <项目名>

# 备份所有项目
./script/backup_pj.sh all
```

**执行逻辑：**

1. 读取 `config.ini` 中项目的 `server`、`remote_dir`、`backup_dir`、`exclude`
2. 遍历所有服务器，SSH 到每台服务器执行 `tar` 打包，将 `remote_dir` 备份到 `backup_dir`
3. 备份文件名：`<项目名>_<YYYYMMDD_HHMMSS>.tar.gz`（不含服务器 IP，同一时间戳文件名相同）
4. 输出备份文件路径和大小（通过 `du -h` 获取）
5. 退出码：全部成功为 `0`，任意失败为 `1`

---

### check_ports.sh

```bash
# 检测单个项目的端口
./script/check_ports.sh <项目名>

# 检测所有项目的端口
./script/check_ports.sh all
```

**执行逻辑：**

1. 读取 `config.ini` 中项目的 `server`、`bind-port`
2. 遍历所有服务器，对每个端口通过 SSH 远程检测是否处于 LISTEN 状态
3. 检测命令（按优先级）：`ss -tln` → `netstat -tln` → `nc -z 127.0.0.1 <port>`
4. SSH 连接超时 5 秒
5. 退出码：全部成功为 `0`，任意失败为 `1`

---

## 后端 API

所有接口需携带登录后获得的 `Authorization: Bearer <token>` 请求头（登录接口本身除外）。

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/login` | 登录，返回 JWT token |
| `GET` | `/api/projects` | 获取所有项目列表 |
| `GET` | `/api/projects/:name` | 获取单个项目配置 |
| `POST` | `/api/tasks/run` | 触发任务（部署/备份/端口检测） |
| `GET` | `/api/tasks` | 获取任务列表 |
| `GET` | `/api/tasks/:id` | 获取单个任务详情 |
| `GET` | `/api/deploy/preflight/:project` | 部署前检查（备份状态 + 文件列表） |
| `POST` | `/api/deploy/upload/:project` | 上传部署包（自动解压压缩包） |
| `DELETE` | `/api/deploy/files/:project/:filename` | 删除 local_dir 下的指定文件 |
| `GET` | `/api/logs` | 获取日志文件列表 |
| `GET` | `/api/logs/:filename` | 获取指定日志文件内容 |
| `GET` | `/api/ssh` | 获取 SSH 配置 |
| `PUT` | `/api/ssh` | 更新 SSH 配置 |
| `GET` | `/api/config/raw` | 获取原始 config.ini 内容 |
| `PUT` | `/api/config/raw` | 保存原始 config.ini 内容 |

**触发任务的请求体示例：**

```json
{
  "type": "deploy",
  "project": "bankgw-api"
}
```

`type` 可选值：`deploy` / `backup` / `check_ports`

---

## WebSocket 实时日志

连接地址：`ws://<host>/ws`

连接成功后发送订阅消息：

```json
{ "type": "subscribe", "taskId": "<task-uuid>" }
```

服务端推送消息格式：

```json
{ "type": "log",      "data": "\u001b[32m[✔] 部署成功\u001b[0m\r\n" }
{ "type": "complete", "data": "success" }
{ "type": "complete", "data": "failure" }
```

`log` 消息中的 `data` 为带 ANSI 转义码的原始终端字符串，可直接写入 xterm.js。

---

## SSH 认证机制

**开发模式（WSL）：**

后端通过 `child_process.spawn` 调用 Shell 脚本时，会传入宿主进程的 `SSH_AUTH_SOCK` 和 `SSH_AGENT_PID` 环境变量，使脚本能访问已加载密钥的 ssh-agent。同时设置 `SKIP_SSH_INIT=1`，避免脚本内部再次初始化 ssh-agent（会产生冲突）。

因此**必须**在启动后端的同一终端里先执行 `eval $(ssh-agent -s) && ssh-add`，否则环境变量无法被后端继承。

**Docker 模式：**

宿主机的 `~/.ssh` 目录以只读方式挂载到容器内 `/home/deploy/.ssh`，容器以非 root 用户 `deploy` 运行。`SKIP_SSH_INIT=1` 环境变量在 `docker-compose.yml` 中已预设，脚本会直接使用 `-i` 参数指定私钥进行 SSH 连接，无需 ssh-agent。

---

## 常见问题

**Q：执行操作报退出码 255 / SSH 无响应**

原因：SSH agent 未在后端进程环境中生效。开发模式下，停掉后端，在同一终端重新执行 `eval $(ssh-agent -s)` → `ssh-add` → `npm run dev`。

**Q：前端报 ECONNREFUSED 127.0.0.1:3001**

原因：后端未启动或端口未监听。检查后端终端是否显示 `Deploy Tool Server running on http://localhost:3001`。

**Q：终端输出乱码（`─` 等字符显示为方块）**

原因：xterm.js 所用字体不支持 Unicode 制表符。前端已配置引入 `Noto Sans Mono`（Google Fonts）作为首选字体，确保网络可访问 Google Fonts 服务。内网环境可将字体文件本地化后修改 `index.html` 引用。

**Q：上传压缩包后文件没有解压**

原因：容器内缺少 `unzip` 命令（`.zip` 格式需要）。Dockerfile 已包含 `RUN apk add --no-cache openssh-client bash unzip`，重新构建镜像后解决：`docker compose up -d --build`。

**Q：修改 config.ini 后不生效**

Docker 模式下 `config.ini` 是挂载进容器的，修改文件内容后需要执行 `docker compose restart` 让容器重新读取。

**Q：想更换 Web 访问端口**

编辑 `docker-compose.yml` 中的 `ports` 配置，将 `"3001:3001"` 改为 `"<新端口>:3001"`，然后 `docker compose up -d --build`。

**Q：端口 3001 被防火墙拦截**

```bash
# Ubuntu/Debian（ufw）
sudo ufw allow 3001

# CentOS/RHEL（firewalld）
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --reload
```
