# Manual Hetzner deployment

This runbook assumes an Ubuntu/Debian server, PostgreSQL, Nginx, systemd, Node.js 22 and npm. Replace `app.example.com` with your domain. The frontend and API share one HTTPS origin; `/api/` is proxied to the backend. Deployment itself has not been performed by the agent.

## Files and services

- Backend source: `/opt/akeem/backend`
- Frontend source: `/opt/akeem/frontend`; only its built `dist` contents are published to `/var/www/akeem`
- Secrets: `/etc/akeem/backend.env`, readable by root and the `akeem` group only
- Uploads: `/var/lib/akeem/uploads`, owned by the `akeem` service user and preserved between releases
- Templates: [systemd service](../deploy/akeem-backend.service), [Nginx](../deploy/nginx.conf.example), [environment](../deploy/backend.env.example)

Upload both repositories, including the current uncommitted changes. Exclude local `.env`, `node_modules`, local QA uploads, and `.git` from public web storage. Never publish the backend source or secrets under the Nginx document root.

Create an unprivileged `akeem` service account, create the directories above, and grant it ownership of the backend working directory and upload directory. Provision an empty PostgreSQL database and an application database user. Keep PostgreSQL and port 3000 private; expose only SSH and HTTP/HTTPS. If PostgreSQL is remote, configure verified TLS (`DB_SSL=true`, `DB_SSL_REJECT_UNAUTHORIZED=true`) and restrict access to the application server.

Copy `deploy/backend.env.example` to `/etc/akeem/backend.env`; set permissions to `root:akeem` and `0640`. Replace every placeholder:

- Database host/name/user/password.
- Two independent random secrets for `JWT_SECRET` and `INTEGRATION_ENCRYPTION_KEY` (at least 32 characters). Generate each with `openssl rand -hex 32`. Keep the encryption key stable after storing integration credentials.
- Actual AI provider key and your verified email sender/provider credentials.
- Your HTTPS domain in `FRONTEND_URLS` and `FRONTEND_APP_URL`.

The currently checked local environment is not a production environment: its production validation fails on JWT/encryption secrets, frontend URLs, and email settings. Do not copy it unchanged. Do not run `qa:reset` against production.

## Build and migrate

Run these as the `akeem` user after the administrator has granted directory access. Source only your own reviewed environment file; it must use shell-compatible `KEY=value` assignments and quote values containing spaces.

```bash
cd /opt/akeem/backend
set -a
. /etc/akeem/backend.env
set +a
npm ci --include=dev
npm run build
node -e "require('./dist/src/config/production-config').validateProductionConfig()"
npm run db:migrate
npx sequelize-cli db:migrate:status

cd /opt/akeem/frontend
npm ci --include=dev
npm run typecheck
VITE_API_URL=/api npm run build
```

`VITE_API_URL` is a build-time setting. Setting it only on the backend service does not change an existing frontend build. The frontend's local default points at localhost and must not be used for deployment.

All four migrations must be applied. Before upgrading an existing database, take a verified backup and pause the service. Migrations require the CLI development dependency, which is why the install explicitly includes development dependencies. The backend must retain `DB_SYNC=false`.

Publish the frontend `dist` contents into `/var/www/akeem` using your normal release process. Keep the previous frontend build for rollback. Ensure Nginx can read those files.

## Start and proxy

As an administrator, copy the supplied service file to `/etc/systemd/system/akeem-backend.service`. Confirm `/usr/bin/node` is your installed Node binary, or update `ExecStart` to its absolute path.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now akeem-backend
sudo systemctl status akeem-backend --no-pager
sudo journalctl -u akeem-backend -n 100 --no-pager
curl --fail http://127.0.0.1:3000/api/health/ready
```

Install the Nginx template as a site, replace the domain and enable it. Run `sudo nginx -t` before reloading. Obtain a valid TLS certificate using your certificate tooling and redirect HTTP to HTTPS before real users sign in. The supplied template is the initial HTTP configuration, not a completed TLS setup.

`HOST=127.0.0.1` binds the backend privately. `TRUST_PROXY=loopback` trusts the same-host Nginx proxy so rate limiting uses the actual client IP instead of putting all users in one shared proxy bucket. Do not change this to indiscriminate proxy trust.

The proxy retains the `/api` prefix, permits multipart overhead around the 10 MiB upload limit, and allows 650 seconds for AI requests. Keep the backend running as one instance initially. Chat is request-based; restarting the process can interrupt an active conversation. OCR may download its language model on first use, so verify outbound access and working-directory write access for the service user.

## Final acceptance on your server

1. Confirm `https://YOUR_DOMAIN/api/health/ready` succeeds, HTTPS is valid and the frontend loads directly and after refresh.
2. Create your real organization through signup; do not reuse the local QA identity. Test login, logout, refresh-token expiry, invitation delivery and password-reset email using addresses you control.
3. Create/select a project, switch modules and confirm Finance, Approvals, Automations and chat retain the chosen scope.
4. Run a suggest-mode chat and a specialist delegation. Confirm replies, saved history and delegation cards; then explicitly test a safe action in the intended project.
5. Create company/contact/deal records through the UI; select related records and change a deal stage. Create a draft invoice and a budget; check numeric values and project association.
6. Upload text and a scanned document; wait for processing, download them, and confirm the assistant can use their content. Verify downloads remain available after a service restart.
7. Create an automation, run it once and inspect its result. Verify a non-admin cannot perform admin-only operations.
8. Back up PostgreSQL, uploads and the encryption key; test restoring them. Retain previous application builds. Database migrations may need a separately planned rollback; switching code alone is not a database rollback.

Local test results are recorded separately in `docs/RELEASE_VERIFICATION.md`. TLS, server firewall, real email delivery, backup restore and deployed behavior can only be signed off after deployment on your Hetzner server.
