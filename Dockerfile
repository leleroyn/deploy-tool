# ============================================================
# 阶段一：构建前端
# ============================================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/web

COPY web/package*.json ./
RUN npm ci

COPY web/ ./
RUN npm run build


# ============================================================
# 阶段二：构建后端
# ============================================================
FROM node:20-alpine AS backend-builder

# 安装编译工具（better-sqlite3 需要）
RUN apk add --no-cache \
    python3 \
    make \
    g++

WORKDIR /app/server

COPY server/package*.json ./
RUN npm install --include=dev

COPY server/ ./
RUN npm run build


# ============================================================
# 阶段三：生产镜像
# ============================================================
FROM node:20-alpine AS production

# 安装运行时工具
# - bash: 脚本需要 bash 语法
# - openssh: ssh/scp 客户端（脚本通过 SSH 连接远程服务器）
# - tar gzip: 打包解压（部署/备份脚本需要）
# - coreutils: date/tr/printf/basename 等基础命令
# - gawk: awk 命令（脚本解析输出）
# - grep sed: 文本处理
# - ncurses-terminfo base: tput 终端颜色支持
# - tzdata: 时区设置
RUN apk add --no-cache \
    bash \
    openssh \
    tar \
    gzip \
    coreutils \
    gawk \
    grep \
    sed \
    ncurses-terminfo-base \
    tzdata

# 设置时区
RUN cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone

WORKDIR /app

# 安装生产依赖
COPY server/package*.json ./
RUN npm ci --omit=dev

# 拷贝后端编译产物（已编译好，无需运行时编译工具）
COPY --from=backend-builder /app/server/dist ./dist

# 将前端 build 产物放到 public/，由后端静态托管
COPY --from=frontend-builder /app/web/dist ./public

# 打包脚本目录并转换换行符（Windows CRLF → Linux LF）
COPY script/ ./script/
RUN find ./script/ -name "*.sh" -exec sed -i 's/\r$//' {} \;

EXPOSE 3001

ENV NODE_ENV=production \
    SCRIPT_DIR=/app/script \
    CONFIG_FILE=/app/config.toml \
    LOG_BASE_DIR=/app/logs

CMD ["node", "dist/index.js"]
