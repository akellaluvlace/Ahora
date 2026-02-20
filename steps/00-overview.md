# Ahora — Implementation Steps Overview

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build Ahora — a tag-first, anti-vanity social app with casual chat + dating lanes.

**Architecture:** React Native (Expo Router) frontend with Supabase backend (Auth, Realtime, Storage, Edge Functions). PostgreSQL with RLS for data security. Chat as an isolated swappable module.

**Tech Stack:** Expo/React Native, Expo Router, Supabase (Auth, Realtime, Storage, Edge Functions), PostgreSQL, Nativewind (TailwindCSS), Zustand, TypeScript

---

## Step Dependency Graph

```
Step 01: Foundation
  └─→ Step 02: Onboarding
       └─→ Step 03: Feed & Posts
            └─→ Step 04: Chat Core
                 └─→ Step 05: Chat Features
                 │    └─→ Step 06: Dating Upgrade
                 │         └─→ Step 07: Plans Engine
                 │              └─→ Step 08: Follow-Through
                 └─→ Step 09: Polish & Moderation
                      └─→ Step 10: Launch Prep
```

## Steps Summary

| Step | Name | Sprint | Key Deliverables |
|------|------|--------|-----------------|
| 01 | Foundation | 1 | Expo project, DB schema, RLS, auth flow, basic profile |
| 02 | Onboarding Complete | 2 | Intent selection, tags, dating setup, phone verify, values card |
| 03 | Feed & Posts | 3 | Feed screen, post cards, create post, post expiry |
| 04 | Chat Core | 4 | Join flow, realtime messaging, chat list, system messages |
| 05 | Chat Features | 5 | Chat expiry, mutual save, content filter, report/block |
| 06 | Dating Upgrade | 6 | Casual→Dating upgrade flow, dating nudge |
| 07 | Plans Engine | 7 | Plan creation, proposal/acceptance, plans tab |
| 08 | Follow-Through | 8 | Push notifications, reminders, check-in, feedback, reliability |
| 09 | Polish & Moderation | 9 | Daily prompts, feed algorithm, moderation, edge cases |
| 10 | Launch Prep | 10 | E2E testing, performance, app store prep, beta launch |

## Conventions

- **File paths** are relative to project root `ahora/`
- **TDD**: Write failing test → verify fail → implement → verify pass → commit
- **Commits**: Small, frequent, one logical change per commit
- **Branch strategy**: Feature branches off `main`, PRs for each step
- **State management**: Zustand stores per domain
- **Styling**: Nativewind (Tailwind classes via `className` prop)
- **Navigation**: Expo Router file-based routing

## Key Config Values

```typescript
// constants/config.ts
export const CONFIG = {
  CASUAL_CHAT_EXPIRY_HOURS: 72,
  DATING_CHAT_EXPIRY_DAYS: 7,
  POST_EXPIRY_HOURS: 24,
  POST_SHORT_EXPIRY_HOURS: 6,
  MAX_PROMPT_LENGTH: 280,
  MAX_MESSAGE_LENGTH: 1000,
  MAX_DISPLAY_NAME_LENGTH: 20,
  MAX_GROUP_PARTICIPANTS: 8,
  MIN_AGE: 18,
  NUDGE_AFTER_HOURS: 48,
  NUDGE_MIN_MESSAGES: 10,
  CHECKIN_GRACE_MINUTES: 30,
  RELIABILITY_SHOWED_UP: 3,
  RELIABILITY_NO_SHOW: -5,
  RELIABILITY_RESPECTFUL: 1,
  RELIABILITY_DISRESPECTFUL: -2,
  RELIABILITY_MEET_AGAIN: 1,
  RELIABILITY_LOW_THRESHOLD: 0,
  RELIABILITY_HIGH_THRESHOLD: 10,
};
```
