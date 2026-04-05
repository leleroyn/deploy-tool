#!/bin/bash
#
# 端口检测脚本：检查项目配置的端口是否在远程服务器上启用
# 用法: ./check_ports.sh <项目英文名称> 或 ./check_ports.sh all
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
CONFIG_FILE="${SCRIPT_DIR}/config.toml"
# 日志写到可写目录（Docker 下 /app/logs 为可写 volume，本地退回脚本目录）
LOG_DIR="${LOG_BASE_DIR:-${SCRIPT_DIR}}"
mkdir -p "$LOG_DIR" 2>/dev/null || true
LOG_FILE="${LOG_DIR}/check_ports.log"

# 检查配置文件是否存在
if [ ! -f "$CONFIG_FILE" ]; then
    echo "  ${RED}${BOLD}[✘]${RESET} ${RED}错误: 配置文件 $CONFIG_FILE 不存在${RESET}"
    exit 1
fi

# ========== TOML 解析函数 ==========
get_toml_value() {
    local path="$1"
    cat "$CONFIG_FILE" | toml | node -e "
        process.stdin.on('data', d => {
            const j = JSON.parse(d);
            const keys = '$path'.split('.');
            let val = j;
            for (const k of keys) { val = val[k]; }
            if (val === undefined || val === null) process.exit(1);
            if (Array.isArray(val)) console.log(val.join(','));
            else console.log(val);
        });
    " 2>/dev/null
}

get_projects() {
    cat "$CONFIG_FILE" | toml | node -e "
        process.stdin.on('data', d => {
            const j = JSON.parse(d);
            if (j.deploy) Object.keys(j.deploy).sort().forEach(k => console.log(k));
        });
    " 2>/dev/null
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
    echo "  ${BOLD}特殊项目:${RESET} ${YELLOW}all${RESET} - 检测所有项目"
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

# ========== 端口检测函数 ==========
# 参数：服务器IP，端口列表（逗号分隔）
check_ports() {
    local server="$1"
    local ports_str="$2"
    local all_ok=true
    IFS=',' read -ra ports <<< "$ports_str"
    for port in "${ports[@]}"; do
        port="$(echo "$port" | xargs)"
        if [ -z "$port" ]; then
            continue
        fi
        CHECK_CMD="ss -tln | grep -q ':$port ' || netstat -tln 2>/dev/null | grep -q ':$port ' || (command -v nc >/dev/null && nc -z 127.0.0.1 $port >/dev/null 2>&1)"
        ssh_err=$(ssh -o ConnectTimeout=5 $SSH_KEY_ARG "${SSH_USER}@${server}" "$CHECK_CMD" 2>&1 >/dev/null)
        ssh_exit=$?
        if [ $ssh_exit -eq 0 ]; then
            echo "[$server] 端口 $port: 正常"
        else
            echo "[$server] 端口 $port: 未监听"
            [ -n "$ssh_err" ] && echo "[$server] 错误: $ssh_err"
            all_ok=false
        fi
    done
    if [ "$all_ok" = true ]; then
        return 0
    else
        return 1
    fi
}

# ========== 处理全部项目检测 ==========
if [ "$PROJECT_NAME" = "all" ]; then
    ALL_PROJECTS=($(get_projects))
    if [ ${#ALL_PROJECTS[@]} -eq 0 ]; then
        echo "错误: 没有找到任何项目配置"
        exit 1
    fi
    echo "开始检测所有项目的端口..."
    echo "---"
    for p in "${ALL_PROJECTS[@]}"; do
        echo "[$p] 开始检测..."
        SUB_EXIT=0
        "$0" "$p" || SUB_EXIT=$?
        if [ $SUB_EXIT -ne 0 ]; then
            echo "[$p] 检测失败"
        else
            echo "[$p] 检测完成"
        fi
        echo "---"
    done
    echo "所有项目检测完成"
    exit 0
fi

# ========== 单项目检测逻辑 ==========
SERVER_LIST_RAW=$(get_toml_value "deploy.$PROJECT_NAME.server")
BIND_PORTS=$(get_toml_value "deploy.$PROJECT_NAME.bind-port")

if [ -z "$SERVER_LIST_RAW" ]; then
    echo "错误: 项目 $PROJECT_NAME 缺少 server 配置"
    exit 1
fi
if [ -z "$BIND_PORTS" ]; then
    echo "错误: 项目 $PROJECT_NAME 缺少 bind-port 配置"
    exit 1
fi

IFS=',' read -ra SERVER_LIST <<< "$SERVER_LIST_RAW"

echo "检测项目: $PROJECT_NAME"
echo "端口: $BIND_PORTS"
echo "目标服务器: ${SERVER_LIST[*]}"
echo "---"

global_failed=false

for SERVER in "${SERVER_LIST[@]}"; do
    SERVER="$(echo "$SERVER" | xargs)"
    [ -z "$SERVER" ] && continue

    echo "[$SERVER] 开始检测端口..."
    if check_ports "$SERVER" "$BIND_PORTS"; then
        echo "[$SERVER] 所有端口正常"
        log "INFO" "项目 $PROJECT_NAME 服务器 $SERVER 端口 $BIND_PORTS 检测成功"
    else
        echo "[$SERVER] 部分端口未监听"
        log "ERROR" "项目 $PROJECT_NAME 服务器 $SERVER 端口 $BIND_PORTS 检测失败"
        global_failed=true
    fi
done

echo "---"
if [ "$global_failed" = true ]; then
    echo "部分服务器端口检测失败"
    exit 1
else
    echo "所有服务器端口检测成功"
    exit 0
fi