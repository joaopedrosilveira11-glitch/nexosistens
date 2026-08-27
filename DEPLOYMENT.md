NEXO Deployment Checklist (staging / production)

This document lists the steps and environment requirements to deploy the current NEXO codebase to a staging or production host.

Prerequisites
- Target host with Node.js (>=18 recommended), npm, and optionally pm2 or systemd service manager.
- Supabase project configured with the expected tables and service role key.
- Secrets stored securely on the host (do NOT commit them to repo):
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY (service role key; required by backend admin operations)
  - SUPABASE_PUBLISHABLE_KEY (for frontend if used)
  - JWT_SECRET (backend JWT signing secret)
  - PORT (optional; default backend: 4000)
  - ALLOWED_ORIGINS (comma-separated frontend origins for CORS)

High-level deploy steps
1. Build artifacts locally or on the CI runner
   - Use the included helper: powershell ./scripts/deploy-staging.ps1 -Environment "staging" (requires PowerShell)
   - Or run locally:
     - cd backend && npm ci && npm run build
     - cd .. && npm ci && npm run build

2. Package and upload
   - Upload the generated release ZIP to the host (or let CI/CD do it).
   - Extract into a release folder (e.g., /srv/nexo/releases/<timestamp>).

3. Configure environment on the host
   - Place environment variables in a secure location (systemd environment file, export, docker secrets, etc.).
   - Ensure SUPABASE_SERVICE_ROLE_KEY is available to the backend process.

4. Migrate database (if required)
   - Apply any database migrations required by the current release. This repo keeps schema migration scripts in supabase/migrations/ (apply with psql or your migration tool). If you use Supabase's migration workflow, run the steps there.

5. Start / restart backend
   - Option A (systemd): create a service file that runs node backend/dist/index.js with environment variables set and restart it.
   - Option B (pm2): pm2 start backend/dist/index.js --name nexo-backend --update-env
   - Option C (Docker): build image and run with proper env vars.

6. Serve frontend
   - Frontend build output is in dist/. Serve it using a static web server (nginx, Vercel, Netlify, or similar). If using nginx, point a location to the dist/ folder.

7. Verify
   - curl -sS http://localhost:4000/api/health
   - Access frontend and verify flows: login, create collaborator, mobile login.

Notes and safety
- Never expose SUPABASE_SERVICE_ROLE_KEY to clients or public logs. Keep it only on the backend and CI secrets.
- In production, ensure env.JWT_SECRET is set and strong.
- Consider rotating service role keys and secrets on schedule.

Optional CI/CD
- Add a CI job that runs tests, builds both backend and frontend, packages artifacts, and deploys to staging via SSH/rsync or container registry.
- The included scripts/deploy-staging.ps1 is a helper for manual deploys and CI runners on Windows hosts. Adapt it for Unix shells if needed.

Contact
- If you want, I can create a GitHub Actions workflow or an Azure/GCP pipeline template to automate build and deploy. Request that and specify your CI provider and target host type.