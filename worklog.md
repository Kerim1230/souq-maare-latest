---
Task ID: 1
Agent: Main Agent
Task: Clone and deploy souq-maare project from GitHub to sandbox environment

Work Log:
- Checked for backup zip at /home/z/suq-maraa-latest.zip - not found
- Cloned repo from https://github.com/Kerim1230/souq-maare-latest.git to /tmp/souq-maare
- Inspected project structure: Next.js 16 marketplace app (سوق مارع) with Supabase, Cloudinary, Socket.io
- Preserved sandbox-specific files (.env, Caddyfile, .zscripts, upload/, mini-services/)
- Copied all project files: src/, public/, prisma/, db/, scripts/, examples/, configs
- Installed dependencies with `bun install` (59 packages)
- Started dev server with `setsid` for persistence
- Verified server responds with HTTP 200 at localhost:3000
- Page renders correctly with Arabic content "سوق مارع الإلكتروني"

Stage Summary:
- Project successfully deployed and running on port 3000
- Uses Supabase as primary database (not Prisma/SQLite - Prisma schema is template leftover)
- App has graceful fallback when Supabase env vars are not configured
- .env currently only has DATABASE_URL - needs Supabase credentials for full functionality
- Dev server running via setsid for process persistence
