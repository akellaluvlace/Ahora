# Step 09: Polish & Moderation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add daily prompts, feed algorithm tuning, notification opt-in for matching posts, moderation review basics, edge case handling, and comprehensive loading/empty/error states across all screens.

**Architecture:** Daily prompts seeded and displayed at top of feed. Feed algorithm boosted by tag matching and reliability tier. Moderation via Supabase Dashboard + SQL queries at MVP.

**Depends on:** Step 08 (Follow-Through) complete.

---

## Task 1: Daily Prompt System

**Files:**
- Create: `components/feed/DailyPrompt.tsx`
- Create: `hooks/useDailyPrompt.ts`
- Modify: `supabase/seed.sql`

**Step 1: Seed daily prompts**

Add to `supabase/seed.sql`:
```sql
-- Daily prompts: 14 casual + 14 dating
-- (using existing vibe_tag and topic_tag IDs from seed)

-- Week 1 Casual
INSERT INTO daily_prompts (lane, vibe_tag_id, topic_tag_id, prompt_text, active_date)
SELECT 'casual', v.id, t.id, prompt, date
FROM (VALUES
  ('chill', 'films', 'What''s the last thing that genuinely surprised you?', CURRENT_DATE),
  ('curious', 'music', 'Drop a song that changed how you see the world', CURRENT_DATE + 1),
  ('playful', 'food', 'Controversial food opinion — go', CURRENT_DATE + 2),
  ('thoughtful', 'books', 'What book do you recommend to literally everyone?', CURRENT_DATE + 3),
  ('energetic', 'fitness', 'What''s your morning routine actually look like?', CURRENT_DATE + 4),
  ('cozy', 'cooking', 'Sunday cooking vibes — what are you making?', CURRENT_DATE + 5),
  ('adventurous', 'travel', 'Best trip you''ve ever taken and why', CURRENT_DATE + 6)
) AS d(vibe, topic, prompt, date)
JOIN vibe_tags v ON v.name = d.vibe
JOIN topic_tags t ON t.name = d.topic;

-- Week 1 Dating
INSERT INTO daily_prompts (lane, vibe_tag_id, topic_tag_id, prompt_text, active_date)
SELECT 'dating', v.id, t.id, prompt, date
FROM (VALUES
  ('thoughtful', 'food', 'Describe your ideal Sunday morning. I''ll go first...', CURRENT_DATE),
  ('curious', 'travel', 'What''s a place that felt like it was made for you?', CURRENT_DATE + 1),
  ('playful', 'music', 'Make me a 3-song playlist that describes your personality', CURRENT_DATE + 2),
  ('chill', 'films', 'Movie you could watch on repeat and never get bored', CURRENT_DATE + 3),
  ('serious', 'books', 'What''s a value you''d never compromise on?', CURRENT_DATE + 4),
  ('cozy', 'cooking', 'Best date you''ve been on — what made it special?', CURRENT_DATE + 5),
  ('adventurous', 'nature', 'Tell me about a time you did something completely out of character', CURRENT_DATE + 6)
) AS d(vibe, topic, prompt, date)
JOIN vibe_tags v ON v.name = d.vibe
JOIN topic_tags t ON t.name = d.topic;
```

**Step 2: Create daily prompt hook**

`hooks/useDailyPrompt.ts`:
```typescript
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type DailyPrompt = {
  id: string;
  prompt_text: string;
  vibe_tag: { name: string; emoji: string | null };
  topic_tag: { name: string; emoji: string | null };
};

export function useDailyPrompt(lane: "casual" | "dating") {
  const [prompt, setPrompt] = useState<DailyPrompt | null>(null);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];

    supabase
      .from("daily_prompts")
      .select(`
        id, prompt_text,
        vibe_tag:vibe_tags!vibe_tag_id(name, emoji),
        topic_tag:topic_tags!topic_tag_id(name, emoji)
      `)
      .eq("lane", lane)
      .eq("active_date", today)
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setPrompt(data as any);
      });
  }, [lane]);

  return prompt;
}
```

**Step 3: Create DailyPrompt component**

`components/feed/DailyPrompt.tsx`:
```typescript
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

type Props = {
  prompt: {
    id: string;
    prompt_text: string;
    vibe_tag: { name: string; emoji: string | null };
    topic_tag: { name: string; emoji: string | null };
  };
};

export function DailyPrompt({ prompt }: Props) {
  const router = useRouter();

  return (
    <TouchableOpacity
      className="mx-4 my-2 rounded-2xl border border-accent/20 bg-accent/5 p-4"
      onPress={() =>
        router.push({
          pathname: "/(tabs)/feed/create",
          params: { dailyPrompt: prompt.prompt_text },
        })
      }
    >
      <Text className="mb-1 text-xs font-medium text-accent">
        Prompt of the Day
      </Text>
      <Text className="text-base text-white">"{prompt.prompt_text}"</Text>
      <Text className="mt-2 text-xs text-muted">
        {prompt.vibe_tag.emoji} {prompt.vibe_tag.name} ·{" "}
        {prompt.topic_tag.emoji} {prompt.topic_tag.name}
      </Text>
      <Text className="mt-1 text-xs text-primary">Tap to respond →</Text>
    </TouchableOpacity>
  );
}
```

**Step 4: Add DailyPrompt to feed header**

In `app/(tabs)/feed/index.tsx`, add as `ListHeaderComponent`:
```typescript
const dailyPrompt = useDailyPrompt(lane);
// ...
<FlatList
  ListHeaderComponent={
    dailyPrompt ? <DailyPrompt prompt={dailyPrompt} /> : null
  }
  // ...
/>
```

**Step 5: Commit**

```bash
git add components/feed/DailyPrompt.tsx hooks/useDailyPrompt.ts supabase/seed.sql app/(tabs)/feed/index.tsx
git commit -m "feat: add daily prompt system with seeded prompts and feed display"
```

---

## Task 2: Feed Algorithm Tuning

**Files:**
- Modify: `hooks/useFeed.ts`

**Step 1: Add tag matching and reliability boost to feed query**

Update the feed query to:
1. Boost posts matching user's tag preferences (order by match first)
2. Boost posts from high-reliability users (dating only)
3. Keep newest-first as secondary sort

```typescript
// In useFeed.ts, update fetchPosts:

// Fetch user's preferred tags for boosting
const { data: userVibes } = await supabase
  .from("user_vibe_tags")
  .select("vibe_tag_id")
  .eq("user_id", userId);

const { data: userTopics } = await supabase
  .from("user_topic_tags")
  .select("topic_tag_id")
  .eq("user_id", userId);

const vibeIds = userVibes?.map((v) => v.vibe_tag_id) || [];
const topicIds = userTopics?.map((t) => t.topic_tag_id) || [];

// After fetching posts, sort client-side for MVP:
const sorted = data.sort((a: any, b: any) => {
  let scoreA = 0;
  let scoreB = 0;

  // Tag match boost
  if (vibeIds.includes(a.vibe_tag_id)) scoreA += 2;
  if (topicIds.includes(a.topic_tag_id)) scoreA += 2;
  if (vibeIds.includes(b.vibe_tag_id)) scoreB += 2;
  if (topicIds.includes(b.topic_tag_id)) scoreB += 2;

  // Reliability boost (dating only)
  if (store.lane === "dating") {
    if (a.author?.reliability_tier === "high") scoreA += 3;
    if (a.author?.reliability_tier === "medium") scoreA += 1;
    if (b.author?.reliability_tier === "high") scoreB += 3;
    if (b.author?.reliability_tier === "medium") scoreB += 1;
  }

  // Higher score = shown first, then newest
  if (scoreB !== scoreA) return scoreB - scoreA;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
});
```

**Step 2: Commit**

```bash
git add hooks/useFeed.ts
git commit -m "feat: add feed algorithm with tag matching and reliability boost"
```

---

## Task 3: Profile Screen

**Files:**
- Create: `app/(tabs)/profile/_layout.tsx`
- Create: `app/(tabs)/profile/index.tsx`
- Create: `app/(tabs)/profile/settings.tsx`
- Create: `app/(tabs)/profile/tags.tsx`
- Create: `app/(tabs)/profile/values-card.tsx`
- Create: `components/profile/VerificationBadge.tsx`

**Step 1: Create VerificationBadge**

`components/profile/VerificationBadge.tsx`:
```typescript
import { View, Text } from "react-native";

type Props = {
  phoneVerified: boolean;
  selfieVerified: boolean;
  locationVerified: boolean;
};

export function VerificationBadge({
  phoneVerified,
  selfieVerified,
  locationVerified,
}: Props) {
  return (
    <View className="flex-row gap-2">
      <View className={`rounded-full px-2 py-0.5 ${phoneVerified ? "bg-green-500/20" : "bg-muted/10"}`}>
        <Text className={`text-xs ${phoneVerified ? "text-green-400" : "text-muted/50"}`}>
          {phoneVerified ? "✓" : "○"} Phone
        </Text>
      </View>
      <View className={`rounded-full px-2 py-0.5 ${selfieVerified ? "bg-green-500/20" : "bg-muted/10"}`}>
        <Text className={`text-xs ${selfieVerified ? "text-green-400" : "text-muted/50"}`}>
          {selfieVerified ? "✓" : "○"} Selfie
        </Text>
      </View>
      <View className={`rounded-full px-2 py-0.5 ${locationVerified ? "bg-green-500/20" : "bg-muted/10"}`}>
        <Text className={`text-xs ${locationVerified ? "text-green-400" : "text-muted/50"}`}>
          {locationVerified ? "✓" : "○"} Location
        </Text>
      </View>
    </View>
  );
}
```

**Step 2: Create profile layout**

`app/(tabs)/profile/_layout.tsx`:
```typescript
import { Stack } from "expo-router";

export default function ProfileLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
      <Stack.Screen name="tags" options={{ title: "Edit Tags" }} />
      <Stack.Screen name="values-card" options={{ title: "Values Card" }} />
    </Stack>
  );
}
```

**Step 3: Build profile screen**

`app/(tabs)/profile/index.tsx`:
```typescript
import { View, Text, TouchableOpacity, ScrollView, Image } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useProfileStore } from "@/stores/profileStore";
import { VerificationBadge } from "@/components/profile/VerificationBadge";
import { ReliabilityBadge } from "@/components/profile/ReliabilityBadge";
import { Badge } from "@/components/ui/Badge";

export default function ProfileScreen() {
  const router = useRouter();
  const profile = useProfileStore((s) => s.profile);

  if (!profile) return null;

  const isDating = profile.intent === "dating" || profile.intent === "both";

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView contentContainerClassName="px-6 py-6">
        {/* Header */}
        <View className="items-center mb-6">
          {profile.photo_url ? (
            <Image
              source={{ uri: profile.photo_url }}
              className="h-24 w-24 rounded-full mb-3"
            />
          ) : (
            <View className="h-24 w-24 rounded-full bg-surface items-center justify-center mb-3">
              <Text className="text-3xl">
                {profile.display_name[0]?.toUpperCase()}
              </Text>
            </View>
          )}
          <Text className="text-2xl font-bold text-white">
            {profile.display_name}
          </Text>
          {profile.show_age && (
            <Text className="text-muted mt-1">{profile.age}</Text>
          )}
        </View>

        {/* Intent badge */}
        <View className="items-center mb-4">
          <Badge
            label={profile.intent === "both" ? "Chat + Dating" : profile.intent}
            variant={profile.intent === "casual" ? "casual" : "dating"}
          />
        </View>

        {/* Verification */}
        <View className="mb-4 items-center">
          <VerificationBadge
            phoneVerified={profile.verification_status !== "unverified"}
            selfieVerified={
              profile.verification_status === "selfie_verified" ||
              profile.verification_status === "selfie_pending"
            }
            locationVerified={true} // from profile.location_verified if added
          />
        </View>

        {/* Reliability (dating) */}
        {isDating && (
          <View className="mb-6 items-center">
            <ReliabilityBadge tier={profile.reliability_tier as any} />
          </View>
        )}

        {/* Quick links */}
        <View className="gap-2">
          {isDating && (
            <TouchableOpacity
              className="rounded-xl bg-surface p-4"
              onPress={() => router.push("/(tabs)/profile/values-card")}
            >
              <Text className="text-white">Edit Values Card</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            className="rounded-xl bg-surface p-4"
            onPress={() => router.push("/(tabs)/profile/tags")}
          >
            <Text className="text-white">Edit Tags</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="rounded-xl bg-surface p-4"
            onPress={() => router.push("/(tabs)/profile/settings")}
          >
            <Text className="text-white">Settings</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

**Step 4: Build settings screen**

`app/(tabs)/profile/settings.tsx`:
```typescript
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { signOut } from "@/lib/auth";
import { useProfile } from "@/hooks/useProfile";

export default function SettingsScreen() {
  const router = useRouter();
  const { updateProfile } = useProfile();

  const handleLogout = async () => {
    await signOut();
    router.replace("/(auth)/welcome");
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            // TODO: implement account deletion via Edge Function
            Alert.alert("Contact support to delete your account.");
          },
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-background px-6 py-6">
      <View className="gap-2">
        <TouchableOpacity className="rounded-xl bg-surface p-4">
          <Text className="text-white">Notification Preferences</Text>
        </TouchableOpacity>

        <TouchableOpacity className="rounded-xl bg-surface p-4">
          <Text className="text-white">Blocked Users</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="rounded-xl bg-surface p-4"
          onPress={handleLogout}
        >
          <Text className="text-red-400">Log Out</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="rounded-xl bg-surface p-4 mt-4"
          onPress={handleDeleteAccount}
        >
          <Text className="text-red-500">Delete Account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
```

**Step 5: Commit**

```bash
git add app/(tabs)/profile/ components/profile/VerificationBadge.tsx
git commit -m "feat: add profile screen with verification badges, reliability, and settings"
```

---

## Task 4: Loading, Empty, and Error States

**Files:**
- Create: `components/ui/EmptyState.tsx`
- Create: `components/ui/ErrorState.tsx`
- Create: `components/ui/LoadingScreen.tsx`

**Step 1: Create reusable state components**

`components/ui/EmptyState.tsx`:
```typescript
import { View, Text } from "react-native";

type Props = {
  title: string;
  subtitle?: string;
};

export function EmptyState({ title, subtitle }: Props) {
  return (
    <View className="items-center justify-center py-20">
      <Text className="text-lg text-muted">{title}</Text>
      {subtitle && (
        <Text className="mt-1 text-center text-sm text-muted/60">
          {subtitle}
        </Text>
      )}
    </View>
  );
}
```

`components/ui/ErrorState.tsx`:
```typescript
import { View, Text } from "react-native";
import { Button } from "./Button";

type Props = {
  message?: string;
  onRetry?: () => void;
};

export function ErrorState({
  message = "Something went wrong",
  onRetry,
}: Props) {
  return (
    <View className="items-center justify-center py-20 px-8">
      <Text className="text-lg text-red-400">{message}</Text>
      {onRetry && (
        <View className="mt-4">
          <Button title="Try Again" variant="outline" onPress={onRetry} />
        </View>
      )}
    </View>
  );
}
```

`components/ui/LoadingScreen.tsx`:
```typescript
import { View, ActivityIndicator } from "react-native";

export function LoadingScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator size="large" color="#6366f1" />
    </View>
  );
}
```

**Step 2: Apply states across all screens**

Go through each screen and ensure:
- Loading state while data fetches
- Empty state when no data
- Error state with retry on failures

**Step 3: Commit**

```bash
git add components/ui/EmptyState.tsx components/ui/ErrorState.tsx components/ui/LoadingScreen.tsx
git commit -m "feat: add reusable loading, empty, and error state components"
```

---

## Task 5: Edge Cases

**Step 1: Handle these edge cases**

| Scenario | Handling |
|----------|----------|
| User deletes account mid-chat | Supabase CASCADE deletes handle this. Chat shows "User left" system message. |
| User deletes account mid-plan | Plan status set to 'cancelled' via CASCADE or trigger. |
| Chat expires while user is in it | Subscribe to chat status changes. Show "This chat has expired" overlay. |
| Post joins when full | Re-check `is_full` before creating chat. Show "This conversation is taken" if race condition. |
| Double-tap on join | Disable button on first tap, use loading state. |
| Network error on message send | Show retry indicator on failed message. Queue for resend. |
| Push token refresh | Re-register token on each app launch. |

**Step 2: Implement critical edge cases**

Focus on:
1. Chat expiry detection while viewing (subscribe to chat status)
2. Race condition on post join (check `is_full` in a transaction)
3. Double-tap prevention (loading states on all action buttons)

**Step 3: Commit**

```bash
git commit -m "feat: handle edge cases for expiry, race conditions, and double-taps"
```

---

## Checkpoint: Step 09 Complete

At this point you should have:
- [ ] Daily prompt system with seeded prompts
- [ ] Feed algorithm with tag matching and reliability boost
- [ ] Complete profile screen with verification and reliability badges
- [ ] Settings screen with logout and delete account
- [ ] Reusable loading/empty/error state components
- [ ] Edge cases handled (expiry mid-chat, race conditions, double-taps)
- [ ] All screens have proper loading, empty, and error states

**Verify:** Full app flow feels polished — proper states everywhere, daily prompt shows, feed is personalized.
