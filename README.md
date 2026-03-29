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

Deploy Tool 为一套完整的 **Web 管理平台**，核心理念是：

无论是一键部署到多台服务器、备份远程应用目录、检测服务端口，还是查看历史操作日志，都可以通过浏览器完成。

---

## ✨ 功能特性

| 功能                 | 描述                                                             |
| ------------------ | -------------------------------------------------------------- |
| 🖥️ **实时终端输出**     | 所有操作通过 WebSocket 将 ANSI 彩色日志推送到前端 xterm.js 终端                  |
| 🔒 **部署安全保护**      | 部署前自动检测今日备份状态，未备份时禁用部署按钮，防止误操作丢失数据                             |
| 📦 **部署包上传**       | 支持拖拽上传 `.zip` / `.tar.gz` / `.tar`，压缩包自动解压；支持直接上传 `.jar` 等任意格式 |
| 🌐 **多服务器支持**      | 单个项目可配置多台服务器，一次操作按顺序覆盖所有节点                                     |
| ⏱️ **任务队列**        | 同一时间只允许一个任务运行，避免并发冲突                                           |
| ⚙️ **在线配置编辑**      | 通过 Web 设置页直接编辑 `config.ini`，无需登录服务器                            |
| 🐳 **Docker 一键部署** | 多阶段 Dockerfile 构建，单容器单端口，开箱即用                                  |
| 🔑 **JWT 认证**      | 密码通过环境变量配置，无状态 JWT token 认证                                    |

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
docker run -d \
  --name deploy-tool \
  --restart unless-stopped \
  -p 3001:3001 \
  -u root \
  -e DEPLOY_PASSWORD=你的密码 \
  -e SCRIPT_DIR=/app/script \
  -e CONFIG_FILE=/app/config.ini \
  -e SKIP_SSH_INIT=1 \
  -v "$(pwd)/script/config.ini:/app/config.ini:ro" \
  -v "$(pwd)/script:/app/script:ro" \
  -v "/root/.ssh:/root/.ssh:ro" \
  leleroyn/deploy-tool:0.1.4
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

| 字段            | 必填      | 说明                                    |
| ------------- | ------- | ------------------------------------- |
| `server`      | ✅       | 目标服务器 IP，多台用逗号分隔                      |
| `remote_dir`  | ✅       | 远程应用目录                                |
| `backup_dir`  | ✅（备份时）  | 远程备份存放路径                              |
| `local_dir`   | ✅（部署时）  | 本地部署包所在目录                             |
| `exclude`     | ❌       | 打包时排除的路径，默认 `logs,log,tmp,temp,*.log` |
| `restart_cmd` | ❌       | 部署完成后在远程服务器执行的重启命令                    |
| `bind-port`   | ✅（端口检测） | 要检测的端口号，多个用逗号分隔                       |

### 📄 License

[MIT](LICENSE)

---

<div align="center">
  <sub>如有问题请提 <a href="https://github.com/your-username/deploy-tool/issues">Issue</a></sub>
</div>
