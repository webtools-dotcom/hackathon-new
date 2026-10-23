# AGENTS.md

Operational notes for AI coding and review agents. Project overview, architecture and security model are in [README.md](README.md) and [SECURITY.md](SECURITY.md).

## Commands
- Install: `npm ci`
- Dev server: `npm run dev`
- Full check (run before every commit): `npm run lint && npx tsc --noEmit && npm test && npm run build`

## Layout
- `src/lib/engine/`: browser-side, pure, unit tested. `schemas.ts` (Zod contracts), `profile.ts` (column profiler), `mask.ts` (PII masking), `execute.ts` (allow-listed deterministic engine), `anomaly.ts`.
- `src/lib/sample-data.ts`: built-in demo dataset (Indian restaurant sales). `src/lib/demo-results.ts`: cached demo plan/narration.
- `src/lib/server/`: server-only. `gemini.ts` (client, retry/backoff), `rate-limit.ts`, `cache.ts`, `prompts.ts`.
- `src/app/api/plan/route.ts`, `src/app/api/narrate/route.ts`: the only code that calls Gemini.
- `src/lib/insights.ts`: pure helpers that turn results into headlines and period labels.
- `src/components/analyst/`: app UI (`analyst-app.tsx` orchestrates; `hero.tsx`, `error-state.tsx`, charts, trace, drawer are leaf components). `src/components/ui/` is shadcn/ui output, do not hand-edit.
- `scripts/bench.ts`: measures payload sizes and engine timings for the README.

## Rules
- TypeScript strict. No `any`, no `@ts-ignore`, no `eval` / `new Function`.
- Model output is untrusted input: validate with Zod, and only map it onto allow-listed operations.
- `GEMINI_API_KEY` is read from `process.env` on the server at request time. Never prefix with `NEXT_PUBLIC_`, never commit it. `npm run build` must pass without any secrets.
- Raw user data stays in the browser. Send the model only column profiles, masked samples and computed aggregates.
- Add or update a test for every behavior change. Keep commits small, with conventional messages (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
- Do not add dependencies without a reason stated in the commit message.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
