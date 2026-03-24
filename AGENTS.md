# AGENTS.md

This file provides guidance for agentic coding agents operating on the **deploy-tool** repository.

## Project Overview

Terminal tools for project backup, deployment, and port monitoring:

- `deploy-tool-ui.sh` - Interactive menu (backup/deploy/port check)
- `backup_pj.sh` - Multi-server backup with SSH key management
- `deploy.sh` - Deployment with dry-run and rollback support
- `check_ports.sh` - Remote service port validation

All scripts share: INI parsing (`get_ini_value`/`get_sections`), color-coded output (`[✔]` `[✘]` `[!]` `[i]`), defensive checks, and `*.log` files (git-ignored).

## Build / Test Commands

```bash
# Validate syntax
bash -n script/*.sh

# Test backup for one project
./script/backup_pj.sh <project>

# Test deployment (dry-run)
DRY_RUN=1 ./script/deploy.sh <project>

# Test port check for all projects
./script/check_ports.sh all

# Interactive UI
./script/deploy-tool-ui.sh
```

## Code Style

### Formatting

- 2-space indentation, no tabs
- Single quotes for literals, double for variables
- Variables: `snake_case`, functions: `get_*`/`print_*`
- No trailing whitespace

### Error Messages

```bash
echo "  ${GREEN}${BOLD}[✔]${RESET} ${GREEN}success message${RESET}"   # success
echo "  ${RED}${BOLD}[✘]${RESET} ${RED}error message${RESET}"         # error
echo "  ${YELLOW}${BOLD}[!]${RESET} ${YELLOW}warning message${RESET}" # warning
echo "  ${CYAN}${BOLD}[i]${RESET} info message"                        # info
```

### INI Parsing

Always sanitize CRLF before parsing:

```bash
sed 's/\r$//' "$CONFIG_FILE" | awk ...
```

## Security Rules

- Never store passwords; use SSH agent
- Validate key paths: `[ -f "$SSH_KEY" ]`
- Use `StrictHostKeyChecking=no` for automation
- Set `ConnectTimeout=5` for SSH operations

## When Modifying Code

1. Check existing patterns in neighboring files
2. Update all 4 scripts when changing shared functions
3. Test with single project before `all`
4. Never commit `.log` files (in `.gitignore`)
5. Avoid `ssh -t` (causes escape sequences)
6. Remove `\r` from SSH output: `tr -d '\r'`

## Common Pitfalls

- Forgetting CRLF sanitization in INI files
- Using `ssh -t` corrupting output
- Inconsistent color variable definitions across scripts
- Not checking exit codes after remote commands

## Architecture Notes

- Each script self-initializes SSH agent (`SKIP_SSH_INIT`)
- Config file: `config.ini` with `[ssh]` section and per-project sections
- Box drawing style: `┌─` `│` `└─` with 2-space indent prefix
- Server output: tree-style with `│` connector lines

## Agent Workflow

### Adding New Features

1. Read the script you need to modify
2. Find similar patterns in existing code
3. Reuse `get_ini_value` for config access
4. Follow the same error message format
5. Test with single project first

### Debugging

1. Check `config.ini` for correct section/key names
2. Verify SSH connectivity: `ssh -o ConnectTimeout=5 user@host`
3. Look at `.log` files for detailed error messages
4. Test INI parsing with: `sed 's/\r$//' config.ini | awk ...`

### Commit Rules

- One logical change per commit
- Include all 4 scripts if modifying shared functions
- Never commit `.log` files
- Use descriptive commit messages in Chinese or English

## Quick Reference

### Color Variables

```bash
RED=$(tput setaf 1)
GREEN=$(tput setaf 2)
YELLOW=$(tput setaf 3)
BLUE=$(tput setaf 4)
MAGENTA=$(tput setaf 5)
CYAN=$(tput setaf 6)
BOLD=$(tput bold)
DIM=$(tput dim)
RESET=$(tput sgr0)
```

### INI Config Format

```ini
[ssh]
user=root
key=/path/to/key

[project-name]
server=192.168.1.1,192.168.1.2
remote_dir=/opt/project
backup_dir=/opt/backup
restart_cmd = docker restart bankgw-job
bind-port=8080,3306
```

### Script Exit Codes

- `0` - Success
- `1` - Failure (config error, network error, etc.)

> Keep it simple. The tools are designed for operational use, not for extensive feature development. Prefer incremental, reversible changes.
