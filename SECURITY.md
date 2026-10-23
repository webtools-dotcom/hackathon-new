# Security

## Reporting a vulnerability
Open a private security advisory on this repository (Security tab, "Report a vulnerability"), or contact the maintainer through their GitHub profile. This is a hackathon project with no SLA, but reports are welcome.

## Threat model

| Threat | Mitigation | Where |
|---|---|---|
| API key leaks to the browser or the repo | Key read only from `process.env` in server route handlers; `.env*` is git-ignored; `.env.example` holds placeholders only | `src/app/api/*`, `.gitignore` |
| Prompt injection through uploaded data | Uploaded content is passed as data, never as instructions; model output only selects from an allow-list of operations; output is validated with Zod | `src/lib/server/prompts.ts`, `src/lib/engine/validate.ts` |
| Model returns malicious or malformed output | Schema-constrained output + Zod validation; no `eval`, no dynamic code execution | `src/lib/server/gemini.ts`, `src/lib/engine/validate.ts` |
| Personal data sent to a third party | Personal columns detected and masked in the browser; raw rows never leave the browser | `src/lib/engine/mask.ts`, `src/lib/agent/run-agent.ts` |
| Oversized or malformed requests | Request size caps and Zod validation on every route | `src/lib/server/http.ts`, `src/lib/server/contracts.ts` |
| Abuse / cost exhaustion | Per-IP rate limiting on API routes (in-memory; see limitations) | `src/lib/server/rate-limit.ts` |
| Browser-side attacks (XSS, clickjacking, sniffing) | Security headers set in `next.config` (CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy); no `dangerouslySetInnerHTML` | `next.config.ts` |
| Information leaks through errors | Generic error messages to clients; details only in server logs | `src/lib/server/http.ts`, `src/app/api/*/route.ts` |

## Dependencies
- Lockfile is committed; CI installs with `npm ci`.
- `npm audit --omit=dev` is run in CI and currently reports 0 vulnerabilities.
- `npm audit` (including dev dependencies) reports 7 high-severity advisories, all from the same chain: `braces` (GHSA-vfj7-8cjw-p6xm) via `micromatch` / `fast-glob` inside the `shadcn` CLI and `ts-morph`. The `shadcn` CLI is a dev-only code generator (moved to `devDependencies`); at build time only its static `tailwind.css` is imported. It never runs in the deployed app and never processes user input, so the denial-of-service path is not reachable. The only offered fix is `npm audit fix --force`, which downgrades `shadcn` to 1.0.0 (breaking), so it is not applied.

## Known limitations
- Rate limiting is in-memory, so it is per server instance. A production deployment would use a shared store.
- There is no authentication: the app stores no user data.
- The CSP allows `'unsafe-inline'` scripts because pages are statically prerendered; nonces would force dynamic rendering.
- PII detection is pattern-based (column names and value formats) and can miss unusually named columns.
