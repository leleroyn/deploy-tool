#!/bin/bash
#
# 简洁终端部署/备份工具（支持全部项目备份，美化版）
# 用法: ./deploy-tool-ui.sh
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
    BG_BLUE=$(tput setab 4)
    BG_GREEN=$(tput setab 2)
    BG_RED=$(tput setab 1)
else
    RED=""; GREEN=""; YELLOW=""; BLUE=""; MAGENTA=""; CYAN=""; WHITE=""; BOLD=""; DIM=""; RESET=""
    BG_BLUE=""; BG_GREEN=""; BG_RED=""
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/config.ini"
DEPLOY_SCRIPT="${SCRIPT_DIR}/deploy.sh"
BACKUP_SCRIPT="${SCRIPT_DIR}/backup_pj.sh"
CHECK_PORTS_SCRIPT="${SCRIPT_DIR}/check_ports.sh"
VERSION="1.0.0"

# ========== 辅助函数 ==========

# 打印分隔线
print_line() {
    local char="${1:-─}"
    local width=58
    echo "${DIM}${char}$(printf "%${width}s" | tr ' ' "$char")${RESET}"
}

# 打印带边框的标题
print_header() {
    local text="$1"
    local width=56
    local text_len=${#text}
    local padding=$(( (width - text_len) / 2 ))
    local right_padding=$(( width - text_len - padding ))

    echo "${MAGENTA}${BOLD}╭$(printf "%${width}s" | tr ' ' '─')╮${RESET}"
    echo "${MAGENTA}${BOLD}│${RESET}$(printf "%${padding}s")${WHITE}${BOLD}${text}${RESET}$(printf "%${right_padding}s")${MAGENTA}${BOLD}│${RESET}"
    echo "${MAGENTA}${BOLD}╰$(printf "%${width}s" | tr ' ' '─')╯${RESET}"
}

# 打印子标题
print_subheader() {
    local text="$1"
    echo
    echo "  ${CYAN}${BOLD}${text}${RESET}"
    print_line "─"
}

# 打印成功消息
print_success() {
    echo "  ${GREEN}${BOLD}[✔]${RESET} ${GREEN}$1${RESET}"
}

# 打印错误消息
print_error() {
    echo "  ${RED}${BOLD}[✘]${RESET} ${RED}$1${RESET}"
}

# 打印警告消息
print_warning() {
    echo "  ${YELLOW}${BOLD}[!]${RESET} ${YELLOW}$1${RESET}"
}

# 打印信息消息
print_info() {
    echo "  ${CYAN}${BOLD}[i]${RESET} $1"
}

# 打印确认框
print_confirm() {
    local text="$1"
    echo
    echo "  ${YELLOW}┌──────────────────────────────────────────────────┐${RESET}"
    echo "  ${YELLOW}│${RESET}  ${BOLD}${text}${RESET}"
    echo "  ${YELLOW}└──────────────────────────────────────────────────┘${RESET}"
    echo -n "  ${YELLOW}${BOLD}确认执行? [y/N]:${RESET} "
}

# 打印页脚
print_footer() {
    echo
    print_line "═"
    local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
    echo "  ${DIM}Deploy Tool v${VERSION} │ ${timestamp} │ 输入选项编号${RESET}"
    print_line "═"
}

# 打印分组标题
print_section() {
    local icon="$1"
    local text="$2"
    echo
    echo "  ${icon} ${CYAN}${BOLD}${text}${RESET}"
    echo "  ${DIM}$(printf '%54s' | tr ' ' '─')${RESET}"
}

# 检查必要文件
check_files() {
    local missing=0
    for f in "$CONFIG_FILE" "$DEPLOY_SCRIPT" "$BACKUP_SCRIPT" "$CHECK_PORTS_SCRIPT"; do
        if [ ! -f "$f" ]; then
            print_error "文件 $f 不存在"
            missing=1
        fi
        if [ ! -x "$f" ] && [[ "$f" != "$CONFIG_FILE" ]]; then
            print_error "脚本 $f 不可执行，请运行 chmod +x $f"
            missing=1
        fi
    done
    if [ $missing -eq 1 ]; then
        exit 1
    fi
}
check_files

# 从 config.ini 提取项目列表（排除 ssh 节）
get_projects() {
    awk '/^\[.*\]$/ { gsub(/^\[|\]$/, "", $0); if ($0 != "ssh") print $0 }' "$CONFIG_FILE" | sort
}

# 显示标题
show_title() {
    echo
    echo "  ${MAGENTA}${BOLD}  ╔══════════════════════════════════════════════════╗${RESET}"
    echo "  ${MAGENTA}${BOLD}  ║${RESET}    ${WHITE}${BOLD}  项目部署 / 备份工具${RESET}    ${MAGENTA}${BOLD}║${RESET}"
    echo "  ${MAGENTA}${BOLD}  ║${RESET}         ${DIM}Deploy & Backup Tool v${VERSION}${RESET}         ${MAGENTA}${BOLD}║${RESET}"
    echo "  ${MAGENTA}${BOLD}  ╚══════════════════════════════════════════════════╝${RESET}"
    echo
}

# 显示项目列表
show_projects() {
    local projects=("$@")
    local cols=2
    local rows=$(( (${#projects[@]} + cols - 1) / cols ))

    for ((r=0; r<rows; r++)); do
        for ((c=0; c<cols; c++)); do
            local idx=$(( r + c * rows ))
            if [ $idx -lt ${#projects[@]} ]; then
                local num=$((idx + 1))
                local proj="${projects[$idx]}"
                printf "  ${GREEN}${BOLD}[%2d]${RESET} %-22s" "$num" "$proj"
            fi
        done
        echo
    done
}

# 执行操作并显示结果
run_action() {
    local script="$1"
    local arg="$2"
    local fail_msg="$3"

    echo
    "$script" "$arg"
    local exit_code=$?
    echo

    if [ $exit_code -ne 0 ]; then
        print_error "$fail_msg (退出码: $exit_code)"
    fi
}

# ========== 主循环 ==========
while true; do
    clear
    show_title

    # 菜单区域
    print_section "📋" "操作菜单"
    echo
    echo "    ${GREEN}${BOLD}[1]${RESET}  ${WHITE}备份项目${RESET}     ${DIM}将项目文件备份到指定目录${RESET}"
    echo "    ${GREEN}${BOLD}[2]${RESET}  ${WHITE}部署项目${RESET}     ${DIM}将项目部署到目标服务器${RESET}"
    echo "    ${GREEN}${BOLD}[3]${RESET}  ${WHITE}检测端口${RESET}     ${DIM}检查项目服务端口状态${RESET}"
    echo
    echo "    ${RED}${BOLD}[0]${RESET}  ${WHITE}退出程序${RESET}     ${DIM}关闭部署工具${RESET}"

    print_footer
    echo -n "  ${BOLD}请输入选项: ${RESET}"
    read choice

    case $choice in
        1)  # 备份
            projects=($(get_projects))
            if [ ${#projects[@]} -eq 0 ]; then
                print_error "没有找到任何项目配置，请检查 config.ini"
                read -p "按回车键继续..."
                continue
            fi

            print_subheader "📦 备份项目"
            show_projects "${projects[@]}"
            echo
            echo "  ${YELLOW}${BOLD}[0]${RESET}  ${WHITE}全部项目${RESET}"

            print_footer
            echo -n "  ${BOLD}请选择项目编号: ${RESET}"
            read num

            if [[ $num =~ ^[0-9]+$ ]] && [ $num -ge 0 ] && [ $num -le ${#projects[@]} ]; then
                if [ $num -eq 0 ]; then
                    print_confirm "即将备份 ${BOLD}所有项目${RESET}"
                    read confirm
                    if [[ $confirm =~ ^[Yy]$ ]]; then
                        run_action "$BACKUP_SCRIPT" "all" "备份失败"
                    else
                        print_warning "操作已取消"
                    fi
                else
                    project="${projects[$((num-1))]}"
                    print_confirm "即将备份项目: ${BOLD}${project}${RESET}"
                    read confirm
                    if [[ $confirm =~ ^[Yy]$ ]]; then
                        run_action "$BACKUP_SCRIPT" "$project" "备份失败"
                    else
                        print_warning "操作已取消"
                    fi
                fi
            else
                print_error "无效选择"
            fi
            ;;
        2)  # 部署
            projects=($(get_projects))
            if [ ${#projects[@]} -eq 0 ]; then
                print_error "没有找到任何项目配置，请检查 config.ini"
                read -p "按回车键继续..."
                continue
            fi

            print_subheader "🚀 部署项目"
            show_projects "${projects[@]}"

            print_footer
            echo -n "  ${BOLD}请选择项目编号: ${RESET}"
            read num

            if [[ $num =~ ^[0-9]+$ ]] && [ $num -ge 1 ] && [ $num -le ${#projects[@]} ]; then
                project="${projects[$((num-1))]}"
                print_confirm "即将部署项目: ${BOLD}${project}${RESET}"
                read confirm
                if [[ $confirm =~ ^[Yy]$ ]]; then
                    run_action "$DEPLOY_SCRIPT" "$project" "部署失败"
                else
                    print_warning "操作已取消"
                fi
            else
                print_error "无效选择"
            fi
            ;;
        3)  # 检测端口
            projects=($(get_projects))
            if [ ${#projects[@]} -eq 0 ]; then
                print_error "没有找到任何项目配置，请检查 config.ini"
                read -p "按回车键继续..."
                continue
            fi

            print_subheader "🔌 端口检测"
            show_projects "${projects[@]}"
            echo
            echo "  ${YELLOW}${BOLD}[0]${RESET}  ${WHITE}全部项目${RESET}"

            print_footer
            echo -n "  ${BOLD}请选择项目编号: ${RESET}"
            read num

            if [[ $num =~ ^[0-9]+$ ]] && [ $num -ge 0 ] && [ $num -le ${#projects[@]} ]; then
                if [ $num -eq 0 ]; then
                    print_confirm "即将检测 ${BOLD}所有项目${RESET} 的端口"
                    read confirm
                    if [[ $confirm =~ ^[Yy]$ ]]; then
                        run_action "$CHECK_PORTS_SCRIPT" "all" "端口检测失败"
                    else
                        print_warning "操作已取消"
                    fi
                else
                    project="${projects[$((num-1))]}"
                    print_confirm "即将检测项目端口: ${BOLD}${project}${RESET}"
                    read confirm
                    if [[ $confirm =~ ^[Yy]$ ]]; then
                        run_action "$CHECK_PORTS_SCRIPT" "$project" "端口检测失败"
                    else
                        print_warning "操作已取消"
                    fi
                fi
            else
                print_error "无效选择"
            fi
            ;;
        0)
            echo
            print_success "感谢使用，再见！"
            echo
            exit 0
            ;;
        *)
            print_error "无效选项，请重试"
            ;;
    esac
    echo
    echo -n "  ${DIM}按回车键继续...${RESET}"
    read
done
