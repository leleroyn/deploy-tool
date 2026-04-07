#!/bin/bash
#
# 项目备份脚本（支持 SSH 私钥认证，排除日志文件，无服务干预）
# 支持多 IP 循环备份：配置中 server 字段可用逗号分隔多个 IP
# 备份文件名格式：<项目名>_<时间戳>.tar.gz（不含 IP）
# 用法: ./backup_pj.sh <项目英文名称> 或 ./backup_pj.sh all
#

set -euo pipefail

# ========== 颜色定义（如果终端支持）==========
if command -v tput >/dev/null 2>&1 && [ -t 1 ]; then
    RED=$(tput setaf 1)
    GREEN=$(tput setaf 2)
    YELLOW=$(tput setaf 3)
    BLUE=$(tput setaf 4)
    MAGENTA=$(tput setaf 5)
    CYAN=$(tput setaf 6)
    WHITE=$(tput setaf 7)
    BOLD=$(tput bold)
    DIM=$(tput dim)
    RESET=$(tput sgr0)
else
    RED=""; GREEN=""; YELLOW=""; BLUE=""; MAGENTA=""; CYAN=""; WHITE=""; BOLD=""; DIM=""; RESET=""
fi

# ========== 全局配置 ==========
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/../config.toml"
# 日志写到可写目录（Docker 下 /app/logs 为可写 volume，本地退回脚本目录）
LOG_DIR="${LOG_BASE_DIR:-${SCRIPT_DIR}/../logs}"
mkdir -p "$LOG_DIR" 2>/dev/null || true
LOG_FILE="${LOG_DIR}/backup_pj.log"

# 检查配置文件是否存在
if [ ! -f "$CONFIG_FILE" ]; then
    echo "  ${RED}${BOLD}[✘]${RESET} ${RED}错误: 配置文件 $CONFIG_FILE 不存在${RESET}"
    exit 1
fi

# ========== TOML 解析函数（使用 @iarna/toml）==========
TOML_HELPER="${SCRIPT_DIR}/_toml_parse.js"

get_toml_value() {
    local path="$1"
    node "$TOML_HELPER" get "$CONFIG_FILE" "$path" 2>/dev/null || true
}

get_projects() {
    node "$TOML_HELPER" keys "$CONFIG_FILE" deploy 2>/dev/null || true
}

# ========== 日志记录函数 ==========
log() {
    local level="$1"
    local message="$2"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $message" >> "$LOG_FILE"
}

# ========== 帮助信息 ==========
usage() {
    echo "  ${BOLD}用法:${RESET} $0 <项目英文名称> 或 $0 all"
    echo "  ${BOLD}可用的项目:${RESET}"
    get_projects | while read -r p; do
        echo "    ${GREEN}$p${RESET}"
    done
    echo ""
    echo "  ${BOLD}特殊项目:${RESET} ${YELLOW}all${RESET} - 备份所有项目"
    exit 1
}

# ========== 参数检查 ==========
if [ $# -ne 1 ]; then
    usage
fi

PROJECT_NAME="$1"

if [ "$PROJECT_NAME" != "all" ] && ! get_projects | grep -qx "$PROJECT_NAME"; then
    echo "  ${RED}${BOLD}[✘]${RESET} ${RED}错误: 未知的项目名称 '$PROJECT_NAME'${RESET}"
    usage
fi

# ========== SSH 配置 ==========
SSH_USER=$(get_toml_value "ssh.user")
[ -z "$SSH_USER" ] && SSH_USER="root"

SSH_KEY=$(get_toml_value "ssh.key")
if [ -n "$SSH_KEY" ]; then
    SSH_KEY_ARG="-i $SSH_KEY"
else
    SSH_KEY_ARG=""
fi

# ========== SSH 初始化（仅在需要时执行一次）==========
if [ -z "${SKIP_SSH_INIT:-}" ]; then
    if [ -z "${SSH_AUTH_SOCK:-}" ]; then
        eval "$(ssh-agent -s)" > /dev/null 2>&1
    fi

    if [ -n "$SSH_KEY" ] && [ -f "$SSH_KEY" ]; then
        pub_key=$(ssh-keygen -y -f "$SSH_KEY" 2>/dev/null | awk '{print $2}')
        if [ -n "$pub_key" ]; then
            if ! ssh-add -l 2>/dev/null | grep -q "$pub_key"; then
                ssh-add "$SSH_KEY" > /dev/null 2>&1
                if [ $? -ne 0 ]; then
                    echo "  ${RED}${BOLD}[✘]${RESET} ${RED}ssh-add 失败，请检查私钥和密码${RESET}"
                    exit 1
                fi
            fi
        fi
    fi

    export SKIP_SSH_INIT=1
fi

# ========== 处理全部项目备份 ==========
if [ "$PROJECT_NAME" = "all" ]; then
    ALL_PROJECTS=($(get_projects))
    if [ ${#ALL_PROJECTS[@]} -eq 0 ]; then
        echo "错误: 没有找到任何项目配置"
        exit 1
    fi
    echo "开始备份所有项目..."
    echo "---"
    for p in "${ALL_PROJECTS[@]}"; do
        echo "[$p] 开始备份..."
        "$0" "$p"
        if [ $? -ne 0 ]; then
            echo "[$p] 备份失败"
        else
            echo "[$p] 备份完成"
        fi
        echo "---"
    done
    echo "所有项目备份处理完成"
    exit 0
fi

# ========== 单项目备份逻辑 ==========
SERVER_LIST_RAW=$(get_toml_value "deploy.$PROJECT_NAME.server")
REMOTE_DIR=$(get_toml_value "deploy.$PROJECT_NAME.remote_dir")
BACKUP_BASE_DIR=$(get_toml_value "deploy.$PROJECT_NAME.backup_dir")
EXCLUDE_PATTERNS=$(get_toml_value "deploy.$PROJECT_NAME.exclude")

if [ -z "$SERVER_LIST_RAW" ]; then
    echo "错误: 项目 $PROJECT_NAME 缺少 server 配置"
    exit 1
fi
if [ -z "$REMOTE_DIR" ]; then
    echo "错误: 项目 $PROJECT_NAME 缺少 remote_dir 配置"
    exit 1
fi
if [ -z "$BACKUP_BASE_DIR" ]; then
    echo "错误: 项目 $PROJECT_NAME 缺少 backup_dir 配置"
    exit 1
fi

IFS=',' read -ra SERVER_LIST <<< "$SERVER_LIST_RAW"

if [ -z "$EXCLUDE_PATTERNS" ]; then
    EXCLUDE_PATTERNS="logs,log,tmp,temp,*.log,*.logs"
fi
IFS=',' read -ra EXCLUDE_PATTERNS_ARRAY <<< "$EXCLUDE_PATTERNS"

EXCLUDE_ARGS=""
for pattern in "${EXCLUDE_PATTERNS_ARRAY[@]}"; do
    pattern="$(echo "$pattern" | xargs)"
    if [ -n "$pattern" ]; then
        EXCLUDE_ARGS+=" --exclude='$pattern'"
    fi
done

echo "备份项目: $PROJECT_NAME"
echo "目标服务器: ${SERVER_LIST[*]}"
echo "---"

global_failed=false

for SERVER in "${SERVER_LIST[@]}"; do
    SERVER="$(echo "$SERVER" | xargs)"
    [ -z "$SERVER" ] && continue

    echo "[$SERVER] 开始备份..."

    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    BACKUP_FILE="${PROJECT_NAME}_${TIMESTAMP}.tar.gz"
    SSH_HOST="${SSH_USER}@${SERVER}"

    # 远程命令：打包并输出大小
    REMOTE_CMD="
set -e
mkdir -p '$BACKUP_BASE_DIR'
tar $EXCLUDE_ARGS -czf '$BACKUP_BASE_DIR/$BACKUP_FILE' \\
    -C \"\$(dirname '$REMOTE_DIR')\" \"\$(basename '$REMOTE_DIR')\"
BACKUP_SIZE=\$(du -h '$BACKUP_BASE_DIR/$BACKUP_FILE' 2>/dev/null | cut -f1)
echo \"BACKUP_SIZE=\${BACKUP_SIZE:-未知}\"
"

    # 执行远程命令，捕获输出（先捕获 ssh 退出码，再去 \r）
    EXIT_CODE=0
    RAW_OUTPUT=$(ssh $SSH_KEY_ARG "$SSH_HOST" "$REMOTE_CMD" 2>&1) || EXIT_CODE=$?
    OUTPUT=$(echo "$RAW_OUTPUT" | tr -d '\r')

    if [ $EXIT_CODE -eq 0 ]; then
        SIZE_LINE=$(echo "$OUTPUT" | grep '^BACKUP_SIZE=' | head -1)
        if [ -n "$SIZE_LINE" ]; then
            SIZE=$(echo "$SIZE_LINE" | cut -d= -f2)
            echo "[$SERVER] 备份成功: $BACKUP_BASE_DIR/$BACKUP_FILE ($SIZE)"
            log "INFO" "项目 $PROJECT_NAME 备份成功，服务器 $SERVER，备份文件：$BACKUP_BASE_DIR/$BACKUP_FILE，大小：$SIZE"
        else
            echo "[$SERVER] 备份成功: $BACKUP_BASE_DIR/$BACKUP_FILE"
            log "INFO" "项目 $PROJECT_NAME 备份成功，服务器 $SERVER，备份文件：$BACKUP_BASE_DIR/$BACKUP_FILE"
        fi
    else
        echo "[$SERVER] 备份失败"
        if [ -n "$OUTPUT" ]; then
            echo "[$SERVER] 错误: $OUTPUT"
        fi
        log "ERROR" "项目 $PROJECT_NAME 备份失败，服务器 $SERVER"
        global_failed=true
    fi
done

echo "---"
if [ "$global_failed" = true ]; then
    echo "部分服务器备份失败，请检查日志"
    exit 1
else
    echo "所有服务器备份成功"
    exit 0
fi
    echo "${BOLD}${CYAN}开始备份所有项目...${RESET}"
    for p in "${ALL_PROJECTS[@]}"; do
        echo ""
        echo "  ${BOLD}${MAGENTA}┌─ 备份项目: ${GREEN}$p${RESET}"
        echo "  ${DIM}$(printf '%54s' | tr ' ' '-')${RESET}"
        "$0" "$p"
        if [ $? -ne 0 ]; then
            echo "  ${YELLOW}${BOLD}[!]${RESET} ${YELLOW}项目 $p 备份失败，继续处理后续项目...${RESET}"
        fi
    done
    echo ""
    echo "  ${GREEN}${BOLD}[✔]${RESET} ${GREEN}所有项目备份处理完成${RESET}"
    exit 0
fi

# ========== 单项目备份逻辑 ==========
SERVER_LIST_RAW=$(get_toml_value "deploy.$PROJECT_NAME.server")
REMOTE_DIR=$(get_toml_value "deploy.$PROJECT_NAME.remote_dir")
BACKUP_BASE_DIR=$(get_toml_value "deploy.$PROJECT_NAME.backup_dir")
EXCLUDE_PATTERNS=$(get_toml_value "deploy.$PROJECT_NAME.exclude")

if [ -z "$SERVER_LIST_RAW" ]; then
    echo "  ${RED}${BOLD}[✘]${RESET} ${RED}错误: 项目 $PROJECT_NAME 缺少 server 配置${RESET}"
    exit 1
fi
if [ -z "$REMOTE_DIR" ]; then
    echo "  ${RED}${BOLD}[✘]${RESET} ${RED}错误: 项目 $PROJECT_NAME 缺少 remote_dir 配置${RESET}"
    exit 1
fi
if [ -z "$BACKUP_BASE_DIR" ]; then
    echo "  ${RED}${BOLD}[✘]${RESET} ${RED}错误: 项目 $PROJECT_NAME 缺少 backup_dir 配置${RESET}"
    exit 1
fi

IFS=',' read -ra SERVER_LIST <<< "$SERVER_LIST_RAW"

if [ -z "$EXCLUDE_PATTERNS" ]; then
    EXCLUDE_PATTERNS="logs,log,tmp,temp,*.log,*.logs"
fi
IFS=',' read -ra EXCLUDE_PATTERNS_ARRAY <<< "$EXCLUDE_PATTERNS"

EXCLUDE_ARGS=""
for pattern in "${EXCLUDE_PATTERNS_ARRAY[@]}"; do
    pattern="$(echo "$pattern" | xargs)"
    if [ -n "$pattern" ]; then
        EXCLUDE_ARGS+=" --exclude='$pattern'"
    fi
done

echo "  ${BOLD}项目 ${CYAN}$PROJECT_NAME${RESET}${BOLD} 配置了 ${#SERVER_LIST[@]} 个服务器: ${SERVER_LIST[*]}${RESET}"

global_failed=false

for SERVER in "${SERVER_LIST[@]}"; do
    SERVER="$(echo "$SERVER" | xargs)"
    [ -z "$SERVER" ] && continue

    echo ""
    echo "  ${BOLD}${BLUE}┌─ 备份服务器: ${WHITE}$SERVER${RESET}"
    echo "  ${BLUE}│${RESET}"

    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    BACKUP_FILE="${PROJECT_NAME}_${TIMESTAMP}.tar.gz"
    SSH_HOST="${SSH_USER}@${SERVER}"

    # 远程命令：打包并输出大小（只输出 BACKUP_SIZE= 一行）
    REMOTE_CMD="
set -e
mkdir -p '$BACKUP_BASE_DIR'
tar $EXCLUDE_ARGS -czf '$BACKUP_BASE_DIR/$BACKUP_FILE' \\
    -C \"\$(dirname '$REMOTE_DIR')\" \"\$(basename '$REMOTE_DIR')\"
BACKUP_SIZE=\$(du -h '$BACKUP_BASE_DIR/$BACKUP_FILE' 2>/dev/null | cut -f1)
echo \"BACKUP_SIZE=\${BACKUP_SIZE:-未知}\"
"

    # 执行远程命令，捕获输出（先捕获 ssh 退出码，再去 \r）
    EXIT_CODE=0
    RAW_OUTPUT=$(ssh $SSH_KEY_ARG "$SSH_HOST" "$REMOTE_CMD" 2>&1) || EXIT_CODE=$?
    OUTPUT=$(echo "$RAW_OUTPUT" | tr -d '\r')

    if [ $EXIT_CODE -eq 0 ]; then
        # 成功：解析大小行并打印本地格式信息
        SIZE_LINE=$(echo "$OUTPUT" | grep '^BACKUP_SIZE=' | head -1)
        if [ -n "$SIZE_LINE" ]; then
            SIZE=$(echo "$SIZE_LINE" | cut -d= -f2)
            echo "  ${BLUE}│${RESET} ${GREEN}${BOLD}[✔]${RESET} ${GREEN}备份成功:${RESET} ${WHITE}$BACKUP_BASE_DIR/$BACKUP_FILE${RESET} ${YELLOW}(${SIZE})${RESET}"
            log "INFO" "项目 $PROJECT_NAME 备份成功，服务器 $SERVER，备份文件：$BACKUP_BASE_DIR/$BACKUP_FILE，大小：$SIZE"
        else
            echo "  ${BLUE}│${RESET} ${GREEN}${BOLD}[✔]${RESET} ${GREEN}备份成功:${RESET} ${WHITE}$BACKUP_BASE_DIR/$BACKUP_FILE${RESET}"
            log "INFO" "项目 $PROJECT_NAME 备份成功，服务器 $SERVER，备份文件：$BACKUP_BASE_DIR/$BACKUP_FILE"
        fi
    else
        echo "  ${BLUE}│${RESET} ${RED}${BOLD}[✘]${RESET} ${RED}备份失败:${RESET} $SERVER"
        echo "  ${BLUE}│${RESET} ${YELLOW}远程错误输出:${RESET}"
        echo "$OUTPUT" | while IFS= read -r line; do
            echo "  ${BLUE}│${RESET}   $line"
        done
        log "ERROR" "项目 $PROJECT_NAME 备份失败，服务器 $SERVER"
        global_failed=true
    fi

    echo "  ${BLUE}└─ 完成${RESET}"
done

if [ "$global_failed" = true ]; then
    echo ""
    echo "  ${RED}${BOLD}[✘]${RESET} ${RED}部分服务器备份失败，请检查日志${RESET}"
    exit 1
else
    echo ""
    echo "  ${GREEN}${BOLD}[✔]${RESET} ${GREEN}项目 $PROJECT_NAME 所有服务器备份成功${RESET}"
    exit 0
fi