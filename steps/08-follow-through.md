# Step 08: Follow-Through

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the follow-through engine — push notifications, plan reminders (24h + 1h), check-in flow, grace window, post-date feedback, and reliability score calculation.

**Architecture:** Expo Notifications for push. Plan reminders via Edge Function cron. Check-in is a tap-based flow in the plan detail screen. Feedback triggers reliability recalculation via Edge Function.

**Depends on:** Step 07 (Plans Engine) complete.

---

## Task 1: Push Notification Setup

**Files:**
- Create: `lib/notifications.ts`
- Modify: `app/_layout.tsx`

**Step 1: Install expo-notifications**

```bash
npx expo install expo-notifications expo-device expo-constants
```

**Step 2: Create notifications helper**

`lib/notifications.ts`:
```typescript
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "./supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log("Push notifications require a physical device");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

  return token;
}

export async function savePushToken(userId: string, token: string) {
  // Store token — you could add a push_tokens table or store on profile
  // For MVP, we'll use Supabase Edge Functions to send via Expo Push API
  await supabase
    .from("profiles")
    .update({ push_token: token } as any)
    .eq("id", userId);
}
```

> **Note:** You'll need to add a `push_token TEXT` column to profiles:
> ```sql
> ALTER TABLE profiles ADD COLUMN push_token TEXT;
> ```

**Step 3: Register on app start**

In `app/_layout.tsx`, after auth is confirmed, register for push:
```typescript
useEffect(() => {
  if (session?.user) {
    registerForPushNotifications().then((token) => {
      if (token) savePushToken(session.user.id, token);
    });
  }
}, [session]);
```

**Step 4: Commit**

```bash
git add lib/notifications.ts app/_layout.tsx
git commit -m "feat: add push notification registration and token storage"
```

---

## Task 2: Plan Reminders Edge Function

**Files:**
- Create: `supabase/functions/plan-reminders/index.ts`

**Step 1: Create plan-reminders edge function**

`supabase/functions/plan-reminders/index.ts`:
```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const now = new Date();

  // 24h reminders
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const { data: plans24h } = await supabase
    .from("plans")
    .select("id, chat_id, date_style, scheduled_at")
    .eq("status", "confirmed")
    .eq("reminder_24h", false)
    .lt("scheduled_at", in24h.toISOString())
    .gt("scheduled_at", now.toISOString());

  for (const plan of plans24h || []) {
    // Get participants
    const { data: participants } = await supabase
      .from("chat_participants")
      .select("user_id, profiles:profiles!user_id(display_name, push_token)")
      .eq("chat_id", plan.chat_id);

    for (const p of participants || []) {
      const profile = p.profiles as any;
      if (profile?.push_token) {
        await sendExpoPush(
          profile.push_token,
          `Tomorrow: ${plan.date_style} date`,
          `Your ${plan.date_style} date is tomorrow!`
        );
      }
    }

    await supabase
      .from("plans")
      .update({ reminder_24h: true })
      .eq("id", plan.id);
  }

  // 1h reminders
  const in1h = new Date(now.getTime() + 60 * 60 * 1000);
  const { data: plans1h } = await supabase
    .from("plans")
    .select("id, chat_id, date_style, scheduled_at")
    .eq("status", "confirmed")
    .eq("reminder_1h", false)
    .lt("scheduled_at", in1h.toISOString())
    .gt("scheduled_at", now.toISOString());

  for (const plan of plans1h || []) {
    const { data: participants } = await supabase
      .from("chat_participants")
      .select("user_id, profiles:profiles!user_id(display_name, push_token)")
      .eq("chat_id", plan.chat_id);

    for (const p of participants || []) {
      const profile = p.profiles as any;
      if (profile?.push_token) {
        await sendExpoPush(
          profile.push_token,
          `In 1 hour: ${plan.date_style}`,
          `Your ${plan.date_style} date is in 1 hour!`
        );
      }
    }

    await supabase
      .from("plans")
      .update({ reminder_1h: true })
      .eq("id", plan.id);
  }

  return new Response(
    JSON.stringify({
      reminders_24h: plans24h?.length ?? 0,
      reminders_1h: plans1h?.length ?? 0,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});

async function sendExpoPush(token: string, title: string, body: string) {
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to: token, title, body, sound: "default" }),
  });
}
```

> **Deployment:** Set as cron every 15 minutes in Supabase Dashboard.

**Step 2: Commit**

```bash
git add supabase/functions/plan-reminders/
git commit -m "feat: add plan-reminders edge function with 24h and 1h push notifications"
```

---

## Task 3: Check-in Flow

**Files:**
- Modify: `app/(tabs)/plans/[planId].tsx`
- Create: `components/plans/CheckinButton.tsx`
- Create: `supabase/functions/plan-checkin-expiry/index.ts`

**Step 1: Create CheckinButton component**

`components/plans/CheckinButton.tsx`:
```typescript
import { View, Text, TouchableOpacity } from "react-native";

type Props = {
  checkedIn: boolean;
  graceExpired: boolean;
  onCheckin: () => void;
  loading: boolean;
};

export function CheckinButton({ checkedIn, graceExpired, onCheckin, loading }: Props) {
  if (checkedIn) {
    return (
      <View className="items-center rounded-xl bg-green-500/20 p-4">
        <Text className="text-lg font-semibold text-green-400">
          ✓ You're checked in!
        </Text>
      </View>
    );
  }

  if (graceExpired) {
    return (
      <View className="items-center rounded-xl bg-red-500/10 p-4">
        <Text className="text-red-400">
          Check-in window has closed
        </Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      className="items-center rounded-xl bg-primary p-4"
      onPress={onCheckin}
      disabled={loading}
    >
      <Text className="text-lg font-semibold text-white">
        {loading ? "Checking in..." : "I'm here!"}
      </Text>
      <Text className="mt-1 text-sm text-white/60">
        30-minute window to check in
      </Text>
    </TouchableOpacity>
  );
}
```

**Step 2: Add check-in to plan detail screen**

In `app/(tabs)/plans/[planId].tsx`, add check-in logic:
```typescript
async function handleCheckin() {
  setActionLoading(true);
  try {
    await supabase
      .from("plan_checkins")
      .update({
        checked_in: true,
        checked_in_at: new Date().toISOString(),
      })
      .eq("plan_id", plan.id)
      .eq("user_id", userId);

    fetchPlan();
  } catch (err: any) {
    Alert.alert("Error", err.message);
  }
  setActionLoading(false);
}
```

Show CheckinButton when:
- Plan is confirmed
- Current time is between `scheduled_at` and `scheduled_at + 30min`

**Step 3: Create plan-checkin-expiry edge function**

`supabase/functions/plan-checkin-expiry/index.ts`:
```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const graceWindow = 30 * 60 * 1000; // 30 minutes
  const now = new Date();

  // Find confirmed plans where scheduled_at + 30min has passed
  const cutoff = new Date(now.getTime() - graceWindow).toISOString();

  const { data: plans } = await supabase
    .from("plans")
    .select("id")
    .eq("status", "confirmed")
    .lt("scheduled_at", cutoff);

  for (const plan of plans || []) {
    // Expire grace for unchecked-in participants
    await supabase
      .from("plan_checkins")
      .update({ grace_expired: true })
      .eq("plan_id", plan.id)
      .eq("checked_in", false);

    // Check if both participants failed to check in
    const { data: checkins } = await supabase
      .from("plan_checkins")
      .select("checked_in")
      .eq("plan_id", plan.id);

    const anyoneCheckedIn = checkins?.some((c) => c.checked_in);

    if (!anyoneCheckedIn) {
      // Both no-showed
      await supabase
        .from("plans")
        .update({ status: "no_show" })
        .eq("id", plan.id);
    } else {
      // At least one showed — mark as completed
      await supabase
        .from("plans")
        .update({ status: "completed" })
        .eq("id", plan.id);
    }
  }

  return new Response(
    JSON.stringify({ processed: plans?.length ?? 0 }),
    { headers: { "Content-Type": "application/json" } }
  );
});
```

> **Deployment:** Set as cron every 5 minutes.

**Step 4: Commit**

```bash
git add components/plans/CheckinButton.tsx app/(tabs)/plans/[planId].tsx supabase/functions/plan-checkin-expiry/
git commit -m "feat: add check-in flow with grace window and expiry edge function"
```

---

## Task 4: Post-Date Feedback

**Files:**
- Create: `components/plans/FeedbackForm.tsx`
- Modify: `app/(tabs)/plans/[planId].tsx`

**Step 1: Create FeedbackForm component**

`components/plans/FeedbackForm.tsx`:
```typescript
import { View, Text, TouchableOpacity } from "react-native";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

type Props = {
  onSubmit: (feedback: {
    showed_up: boolean;
    was_respectful: boolean;
    would_meet_again: boolean;
  }) => void;
  loading: boolean;
};

function FeedbackQuestion({
  question,
  value,
  onChange,
}: {
  question: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <View className="flex-row items-center justify-between py-3">
      <Text className="flex-1 text-white">{question}</Text>
      <View className="flex-row gap-3">
        <TouchableOpacity
          className={`h-10 w-10 items-center justify-center rounded-full ${
            value === true ? "bg-green-500" : "bg-surface"
          }`}
          onPress={() => onChange(true)}
        >
          <Text className="text-lg">👍</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`h-10 w-10 items-center justify-center rounded-full ${
            value === false ? "bg-red-500" : "bg-surface"
          }`}
          onPress={() => onChange(false)}
        >
          <Text className="text-lg">👎</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function FeedbackForm({ onSubmit, loading }: Props) {
  const [showedUp, setShowedUp] = useState<boolean | null>(null);
  const [respectful, setRespectful] = useState<boolean | null>(null);
  const [meetAgain, setMeetAgain] = useState<boolean | null>(null);

  const isComplete =
    showedUp !== null && respectful !== null && meetAgain !== null;

  return (
    <View className="rounded-xl bg-surface p-4">
      <Text className="mb-3 text-lg font-semibold text-white">
        How was it?
      </Text>

      <FeedbackQuestion
        question="Did they show up?"
        value={showedUp}
        onChange={setShowedUp}
      />
      <FeedbackQuestion
        question="Were they respectful?"
        value={respectful}
        onChange={setRespectful}
      />
      <FeedbackQuestion
        question="Would you meet again?"
        value={meetAgain}
        onChange={setMeetAgain}
      />

      <View className="mt-3">
        <Button
          title="Submit Feedback"
          onPress={() =>
            onSubmit({
              showed_up: showedUp!,
              was_respectful: respectful!,
              would_meet_again: meetAgain!,
            })
          }
          disabled={!isComplete}
          loading={loading}
        />
      </View>
    </View>
  );
}
```

**Step 2: Integrate feedback into plan detail screen**

In `app/(tabs)/plans/[planId].tsx`, show FeedbackForm when:
- Plan status is 'completed' or 'no_show'
- User hasn't submitted feedback yet

```typescript
async function handleFeedback(feedback: {
  showed_up: boolean;
  was_respectful: boolean;
  would_meet_again: boolean;
}) {
  setActionLoading(true);
  try {
    // Determine target user
    const { data: participants } = await supabase
      .from("chat_participants")
      .select("user_id")
      .eq("chat_id", plan.chat_id)
      .neq("user_id", userId);

    const targetId = participants?.[0]?.user_id;
    if (!targetId) throw new Error("Could not find other participant");

    await supabase.from("plan_feedback").insert({
      plan_id: plan.id,
      reviewer_id: userId,
      target_id: targetId,
      ...feedback,
    });

    fetchPlan();
    Alert.alert("Thanks!", "Your feedback has been submitted.");
  } catch (err: any) {
    Alert.alert("Error", err.message);
  }
  setActionLoading(false);
}
```

**Step 3: Commit**

```bash
git add components/plans/FeedbackForm.tsx app/(tabs)/plans/[planId].tsx
git commit -m "feat: add post-date feedback form with thumbs up/down questions"
```

---

## Task 5: Reliability Score Calculation

**Files:**
- Create: `supabase/functions/reliability-calc/index.ts`

**Step 1: Create reliability-calc edge function**

`supabase/functions/reliability-calc/index.ts`:
```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SCORES = {
  SHOWED_UP: 3,
  NO_SHOW: -5,
  RESPECTFUL: 1,
  DISRESPECTFUL: -2,
  MEET_AGAIN: 1,
  WOULD_NOT: 0,
};

function getTier(score: number): string {
  if (score < 0) return "low";
  if (score <= 10) return "medium";
  return "high";
}

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { record } = await req.json();
  const planId = record.plan_id;

  // Check if both feedbacks exist
  const { data: feedbacks } = await supabase
    .from("plan_feedback")
    .select("*")
    .eq("plan_id", planId);

  if (!feedbacks || feedbacks.length < 2) {
    return new Response(JSON.stringify({ message: "Waiting for both feedbacks" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Calculate scores for each user
  for (const feedback of feedbacks) {
    const targetId = feedback.target_id;

    // Get current score
    const { data: profile } = await supabase
      .from("profiles")
      .select("reliability_score")
      .eq("id", targetId)
      .single();

    let delta = 0;
    delta += feedback.showed_up ? SCORES.SHOWED_UP : SCORES.NO_SHOW;
    delta += feedback.was_respectful ? SCORES.RESPECTFUL : SCORES.DISRESPECTFUL;
    delta += feedback.would_meet_again ? SCORES.MEET_AGAIN : SCORES.WOULD_NOT;

    const newScore = (profile?.reliability_score ?? 0) + delta;
    const newTier = getTier(newScore);

    await supabase
      .from("profiles")
      .update({
        reliability_score: newScore,
        reliability_tier: newTier,
      })
      .eq("id", targetId);

    // Check for repeated no-shows
    const { count: noShowCount } = await supabase
      .from("plan_feedback")
      .select("*", { count: "exact", head: true })
      .eq("target_id", targetId)
      .eq("showed_up", false);

    if (noShowCount && noShowCount >= 3) {
      // Flag for review — could ban or restrict dating
      console.log(`User ${targetId} has ${noShowCount} no-show reports`);
      // For MVP: just set tier to low
      await supabase
        .from("profiles")
        .update({ reliability_tier: "low" })
        .eq("id", targetId);
    }
  }

  return new Response(JSON.stringify({ calculated: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

> **Deployment:** Set as database webhook triggered by INSERT on `plan_feedback` table.

**Step 2: Commit**

```bash
git add supabase/functions/reliability-calc/
git commit -m "feat: add reliability score calculation edge function with tier mapping"
```

---

## Task 6: Reliability Badge Display

**Files:**
- Create: `components/profile/ReliabilityBadge.tsx`

**Step 1: Create ReliabilityBadge**

`components/profile/ReliabilityBadge.tsx`:
```typescript
import { View, Text } from "react-native";

type Props = {
  tier: "new" | "low" | "medium" | "high";
};

const TIER_CONFIG = {
  new: { label: "New", color: "text-muted", bg: "bg-muted/10 border-muted/20" },
  low: { label: "Low", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  medium: { label: "Medium", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
  high: { label: "High", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
};

export function ReliabilityBadge({ tier }: Props) {
  const config = TIER_CONFIG[tier];

  return (
    <View className={`rounded-full border px-3 py-1 ${config.bg}`}>
      <Text className={`text-xs font-medium ${config.color}`}>
        Reliability: {config.label}
      </Text>
    </View>
  );
}
```

**Step 2: Commit**

```bash
git add components/profile/ReliabilityBadge.tsx
git commit -m "feat: add ReliabilityBadge component with tier-based styling"
```

---

## Checkpoint: Step 08 Complete

At this point you should have:
- [ ] Push notification registration and token storage
- [ ] Plan reminders edge function (24h + 1h)
- [ ] Check-in flow with 30-minute grace window
- [ ] Check-in expiry edge function
- [ ] Post-date feedback form (showed up, respectful, meet again)
- [ ] Reliability score calculation edge function
- [ ] Reliability badge component
- [ ] No-show tracking (3+ flags for review)

**Verify:** Confirm a plan → get 24h/1h reminders → check in → submit feedback → reliability tier updates.
