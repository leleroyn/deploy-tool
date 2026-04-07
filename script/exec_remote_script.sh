#!/bin/bash
#
# 远程命令执行脚本（从 config.toml 读取 command 节配置）
# 用法: ./exec_remote_script.sh <命令名>
# 输出：只显示远程命令的实际输出，无任何样式
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/../config.toml"
LOG_DIR="${LOG_BASE_DIR:-${SCRIPT_DIR}/../logs}"
mkdir -p "$LOG_DIR" 2>/dev/null || true
LOG_FILE="${LOG_DIR}/exec_remote_script.log"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: config file $CONFIG_FILE not found" >&2
    exit 1
fi

get_toml_value() {
    local path="$1"
    node "${SCRIPT_DIR}/_toml_parse.js" get "$CONFIG_FILE" "$path" 2>/dev/null || true
}

get_commands() {
    node "${SCRIPT_DIR}/_toml_parse.js" keys "$CONFIG_FILE" command 2>/dev/null || true
}

SSH_USER=$(get_toml_value "ssh.user")
[ -z "$SSH_USER" ] && SSH_USER="root"

SSH_KEY=$(get_toml_value "ssh.key")
if [ -n "$SSH_KEY" ]; then
    SSH_KEY_ARG="-i $SSH_KEY"
else
    SSH_KEY_ARG=""
fi

if [ -z "${SKIP_SSH_INIT:-}" ]; then
    if [ -z "${SSH_AUTH_SOCK:-}" ]; then
        eval "$(ssh-agent -s)" > /dev/null 2>&1
    fi

    if [ -n "$SSH_KEY" ] && [ -f "$SSH_KEY" ]; then
        pub_key=$(ssh-keygen -y -f "$SSH_KEY" 2>/dev/null | awk '{print $2}')
        if [ -n "$pub_key" ]; then
            if ! ssh-add -l 2>/dev/null | grep -q "$pub_key"; then
                ssh-add "$SSH_KEY" > /dev/null 2>&1
            fi
        fi
    fi

    export SKIP_SSH_INIT=1
fi

log() {
    local level="$1"
    local message="$2"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $message" >> "$LOG_FILE"
}

if [ $# -ne 1 ]; then
    echo "Usage: $0 <command_name>"
    echo "Available commands:"
    get_commands | while read -r cmd; do
        echo "  $cmd"
    done
    exit 1
fi

COMMAND_NAME="$1"

if ! get_commands | grep -qx "$COMMAND_NAME"; then
    echo "Error: unknown command '$COMMAND_NAME'" >&2
    exit 1
fi

SERVER_LIST_RAW=$(get_toml_value "command.$COMMAND_NAME.server")
COMMAND=$(get_toml_value "command.$COMMAND_NAME.command")

if [ -z "$SERVER_LIST_RAW" ]; then
    echo "Error: command $COMMAND_NAME missing server config" >&2
    exit 1
fi

if [ -z "$COMMAND" ]; then
    echo "Error: command $COMMAND_NAME missing command config" >&2
    exit 1
fi

IFS=',' read -ra SERVER_LIST <<< "$SERVER_LIST_RAW"

global_failed=false

for SERVER in "${SERVER_LIST[@]}"; do
    SERVER="$(echo "$SERVER" | xargs)"
    [ -z "$SERVER" ] && continue

    EXIT_CODE=0
    OUTPUT=$(ssh -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=no $SSH_KEY_ARG "${SSH_USER}@${SERVER}" "$COMMAND" 2>&1) || EXIT_CODE=$?

    if [ $EXIT_CODE -eq 0 ]; then
        if [ -n "$OUTPUT" ]; then
            echo "$OUTPUT"
        fi
        log "INFO" "命令 $COMMAND_NAME 执行成功，服务器 $SERVER"
    else
        echo "$OUTPUT" >&2
        log "ERROR" "命令 $COMMAND_NAME 执行失败，服务器 $SERVER"
        global_failed=true
    fi
done

if [ "$global_failed" = true ]; then
    exit 1
else
    exit 0
fi