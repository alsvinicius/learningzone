#!/usr/bin/env bash
set -euo pipefail
action=$1 pid_file=$2 log_file=$3 port=$4
shift 4
mkdir -p "$(dirname "$pid_file")" "$(dirname "$log_file")"
listening() { ss -ltn "sport = :$port" 2>/dev/null | tail -n +2 | grep -q .; }
case "$action" in
  start)
    if [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null && listening; then exit 0; fi
    if listening; then echo "Porta $port ocupada por um processo externo." >&2; exit 1; fi
    rm -f "$pid_file"; nohup setsid "$@" >"$log_file" 2>&1 </dev/null & echo $! >"$pid_file" ;;
  stop)
    [[ -f "$pid_file" ]] || exit 0
    pid=$(cat "$pid_file")
    if kill -0 "$pid" 2>/dev/null; then
      kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
      for _ in $(seq 1 50); do kill -0 "$pid" 2>/dev/null || break; sleep 0.1; done
      if kill -0 "$pid" 2>/dev/null; then kill -KILL -- "-$pid" 2>/dev/null || true; fi
    fi
    rm -f "$pid_file" ;;
  *) echo "Uso: gallery-process.sh start|stop PID_FILE LOG_FILE PORT COMMAND [ARGS...]" >&2; exit 2 ;;
esac
