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

WORKDIR /app/server

COPY server/package*.json ./
RUN npm ci

COPY server/ ./
RUN npm run build


# ============================================================
# 阶段三：生产镜像
# ============================================================
FROM node:20-alpine AS production

# 安装 SSH 客户端（脚本需要 ssh/scp）+ 设置时区为 Asia/Shanghai
RUN apk add --no-cache openssh-client bash unzip tzdata \
    && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone \
    && apk del tzdata

WORKDIR /app

# 安装生产依赖（后端 + 脚本 TOML 解析共用）
COPY server/package*.json ./
RUN npm ci --omit=dev

# 拷贝后端编译产物
COPY --from=backend-builder /app/server/dist ./dist

# 将前端 build 产物放到 public/，由后端静态托管
COPY --from=frontend-builder /app/web/dist ./public

# 脚本目录挂载进来（运行时通过 volume 提供）
# config.ini 和 script/ 通过 volume 挂载，不打包进镜像

EXPOSE 3001

ENV NODE_ENV=production \
    SCRIPT_DIR=/app/script \
    CONFIG_FILE=/app/config.toml \
    LOG_BASE_DIR=/app/logs

CMD ["node", "dist/index.js"]
