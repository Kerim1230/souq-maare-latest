#!/bin/bash
cd /home/z/my-project
exec node /home/z/my-project/node_modules/.bin/next dev -p 3000 --webpack 2>&1 | tee /home/z/my-project/dev.log
