#!/usr/bin/env bash
SESSION="mms"
ROOT="$HOME/mms-platform"
SERVICES=(
  "vendor-service:3001"
  "procurement-service:3002"
  "inventory-service:3003"
  "receiving-service:3004"
  "warehouse-service:3005"
  "retail-sales-service:3006"
  "sales-audit-service:3007"
  "financials-service:3008"
)
if [ "$1" = "down" ]; then
  tmux kill-session -t "$SESSION" 2>/dev/null && echo "stopped" || echo "no session"
  exit 0
fi
if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "already running: tmux attach -t $SESSION"
  exit 1
fi
first="${SERVICES[0]%%:*}"
tmux new-session -d -s "$SESSION" -n "$first"
tmux send-keys -t "$SESSION:0" "cd $ROOT/services/$first && npm run dev" C-m
for entry in "${SERVICES[@]:1}"; do
  name="${entry%%:*}"
  tmux new-window -t "$SESSION" -n "$name"
  tmux send-keys -t "$SESSION:$name" "cd $ROOT/services/$name && npm run dev" C-m
done
tmux select-window -t "$SESSION:0"
echo "started $SESSION"
echo "  attach: tmux attach -t $SESSION"
echo "  stop:   $ROOT/dev.sh down"
