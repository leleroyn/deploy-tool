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
CONFIG_FILE="${SCRIPT_DIR}/config.ini"
LOG_FILE="${SCRIPT_DIR}/check_ports.log"

# 检查配置文件是否存在
if [ ! -f "$CONFIG_FILE" ]; then
    echo "  ${RED}${BOLD}[✘]${RESET} ${RED}错误: 配置文件 $CONFIG_FILE 不存在${RESET}"
    exit 1
fi

# ========== INI 解析函数 ==========
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
    get_sections | grep -v '^ssh$' | while read -r p; do
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

if [ "$PROJECT_NAME" != "all" ] && ! get_sections | grep -qx "$PROJECT_NAME"; then
    echo "  ${RED}${BOLD}[✘]${RESET} ${RED}错误: 未知的项目名称 '$PROJECT_NAME'${RESET}"
    usage
fi

# ========== SSH 配置 ==========
SSH_USER=$(get_ini_value "ssh" "user" "$CONFIG_FILE")
[ -z "$SSH_USER" ] && SSH_USER="root"

SSH_KEY=$(get_ini_value "ssh" "key" "$CONFIG_FILE")
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
        # 通过 SSH 检查端口是否监听
        # 使用 ss 或 netstat，如果不存在则用 nc -z
        CHECK_CMD="ss -tln | grep -q ':$port ' || netstat -tln 2>/dev/null | grep -q ':$port ' || (command -v nc >/dev/null && nc -z 127.0.0.1 $port >/dev/null 2>&1)"
        if ssh -o ConnectTimeout=5 $SSH_KEY_ARG "${SSH_USER}@${server}" "$CHECK_CMD" 2>/dev/null; then
            echo -n "${GREEN}${BOLD}[✔]${RESET}"
        else
            echo -n "${RED}${BOLD}[✘]${RESET}"
            all_ok=false
        fi
        echo -n " $port "
    done
    if [ "$all_ok" = true ]; then
        return 0
    else
        return 1
    fi
}

# ========== 处理全部项目检测 ==========
if [ "$PROJECT_NAME" = "all" ]; then
    ALL_PROJECTS=($(get_sections | grep -v '^ssh$'))
    if [ ${#ALL_PROJECTS[@]} -eq 0 ]; then
        echo "  ${RED}${BOLD}[✘]${RESET} ${RED}错误: 没有找到任何项目配置${RESET}"
        exit 1
    fi
    echo "${BOLD}${CYAN}开始检测所有项目的端口...${RESET}"
    for p in "${ALL_PROJECTS[@]}"; do
        echo ""
        echo "  ${BOLD}${MAGENTA}┌─ 检测项目: ${GREEN}$p${RESET}"
        echo "  ${DIM}$(printf '%54s' | tr ' ' '─')${RESET}"
        "$0" "$p"
        if [ $? -ne 0 ]; then
            echo "  ${YELLOW}${BOLD}[!]${RESET} ${YELLOW}项目 $p 检测失败，继续处理后续项目...${RESET}"
        fi
    done
    echo ""
    echo "  ${GREEN}${BOLD}[✔]${RESET} ${GREEN}所有项目检测完成${RESET}"
    exit 0
fi

# ========== 单项目检测逻辑 ==========
SERVER_LIST_RAW=$(get_ini_value "$PROJECT_NAME" "server" "$CONFIG_FILE")
BIND_PORTS=$(get_ini_value "$PROJECT_NAME" "bind-port" "$CONFIG_FILE")

if [ -z "$SERVER_LIST_RAW" ]; then
    echo "  ${RED}${BOLD}[✘]${RESET} ${RED}错误: 项目 $PROJECT_NAME 缺少 server 配置${RESET}"
    exit 1
fi
if [ -z "$BIND_PORTS" ]; then
    echo "  ${RED}${BOLD}[✘]${RESET} ${RED}错误: 项目 $PROJECT_NAME 缺少 bind-port 配置${RESET}"
    exit 1
fi

IFS=',' read -ra SERVER_LIST <<< "$SERVER_LIST_RAW"

echo "  ${BOLD}项目 ${CYAN}$PROJECT_NAME${RESET}${BOLD} 配置了 ${#SERVER_LIST[@]} 个服务器${RESET}"
global_failed=false

for SERVER in "${SERVER_LIST[@]}"; do
    SERVER="$(echo "$SERVER" | xargs)"
    [ -z "$SERVER" ] && continue

    echo ""
    echo "${BOLD}${BLUE}┌─ 服务器: ${WHITE}$SERVER${RESET}"
    echo "${BLUE}│${RESET}"

    echo -n "${BLUE}│${RESET} ${BOLD}端口状态:${RESET} "
    if check_ports "$SERVER" "$BIND_PORTS"; then
        echo ""
        echo "${BLUE}│${RESET} ${GREEN}${BOLD}[✔]${RESET} ${GREEN}所有端口均正常${RESET}"
        log "INFO" "项目 $PROJECT_NAME 服务器 $SERVER 端口 $BIND_PORTS 检测成功"
    else
        echo ""
        echo "${BLUE}│${RESET} ${RED}${BOLD}[✘]${RESET} ${RED}部分端口未监听${RESET}"
        log "ERROR" "项目 $PROJECT_NAME 服务器 $SERVER 端口 $BIND_PORTS 检测失败"
        global_failed=true
    fi
    echo "${BLUE}└─ 完成${RESET}"
done

if [ "$global_failed" = true ]; then
    echo ""
    echo "  ${RED}${BOLD}[✘]${RESET} ${RED}部分服务器端口检测失败${RESET}"
    exit 1
else
    echo ""
    echo "  ${GREEN}${BOLD}[✔]${RESET} ${GREEN}项目 $PROJECT_NAME 所有服务器端口检测成功${RESET}"
    exit 0
fi