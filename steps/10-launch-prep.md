# Step 10: Launch Prep

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** End-to-end testing, performance testing, Supabase configuration, app store prep, privacy/legal compliance, and Dublin beta launch.

**Architecture:** Testing with Jest (unit), pgTAP (RLS), and manual QA. Performance tested with simulated load. Deployed via EAS Build for iOS/Android.

**Depends on:** Step 09 (Polish & Moderation) complete.

---

## Task 1: Unit Tests — Core Logic

**Files:**
- Create: `__tests__/lib/contentFilter.test.ts`
- Create: `__tests__/lib/auth.test.ts`
- Create: `__tests__/hooks/useFeed.test.ts`

**Step 1: Install testing dependencies**

```bash
npx expo install jest @testing-library/react-native jest-expo
npm install -D @types/jest
```

**Step 2: Write content filter tests**

`__tests__/lib/contentFilter.test.ts`:
```typescript
import { containsContactInfo } from "@/lib/contentFilter";

describe("containsContactInfo", () => {
  it("detects phone numbers", () => {
    expect(containsContactInfo("+353 85 123 4567")).toBe(true);
    expect(containsContactInfo("call me at 085-1234567")).toBe(true);
  });

  it("detects Instagram handles", () => {
    expect(containsContactInfo("my insta is @johndoe")).toBe(true);
    expect(containsContactInfo("instagram: cooluser")).toBe(true);
  });

  it("detects Snapchat handles", () => {
    expect(containsContactInfo("snap me: user123")).toBe(true);
  });

  it("detects URLs", () => {
    expect(containsContactInfo("check https://example.com")).toBe(true);
  });

  it("detects emails", () => {
    expect(containsContactInfo("email me john@example.com")).toBe(true);
  });

  it("allows normal messages", () => {
    expect(containsContactInfo("hey how are you?")).toBe(false);
    expect(containsContactInfo("I love coffee")).toBe(false);
    expect(containsContactInfo("let's meet for dinner")).toBe(false);
  });

  it("allows short @ mentions that could be normal text", () => {
    expect(containsContactInfo("@hi")).toBe(false); // too short
  });
});
```

**Step 3: Run tests**

```bash
npx jest
```
Expected: All tests pass.

**Step 4: Commit**

```bash
git add __tests__/ jest.config.js
git commit -m "test: add unit tests for content filter"
```

---

## Task 2: RLS Policy Tests

**Files:**
- Create: `supabase/tests/rls_tests.sql`

**Step 1: Write RLS test queries**

`supabase/tests/rls_tests.sql`:
```sql
-- Test: Users cannot see banned profiles
-- Set up: Create a banned user, verify they're hidden

-- Test: Users cannot see posts from blocked users
-- Blocked user creates a post, blocker should not see it

-- Test: Dating posts require dating_setup_done
-- User without dating setup should not see dating posts

-- Test: Messages only visible to chat participants
-- Non-participant should get empty result

-- Test: Content filter blocks phone numbers in unsaved chats

-- Test: Content filter allows phone numbers in saved chats

-- Test: Block trigger closes shared chats
-- Create block, verify chat status = 'closed'

-- Test: Mutual save trigger updates chat status
-- Both participants set has_saved = true, verify chat status = 'saved'
```

> **Note:** These are manual SQL tests to run via Supabase Dashboard SQL editor. For MVP, this is sufficient. Consider pgTAP for automated testing later.

**Step 2: Execute tests manually**

Run each test query in Supabase Dashboard, verify expected results.

**Step 3: Commit**

```bash
git add supabase/tests/
git commit -m "test: add RLS policy test queries for manual verification"
```

---

## Task 3: E2E Critical Path Testing

**Step 1: Manual QA checklist**

Test these critical paths manually on both iOS and Android:

### Flow 1: New Casual User
- [ ] Welcome → Signup (magic link)
- [ ] Intent: "Just Chat"
- [ ] Profile setup (name, skip photo)
- [ ] Tag selection (3+ vibes, 3+ topics)
- [ ] Feed loads with daily prompt
- [ ] Create a post (casual, 1:1)
- [ ] Post appears in feed

### Flow 2: New Dating User
- [ ] Welcome → Signup
- [ ] Intent: "Dating"
- [ ] Profile setup (name, photo required)
- [ ] Dating setup: phone verify
- [ ] Dating setup: selfie upload
- [ ] Dating setup: values card
- [ ] Dating setup: location permission
- [ ] Tag selection
- [ ] Feed shows both casual + dating tabs
- [ ] Create dating post (1:1 only)

### Flow 3: Chat Flow
- [ ] Join a post with opener
- [ ] Messages appear in real-time
- [ ] Chat shows in chat list
- [ ] System messages render correctly
- [ ] Content filter blocks phone numbers
- [ ] Save chat (mutual save)
- [ ] Contact info allowed after save

### Flow 4: Dating Upgrade
- [ ] Request upgrade from casual chat
- [ ] Redirect to dating setup if incomplete
- [ ] Other user sees accept/decline
- [ ] Accept → lane changes, values revealed
- [ ] Decline → chat continues as casual

### Flow 5: Plans
- [ ] Create plan from dating chat
- [ ] Select style, time, area
- [ ] Other user accepts
- [ ] Plan shows in Plans tab
- [ ] Check-in works at scheduled time
- [ ] Feedback form after date
- [ ] Reliability score updates

### Flow 6: Moderation
- [ ] Report user from chat
- [ ] Block user → chats close, posts hidden
- [ ] Unblock from settings → content reappears

**Step 2: Document any bugs found**

Create a bugs list and fix before launch.

**Step 3: Commit**

```bash
git commit -m "chore: complete E2E manual testing for all critical paths"
```

---

## Task 4: Performance Testing

**Step 1: Test these scenarios**

| Scenario | Target |
|----------|--------|
| Feed with 100+ posts | Smooth scroll, <1s initial load |
| Chat with 500+ messages | Smooth scroll, pagination works |
| 10+ active chats | List renders quickly |
| Image upload (5MB photo) | Compressed to <500KB, uploads in <5s |
| Supabase Realtime with 50 subscriptions | No dropped connections |

**Step 2: Optimize if needed**

- Enable FlatList optimization props: `removeClippedSubviews`, `maxToRenderPerBatch`, `windowSize`
- Add image caching with `expo-image` (faster than `Image`)
- Limit realtime subscriptions to active screen only

**Step 3: Commit performance improvements**

```bash
git commit -m "perf: optimize FlatList rendering and image handling"
```

---

## Task 5: Supabase Configuration

**Step 1: Set up production environment**

- [ ] Create Supabase production project (separate from dev)
- [ ] Apply all migrations to production
- [ ] Run seed data on production
- [ ] Configure RLS policies verified against production
- [ ] Set up Edge Function cron schedules:
  - `chat-expiry`: every 15 minutes
  - `dating-nudge`: every 30 minutes
  - `plan-reminders`: every 15 minutes
  - `plan-checkin-expiry`: every 5 minutes
- [ ] Set up database webhook for `reliability-calc` on `plan_feedback` INSERT
- [ ] Configure Twilio credentials in Edge Function secrets
- [ ] Set Supabase rate limits (auth: 30/hour, API: 100/min)
- [ ] Enable database backups

**Step 2: Update app env vars**

Create `.env.production`:
```
EXPO_PUBLIC_SUPABASE_URL=https://your-prod-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-prod-anon-key
```

**Step 3: Commit**

```bash
git commit -m "chore: configure Supabase production environment and cron schedules"
```

---

## Task 6: App Store Preparation

**Step 1: App store assets**

- [ ] App icon (1024x1024)
- [ ] Splash screen
- [ ] Screenshots (6.5" iPhone, 5.5" iPhone, iPad if targeting)
- [ ] Play Store feature graphic (1024x500)
- [ ] App description (short + long)
- [ ] Keywords / categories

**Step 2: EAS Build setup**

```bash
npx eas-cli login
npx eas build:configure
```

Update `eas.json`:
```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your@email.com",
        "ascAppId": "your-app-id"
      },
      "android": {
        "serviceAccountKeyPath": "./google-services.json"
      }
    }
  }
}
```

**Step 3: Build for testing**

```bash
npx eas build --platform all --profile preview
```

**Step 4: Commit**

```bash
git add eas.json
git commit -m "chore: configure EAS Build for iOS and Android"
```

---

## Task 7: Privacy & Legal

**Step 1: Create privacy policy**

Key GDPR requirements for Ireland:
- [ ] What data is collected and why
- [ ] How data is stored and protected
- [ ] User rights (access, rectify, delete, port)
- [ ] Data retention policy (selfies, messages, profile data)
- [ ] Third-party services (Supabase, Twilio, Expo)
- [ ] Cookie/tracking policy (minimal — no tracking for MVP)
- [ ] Contact information for DPO
- [ ] Age restriction (18+)

**Step 2: Create terms of service**

- [ ] Acceptable use policy
- [ ] Content moderation policy
- [ ] Account termination conditions
- [ ] Liability limitations
- [ ] Dispute resolution

**Step 3: Add legal links to app**

Add links to privacy policy and ToS in:
- Signup screen (below CTA)
- Settings screen
- App Store listing

**Step 4: Commit**

```bash
git commit -m "chore: add privacy policy and terms of service"
```

---

## Task 8: Beta Launch

**Step 1: Prepare beta launch**

- [ ] Deploy production build via EAS
- [ ] Invite 50-100 beta users (Dublin area)
- [ ] Stagger invites: 20 users day 1, 30 day 3, 50 day 5
- [ ] Ensure seed data provides initial content
- [ ] Set up feedback mechanism (in-app or external form)
- [ ] Monitor Supabase Dashboard for:
  - Auth errors
  - API errors
  - Edge Function failures
  - Realtime connection count
  - Storage usage

**Step 2: Post-launch monitoring**

- [ ] Check daily: Edge Function logs for cron job failures
- [ ] Check daily: Report queue (SQL query on `reports` table)
- [ ] Check weekly: User growth, post volume, chat engagement
- [ ] Check weekly: Content filter false positive rate

**Step 3: Feedback collection**

Create a simple feedback form (Google Forms or Typeform) linked from settings screen. Track:
- What do you like?
- What's confusing?
- What's missing?
- Would you recommend to a friend?
- Net Promoter Score (1-10)

---

## Checkpoint: Step 10 Complete — MVP READY

At this point you should have:
- [ ] Unit tests passing for core logic
- [ ] RLS policies verified manually
- [ ] All critical paths tested E2E
- [ ] Performance acceptable for MVP scale
- [ ] Supabase production configured with crons and webhooks
- [ ] EAS Build configured for iOS and Android
- [ ] Privacy policy and ToS created (GDPR compliant)
- [ ] App store metadata prepared
- [ ] Beta launch plan executed
- [ ] Monitoring and feedback collection in place

**The app is ready for Dublin beta launch.**
