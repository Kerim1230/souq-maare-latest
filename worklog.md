---
Task ID: 1
Agent: Main Agent
Task: Set up the souq-maare-latest project from GitHub in the sandbox

Work Log:
- Stopped the existing dev server processes
- Cloned the repository from https://github.com/Kerim1230/souq-maare-latest.git
- Verified .env file already contains all required environment variables (Supabase, Cloudinary, Session, Admin, VAPID keys)
- Installed all dependencies with `bun install` (544 packages)
- Modified package.json dev script to use direct output redirection instead of `tee` (tee was causing process instability)
- Started the Next.js dev server using double-fork approach for process persistence
- Verified the server is running and accessible (HTTP 200)
- The application "سوق الحرية الإلكتروني" is successfully serving pages

Stage Summary:
- Project successfully cloned and set up at /home/z/my-project
- All environment variables are configured
- Dependencies installed (544 packages)
- Dev server running on port 3000 with stable process management
- Application accessible via preview panel through Caddy gateway (port 81 -> port 3000)
- Key fix: Changed dev script from `next dev -p 3000 --webpack 2>&1 | tee dev.log` to `next dev -p 3000 --webpack > dev.log 2>&1` to prevent process instability
- Key fix: Used double-fork (`(cd ... && nohup bash -c '...' </dev/null &>/dev/null &)`) to ensure the dev server process survives between bash tool invocations
