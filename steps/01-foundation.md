# Step 01: Foundation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up the Expo project, Supabase backend, full database schema with RLS, and basic email auth flow.

**Architecture:** Expo Router for navigation, Supabase client for backend communication, Nativewind for styling. Auth uses Supabase magic link (email).

**Tech Stack:** Expo SDK 52+, Expo Router v4, Supabase JS v2, Nativewind v4, Zustand

---

## Task 1: Initialize Expo Project

**Files:**
- Create: `package.json` (via expo init)
- Create: `app.json`
- Create: `tsconfig.json`
- Create: `tailwind.config.js`
- Create: `global.css`

**Step 1: Create Expo project with Expo Router template**

```bash
npx create-expo-app@latest ahora --template tabs
cd ahora
```

**Step 2: Install core dependencies**

```bash
npx expo install expo-router expo-linking expo-constants expo-status-bar
npx expo install nativewind tailwindcss react-native-reanimated
npx expo install @supabase/supabase-js react-native-url-polyfill
npx expo install zustand
npx expo install expo-image-picker expo-image-manipulator
npx expo install @react-native-async-storage/async-storage
npx expo install react-native-safe-area-context react-native-screens
```

**Step 3: Configure Nativewind**

Create `tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: '#6366f1',
        secondary: '#8b5cf6',
        surface: '#1e1e2e',
        background: '#11111b',
        muted: '#6c7086',
        accent: '#f9e2af',
      },
    },
  },
  plugins: [],
};
```

Create `global.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 4: Configure metro and babel for Nativewind**

Update `babel.config.js`:
```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
```

Create `metro.config.js`:
```javascript
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
module.exports = withNativeWind(config, { input: "./global.css" });
```

**Step 5: Verify the app runs**

```bash
npx expo start
```
Expected: App launches with default tabs template.

**Step 6: Commit**

```bash
git init
git add .
git commit -m "chore: initialize Expo project with Router, Nativewind, Supabase deps"
```

---

## Task 2: Set Up Project Structure

**Files:**
- Create: `app/_layout.tsx` (modify default)
- Create: `app/(auth)/_layout.tsx`
- Create: `app/(auth)/welcome.tsx` (placeholder)
- Create: `app/(tabs)/_layout.tsx`
- Create: `components/ui/Button.tsx`
- Create: `components/ui/Input.tsx`
- Create: `components/ui/Card.tsx`
- Create: `components/ui/Badge.tsx`
- Create: `lib/supabase.ts`
- Create: `constants/config.ts`
- Create: `constants/theme.ts`
- Create: `types/database.ts` (placeholder)

**Step 1: Create directory structure**

```bash
mkdir -p app/(auth) app/(tabs)/feed app/(tabs)/chats app/(tabs)/plans app/(tabs)/profile
mkdir -p components/ui components/feed components/chat components/plans components/profile
mkdir -p lib hooks stores constants types
mkdir -p supabase/migrations supabase/functions
```

**Step 2: Create constants/config.ts**

```typescript
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
} as const;
```

**Step 3: Create lib/supabase.ts**

```typescript
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

**Step 4: Create placeholder root layout**

`app/_layout.tsx`:
```typescript
import "../global.css";
import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

**Step 5: Create auth layout**

`app/(auth)/_layout.tsx`:
```typescript
import { Stack } from "expo-router";

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

**Step 6: Create placeholder welcome screen**

`app/(auth)/welcome.tsx`:
```typescript
import { View, Text } from "react-native";

export default function WelcomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-3xl font-bold text-white">ahora</Text>
      <Text className="mt-2 text-muted">be here now</Text>
    </View>
  );
}
```

**Step 7: Create base UI components**

`components/ui/Button.tsx`:
```typescript
import { TouchableOpacity, Text, ActivityIndicator } from "react-native";

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline";
  loading?: boolean;
  disabled?: boolean;
};

export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
}: ButtonProps) {
  const base = "rounded-xl px-6 py-4 items-center justify-center";
  const variants = {
    primary: "bg-primary",
    secondary: "bg-secondary",
    outline: "border border-primary",
  };
  const textVariants = {
    primary: "text-white font-semibold text-base",
    secondary: "text-white font-semibold text-base",
    outline: "text-primary font-semibold text-base",
  };

  return (
    <TouchableOpacity
      className={`${base} ${variants[variant]} ${disabled ? "opacity-50" : ""}`}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color="white" />
      ) : (
        <Text className={textVariants[variant]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}
```

**Step 8: Verify app still runs with new structure**

```bash
npx expo start
```

**Step 9: Commit**

```bash
git add .
git commit -m "chore: set up project structure, constants, Supabase client, base UI"
```

---

## Task 3: Supabase Database Schema — Enums & Core Tables

**Files:**
- Create: `supabase/migrations/001_enums.sql`
- Create: `supabase/migrations/002_profiles.sql`
- Create: `supabase/migrations/003_tags.sql`
- Create: `supabase/migrations/004_posts.sql`
- Create: `supabase/migrations/005_chats.sql`
- Create: `supabase/migrations/006_plans.sql`
- Create: `supabase/migrations/007_moderation.sql`
- Create: `supabase/migrations/008_daily_prompts.sql`

**Step 1: Create enums migration**

`supabase/migrations/001_enums.sql`:
```sql
-- Enums for Ahora app
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

**Step 2: Create profiles table**

`supabase/migrations/002_profiles.sql`:
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age >= 18),
  show_age BOOLEAN NOT NULL DEFAULT true,
  intent user_intent NOT NULL DEFAULT 'casual',
  photo_url TEXT,
  phone_number TEXT UNIQUE,
  phone_verified BOOLEAN NOT NULL DEFAULT false,
  phone_country_code TEXT,
  verification_status verification_status NOT NULL DEFAULT 'unverified',
  selfie_url TEXT,
  location_verified BOOLEAN NOT NULL DEFAULT false,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  reliability_tier reliability_tier NOT NULL DEFAULT 'new',
  reliability_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  dating_setup_done BOOLEAN NOT NULL DEFAULT false,
  is_banned BOOLEAN NOT NULL DEFAULT false,
  ban_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can read non-banned, non-blocked profiles"
  ON profiles FOR SELECT
  USING (
    NOT is_banned
    AND id NOT IN (
      SELECT blocked_id FROM blocks WHERE blocker_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
```

**Step 3: Create tags tables**

`supabase/migrations/003_tags.sql`:
```sql
-- Vibe tags (system-managed)
CREATE TABLE vibe_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  emoji TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Topic tags (system-managed)
CREATE TABLE topic_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  emoji TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- User's selected vibe tags
CREATE TABLE user_vibe_tags (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vibe_tag_id UUID NOT NULL REFERENCES vibe_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, vibe_tag_id)
);

-- User's selected topic tags
CREATE TABLE user_topic_tags (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic_tag_id UUID NOT NULL REFERENCES topic_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, topic_tag_id)
);

-- Values cards (dating lane)
CREATE TABLE values_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  looking_for TEXT NOT NULL,
  dealbreakers TEXT[] DEFAULT '{}',
  relationship_intent TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER values_cards_updated_at
  BEFORE UPDATE ON values_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS for tags (public read)
ALTER TABLE vibe_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_vibe_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_topic_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE values_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read vibe tags" ON vibe_tags FOR SELECT USING (true);
CREATE POLICY "Anyone can read topic tags" ON topic_tags FOR SELECT USING (true);

CREATE POLICY "Users can read own vibe tags" ON user_vibe_tags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own vibe tags" ON user_vibe_tags FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can read own topic tags" ON user_topic_tags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own topic tags" ON user_topic_tags FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can read own values card" ON values_cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own values card" ON values_cards FOR ALL USING (auth.uid() = user_id);
-- Dating chat participants can see other user's values card (added in chat RLS step)
```

**Step 4: Create posts table**

`supabase/migrations/004_posts.sql`:
```sql
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lane lane_type NOT NULL,
  vibe_tag_id UUID NOT NULL REFERENCES vibe_tags(id),
  topic_tag_id UUID NOT NULL REFERENCES topic_tags(id),
  prompt_text TEXT NOT NULL CHECK (char_length(prompt_text) <= 280),
  format post_format NOT NULL DEFAULT 'one_on_one',
  max_participants INTEGER NOT NULL DEFAULT 2,
  current_joins INTEGER NOT NULL DEFAULT 0,
  is_full BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  is_expired BOOLEAN NOT NULL DEFAULT false,
  is_reported BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read visible posts" ON posts FOR SELECT
  USING (
    (author_id = auth.uid())
    OR (
      NOT is_expired
      AND NOT is_reported
      AND author_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = auth.uid())
      AND (
        lane = 'casual'
        OR (lane = 'dating' AND EXISTS (
          SELECT 1 FROM profiles WHERE id = auth.uid() AND dating_setup_done = true
        ))
      )
    )
  );

CREATE POLICY "Users can create posts" ON posts FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update own posts" ON posts FOR UPDATE
  USING (auth.uid() = author_id);
```

**Step 5: Create chats & messages tables**

`supabase/migrations/005_chats.sql`:
```sql
CREATE TABLE chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  lane lane_type NOT NULL,
  status chat_status NOT NULL DEFAULT 'active',
  is_upgraded BOOLEAN NOT NULL DEFAULT false,
  upgraded_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  nudge_sent BOOLEAN NOT NULL DEFAULT false,
  nudge_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE chat_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  has_saved BOOLEAN NOT NULL DEFAULT false,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (chat_id, user_id)
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 1000),
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_filtered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE TABLE upgrade_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Triggers
CREATE TRIGGER chats_updated_at
  BEFORE UPDATE ON chats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Mutual save trigger: when all participants have has_saved=true, update chat status
CREATE OR REPLACE FUNCTION check_mutual_save()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.has_saved = true THEN
    IF NOT EXISTS (
      SELECT 1 FROM chat_participants
      WHERE chat_id = NEW.chat_id AND has_saved = false
    ) THEN
      UPDATE chats SET status = 'saved' WHERE id = NEW.chat_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER chat_mutual_save
  AFTER UPDATE OF has_saved ON chat_participants
  FOR EACH ROW EXECUTE FUNCTION check_mutual_save();

-- Update last_message_at on new message
CREATE OR REPLACE FUNCTION update_chat_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chats SET last_message_at = NEW.created_at WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER messages_update_chat
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_chat_last_message();

-- RLS
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE upgrade_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read chats they participate in" ON chats FOR SELECT
  USING (id IN (SELECT chat_id FROM chat_participants WHERE user_id = auth.uid()));

CREATE POLICY "Users can read own participation" ON chat_participants FOR SELECT
  USING (user_id = auth.uid() OR chat_id IN (SELECT chat_id FROM chat_participants WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own participation" ON chat_participants FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can read messages in their chats" ON messages FOR SELECT
  USING (chat_id IN (SELECT chat_id FROM chat_participants WHERE user_id = auth.uid()));

CREATE POLICY "Users can send messages to their active chats" ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND chat_id IN (SELECT chat_id FROM chat_participants WHERE user_id = auth.uid())
    AND chat_id IN (SELECT id FROM chats WHERE status IN ('active', 'saved'))
  );

CREATE POLICY "Users can read upgrade requests in their chats" ON upgrade_requests FOR SELECT
  USING (chat_id IN (SELECT chat_id FROM chat_participants WHERE user_id = auth.uid()));

CREATE POLICY "Users can create upgrade requests" ON upgrade_requests FOR INSERT
  WITH CHECK (requester_id = auth.uid());

CREATE POLICY "Users can respond to upgrade requests" ON upgrade_requests FOR UPDATE
  USING (chat_id IN (SELECT chat_id FROM chat_participants WHERE user_id = auth.uid()));
```

**Step 6: Create plans tables**

`supabase/migrations/006_plans.sql`:
```sql
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  proposed_by UUID NOT NULL REFERENCES profiles(id),
  date_style date_style NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  area TEXT NOT NULL,
  status plan_status NOT NULL DEFAULT 'proposed',
  confirmed_at TIMESTAMPTZ,
  reminder_24h BOOLEAN NOT NULL DEFAULT false,
  reminder_1h BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE plan_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  checked_in BOOLEAN NOT NULL DEFAULT false,
  checked_in_at TIMESTAMPTZ,
  grace_expired BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (plan_id, user_id)
);

CREATE TABLE plan_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id),
  target_id UUID NOT NULL REFERENCES profiles(id),
  showed_up BOOLEAN NOT NULL,
  was_respectful BOOLEAN NOT NULL,
  would_meet_again BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, reviewer_id)
);

CREATE TRIGGER plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read plans in their chats" ON plans FOR SELECT
  USING (chat_id IN (SELECT chat_id FROM chat_participants WHERE user_id = auth.uid()));

CREATE POLICY "Users can create plans in their chats" ON plans FOR INSERT
  WITH CHECK (
    proposed_by = auth.uid()
    AND chat_id IN (SELECT chat_id FROM chat_participants WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update plans in their chats" ON plans FOR UPDATE
  USING (chat_id IN (SELECT chat_id FROM chat_participants WHERE user_id = auth.uid()));

CREATE POLICY "Users can read own checkins" ON plan_checkins FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can checkin" ON plan_checkins FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can read feedback they gave" ON plan_feedback FOR SELECT
  USING (reviewer_id = auth.uid());

CREATE POLICY "Users can submit feedback" ON plan_feedback FOR INSERT
  WITH CHECK (reviewer_id = auth.uid());
```

**Step 7: Create moderation tables**

`supabase/migrations/007_moderation.sql`:
```sql
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES profiles(id),
  target_id UUID NOT NULL REFERENCES profiles(id),
  chat_id UUID REFERENCES chats(id),
  post_id UUID REFERENCES posts(id),
  reason report_reason NOT NULL,
  details TEXT,
  status report_status NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);

-- When a block is created, close shared chats
CREATE OR REPLACE FUNCTION handle_block()
RETURNS TRIGGER AS $$
BEGIN
  -- Close all shared chats between blocker and blocked
  UPDATE chats SET status = 'closed'
  WHERE id IN (
    SELECT cp1.chat_id FROM chat_participants cp1
    JOIN chat_participants cp2 ON cp1.chat_id = cp2.chat_id
    WHERE cp1.user_id = NEW.blocker_id AND cp2.user_id = NEW.blocked_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER blocks_close_chats
  AFTER INSERT ON blocks
  FOR EACH ROW EXECUTE FUNCTION handle_block();

-- Blocked terms for content filter
CREATE TABLE blocked_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term TEXT NOT NULL UNIQUE,
  is_regex BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create reports" ON reports FOR INSERT
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "Users can read own reports" ON reports FOR SELECT
  USING (reporter_id = auth.uid());

CREATE POLICY "Users can create blocks" ON blocks FOR INSERT
  WITH CHECK (blocker_id = auth.uid());

CREATE POLICY "Users can read own blocks" ON blocks FOR SELECT
  USING (blocker_id = auth.uid());

CREATE POLICY "Users can delete own blocks" ON blocks FOR DELETE
  USING (blocker_id = auth.uid());

CREATE POLICY "Content filter can read terms" ON blocked_terms FOR SELECT
  USING (true);
```

**Step 8: Create daily prompts table**

`supabase/migrations/008_daily_prompts.sql`:
```sql
CREATE TABLE daily_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lane lane_type NOT NULL,
  vibe_tag_id UUID NOT NULL REFERENCES vibe_tags(id),
  topic_tag_id UUID NOT NULL REFERENCES topic_tags(id),
  prompt_text TEXT NOT NULL,
  active_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE daily_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read daily prompts" ON daily_prompts FOR SELECT
  USING (true);
```

**Step 9: Apply migrations to Supabase**

```bash
npx supabase db push
```
Or apply via Supabase Dashboard SQL editor if using hosted project.

**Step 10: Commit**

```bash
git add supabase/
git commit -m "feat: add complete database schema with enums, tables, RLS, and triggers"
```

---

## Task 4: Seed Data

**Files:**
- Create: `supabase/seed.sql`

**Step 1: Create seed data**

`supabase/seed.sql`:
```sql
-- Vibe tags
INSERT INTO vibe_tags (name, emoji, sort_order) VALUES
  ('chill', '🧊', 1),
  ('curious', '🔍', 2),
  ('playful', '🎯', 3),
  ('serious', '🎩', 4),
  ('energetic', '⚡', 5),
  ('thoughtful', '💭', 6),
  ('adventurous', '🌍', 7),
  ('cozy', '☕', 8);

-- Topic tags
INSERT INTO topic_tags (name, emoji, sort_order) VALUES
  ('music', '🎵', 1),
  ('films', '🎬', 2),
  ('food', '🍜', 3),
  ('travel', '✈️', 4),
  ('fitness', '💪', 5),
  ('books', '📚', 6),
  ('gaming', '🎮', 7),
  ('tech', '💻', 8),
  ('nature', '🌿', 9),
  ('art', '🎨', 10),
  ('nightlife', '🌙', 11),
  ('pets', '🐕', 12),
  ('sports', '⚽', 13),
  ('cooking', '👨‍🍳', 14),
  ('fashion', '👗', 15);
```

**Step 2: Apply seed data**

```bash
npx supabase db seed
```

**Step 3: Commit**

```bash
git add supabase/seed.sql
git commit -m "feat: add seed data for vibe and topic tags"
```

---

## Task 5: Supabase Storage Buckets

**Files:**
- Create: `supabase/migrations/009_storage.sql`

**Step 1: Create storage buckets**

`supabase/migrations/009_storage.sql`:
```sql
-- Profile photos bucket (public read)
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-photos', 'profile-photos', true);

-- Verification selfies bucket (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('verification-selfies', 'verification-selfies', false);

-- Storage policies
CREATE POLICY "Users can upload own profile photo"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view profile photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-photos');

CREATE POLICY "Users can upload own verification selfie"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'verification-selfies' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own selfie"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'verification-selfies' AND auth.uid()::text = (storage.foldername(name))[1]);
```

**Step 2: Apply migration**

```bash
npx supabase db push
```

**Step 3: Commit**

```bash
git add supabase/migrations/009_storage.sql
git commit -m "feat: add storage buckets for profile photos and verification selfies"
```

---

## Task 6: Auth Store & Hook

**Files:**
- Create: `stores/authStore.ts`
- Create: `hooks/useAuth.ts`
- Create: `lib/auth.ts`

**Step 1: Create auth store**

`stores/authStore.ts`:
```typescript
import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";

type AuthState = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isLoading: true,
  setSession: (session) =>
    set({ session, user: session?.user ?? null }),
  setLoading: (isLoading) => set({ isLoading }),
}));
```

**Step 2: Create auth helpers**

`lib/auth.ts`:
```typescript
import { supabase } from "./supabase";

export async function signInWithEmail(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}
```

**Step 3: Create auth hook**

`hooks/useAuth.ts`:
```typescript
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";

export function useAuth() {
  const { session, user, isLoading, setSession, setLoading } = useAuthStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { session, user, isLoading };
}
```

**Step 4: Commit**

```bash
git add stores/ hooks/ lib/
git commit -m "feat: add auth store, hook, and helper functions"
```

---

## Task 7: Root Layout with Auth Guard

**Files:**
- Modify: `app/_layout.tsx`

**Step 1: Implement auth-guarded root layout**

`app/_layout.tsx`:
```typescript
import "../global.css";
import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { View, ActivityIndicator } from "react-native";

export default function RootLayout() {
  const { session, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!session && !inAuthGroup) {
      router.replace("/(auth)/welcome");
    } else if (session && inAuthGroup) {
      router.replace("/(tabs)/feed");
    }
  }, [session, isLoading, segments]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
```

**Step 2: Verify auth redirect works**

```bash
npx expo start
```
Expected: App redirects to welcome screen when not authenticated.

**Step 3: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat: add root layout with auth guard and session redirect"
```

---

## Task 8: Welcome & Signup Screens

**Files:**
- Modify: `app/(auth)/welcome.tsx`
- Create: `app/(auth)/signup.tsx`
- Create: `components/ui/Input.tsx`

**Step 1: Create Input component**

`components/ui/Input.tsx`:
```typescript
import { TextInput, View, Text } from "react-native";

type InputProps = {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: "default" | "email-address" | "number-pad";
  autoCapitalize?: "none" | "sentences" | "words";
  secureTextEntry?: boolean;
  error?: string;
};

export function Input({
  label,
  placeholder,
  value,
  onChangeText,
  keyboardType = "default",
  autoCapitalize = "none",
  secureTextEntry = false,
  error,
}: InputProps) {
  return (
    <View className="w-full">
      {label && (
        <Text className="mb-2 text-sm text-muted">{label}</Text>
      )}
      <TextInput
        className="w-full rounded-xl border border-muted/30 bg-surface px-4 py-3.5 text-base text-white"
        placeholder={placeholder}
        placeholderTextColor="#6c7086"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        secureTextEntry={secureTextEntry}
      />
      {error && (
        <Text className="mt-1 text-sm text-red-400">{error}</Text>
      )}
    </View>
  );
}
```

**Step 2: Build welcome screen**

`app/(auth)/welcome.tsx`:
```typescript
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/ui/Button";

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 items-center justify-center bg-background px-8">
      <View className="flex-1 items-center justify-center">
        <Text className="text-5xl font-bold text-white">ahora</Text>
        <Text className="mt-3 text-center text-lg text-muted">
          Tag your vibe. Find your people.
        </Text>
      </View>

      <View className="w-full gap-3 pb-12">
        <Button
          title="Get Started"
          onPress={() => router.push("/(auth)/signup")}
        />
        <Button
          title="I have an account"
          variant="outline"
          onPress={() => router.push("/(auth)/signup")}
        />
      </View>
    </View>
  );
}
```

**Step 3: Build signup screen with email magic link + age gate**

`app/(auth)/signup.tsx`:
```typescript
import { useState } from "react";
import { View, Text, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { signInWithEmail } from "@/lib/auth";
import { CONFIG } from "@/constants/config";

export default function SignupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSignup = async () => {
    setError("");
    const ageNum = parseInt(age, 10);

    if (!email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (isNaN(ageNum) || ageNum < CONFIG.MIN_AGE) {
      setError(`You must be at least ${CONFIG.MIN_AGE} to use Ahora.`);
      return;
    }

    setLoading(true);
    try {
      await signInWithEmail(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-8">
        <Text className="text-2xl font-bold text-white">Check your email</Text>
        <Text className="mt-3 text-center text-muted">
          We sent a magic link to {email}. Tap it to sign in.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 justify-center bg-background px-8">
      <Text className="mb-8 text-3xl font-bold text-white">Join Ahora</Text>

      <View className="gap-4">
        <Input
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
        />
        <Input
          label="Your age"
          placeholder="18"
          value={age}
          onChangeText={setAge}
          keyboardType="number-pad"
        />
        {error ? (
          <Text className="text-sm text-red-400">{error}</Text>
        ) : null}
        <Button
          title="Continue"
          onPress={handleSignup}
          loading={loading}
          disabled={!email || !age}
        />
      </View>
    </View>
  );
}
```

**Step 4: Verify signup flow**

```bash
npx expo start
```
Expected: Welcome → Signup → "Check your email" confirmation.

**Step 5: Commit**

```bash
git add app/(auth)/ components/ui/Input.tsx
git commit -m "feat: add welcome screen and email signup with age gate"
```

---

## Task 9: Generate TypeScript Types from Supabase

**Files:**
- Modify: `types/database.ts`

**Step 1: Generate types**

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.ts
```

**Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add types/database.ts
git commit -m "chore: generate TypeScript types from Supabase schema"
```

---

## Checkpoint: Step 01 Complete

At this point you should have:
- [ ] Expo project running with Expo Router
- [ ] Nativewind configured and working
- [ ] Full database schema deployed to Supabase (14 tables, all enums, RLS policies, triggers)
- [ ] Seed data for vibe and topic tags
- [ ] Storage buckets for photos and selfies
- [ ] Auth flow: welcome → signup with magic link + age gate
- [ ] Auth guard redirecting based on session state
- [ ] TypeScript types generated from schema
- [ ] Base UI components (Button, Input)

**Verify:** `npx expo start` — app loads, shows welcome, signup works.
