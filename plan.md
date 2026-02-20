# Ahora — Full Project Plan (MVP)

**Tag-first, anti-vanity social app with casual chat + dating lanes**
**Stack:** React Native (Expo) • Supabase • PostgreSQL • Nativewind

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                  EXPO / RN APP                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐│
│  │  Auth     │ │  Feed    │ │  Chat (Realtime) ││
│  │  Screens  │ │  Screens │ │  Module          ││
│  └──────────┘ └──────────┘ └──────────────────┘│
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐│
│  │  Profile  │ │  Plans   │ │  Dating Setup    ││
│  │  Screens  │ │  Screens │ │  Screens         ││
│  └──────────┘ └──────────┘ └──────────────────┘│
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│               SUPABASE BACKEND                  │
│  ┌────────┐ ┌──────────┐ ┌────────────────────┐│
│  │  Auth   │ │  Realtime│ │  Storage (photos)  ││
│  │  (email)│ │  (chat)  │ │                    ││
│  └────────┘ └──────────┘ └────────────────────┘│
│  ┌────────────────────────────────────────────┐ │
│  │  PostgreSQL (RLS enabled)                  │ │
│  └────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────┐ │
│  │  Edge Functions (Deno)                     │ │
│  │  - chat expiry cron                        │ │
│  │  - nudge triggers                          │ │
│  │  - plan reminders (push)                   │ │
│  │  - phone OTP (Twilio)                      │ │
│  │  - reliability score calc                  │ │
│  └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Key Architecture Decisions

- **Chat as isolated module**: All chat logic in its own directory with a clean interface. If Supabase Realtime hits limits, swap to Stream/Ably without touching the rest of the app.
- **RLS everywhere**: Row Level Security on every table. Users only see what they're allowed to see. No API-level auth checks needed for reads.
- **Edge Functions for side effects**: Anything time-based (expiry, nudges, reminders) runs as Supabase Edge Functions on cron or triggered by database webhooks.
- **Expo Router**: File-based routing, feels like Next.js. Tab navigator for main screens, stack navigators within each tab.

---

## 2. Data Model (Supabase / PostgreSQL)

### Enums

```sql
CREATE TYPE user_intent AS ENUM ('casual', 'dating', 'both');
CREATE TYPE lane_type AS ENUM ('casual', 'dating');
CREATE TYPE post_format AS ENUM ('one_on_one', 'group');
CREATE TYPE chat_status AS ENUM ('active', 'expired', 'saved', 'closed');
CREATE TYPE plan_status AS ENUM ('proposed', 'confirmed', 'completed', 'cancelled', 'no_show');
CREATE TYPE verification_status AS ENUM ('unverified', 'phone_verified', 'selfie_pending', 'selfie_verified', 'rejected');
CREATE TYPE date_style AS ENUM ('coffee', 'walk', 'activity', 'dinner');
CREATE TYPE reliability_tier AS ENUM ('new', 'low', 'medium', 'high');
CREATE TYPE report_reason AS ENUM ('harassment', 'spam', 'inappropriate', 'fake_profile', 'no_show', 'other');
CREATE TYPE report_status AS ENUM ('pending', 'reviewed', 'actioned', 'dismissed');
```

### Tables

#### `profiles`
The single user identity table. Extends Supabase auth.users.

```
profiles
├── id                  UUID (PK, FK → auth.users)
├── display_name        TEXT (required)
├── age                 INTEGER (required, from DOB at signup)
├── show_age            BOOLEAN (default true)
├── intent              user_intent (casual/dating/both)
├── photo_url           TEXT (nullable — required for dating)
├── phone_number        TEXT (nullable, unique, E.164 format)
├── phone_verified      BOOLEAN (default false)
├── phone_country_code  TEXT (nullable, e.g. '+353')
├── verification_status verification_status (default 'unverified')
├── selfie_url          TEXT (nullable — verification artifact, never public)
├── location_verified   BOOLEAN (default false)
├── location_lat        FLOAT (nullable — stored at dating signup only)
├── location_lng        FLOAT (nullable)
├── reliability_tier    reliability_tier (default 'new')
├── reliability_score   FLOAT (default 0, internal only)
├── dating_setup_done   BOOLEAN (default false)
├── is_banned           BOOLEAN (default false)
├── ban_reason          TEXT (nullable)
├── created_at          TIMESTAMPTZ
├── updated_at          TIMESTAMPTZ
└── last_active_at      TIMESTAMPTZ
```

#### `vibe_tags`
System-managed list of vibe tags.

```
vibe_tags
├── id          UUID (PK)
├── name        TEXT (unique, e.g. 'chill', 'curious', 'playful', 'serious')
├── emoji       TEXT (optional display emoji)
└── sort_order  INTEGER
```

#### `topic_tags`
System-managed list of topic tags.

```
topic_tags
├── id          UUID (PK)
├── name        TEXT (unique, e.g. 'music', 'films', 'gym', 'food', 'travel')
├── emoji       TEXT
└── sort_order  INTEGER
```

#### `user_vibe_tags`
User's selected vibe preferences (for recommendations).

```
user_vibe_tags
├── user_id     UUID (FK → profiles)
├── vibe_tag_id UUID (FK → vibe_tags)
└── PRIMARY KEY (user_id, vibe_tag_id)
```

#### `user_topic_tags`
User's selected topic preferences.

```
user_topic_tags
├── user_id      UUID (FK → profiles)
├── topic_tag_id UUID (FK → topic_tags)
└── PRIMARY KEY (user_id, topic_tag_id)
```

#### `values_cards`
Dating lane requirement — one per user.

```
values_cards
├── id                  UUID (PK)
├── user_id             UUID (FK → profiles, unique)
├── looking_for         TEXT (free text, 1-2 lines)
├── dealbreakers        TEXT[] (array of strings)
├── relationship_intent TEXT (e.g. 'long-term', 'open to anything', 'serious only')
├── created_at          TIMESTAMPTZ
└── updated_at          TIMESTAMPTZ
```

#### `posts`
The core content unit — every interaction starts here.

```
posts
├── id              UUID (PK)
├── author_id       UUID (FK → profiles)
├── lane            lane_type (casual/dating)
├── vibe_tag_id     UUID (FK → vibe_tags)
├── topic_tag_id    UUID (FK → topic_tags)
├── prompt_text     TEXT (1-3 lines, max 280 chars)
├── format          post_format (one_on_one/group)
├── max_participants INTEGER (default 2 for 1:1, up to 8 for group)
├── current_joins   INTEGER (default 0)
├── is_full         BOOLEAN (default false)
├── expires_at      TIMESTAMPTZ (default: created_at + 24h, optional shorter)
├── is_expired      BOOLEAN (default false)
├── is_reported     BOOLEAN (default false)
├── created_at      TIMESTAMPTZ
└── updated_at      TIMESTAMPTZ
```

**RLS rules:**
- Dating posts only visible to users with `dating_setup_done = true` and `verification_status IN ('phone_verified', 'selfie_verified')`
- Expired/reported posts hidden from feed
- Author can always see their own posts

#### `chats`
Created when someone joins a post and the conversation starts.

```
chats
├── id              UUID (PK)
├── post_id         UUID (FK → posts)
├── lane            lane_type (inherits from post, can upgrade)
├── status          chat_status (active/expired/saved/closed)
├── is_upgraded     BOOLEAN (default false — true if escalated casual→dating)
├── upgraded_at     TIMESTAMPTZ (nullable)
├── last_message_at TIMESTAMPTZ
├── expires_at      TIMESTAMPTZ (casual: last_message + 72h, dating: last_message + 7d)
├── nudge_sent      BOOLEAN (default false — dating "plan something?" nudge)
├── nudge_sent_at   TIMESTAMPTZ (nullable)
├── created_at      TIMESTAMPTZ
└── updated_at      TIMESTAMPTZ
```

#### `chat_participants`
Who's in each chat.

```
chat_participants
├── id              UUID (PK)
├── chat_id         UUID (FK → chats)
├── user_id         UUID (FK → profiles)
├── joined_at       TIMESTAMPTZ
├── has_saved       BOOLEAN (default false — mutual save requires both)
├── is_blocked      BOOLEAN (default false)
└── PRIMARY KEY (chat_id, user_id)
```

**Mutual save logic**: Chat status becomes 'saved' only when ALL participants have `has_saved = true`. Enforced via database trigger.

#### `messages`
Chat messages — kept simple for MVP.

```
messages
├── id              UUID (PK)
├── chat_id         UUID (FK → chats)
├── sender_id       UUID (FK → profiles)
├── content         TEXT (max 1000 chars)
├── is_system       BOOLEAN (default false — for "X upgraded to dating" etc.)
├── is_filtered     BOOLEAN (default false — content filter caught something)
├── created_at      TIMESTAMPTZ
└── read_at         TIMESTAMPTZ (nullable, for read receipts later)
```

**Content filter trigger**: On INSERT, a database function checks for phone numbers, social handles, links, explicit keywords. If caught, `is_filtered = true` and content is replaced with "[Message filtered]". Contact info allowed only if chat is 'saved' OR a confirmed plan exists between participants.

#### `upgrade_requests`
Tracks the mutual "Upgrade to Dating" flow.

```
upgrade_requests
├── id              UUID (PK)
├── chat_id         UUID (FK → chats)
├── requester_id    UUID (FK → profiles)
├── status          TEXT ('pending', 'accepted', 'declined')
├── responded_at    TIMESTAMPTZ (nullable)
├── created_at      TIMESTAMPTZ
```

When accepted: chat.lane → 'dating', chat.is_upgraded → true, chat.expires_at recalculated to 7d TTL.

#### `plans`
The date planning / follow-through engine.

```
plans
├── id              UUID (PK)
├── chat_id         UUID (FK → chats)
├── proposed_by     UUID (FK → profiles)
├── date_style      date_style (coffee/walk/activity/dinner)
├── scheduled_at    TIMESTAMPTZ
├── area            TEXT (e.g. 'Dublin City Centre', 'D2', 'D6')
├── status          plan_status (proposed/confirmed/completed/cancelled/no_show)
├── confirmed_at    TIMESTAMPTZ (nullable)
├── reminder_24h    BOOLEAN (default false — has been sent)
├── reminder_1h     BOOLEAN (default false)
├── created_at      TIMESTAMPTZ
└── updated_at      TIMESTAMPTZ
```

#### `plan_checkins`
Post-plan check-in from each participant.

```
plan_checkins
├── id              UUID (PK)
├── plan_id         UUID (FK → plans)
├── user_id         UUID (FK → profiles)
├── checked_in      BOOLEAN (tapped "I'm here")
├── checked_in_at   TIMESTAMPTZ (nullable)
└── grace_expired   BOOLEAN (default false — 30min window passed)
```

#### `plan_feedback`
Post-date feedback that powers reliability scores.

```
plan_feedback
├── id              UUID (PK)
├── plan_id         UUID (FK → plans)
├── reviewer_id     UUID (FK → profiles)
├── target_id       UUID (FK → profiles)
├── showed_up       BOOLEAN
├── was_respectful  BOOLEAN
├── would_meet_again BOOLEAN
├── created_at      TIMESTAMPTZ
```

**Reliability score calculation** (Edge Function, runs after both feedbacks submitted):
- showed_up: +3 / -5
- was_respectful: +1 / -2
- would_meet_again: +1 / 0
- Score mapped to tier: <0 = low, 0-10 = medium, >10 = high, new users = 'new'
- Tier affects dating feed ranking (high tier posts shown first)

#### `reports`
User reports for moderation.

```
reports
├── id              UUID (PK)
├── reporter_id     UUID (FK → profiles)
├── target_id       UUID (FK → profiles)
├── chat_id         UUID (FK → chats, nullable)
├── post_id         UUID (FK → posts, nullable)
├── reason          report_reason
├── details         TEXT (nullable)
├── status          report_status (default 'pending')
├── reviewed_at     TIMESTAMPTZ (nullable)
├── created_at      TIMESTAMPTZ
```

#### `blocks`
User-level blocking.

```
blocks
├── id              UUID (PK)
├── blocker_id      UUID (FK → profiles)
├── blocked_id      UUID (FK → profiles)
├── created_at      TIMESTAMPTZ
└── UNIQUE (blocker_id, blocked_id)
```

**RLS impact**: Blocked users' posts are hidden, their join requests are silently rejected, existing chats are closed.

#### `daily_prompts`
System-generated prompts for the daily habit loop.

```
daily_prompts
├── id              UUID (PK)
├── lane            lane_type
├── vibe_tag_id     UUID (FK → vibe_tags)
├── topic_tag_id    UUID (FK → topic_tags)
├── prompt_text     TEXT
├── active_date     DATE (the day this prompt is shown)
├── created_at      TIMESTAMPTZ
```

---

## 3. Edge Functions (Supabase Deno)

### `chat-expiry` (Cron: every 15 minutes)
- Query chats where `status = 'active'` AND `expires_at < NOW()`
- Set `status = 'expired'`
- Delete associated messages (or archive if you want moderation history)

### `dating-nudge` (Cron: every 30 minutes)
- Query dating lane chats where:
  - `status = 'active'`
  - `nudge_sent = false`
  - `created_at < NOW() - INTERVAL '48 hours'`
  - message count > X (e.g., 10 messages)
- Insert system message: "Want to plan something?"
- Set `nudge_sent = true`

### `plan-reminders` (Cron: every 15 minutes)
- Query confirmed plans where `scheduled_at - NOW() < 24h` AND `reminder_24h = false`
  - Send push notification via Expo Notifications
  - Set `reminder_24h = true`
- Same for 1h reminder

### `plan-checkin-expiry` (Cron: every 5 minutes)
- Query plan_checkins where `checked_in = false` AND `plan.scheduled_at + 30min < NOW()`
- Set `grace_expired = true`
- If both grace_expired and neither checked in → plan status = 'no_show'

### `reliability-calc` (Triggered by plan_feedback INSERT)
- When both feedbacks exist for a plan:
  - Calculate new scores for both users
  - Update reliability_score and reliability_tier on profiles
  - If repeated no-shows (3+), flag for review / temporary dating ban

### `phone-verify` (HTTP endpoint)
- Accepts phone number, generates 6-digit OTP
- Stores OTP hash in a temp table with 5min expiry
- Sends via Twilio SMS API
- Verify endpoint checks OTP, updates profile

### `content-filter` (Database trigger on messages INSERT)
- Regex check for:
  - Phone patterns (international formats)
  - Social handles (@, instagram, snap, etc.)
  - URLs
  - Explicit keyword list
- If match AND chat is not 'saved' AND no confirmed plan: filter the message

---

## 4. Screen Map & Navigation

```
App Root (Expo Router)
├── (auth)/                     — Auth flow (unauthenticated)
│   ├── welcome.tsx             — Landing / value prop
│   ├── signup.tsx              — Email signup
│   ├── intent.tsx              — "What are you here for?" (casual/dating/both)
│   ├── profile-setup.tsx       — Name, age, optional photo
│   ├── dating-setup.tsx        — Phone verify + selfie + values card + location
│   └── tags.tsx                — Pick vibe + topic tags
│
├── (tabs)/                     — Main app (authenticated)
│   ├── feed/                   — Explore Feed
│   │   ├── index.tsx           — Feed with Casual/Dating tab switch
│   │   ├── [postId].tsx        — Post detail / join flow
│   │   └── create.tsx          — Create new post
│   │
│   ├── chats/                  — Active conversations
│   │   ├── index.tsx           — Chat list (sorted by last message)
│   │   ├── [chatId].tsx        — Chat screen
│   │   └── upgrade.tsx         — "Upgrade to Dating" modal
│   │
│   ├── plans/                  — Date plans
│   │   ├── index.tsx           — Upcoming / past plans list
│   │   ├── [planId].tsx        — Plan detail (status, checkin, feedback)
│   │   └── create.tsx          — Plan creation flow (availability, style, area)
│   │
│   └── profile/                — User's own profile
│       ├── index.tsx           — View/edit profile
│       ├── values-card.tsx     — Edit values card
│       ├── tags.tsx            — Edit vibe/topic preferences
│       ├── verification.tsx    — Verification status + upgrade
│       └── settings.tsx        — App settings, intent switch, logout
│
└── _layout.tsx                 — Root layout with auth guard
```

### Navigation Structure

- **Bottom tabs**: Feed | Chats | Plans | Profile
- **Plans tab** only visible if intent includes 'dating'
- **Feed** has a top tab bar switching Casual / Dating (Dating tab hidden if intent = 'casual')
- Each tab has its own stack navigator for drill-down screens

---

## 5. Screen-by-Screen Detail

### 5.1 Onboarding

**welcome.tsx**
- App name, one-line tagline, two CTAs: "Get Started" / "I have an account"
- Minimal, anti-vanity aesthetic — no stock photos of couples

**signup.tsx**
- Email input → magic link (zero cost auth)
- "Continue with Apple" / "Continue with Google" as secondary options
- Age gate: date of birth picker, must be 18+

**intent.tsx**
- Single question: "What brings you here?"
- Three cards: "Just Chat" / "Dating" / "Both"
- Each card has a 1-line description
- This sets `profiles.intent` and controls what they see

**profile-setup.tsx**
- Display name (first name or handle, max 20 chars)
- Age visibility toggle
- Photo upload (optional for casual, explained as "required for dating")
- Skip button available if casual-only

**dating-setup.tsx** (only shown if intent = dating/both)
- Step 1: Phone verification (+353 preferred, warning for non-Irish numbers)
- Step 2: Selfie upload ("This won't be shown publicly — it helps us verify you're real")
- Step 3: Values card mini-form
  - "What are you looking for?" (free text, 1-2 lines)
  - Dealbreakers (multi-select from preset list + custom)
  - Intent: "Long-term" / "Open to anything" / "Serious only"
- Step 4: Location permission request (one-time, explains why)

**tags.tsx**
- Two sections: "Your vibes" and "Your topics"
- Chip/pill selection UI, pick 3-5 of each
- "These help us show you the right posts"

### 5.2 Feed

**feed/index.tsx**
- Top tabs: Casual | Dating
- Each tab shows scrollable list of Post Cards
- Pull to refresh, infinite scroll pagination
- FAB (floating action button): "+" to create post
- Feed algorithm (MVP — keep simple):
  - Newest first
  - Boost posts matching user's tag preferences
  - Boost posts from high-reliability users (dating only)
  - Hide posts from blocked users
  - Hide expired / full posts

**Post Card UI:**
```
┌─────────────────────────────────────┐
│  [Casual]  🧊 Chill • 🎬 Movies    │  ← lane badge + tags
│                                     │
│  "Need a good thriller rec.         │  ← prompt text
│   What's the best you've seen?"     │
│                                     │
│  🟢 Alex • 2h ago                   │  ← tiny identity + time
│                                     │
│  [ Join Chat ]                      │  ← CTA button
│  2/8 spots                          │  ← capacity (group only)
└─────────────────────────────────────┘
```

Dating Post Card variant:
- Photos are small/blurred until joined
- Shows values badges: "Looking for: Long-term" "✓ Verified" "Reliability: High"

**feed/[postId].tsx**
- Full post view with author's mini-profile
- "Join Chat" button
- If 1:1 and already full: "This conversation is taken"
- If dating: shows values card summary of author

**feed/create.tsx**
- Step-through or single-scroll form:
  1. Lane picker (Casual / Dating — Dating only if setup complete)
  2. Vibe tag selector (pick one)
  3. Topic tag selector (pick one)
  4. Prompt text input (max 280 chars, placeholder examples)
  5. Format: 1:1 or Group (group only for casual)
  6. Optional: "Expires sooner" toggle (6h instead of 24h)
- Preview card shown before "Post"

### 5.3 Chat

**chats/index.tsx**
- List of active chats sorted by last message
- Each row shows:
  - Other person's name + tiny avatar
  - Lane badge (Casual / Dating / "Upgraded")
  - Last message preview + timestamp
  - Unread indicator
- Expired chats shown briefly with "This chat expired" then removed

**chats/[chatId].tsx**
- Standard messaging UI (bottom input, messages scroll up)
- Header: other person's name, lane badge, "..." menu
- Menu options:
  - Report
  - Block
  - Save Chat (mutual save)
  - Upgrade to Dating (if casual 1:1)
- System messages styled differently (centered, muted):
  - "Chat expires in 24h"
  - "Want to plan something?" (dating nudge)
  - "X upgraded this chat to Dating"
- Quick reactions (optional, simple emoji set)
- Contact info filter: if user types a phone number / handle and chat isn't saved → show inline warning "Contact sharing is available after you save this chat or confirm a plan"

**Join flow (triggered from post):**
- Modal/bottom sheet with 3 suggested openers based on the post's vibe + topic
- User picks one or writes custom opener
- On send → chat created, both users enter chat screen
- System message: "[User] joined from your post about [topic]"

**Upgrade flow:**
- User taps "Upgrade to Dating" in menu
- Confirmation: "This will move the chat to Dating. [Other person] needs to accept."
  - If requester hasn't done dating setup → redirected to dating-setup screens first
- Other person receives in-chat prompt: "[User] wants to upgrade to Dating. Accept?"
  - Accept → lane changes, values badges revealed, "Plan a date" CTA appears
  - Decline → requester notified, chat continues as casual, no awkwardness

### 5.4 Plans

**plans/index.tsx**
- Two sections: "Upcoming" and "Past"
- Each plan card shows:
  - Other person's name
  - Date style icon + area
  - Scheduled time
  - Status badge (Confirmed / Completed / Cancelled / No-show)
- Past plans that need feedback have a "Leave feedback" badge

**plans/create.tsx** (accessed from dating chat)
- Step 1: Date style picker (coffee / walk / activity / dinner) — icon cards
- Step 2: Date window picker
  - Shows current week + next week
  - Simple slot buttons: "Mon Eve" / "Tue Lunch" / "Sat Morning" etc.
  - User picks 2-3 preferred slots
  - Sent to other person who picks from those slots (or suggests alternatives)
- Step 3: Area picker
  - Predefined Dublin areas: City Centre / D2 / D4 / D6 / Dun Laoghaire / etc.
  - Or free text "Other area"
- Step 4: Confirm → plan created as 'proposed'
- Other person accepts (confirms slot + area) → status = 'confirmed'

**plans/[planId].tsx**
- Shows full plan detail
- Before scheduled time: countdown, cancel option
- At scheduled time: "I'm here" check-in button (30min grace window)
- After scheduled time + grace: feedback prompt

**Feedback prompt UI:**
- Three questions, each with thumbs up / thumbs down:
  - "Did they show up?"
  - "Were they respectful?"
  - "Would you meet again?"
- Submit → stored, reliability recalculated when both submit
- Brief "Thanks for your feedback" confirmation

### 5.5 Profile

**profile/index.tsx**
- Display name, photo, age (if shown)
- Verification badges: ✓ Phone • ✓ Selfie • ✓ Location
- Reliability tier badge (if dating)
- Intent display + change option
- Quick links: Edit Values Card / Edit Tags / Settings

**profile/settings.tsx**
- Change intent (casual/dating/both)
- Notification preferences
- Blocked users list
- Delete account
- Logout

---

## 6. User Stories (MVP)

### Auth & Onboarding
- US-01: As a new user, I can sign up with my email and receive a magic link
- US-02: As a new user, I must confirm I'm 18+ before proceeding
- US-03: As a new user, I choose my intent (casual/dating/both) during onboarding
- US-04: As a new user, I set up my display name and optional photo
- US-05: As a dating user, I verify my phone number via SMS OTP
- US-06: As a dating user, I upload a verification selfie
- US-07: As a dating user, I fill out my values card (looking for, dealbreakers, intent)
- US-08: As a dating user, I grant one-time location permission to confirm I'm in Ireland
- US-09: As a new user, I select my vibe and topic tag preferences

### Feed & Posts
- US-10: As a user, I see a feed of posts filtered by my intent (casual / dating / both)
- US-11: As a user, I can switch between Casual and Dating tabs in the feed
- US-12: As a user, I can create a post by choosing lane, vibe, topic, prompt, and format
- US-13: As a casual user, I can create group posts (up to 8 participants)
- US-14: As a dating user, I can only create 1:1 posts
- US-15: As a user, I see post cards with lane badge, tags, prompt, and author preview
- US-16: As a dating user, I see values badges on dating posts
- US-17: As a user, posts I've already joined are marked in the feed
- US-18: As a user, expired posts are automatically hidden from the feed
- US-19: As a user, I never see posts from users I've blocked

### Joining & Chat
- US-20: As a user, I can join a post by selecting a suggested opener or writing my own
- US-21: As a user, I cannot join a 1:1 post that already has someone in it
- US-22: As a user, I see my active chats in a list sorted by last message
- US-23: As a user, I can send and receive messages in real-time
- US-24: As a user, casual chats auto-expire after 72h of no messages
- US-25: As a user, dating chats auto-expire after 7 days of no messages
- US-26: As a user, I can "save" a chat; it's only saved when both participants agree
- US-27: As a user, I see a notification when the other person saves the chat
- US-28: As a user, saved chats do not expire
- US-29: As a user, I can report or block another user from within a chat
- US-30: As a user, I receive system messages about chat expiry, nudges, and lane changes

### Upgrade (Casual → Dating)
- US-31: As a casual 1:1 chat participant, I can request to "Upgrade to Dating"
- US-32: As a user who hasn't completed dating setup, I'm prompted to complete it before upgrading
- US-33: As a chat participant, I see the upgrade request and can accept or decline
- US-34: When both accept, the chat lane changes to dating and values badges become visible
- US-35: A declined upgrade doesn't close the chat — it continues as casual

### Dating Nudge & Plans
- US-36: As a dating chat participant, I see a "Want to plan something?" nudge after 48h / 10+ messages
- US-37: As a dating user, I can initiate plan creation from a dating chat
- US-38: As a plan initiator, I choose date style, preferred time slots, and area
- US-39: As the other participant, I accept a slot and confirm the plan
- US-40: As a user with a confirmed plan, I see it in my Plans tab
- US-41: As a user, I receive push notifications 24h and 1h before a plan
- US-42: As a user, I can cancel a plan before the scheduled time
- US-43: As a user, I can tap "I'm here" to check in at the scheduled time
- US-44: As a user, I have a 30-minute grace window for check-in

### Feedback & Reliability
- US-45: As a user, after a plan's scheduled time, I receive a feedback prompt
- US-46: As a user, I answer three feedback questions (showed up, respectful, meet again)
- US-47: As a user, my reliability tier is updated based on accumulated feedback
- US-48: As a dating user, high reliability boosts my posts in the dating feed
- US-49: As a dating user, repeated no-shows result in reduced reach or temporary restrictions
- US-50: As a user, I see reliability tier badges on dating profiles (not raw scores)

### Content Moderation
- US-51: As a user, my messages are filtered for phone numbers, social handles, and links
- US-52: As a user, filtered content is replaced with a system message explaining why
- US-53: As a user in a saved chat or with a confirmed plan, contact info sharing is allowed
- US-54: As a user, I can report a post or chat participant
- US-55: As a user, blocking someone hides all their content and closes shared chats

### Daily Engagement
- US-56: As a user, I see a "Prompt of the Day" at the top of each feed lane
- US-57: As a user, I can opt into receiving up to 3 matching posts per day via push notification

---

## 7. Content Filter Rules (MVP)

### Blocked patterns (when chat is not saved AND no confirmed plan):
```
Phone:    /(\+?\d[\d\s\-()]{7,}\d)/
Instagram: /(instagram|insta|ig)[:\s]*@?\w+/i
Snapchat:  /(snapchat|snap)[:\s]*@?\w+/i
TikTok:    /(tiktok|tt)[:\s]*@?\w+/i
Twitter/X: /(twitter|x\.com)[:\s]*@?\w+/i
Generic @: /@\w{3,}/
URLs:      /https?:\/\/\S+/
Email:     /[\w.]+@[\w.]+\.\w+/
```

### Explicit content keywords:
Maintain a configurable blocklist in a Supabase table (`blocked_terms`). Start with obvious terms, expand based on reports. Flag but don't auto-ban — review queue for false positives.

---

## 8. Supabase RLS Policies (Key Ones)

```sql
-- Users can only read their own profile fully, others see limited fields
CREATE POLICY "profiles_read_own" ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_read_others" ON profiles FOR SELECT
  USING (NOT is_banned AND id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = auth.uid()));

-- Posts: only see posts in lanes matching intent, not expired, not from blocked users
CREATE POLICY "posts_read" ON posts FOR SELECT
  USING (
    NOT is_expired
    AND NOT is_reported
    AND author_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = auth.uid())
    AND (
      lane = 'casual'
      OR (lane = 'dating' AND EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND dating_setup_done = true
      ))
    )
  );

-- Messages: only if you're a participant in the chat
CREATE POLICY "messages_read" ON messages FOR SELECT
  USING (
    chat_id IN (SELECT chat_id FROM chat_participants WHERE user_id = auth.uid())
  );

-- Messages: can only insert into chats you're in
CREATE POLICY "messages_insert" ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND chat_id IN (SELECT chat_id FROM chat_participants WHERE user_id = auth.uid())
    AND chat_id IN (SELECT id FROM chats WHERE status = 'active' OR status = 'saved')
  );
```

---

## 9. Push Notification Events

| Event | Trigger | Message |
|-------|---------|---------|
| New join | Someone joins your post | "[Name] joined your [topic] chat" |
| New message | Message in a chat you're in | "[Name]: [preview]" |
| Save request | Other person saved the chat | "[Name] wants to save this chat" |
| Upgrade request | Other person requests dating upgrade | "[Name] wants to upgrade to Dating" |
| Dating nudge | 48h in dating chat | "Ready to plan something with [Name]?" |
| Plan proposed | Someone proposes a plan | "[Name] wants to meet for [style]" |
| Plan confirmed | Both agreed | "Your [style] with [Name] is confirmed!" |
| Plan reminder 24h | 24h before | "Tomorrow: [style] with [Name]" |
| Plan reminder 1h | 1h before | "In 1 hour: [style] with [Name]" |
| Check-in prompt | At scheduled time | "Are you there? Tap to check in" |
| Feedback prompt | After plan time ends | "How was your [style] with [Name]?" |
| Matching posts | Daily (if opted in) | "3 new posts match your vibes" |

---

## 10. Sprint Plan (MVP in 8-10 Sprints of 1 Week Each)

### Sprint 1: Foundation
- Expo project setup with Expo Router
- Supabase project + database schema (all tables, enums, RLS)
- Nativewind config
- Auth flow: email magic link signup + age gate
- Basic profile creation (name, photo upload to Supabase Storage)

### Sprint 2: Onboarding Complete
- Intent selection screen
- Tag selection screen (vibe + topic)
- Dating setup flow: phone verification (Twilio integration), selfie upload
- Values card form
- Location permission + one-time geocode check
- Profile completion state management

### Sprint 3: Feed & Posts
- Feed screen with Casual/Dating tab switch
- Post card component
- Create post flow (lane, tags, prompt, format)
- Feed pagination (cursor-based, newest first)
- Post expiry logic (Edge Function cron)
- RLS policies for posts

### Sprint 4: Chat Core
- Chat creation on post join (with opener selection)
- Real-time messaging via Supabase Realtime
- Chat list screen (sorted by last message)
- Chat screen UI (messages, input, header)
- System messages rendering
- Message RLS policies

### Sprint 5: Chat Features
- Ephemeral chat expiry (72h casual, 7d dating) — Edge Function
- Mutual save flow
- Content filter (database trigger)
- Report and block functionality
- Block impact on feed + chats

### Sprint 6: Dating Upgrade
- "Upgrade to Dating" request flow
- Inline dating setup prompt (if not completed)
- Accept/decline UI
- Chat lane change on acceptance
- Values badges reveal in upgraded chats
- Dating nudge system message (Edge Function)

### Sprint 7: Plans Engine
- Plan creation flow (style, date windows, area)
- Plan proposal + acceptance between users
- Plans tab (upcoming + past)
- Plan detail screen
- Cancel plan flow

### Sprint 8: Follow-Through
- Push notification system (Expo Notifications)
- Plan reminders (24h + 1h) — Edge Function
- Check-in flow (soft, tap-based)
- Grace window logic
- Post-date feedback prompt + UI
- Reliability score calculation — Edge Function
- Reliability tier display on profiles

### Sprint 9: Polish & Moderation
- Daily prompt system (seeded data + display)
- Feed algorithm tuning (tag matching, reliability boost)
- Notification opt-in for matching posts
- Moderation review queue (basic admin — can be Supabase Dashboard + SQL at MVP)
- Edge cases: what happens when someone deletes account mid-chat, mid-plan, etc.
- Error states, empty states, loading states for all screens

### Sprint 10: Testing & Launch Prep
- End-to-end testing of all flows
- Performance testing (chat with many messages, feed with many posts)
- Supabase rate limit configuration
- App Store / Play Store submission prep
- Privacy policy + terms (GDPR compliant, Irish DPC aware)
- Dublin-area beta launch: 50-100 invite-only users
- Feedback collection mechanism

---

## 11. Project Structure (Expo)

```
ahora/
├── app/                            — Expo Router pages
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── welcome.tsx
│   │   ├── signup.tsx
│   │   ├── intent.tsx
│   │   ├── profile-setup.tsx
│   │   ├── dating-setup.tsx
│   │   └── tags.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx             — Tab navigator
│   │   ├── feed/
│   │   │   ├── _layout.tsx         — Stack navigator
│   │   │   ├── index.tsx
│   │   │   ├── [postId].tsx
│   │   │   └── create.tsx
│   │   ├── chats/
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx
│   │   │   ├── [chatId].tsx
│   │   │   └── upgrade.tsx
│   │   ├── plans/
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx
│   │   │   ├── [planId].tsx
│   │   │   └── create.tsx
│   │   └── profile/
│   │       ├── _layout.tsx
│   │       ├── index.tsx
│   │       ├── values-card.tsx
│   │       ├── tags.tsx
│   │       ├── verification.tsx
│   │       └── settings.tsx
│   └── _layout.tsx                 — Root layout + auth guard
│
├── components/                     — Shared components
│   ├── ui/                         — Generic UI (buttons, inputs, cards, badges)
│   ├── feed/                       — PostCard, FeedTabs, DailyPrompt
│   ├── chat/                       — MessageBubble, ChatInput, SystemMessage, OpenerPicker
│   ├── plans/                      — PlanCard, DateWindowPicker, FeedbackForm, CheckinButton
│   └── profile/                    — ValuesCardDisplay, TagChips, ReliabilityBadge, VerificationBadge
│
├── lib/                            — Core logic
│   ├── supabase.ts                 — Supabase client init
│   ├── auth.ts                     — Auth helpers
│   ├── realtime.ts                 — Chat subscription manager
│   ├── notifications.ts            — Expo push notifications setup
│   ├── location.ts                 — One-time geocode check
│   └── contentFilter.ts            — Client-side preview filter (server is source of truth)
│
├── hooks/                          — Custom hooks
│   ├── useAuth.ts
│   ├── useProfile.ts
│   ├── useFeed.ts
│   ├── useChat.ts
│   ├── usePlans.ts
│   └── useRealtimeMessages.ts
│
├── stores/                         — State management (Zustand recommended)
│   ├── authStore.ts
│   ├── feedStore.ts
│   ├── chatStore.ts
│   └── planStore.ts
│
├── constants/                      — App constants
│   ├── tags.ts                     — Default vibe/topic tags for seeding
│   ├── config.ts                   — Expiry times, limits, etc.
│   └── theme.ts                    — Color palette, typography
│
├── types/                          — TypeScript types
│   └── database.ts                 — Generated from Supabase (npx supabase gen types)
│
├── supabase/                       — Supabase project config
│   ├── migrations/                 — SQL migrations
│   ├── functions/                  — Edge Functions
│   │   ├── chat-expiry/
│   │   ├── dating-nudge/
│   │   ├── plan-reminders/
│   │   ├── plan-checkin-expiry/
│   │   ├── reliability-calc/
│   │   ├── phone-verify/
│   │   └── content-filter/
│   └── seed.sql                    — Default tags, daily prompts
│
└── assets/                         — Images, fonts
```

---

## 12. Key Technical Notes

### State Management
Zustand over Redux — lighter, no boilerplate, perfect for this scale. One store per domain (auth, feed, chat, plans). Supabase realtime subscriptions managed in hooks, not stores.

### Realtime Chat Architecture
- Subscribe to `messages` table filtered by `chat_id` using Supabase Realtime
- On new row → append to local state
- Unsubscribe on screen exit
- Keep last 50 messages in memory, paginate older ones

### Image Handling
- Profile photos: upload to Supabase Storage `profile-photos` bucket, store URL in profile
- Verification selfies: upload to `verification-selfies` bucket (private, no public URL)
- Compress client-side before upload (expo-image-manipulator)

### Offline Handling (MVP)
- Keep it simple: show "No connection" banner, disable send
- Messages queue locally and send on reconnect (Supabase handles this partially)
- Don't over-engineer offline for MVP

### Testing Strategy
- Unit tests: business logic in lib/ and hooks/ (Jest)
- Integration tests: Supabase RLS policies (pgTAP or manual SQL tests)
- E2E: Detox or manual QA for critical flows (onboarding, post→join→chat→plan)

---

## 13. Seed Data (launch essentials)

### Vibe Tags (v1)
chill, curious, playful, serious, energetic, thoughtful, adventurous, cozy

### Topic Tags (v1)
music, films, food, travel, fitness, books, gaming, tech, nature, art, nightlife, pets, sports, cooking, fashion

### Daily Prompts (first 2 weeks)
Pre-write 14 casual + 14 dating prompts. Rotate daily. Examples:
- Casual: "What's the last thing that genuinely surprised you?"
- Dating: "Describe your ideal Sunday morning. I'll go first..."

---

## 14. Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Empty feed at launch | Fatal — users leave immediately | Seed with daily prompts, invite 50+ beta users, stagger invites to ensure overlap |
| Supabase Realtime limits | Chat breaks at scale | Architect chat as swappable module, monitor connection count |
| SMS costs spike | Budget overrun | One-time OTP only, monitor usage, set Twilio spending cap |
| Fake/spam accounts | Trust erosion in dating lane | Phone verify + selfie review + content filter + report system |
| No-shows kill dating trust | Core value prop undermined | Reliability scoring + reduced reach + feedback loop — the entire follow-through engine |
| GDPR non-compliance | Legal risk in Ireland | Minimal data collection, selfie stored privately, deletion flow, privacy policy reviewed |
| App Store rejection | Launch delayed | Follow Apple/Google guidelines, no sexual content in screenshots, clear age gate |

---

*Document version: 1.0 — MVP Planning*
*Last updated: February 2026*