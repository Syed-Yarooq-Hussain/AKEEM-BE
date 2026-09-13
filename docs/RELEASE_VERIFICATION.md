# Local release verification — 2026-09-12

The user will deploy manually to Hetzner. See [the deployment runbook](HETZNER_DEPLOYMENT.md). No remote deployment was attempted.

## Verified locally

- Headless Edge login and navigation through 21 desktop screens: Dashboard, Projects, Command Center, AI Tasks, Assistant Hub, all eight assistants, Approvals, Automations, CRM, Finance, Files, Reports, Settings and Administration. No captured API failures or page runtime errors in the successful navigation run.
- Browser project creation and selection followed by a project-scoped budget creation with decimal amount `123.45`.
- Browser company, contact and deal creation using numeric selected relation IDs; an empty optional close date was omitted. Deal stage update sent numeric `stageId` from the selected pipeline.
- Browser Command Center retained the selected project and completed a real provider request in suggest mode.
- Browser text upload retained the project ID. Mobile navigation and screenshots checked at 390 × 844.
- Browser document processing reached `ready`. Authenticated download returned the exact bytes and original filename. Replacing the access token with an invalid test token triggered exactly one refresh and a successful retry. Deleting that test file succeeded.
- Backend and frontend builds passed; frontend TypeScript and the existing frontend payload regression script passed. The production configuration regression test passed. The previous full backend run (2026-09-11) passed 19 suites / 47 tests and one authentication e2e test; it was not repeated for the startup/CORS-only change.
- Final restarted backend readiness passed: database, storage, configured AI key and automation worker. Real browser chat, rather than the readiness key check alone, verified provider connectivity.

## Fixes discovered during this pass

- Files UI used a legacy direct file URL. It now downloads from the authenticated `/files/:id/download` route; report downloads share the refresh-aware download helper.
- Files UI now polls pending/processing files, displays terminal status/error and offers processing retry. Supported upload extensions match the backend; legacy `.doc` and `.xls` are no longer offered. Old copy claiming agents cannot read documents was corrected.
- CORS now exposes `Content-Disposition`, enabling the frontend to preserve the server's filename across development origins.
- Backend supports an explicit bind host and trusted proxy setting. The Hetzner example binds to loopback and trusts only a same-host reverse proxy, preserving client IPs for rate limiting.
- Added systemd, Nginx and production environment templates plus manual deployment instructions. Nginx retains `/api/`, supports long chat requests and separates static assets from backend/storage files.

## Evidence and repeatability

Generated screenshots and machine-readable results were removed during the user-requested cleanup on 2026-09-13. This document preserves the reported verification results. The successful create-flow run used QA project 5 (`Browser QA 1789246192433`), budget 3, company/contact 36, deal 3, file 2 and conversation 62. These are QA records, not customer data. Database records and uploaded documents were not deleted during filesystem cleanup.

Remaining regression check:

- Frontend: `node tests/api-contract.cjs` checks selection, relation/stage payloads, finance scope, automation payloads and numeric/date serialization.

The temporary browser scripts were already absent when cleanup began. For manual browser checks, start the backend and wait for `/api/health/ready`. The configured local CORS origin is `http://localhost:5173`; `http://127.0.0.1:5173` is a different browser origin.

## Checks that require the Hetzner deployment

These local checks are not full production certification. Real server TLS, firewall, persistent storage, backup/restore, real email delivery and the invitation/password-reset flows, OCR language assets on Linux, and deployed user workflows still require verification on that server. Nginx/systemd templates were prepared here but have not been executed on a Linux host. Replace production environment placeholders and follow the runbook before opening access to users.
