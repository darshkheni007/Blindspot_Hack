# Blindspot

> Risk tools track what you've already identified. Blindspot finds what you haven't.

Blindspot reads project documents (PRDs, plans, budgets, contracts, spreadsheets) and surfaces what the team has **not** considered: missing assumptions, overlooked constraints, contradictions between documents and unasked questions. Findings are ranked by impact and every one is backed by quoted evidence.

The product name is a placeholder. Change it in one place: `src/config/app.ts` (`APP.name`), which also holds the plan limits.

## Status: what is and isn't verified

| Area | State |
|---|---|
| App, auth (email + password), projects, upload, parsing (PDF/DOCX/XLSX/CSV/TXT/MD), findings UI, exports, settings, delete flows | Built and tested (unit, tenant-isolation and browser e2e tests below) |
| Analysis with the **mock provider** | Built and tested. Rule-based and deterministic, runs offline on your real text. It finds a useful subset (dates, money, capacity, checklist gaps, unsupported assumptions) but is **not** an LLM, so it will miss subtle issues |
| Analysis with the **Anthropic provider** | Code written (retries, backoff, JSON repair, "provider unavailable" message) but **not run against the live API**: no key was available while building |
| S3-compatible storage driver | Code written, **not run** against a real bucket. Local disk driver is tested |
| Google sign-in | Wired in, **not tested**. Needs `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` |
| Billing | Not built. Plans only enforce limits; every account is Free |
| Out of scope (extension points only) | SSO/SAML, Drive/Jira/Slack connectors, co-editing, on-prem, mobile apps |

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Radix primitives (shadcn-style components in `src/components/ui`) · lucide-react · Prisma 7 + Postgres · Auth.js v5 (JWT sessions) · Zod · Vitest · Playwright.

## Setup

Requirements: Node 20+, Postgres 14+.

```bash
npm install
cp .env.example .env          # then fill in DATABASE_URL and AUTH_SECRET
npm run db:generate           # generates the Prisma client
npm run db:migrate            # applies prisma/migrations to DATABASE_URL
npm run dev                   # http://localhost:3000
```

Optional demo data (creates a demo account with a fully populated sample project, analysed twice so the trend chart and New/Resolved diff have data):

```bash
SEED_DEMO_PASSWORD='choose-a-long-password' npm run db:seed   # demo email: demo@blindspot.local
```

If you don't set `SEED_DEMO_PASSWORD` a random one is printed once. Never seed production. You can also click **Open the sample project** on an empty dashboard.

> **Prisma engine note.** In the sandbox this was built in, Prisma's `migrate dev` could not download its schema engine. `prisma/migrations/0001_init/migration.sql` was generated from `schema.prisma` with `scripts/prisma-schema-to-sql.py` and applied with `psql`. On a normal machine run `npx prisma migrate dev` after schema changes and commit the result. `npm run db:migrate` runs `prisma migrate deploy`.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `AUTH_SECRET` | yes | Session signing key. `openssl rand -base64 32` |
| `APP_URL` | yes | Public base URL |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | no | Enables "Continue with Google" |
| `ANALYSIS_PROVIDER` | no | `mock` (default) or `anthropic` |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | for `anthropic` | Key and model name |
| `STORAGE_DRIVER` | no | `local` (default) or `s3` |
| `STORAGE_LOCAL_DIR` | no | Local upload folder (default `./storage`) |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | for `s3` | Any S3-compatible store |
| `TRUST_PROXY` | no | `true` only behind a proxy that sets `X-Forwarded-For` (used for rate limiting) |
| `DATABASE_URL_TEST` | no | Test database. Defaults to the same server's `blindspot_test` |

Serve over HTTPS in production: the session cookie is `Secure` there. Rate limiting is in-memory (per process); use a shared store if you run several instances.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` / `lint` | `tsc --noEmit` / ESLint |
| `npm test` | Vitest unit + database tests (uses the **test** database) |
| `npm run test:e2e` | Playwright: sign up → create → upload → analyze → view findings → triage → export, plus a cross-account check. Starts its own dev server on port 3101 against the test database. Set `PLAYWRIGHT_CHROMIUM_PATH` if your Chromium isn't the one Playwright expects |
| `npm run db:seed` | Demo account and sample project |
| `npx tsx scripts/try-pipeline.ts` | Runs the pipeline on the sample files and prints ranked findings |

Create the test database once and apply the migration to it:
`createdb blindspot_test && psql blindspot_test -f prisma/migrations/0001_init/migration.sql`.

## Architecture

```
Browser
  │  fetch / polling (1.2 s while a run is active)
  ▼
Next.js App Router
  ├─ src/app/(app)/…        pages: dashboard, wizard, project tabs, settings (server components + client islands)
  ├─ src/app/api/…          route handlers: Zod-validated, rate-limited, workspace-scoped
  ├─ src/proxy.ts           redirects visitors with no session cookie (every page/route re-checks the session)
  └─ src/auth.ts            Auth.js config → JWT carries user id + workspace id
        │
        ▼
src/lib/data/*              the ONLY code that reads/writes Prisma. Every function takes `ws` (workspaceId) first
        │                   and puts it in the WHERE clause. ESLint forbids importing Prisma from app/ or components/
        ▼
Postgres  ◄───────────────  every table carries workspaceId

src/lib/documents.ts ──► Storage (local | s3)      key = <ws>/<project>/<docId>-<safeName>
        │ enqueue parse
        ▼
src/lib/queue (in-process, keyed serialization; swap for BullMQ/Inngest behind the same interface)
        │
        ▼
src/lib/analysis/
  service.ts      start a run (creates AnalysisRun row, enqueues) and returns immediately
  pipeline.ts     reading → assumptions → contradictions → ranking, upserting findings as they are verified
  detectors/      assumptions · checklist · contradictions · quantitative · questions   (each returns Zod-validated JSON)
  verifier.ts     tries to refute each finding; drops or downgrades; no evidence → rejected
  specificity.ts  discards findings that could apply to any project
  scoring.ts      pure priority function (unit tested)
  dedupe.ts       merges repeats / shared root causes
  providers/      LLMProvider interface: anthropic.ts, mock.ts
prompts/v1/*.md   versioned prompts; every run records provider, model and prompt version
```

How a run works:

1. Uploads are validated (extension, size ≤ 25 MB, magic bytes), stored, then parsed in the background into chunks with locators (`line 8`, `p.3`, `Sheet!A5:D5`, `row 7`). Re-uploading an unchanged file is a no-op; a changed file replaces the old one and only that file is re-read.
2. Your wizard answers (goal, deadline, budget, team size, known risks) become a synthetic "Project details" chunk so they are cross-checked like any document.
3. Detectors produce raw findings. The verifier checks every quote exists verbatim in the cited document and that absence claims aren't contradicted anywhere in the corpus.
4. Findings are scored: `priority = Impact^wI × Likelihood^wL × Irreversibility^wR × Proximity^wP ÷ Cost^wC`, each factor 1–5, mapped to 0–100 on a log scale. Severity: Critical ≥ 85, High ≥ 72, Medium ≥ 55, else Low. The **Adjust weights** control (0–2) re-scores in the browser with the same function.
5. Each finding has a stable fingerprint, so a re-run labels it New, Worsened, Unchanged or Resolved.

## Add a checklist item (no code)

Checklists are editable JSON in `src/lib/analysis/checklists/<domain>.json`, plus `other.json` which applies to every domain. Add an object:

```json
{
  "id": "rollback",
  "label": "Rollback / back-out plan",
  "group": "launch-readiness",
  "anchors": ["cutover", "go-live", "launch"],
  "keywords": ["rollback", "roll back", "back out", "fallback"],
  "title": "Going to production (“{anchor}”) is planned, but nothing says how to back out",
  "why": "…", "question": "…", "owner": "Engineering lead", "nextStep": "…", "disproof": "…",
  "category": "CONSTRAINT",
  "factors": { "impact": 5, "likelihood": 4, "irreversibility": 4, "proximity": 4, "cost": 2 },
  "justifications": { "impact": "…", "irreversibility": "…", "cost": "…" }
}
```

An item fires only when one of its `anchors` appears in the documents (empty = always applicable) and none of its `keywords` do. `{anchor}` is replaced by the word as written in the documents, which keeps findings specific. Invalid items fail Zod validation at load. At most 5 checklist findings are kept per run.

## Add a detector

1. Create `src/lib/analysis/detectors/mine.ts` exporting `async function detectMine(ctx: DetectorContext): Promise<{ findings: RawFinding[] }>`. Build findings with the `finding()` and `ev()` helpers; every evidence quote must be copied verbatim from the corpus or the verifier will drop it.
2. For an LLM-backed detector, add `prompts/v1/mine.md`, load it with `loadPrompt`, call `ctx.provider.generate({ task, system, prompt, input, schema })` and validate with `validateItems(RawFindingSchema, …)`. Add the task id to `TaskId` in `providers/types.ts` and a rule-based fallback in `providers/mock.ts` so the app still works without a key.
3. Register it in `pipeline.ts` in the step it belongs to.
4. Add a unit test in `tests/`.

Bump `PROMPT_VERSION` (and copy `prompts/v1` to `prompts/v2`) when you change prompt text, so runs record which prompts produced them.

## Security and privacy notes

- Every query is scoped by `workspaceId`; `tests/tenant-isolation.test.ts` and the e2e suite check cross-tenant reads and writes fail. Files live under `<workspaceId>/…`; the local driver refuses path escapes and writes files `0600`. Uploads are never executed or served back inline.
- Document text is never logged. The API returns generic errors for server failures.
- Passwords: argon2id, 10+ characters, login limited to 8 attempts per 10 minutes per email. Rate limits also cover sign-up, uploads, analysis and exports.
- **Delete project** and **Delete my data** (Settings) remove files from storage and rows from the database.
- With the Anthropic provider, document excerpts are sent to the Anthropic API to produce findings. The landing page promise that documents are never used to train models is a product statement: confirm it against your agreement with your model provider before you publish it.
- CSV export neutralises spreadsheet formula injection.

## Known limits

- Scanned PDFs without selectable text can't be read (no OCR). The PDF reader (`pdf-parse`) is old and can fail on some valid PDFs; failures show as "Failed" with a message.
- The in-process queue and rate limiter don't survive restarts or span instances. Runs stuck for over 10 minutes are marked failed.
- No email provider: there is no password reset or email verification yet.
- Paid-plan billing isn't connected.
