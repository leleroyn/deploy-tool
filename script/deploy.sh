#!/bin/bash
#
# 项目部署脚本（支持 SSH 私钥认证，排除文件，多服务器循环，部署后执行重启命令）
# 用法: ./deploy.sh <项目英文名称>
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
CONFIG_FILE="${SCRIPT_DIR}/config.ini"
LOG_FILE="${SCRIPT_DIR}/deploy.log"
DRY_RUN=${DRY_RUN:-0}

if [ ! -f "$CONFIG_FILE" ]; then
    echo "  ${RED}${BOLD}[✘]${RESET} ${RED}错误: 配置文件 $CONFIG_FILE 不存在${RESET}"
    exit 1
fi

# ========== INI 解析函数（自动去除 CRLF）==========
get_ini_value() {
    local section="$1"
    local key="$2"
    local ini_file="$3"
    sed 's/\r$//' "$ini_file" | awk -F= -v section="$section" -v key="$key" '
    $0 ~ "^\\[" section "\\]" { in_section=1; next }
    /^\\[/ && !/^\\[" section "\\]/ { in_section=0 }
    in_section && $1 ~ "^[[:space:]]*" key "[[:space:]]*$" {
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2)
        print $2
        exit
    }
    '
}

get_sections() {
    sed 's/\r$//' "$CONFIG_FILE" | awk '/^[[:space:]]*\[.*\][[:space:]]*$/ {
        gsub(/^[[:space:]]*\[|\][[:space:]]*$/, "", $0);
        print $0
    }' | sort -u
}

# ========== SSH 配置 ==========
SSH_USER=$(get_ini_value "ssh" "user" "$CONFIG_FILE")
[ -z "$SSH_USER" ] && SSH_USER="root"

SSH_KEY=$(get_ini_value "ssh" "key" "$CONFIG_FILE")
if [ -n "$SSH_KEY" ]; then
    SSH_KEY_ARG="-i $SSH_KEY"
else
    SSH_KEY_ARG=""
fi

# ========== ssh-agent 自动管理（仅在需要时初始化一次）==========
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

# ========== 日志记录函数 ==========
log() {
    local level="$1"
    local message="$2"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $message" >> "$LOG_FILE"
}

# ========== 显示帮助信息 ==========
usage() {
    echo "  ${BOLD}用法:${RESET} $0 <项目英文名称>"
    echo "  ${BOLD}可用的项目:${RESET}"
    get_sections | grep -v '^ssh$' | while read -r p; do
        echo "    ${GREEN}$p${RESET}"
    done
    exit 1
}

# ========== 参数检查 ==========
if [ $# -ne 1 ]; then
    usage
fi

PROJECT_NAME="$1"

if ! get_sections | grep -qx "$PROJECT_NAME"; then
    echo "  ${RED}${BOLD}[✘]${RESET} ${RED}错误: 未知的项目名称 '$PROJECT_NAME'${RESET}"
    usage
fi

# ========== 读取项目配置 ==========
SERVER_LIST_RAW=$(get_ini_value "$PROJECT_NAME" "server" "$CONFIG_FILE")
LOCAL_DIR=$(get_ini_value "$PROJECT_NAME" "local_dir" "$CONFIG_FILE")
REMOTE_DIR=$(get_ini_value "$PROJECT_NAME" "remote_dir" "$CONFIG_FILE")
EXCLUDE_PATTERNS=$(get_ini_value "$PROJECT_NAME" "exclude" "$CONFIG_FILE")
RESTART_CMD=$(get_ini_value "$PROJECT_NAME" "restart_cmd" "$CONFIG_FILE")

if [ -z "$SERVER_LIST_RAW" ]; then
    echo "  ${RED}${BOLD}[✘]${RESET} ${RED}错误: 项目 $PROJECT_NAME 缺少 server 配置${RESET}"
    exit 1
fi
if [ -z "$LOCAL_DIR" ]; then
    echo "  ${RED}${BOLD}[✘]${RESET} ${RED}错误: 项目 $PROJECT_NAME 缺少 local_dir 配置${RESET}"
    exit 1
fi
if [ -z "$REMOTE_DIR" ]; then
    echo "  ${RED}${BOLD}[✘]${RESET} ${RED}错误: 项目 $PROJECT_NAME 缺少 remote_dir 配置${RESET}"
    exit 1
fi

IFS=',' read -ra SERVER_LIST <<< "$SERVER_LIST_RAW"

if [ -z "$EXCLUDE_PATTERNS" ]; then
    EXCLUDE_PATTERNS="logs,log,tmp,temp,*.log,*.logs"
fi
IFS=',' read -ra EXCLUDE_PATTERNS_ARRAY <<< "$EXCLUDE_PATTERNS"

EXCLUDE_ARGS=()
for pattern in "${EXCLUDE_PATTERNS_ARRAY[@]}"; do
    pattern="$(echo "$pattern" | xargs)"
    if [ -n "$pattern" ]; then
        EXCLUDE_ARGS+=(--exclude="$pattern")
    fi
done

# 显示项目信息（美化）
echo ""
echo "  ${BOLD}${MAGENTA}┌─ 部署项目: ${GREEN}$PROJECT_NAME${RESET}"
echo "  ${DIM}$(printf '%54s' | tr ' ' '─')${RESET}"
echo "  ${BOLD}本地源目录:${RESET} $LOCAL_DIR"
echo "  ${BOLD}远程目标目录:${RESET} $REMOTE_DIR"
echo "  ${BOLD}排除模式:${RESET} $EXCLUDE_PATTERNS"
echo "  ${BOLD}目标服务器:${RESET} ${SERVER_LIST[*]}"
echo "  ${BOLD}重启命令:${RESET} ${RESTART_CMD:-无}"
echo "  ${BOLD}干跑模式:${RESET} $([ $DRY_RUN -eq 1 ] && echo "${YELLOW}是${RESET}" || echo "否")"

global_failed=false

for SERVER in "${SERVER_LIST[@]}"; do
    SERVER="$(echo "$SERVER" | xargs)"
    [ -z "$SERVER" ] && continue

    echo ""
    echo "  ${BOLD}${BLUE}┌─ 部署到服务器: ${WHITE}$SERVER${RESET}"
    echo "  ${BLUE}│${RESET}"

    if [ ! -d "$LOCAL_DIR" ]; then
        echo "  ${BLUE}│${RESET} ${RED}${BOLD}[✘]${RESET} ${RED}错误: 本地源目录 '$LOCAL_DIR' 不存在${RESET}"
        log "ERROR" "项目 $PROJECT_NAME 部署失败，服务器 $SERVER，本地源目录不存在: $LOCAL_DIR"
        global_failed=true
        echo "  ${BLUE}└─ 完成${RESET}"
        continue
    fi

    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    TARBALL_NAME="deploy_$(basename "$LOCAL_DIR")_${TIMESTAMP}.tar.gz"
    LOCAL_TARBALL="/tmp/$TARBALL_NAME"
    REMOTE_TARBALL="/tmp/$TARBALL_NAME"

    TAR_CMD=(tar -czf "$LOCAL_TARBALL")
    for exclude in "${EXCLUDE_ARGS[@]}"; do
        TAR_CMD+=("$exclude")
    done
    TAR_CMD+=(-C "$LOCAL_DIR" .)

    SCP_CMD="scp -o StrictHostKeyChecking=no '$LOCAL_TARBALL' ${SSH_USER}@${SERVER}:'$REMOTE_TARBALL'"

    REMOTE_EXTRACT_CMD="
        mkdir -p '$REMOTE_DIR' && \
        tar -xzf '$REMOTE_TARBALL' -C '$REMOTE_DIR' && \
        rm -f '$REMOTE_TARBALL'
    "
    SSH_CMD="ssh -o StrictHostKeyChecking=no ${SSH_USER}@${SERVER} \"$REMOTE_EXTRACT_CMD\""

    if [ $DRY_RUN -eq 1 ]; then
        echo "${BLUE}│${RESET} ${YELLOW}[干跑模式] 本地打包:${RESET} ${TAR_CMD[*]}"
        echo "${BLUE}│${RESET} ${YELLOW}[干跑模式] 上传:${RESET} $SCP_CMD"
        echo "${BLUE}│${RESET} ${YELLOW}[干跑模式] 远程解压:${RESET} $SSH_CMD"
        echo "${BLUE}│${RESET} ${YELLOW}[干跑模式] 本地清理: rm -f '$LOCAL_TARBALL'${RESET}"
        if [ -n "$RESTART_CMD" ]; then
            echo "${BLUE}│${RESET} ${YELLOW}[干跑模式] 远程重启: ssh ${SSH_USER}@${SERVER} \"$RESTART_CMD\"${RESET}"
        fi
        log "INFO" "项目 $PROJECT_NAME 干跑部署，服务器 $SERVER"
        echo "${BLUE}└─ 完成${RESET}"
        continue
    fi

    # 实际执行
    echo "${BLUE}│${RESET} ${CYAN}创建本地 tarball...${RESET}"
    if ! "${TAR_CMD[@]}"; then
        echo "${BLUE}│${RESET} ${RED}${BOLD}[✘]${RESET} ${RED}错误: 本地打包失败${RESET}"
        log "ERROR" "项目 $PROJECT_NAME 部署失败，服务器 $SERVER，本地打包失败"
        global_failed=true
        echo "${BLUE}└─ 完成${RESET}"
        continue
    fi

    echo "${BLUE}│${RESET} ${CYAN}上传 tarball 到 $SERVER ...${RESET}"
    if ! eval "$SCP_CMD"; then
        echo "${BLUE}│${RESET} ${RED}${BOLD}[✘]${RESET} ${RED}错误: scp 上传失败${RESET}"
        rm -f "$LOCAL_TARBALL"
        log "ERROR" "项目 $PROJECT_NAME 部署失败，服务器 $SERVER，scp 上传失败"
        global_failed=true
        echo "${BLUE}└─ 完成${RESET}"
        continue
    fi

    echo "${BLUE}│${RESET} ${CYAN}远程解压到 $REMOTE_DIR ...${RESET}"
    if ! eval "$SSH_CMD"; then
        echo "${BLUE}│${RESET} ${RED}${BOLD}[✘]${RESET} ${RED}错误: 远程解压失败${RESET}"
        rm -f "$LOCAL_TARBALL"
        log "ERROR" "项目 $PROJECT_NAME 部署失败，服务器 $SERVER，远程解压失败"
        global_failed=true
        echo "${BLUE}└─ 完成${RESET}"
        continue
    fi

    rm -f "$LOCAL_TARBALL"

    if [ -n "$RESTART_CMD" ]; then
        echo "${BLUE}│${RESET} ${CYAN}执行重启命令: $RESTART_CMD${RESET}"
        if ssh -o StrictHostKeyChecking=no $SSH_KEY_ARG "${SSH_USER}@${SERVER}" "$RESTART_CMD"; then
            echo "${BLUE}│${RESET} ${GREEN}${BOLD}[✔]${RESET} ${GREEN}重启命令执行成功${RESET}"
            log "INFO" "项目 $PROJECT_NAME 部署成功，服务器 $SERVER，重启命令执行成功: $RESTART_CMD"
        else
            echo "${BLUE}│${RESET} ${RED}${BOLD}[✘]${RESET} ${RED}重启命令执行失败${RESET}"
            log "ERROR" "项目 $PROJECT_NAME 部署成功但重启命令执行失败，服务器 $SERVER，命令: $RESTART_CMD"
            global_failed=true
            echo "${BLUE}└─ 完成${RESET}"
            continue
        fi
    fi

    echo "${BLUE}│${RESET} ${GREEN}${BOLD}[✔]${RESET} ${GREEN}部署成功: $SERVER${RESET}"
    log "INFO" "项目 $PROJECT_NAME 部署成功，服务器 $SERVER，本地目录 $LOCAL_DIR -> 远程目录 $REMOTE_DIR"
    echo "${BLUE}└─ 完成${RESET}"
done

echo ""
if [ "$global_failed" = true ]; then
    echo "  ${RED}${BOLD}[✘]${RESET} ${RED}部分服务器部署失败，请检查日志${RESET}"
    exit 1
else
    echo "  ${GREEN}${BOLD}[✔]${RESET} ${GREEN}所有服务器部署成功${RESET}"
    exit 0
fi