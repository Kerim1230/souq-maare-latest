#!/bin/bash
cd /home/z/my-project
while true; do
  node node_modules/.bin/next dev -p 3000 --webpack > dev.log 2>&1
  echo "Process exited, restarting in 3s..." >> dev.log
  sleep 3
done
