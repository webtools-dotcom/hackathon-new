# CLAUDE.md

## Context
This is a time-boxed hackathon project (Prompt War 2026, individual, ~3 hours to build).
Goal: a polished, deployable, secure AI data-analyst agent (Gemini) that solves ONE real problem and demos well.
An AI agent judges the repo on: Security, Efficiency, Technology Implemented, Performance, Google Technology Used.
Everything claimed in docs must be true and verifiable in code. Speed and a working deploy matter more than completeness.

## Stack
- Next.js (App Router, TypeScript, `src/` dir), Tailwind CSS v4
- shadcn/ui components in `src/components/ui` (add more with `npx shadcn@latest add <name>`)
- Charts: shadcn `chart` (recharts). Icons: lucide-react. Dark mode: next-themes (class strategy)
- Deploy: Vercel via GitHub (push to `main` = production deploy)

## Hard rules
- The repo is PUBLIC. No database, no auth. Secrets only in `.env.local` (git-ignored) and Vercel settings.
- Gemini via `@google/genai`, server-side only in `src/app/api/*` route handlers. `GEMINI_API_KEY` / `GEMINI_MODEL` read from `process.env` at request time; never `NEXT_PUBLIC_`. `npm run build` must pass without secrets.
- Raw user data stays in the browser. The model only gets column profiles, masked samples and computed aggregates.
- Zod validation on every request body and every model output. Model output only selects allow-listed operations. No `eval`/`new Function`.
- Request size caps, per-IP rate limit, security headers in `next.config.ts`, generic errors to clients, no `dangerouslySetInnerHTML`.
- TypeScript strict, no `any`/`@ts-ignore`/`console.log`. Vitest tests for every behavior change (`npm test`).
- Sample/demo data lives in typed files under `src/lib/` (e.g. `src/lib/sample-data.ts`). Never inline fake data in components.
- Do not add dependencies unless truly needed. Prefer what is already installed. Tell me before adding one.
- Mobile-first and responsive. Everything must work at 375px wide and on a projector (1280px).
- Dark and light mode must both look good. Use theme tokens (`bg-background`, `text-muted-foreground`), never hardcoded hex colors in components.
- Imports are case-sensitive on Vercel (Linux). File names must match imports exactly (kebab-case files).
- Keep it simple: max 3 routes. One main flow that is excellent beats many half-done features.

## How to work (save tokens, my usage limit is tight)
- Do not read the whole repo. Read only the files needed for the task.
- Change as few files as possible per task. No unrelated refactors, no renaming, no reformatting.
- Do not re-explain what you did at length. After finishing, reply in 3 lines max: what changed, files touched, anything I must check.
- Plan first only when I say "plan". Otherwise just implement.
- Run `npx tsc --noEmit` after larger changes. Run `npm run build` only when I ask or before a deploy.
- If a task is ambiguous, pick the most sensible option and say which one you picked. Don't ask more than one question.
- Commit-friendly: keep the app in a working state after every task.

## Design direction (important: it must NOT look like a generic AI template)
- One accent color plus neutrals. No purple-to-blue gradient everywhere. No rainbow.
- Strong type hierarchy: large confident headings, comfortable body text, generous whitespace. Use the Geist or Inter font via `next/font`.
- Consistent spacing scale (4/8/12/16/24/32/48). Consistent radius. Subtle borders and soft shadows, not heavy ones.
- Real-feeling content: specific names, Indian context where relevant (cities, ₹, units), plausible numbers. NEVER "Item 1", "Lorem ipsum", "Acme", "John Doe".
- Copy must sound human and specific. Banned words: revolutionize, seamless, leverage, cutting-edge, empower, ecosystem, game-changer, unlock.
- No emoji as icons. Use lucide-react.
- Every screen needs: a loading/skeleton state, an empty state, and hover/focus states on interactive elements.
- Add small motion only where it helps: count-up numbers, smooth chart transitions, hover lifts, fade-in on mount. Respect `prefers-reduced-motion`.
- The UI should make the PROBLEM visible (before/after, a timeline, a heatmap, a live status), not just list data.
- One memorable "wow" element, executed well (e.g. an interactive chart, a live simulation, a map, a smart suggestion panel). Not five gimmicks.
- Layout is not always centered cards in a 3-column grid. Vary the layout: a sidebar, a split hero, a bento grid, a timeline.

## Finishing checklist (when I say "finalize")
1. Replace the page title, favicon, and metadata with the real project name.
2. Remove all leftover template/demo content.
3. Check responsive layout at 375px and 1280px, in both themes.
4. Fix type errors and lint warnings. Run `npm run build` and make sure it passes.
5. Update `README.md`: project name, one-line problem, solution, how it works, tech stack, how to run (`npm install`, `npm run dev`), and the live link placeholder.
