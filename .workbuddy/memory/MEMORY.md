# MEMORY.md - Deploy Tool 项目长期记忆

## 项目概述
deploy-tool 是一套运维脚本工具集，位于 f:\软件项目\deploy-tool\

## Docker 部署（2026-03-27 完成）
- 多阶段 Dockerfile：阶段一构建前端，阶段二编译后端 TS，阶段三最小生产镜像（node:20-alpine）
- 前端 build 产物由后端 express.static 托管，单容器单端口 3001
- config.ini 和 script/ 目录通过 volume 挂载，不打包进镜像
- **生产部署用 docker run（不用 docker compose）**，以 root 用户运行（-u root）
- SSH 密钥挂载：`/root/.ssh:/root/.ssh:ro`，config.ini 里 `key = /root/.ssh/id_rsa`
- 日志目录：宿主机提前 `mkdir -p logs`，挂载 `./logs:/app/logs`，ENV LOG_BASE_DIR=/app/logs
- 支持环境变量：DEPLOY_PASSWORD / SCRIPT_DIR / CONFIG_FILE / SKIP_SSH_INIT / LOG_BASE_DIR
- 完整启动命令：
  ```bash
  mkdir -p logs
  docker run -d --name deploy-tool --restart unless-stopped -p 3001:3001 -u root \
    -e DEPLOY_PASSWORD=密码 -e SCRIPT_DIR=/app/script -e CONFIG_FILE=/app/config.ini \
    -e SKIP_SSH_INIT=1 -e LOG_BASE_DIR=/app/logs \
    -v "$(pwd)/script/config.ini:/app/config.ini:ro" \
    -v "$(pwd)/script:/app/script:ro" \
    -v "/root/.ssh:/root/.ssh:ro" \
    -v "$(pwd)/logs:/app/logs" \
    leleroyn/deploy-tool:0.1
  ```


- 将原 Shell 脚本改造为 Web 管理平台
- 后端：server/ 目录，Node.js + Express + TypeScript，端口 3001
- 前端：web/ 目录，React 18 + Vite + Tailwind CSS，端口 5173（代理 /api 到 3001）
- 原 script/ 目录脚本保持不变，后端通过 child_process.spawn 调用
- 已加登录认证：密码通过环境变量 DEPLOY_PASSWORD 配置（默认 admin123），token 存 localStorage
- 项目名称：「项目自助发布平台」

## 启动方式（WSL Ubuntu-24.04）

**关键：必须在启动后端的同一终端里先加载 SSH 密钥，否则脚本调用会报 exitCode=255。**

```bash
# 终端一（后端，含 SSH agent）
eval $(ssh-agent -s)
ssh-add /home/ubuntu/.ssh/id_rsa
cd /mnt/f/软件项目/deploy-tool/server && npm run dev

# 终端二（前端）
cd /mnt/f/软件项目/deploy-tool/web && npm run dev
```

WSL 路径：/mnt/f/软件项目/deploy-tool

## 已知 Bug 修复记录
- WebSocket 直连 3001 绕过 Vite 代理 → 改为 ws://${window.location.host}/ws
- 后端 listen 改为 0.0.0.0 避免 IPv6/IPv4 不一致
- scriptRunner 传入 SSH_AUTH_SOCK/SSH_AGENT_PID + SKIP_SSH_INIT=1，跳过脚本内部 ssh-agent 初始化

## 技术栈
- 后端：Express, ws, ini, uuid, ts-node-dev
- 前端：React Router, Zustand, @xterm/xterm, Tailwind CSS 3.4.17
- 设计：企业级后台风格，深蓝侧边栏(#001529) + 蓝色顶栏(#1677FF) + 白色内容区

## 用户偏好
- 中文界面，专业运维工具风格
- **浅色主题**（白底，#F0F2F5 背景，蓝色主色 #1677FF）
- 宽屏布局，所有页面不设 max-w 限制
- 保持原有 Shell 脚本不变，Web 层为代理调用层
- 三个操作页（部署/备份/检测）按钮风格统一：蓝色 bg-primary，布局 flex+下拉+按钮横排
- 部署页不要干跑模式，默认直接实际操作
