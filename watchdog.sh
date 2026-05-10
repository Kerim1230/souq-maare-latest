#!/bin/bash
while true; do
  if ! ss -tlnp | grep -q ":3000 "; then
    cd /home/z/my-project
    node node_modules/.bin/next dev -p 3000 --webpack >> dev.log 2>&1 &
    # Wait for server to be ready
    for i in $(seq 1 30); do
      sleep 1
      if ss -tlnp | grep -q ":3000 "; then
        break
      fi
    done
  fi
  sleep 5
done
