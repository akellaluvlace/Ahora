# Ahora — Project Rules

## What This Is

Tag-first, anti-vanity social app with casual chat + dating lanes.
Stack: React Native (Expo) + Supabase + PostgreSQL + Nativewind.

## Git Rules

- Remote: https://github.com/akellaluvlace/Ahora
- **Never co-sign commits.** No `Co-Authored-By` lines.
- Keep it simple: `git add`, `git commit`, `git push`. No overengineering.
- Commit messages: short, lowercase, imperative. e.g. `feat: add feed screen`
- Push to `main` unless told otherwise.

## Progress Tracking

Current step progress is tracked in `steps/PROGRESS.md`.
After completing each step, update that file.

## Project Structure

```
ahora/
├── plan.md              — Full project plan (reference, don't modify)
├── steps/               — Broken-down implementation steps (00-10)
├── CLAUDE.md            — This file (project rules)
├── app/                 — Expo Router pages (created in Step 01)
├── components/          — Shared components
├── lib/                 — Core logic
├── hooks/               — Custom hooks
├── stores/              — Zustand stores
├── constants/           — Config, theme
├── types/               — TypeScript types
├── supabase/            — Migrations, edge functions, seed
└── assets/              — Images, fonts
```

## Review Protocol

Rules for running automated code review agents.

### Agent Selection — 3 focused agents max:

| Agent | Use For | Strength |
|-------|---------|----------|
| `pr-review-toolkit:silent-failure-hunter` | After any step completion | Best signal-to-noise — finds real silent failures |
| `pr-review-toolkit:type-design-analyzer` | After schema/type changes | Catches drift between layers |
| `coderabbit:code-reviewer` | General coverage | Good breadth, moderate noise |

Skip multiple `superpowers:code-reviewer` instances on the same code.

### Triage Before Fixing

**Never bulk-fix all findings.** Follow this flow:

1. **Collect** — run agents, let them all finish
2. **Deduplicate** — merge identical findings across agents (expect 40-60% overlap)
3. **Present** — show the user a deduplicated list with severities
4. **Get approval** — user picks which findings to fix
5. **Fix in batches** — group by category (errors, types, validation, etc.)
6. **Test after each batch** — typecheck + test after each category

### False Positive Rules

- **Never trust severity labels** — automated "CRITICAL" may be wrong. Cross-reference before acting.
- **Verify existence claims** — if a tool says "version X doesn't exist" or "function Y is unused," verify before changing.
- **Conflicting advice** — pick the simpler fix or ask the user. Don't implement both.
- **"Should add" suggestions** — these are backlog items, not blockers. Note but don't implement unless requested.

### Blast Radius Awareness

Before implementing a review fix, check:
- Does this type/interface have consumers? Changing shapes is safe early, dangerous late.
- Does this change cascade? Tightening types requires updating every consumer.
- Is the fix in the right layer? Input validation belongs in API routes, not schemas.

## Coding Conventions

- TypeScript strict mode
- Nativewind for styling (className prop with Tailwind classes)
- Zustand for state (one store per domain)
- Expo Router file-based navigation
- Supabase RLS for authorization (no API-level auth checks for reads)
- Edge Functions in Deno for server-side logic
- No comments unless logic is non-obvious
- No over-engineering — MVP first
