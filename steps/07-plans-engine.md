# Step 07: Plans Engine

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the date planning system — plan creation flow (style, date windows, area), proposal/acceptance between users, plans tab with upcoming/past views, plan detail screen, and cancel flow.

**Architecture:** Plans are created from dating chats. Plan creation is a multi-step flow: style → time slots → area. The other participant accepts a slot. Plans tab shows upcoming and past plans. Cancellation sends a system message.

**Depends on:** Step 06 (Dating Upgrade) complete.

---

## Task 1: Plan Store & Hook

**Files:**
- Create: `stores/planStore.ts`
- Create: `hooks/usePlans.ts`

**Step 1: Create plan store**

`stores/planStore.ts`:
```typescript
import { create } from "zustand";

type Plan = {
  id: string;
  chat_id: string;
  proposed_by: string;
  date_style: "coffee" | "walk" | "activity" | "dinner";
  scheduled_at: string;
  area: string;
  status: "proposed" | "confirmed" | "completed" | "cancelled" | "no_show";
  confirmed_at: string | null;
  created_at: string;
  other_user: {
    id: string;
    display_name: string;
    photo_url: string | null;
  };
  my_checkin?: {
    checked_in: boolean;
    grace_expired: boolean;
  };
  feedback_submitted: boolean;
};

type PlanState = {
  plans: Plan[];
  isLoading: boolean;
  setPlans: (plans: Plan[]) => void;
  setLoading: (loading: boolean) => void;
};

export const usePlanStore = create<PlanState>((set) => ({
  plans: [],
  isLoading: false,
  setPlans: (plans) => set({ plans }),
  setLoading: (isLoading) => set({ isLoading }),
}));
```

**Step 2: Create plans hook**

`hooks/usePlans.ts`:
```typescript
import { useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { usePlanStore } from "@/stores/planStore";
import { useAuthStore } from "@/stores/authStore";

export function usePlans() {
  const store = usePlanStore();
  const userId = useAuthStore((s) => s.user?.id);

  const fetchPlans = useCallback(async () => {
    if (!userId) return;
    store.setLoading(true);

    // Get chats user participates in
    const { data: participations } = await supabase
      .from("chat_participants")
      .select("chat_id")
      .eq("user_id", userId);

    if (!participations || participations.length === 0) {
      store.setPlans([]);
      store.setLoading(false);
      return;
    }

    const chatIds = participations.map((p) => p.chat_id);

    const { data: plans } = await supabase
      .from("plans")
      .select("*")
      .in("chat_id", chatIds)
      .order("scheduled_at", { ascending: true });

    if (!plans) {
      store.setPlans([]);
      store.setLoading(false);
      return;
    }

    // Enrich with other user info and checkin status
    const enriched = await Promise.all(
      plans.map(async (plan) => {
        // Get other participant
        const { data: participants } = await supabase
          .from("chat_participants")
          .select("user_id, profiles:profiles!user_id(id, display_name, photo_url)")
          .eq("chat_id", plan.chat_id)
          .neq("user_id", userId);

        const otherUser = (participants?.[0]?.profiles as any) || {
          id: "",
          display_name: "Unknown",
          photo_url: null,
        };

        // Get own checkin
        const { data: checkin } = await supabase
          .from("plan_checkins")
          .select("checked_in, grace_expired")
          .eq("plan_id", plan.id)
          .eq("user_id", userId)
          .single();

        // Check if feedback submitted
        const { data: feedback } = await supabase
          .from("plan_feedback")
          .select("id")
          .eq("plan_id", plan.id)
          .eq("reviewer_id", userId)
          .single();

        return {
          ...plan,
          other_user: otherUser,
          my_checkin: checkin || undefined,
          feedback_submitted: !!feedback,
        };
      })
    );

    store.setPlans(enriched as any);
    store.setLoading(false);
  }, [userId]);

  const createPlan = useCallback(
    async (data: {
      chat_id: string;
      date_style: string;
      scheduled_at: string;
      area: string;
    }) => {
      if (!userId) return;

      const { data: plan, error } = await supabase
        .from("plans")
        .insert({
          ...data,
          proposed_by: userId,
        })
        .select()
        .single();

      if (error) throw error;

      // Create checkin records for both participants
      const { data: participants } = await supabase
        .from("chat_participants")
        .select("user_id")
        .eq("chat_id", data.chat_id);

      if (participants) {
        await supabase.from("plan_checkins").insert(
          participants.map((p) => ({
            plan_id: plan.id,
            user_id: p.user_id,
          }))
        );
      }

      // System message
      await supabase.from("messages").insert({
        chat_id: data.chat_id,
        sender_id: userId,
        content: `proposed a ${data.date_style} date in ${data.area}`,
        is_system: true,
      });

      return plan;
    },
    [userId]
  );

  const confirmPlan = useCallback(
    async (planId: string, chatId: string) => {
      if (!userId) return;

      const { error } = await supabase
        .from("plans")
        .update({
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", planId);

      if (error) throw error;

      await supabase.from("messages").insert({
        chat_id: chatId,
        sender_id: userId,
        content: "It's a date! Plan confirmed.",
        is_system: true,
      });
    },
    [userId]
  );

  const cancelPlan = useCallback(
    async (planId: string, chatId: string) => {
      if (!userId) return;

      const { error } = await supabase
        .from("plans")
        .update({ status: "cancelled" })
        .eq("id", planId);

      if (error) throw error;

      await supabase.from("messages").insert({
        chat_id: chatId,
        sender_id: userId,
        content: "cancelled the plan",
        is_system: true,
      });
    },
    [userId]
  );

  return {
    plans: store.plans,
    isLoading: store.isLoading,
    fetchPlans,
    createPlan,
    confirmPlan,
    cancelPlan,
  };
}
```

**Step 3: Commit**

```bash
git add stores/planStore.ts hooks/usePlans.ts
git commit -m "feat: add plan store and hook with CRUD, confirm, and cancel operations"
```

---

## Task 2: Plan Creation Screen

**Files:**
- Create: `app/(tabs)/plans/create.tsx`
- Create: `components/plans/DateWindowPicker.tsx`

**Step 1: Create DateWindowPicker component**

`components/plans/DateWindowPicker.tsx`:
```typescript
import { View, Text, TouchableOpacity, ScrollView } from "react-native";

type TimeSlot = {
  label: string;
  value: string; // ISO string
};

function generateSlots(): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const now = new Date();

  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const date = new Date(now);
    date.setDate(date.getDate() + dayOffset);

    const dayName = date.toLocaleDateString("en-IE", { weekday: "short" });
    const dateStr = date.toLocaleDateString("en-IE", { month: "short", day: "numeric" });

    const times = [
      { label: "Morning", hour: 10 },
      { label: "Lunch", hour: 12 },
      { label: "Afternoon", hour: 15 },
      { label: "Evening", hour: 19 },
    ];

    for (const time of times) {
      const slotDate = new Date(date);
      slotDate.setHours(time.hour, 0, 0, 0);

      // Skip past times
      if (slotDate <= now) continue;

      slots.push({
        label: `${dayName} ${dateStr} · ${time.label}`,
        value: slotDate.toISOString(),
      });
    }
  }

  return slots;
}

type Props = {
  selected: string[];
  onToggle: (value: string) => void;
  maxSelect?: number;
};

export function DateWindowPicker({ selected, onToggle, maxSelect = 3 }: Props) {
  const slots = generateSlots();

  return (
    <ScrollView className="max-h-64">
      <View className="gap-2">
        {slots.map((slot) => {
          const isSelected = selected.includes(slot.value);
          const isDisabled = !isSelected && selected.length >= maxSelect;

          return (
            <TouchableOpacity
              key={slot.value}
              className={`rounded-xl border p-3 ${
                isSelected
                  ? "border-primary bg-primary/10"
                  : isDisabled
                  ? "border-muted/10 bg-surface/50"
                  : "border-muted/20 bg-surface"
              }`}
              onPress={() => !isDisabled && onToggle(slot.value)}
              disabled={isDisabled}
            >
              <Text
                className={
                  isSelected
                    ? "text-primary font-semibold"
                    : isDisabled
                    ? "text-muted/50"
                    : "text-white"
                }
              >
                {slot.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}
```

**Step 2: Build plan creation screen**

`app/(tabs)/plans/create.tsx`:
```typescript
import { useState } from "react";
import { View, Text, ScrollView, Alert, TouchableOpacity } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DateWindowPicker } from "@/components/plans/DateWindowPicker";
import { usePlans } from "@/hooks/usePlans";

const DATE_STYLES = [
  { value: "coffee", label: "Coffee", icon: "☕" },
  { value: "walk", label: "Walk", icon: "🚶" },
  { value: "activity", label: "Activity", icon: "🎯" },
  { value: "dinner", label: "Dinner", icon: "🍽️" },
];

const DUBLIN_AREAS = [
  "City Centre",
  "D2 (Grand Canal)",
  "D4 (Ballsbridge)",
  "D6 (Rathmines)",
  "D8 (Portobello)",
  "Dun Laoghaire",
  "Howth",
  "Smithfield",
];

type Step = "style" | "time" | "area" | "confirm";

export default function CreatePlanScreen() {
  const router = useRouter();
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const { createPlan } = usePlans();

  const [step, setStep] = useState<Step>("style");
  const [dateStyle, setDateStyle] = useState<string | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [area, setArea] = useState<string | null>(null);
  const [customArea, setCustomArea] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleSlot = (value: string) => {
    setSelectedSlots((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );
  };

  const handleCreate = async () => {
    if (!chatId || !dateStyle || selectedSlots.length === 0 || !area) return;
    setLoading(true);

    try {
      await createPlan({
        chat_id: chatId,
        date_style: dateStyle,
        scheduled_at: selectedSlots[0], // Primary slot (MVP: use first selected)
        area: area === "Other" ? customArea : area,
      });
      router.back();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-6 py-6"
    >
      <Text className="mb-2 text-2xl font-bold text-white">Plan a date</Text>
      <Text className="mb-6 text-muted">
        Step {["style", "time", "area", "confirm"].indexOf(step) + 1} of 4
      </Text>

      {/* Step 1: Date style */}
      {step === "style" && (
        <View className="gap-3">
          <Text className="text-lg font-semibold text-white">
            What kind of date?
          </Text>
          {DATE_STYLES.map((style) => (
            <TouchableOpacity
              key={style.value}
              className={`flex-row items-center gap-3 rounded-xl border p-4 ${
                dateStyle === style.value
                  ? "border-primary bg-primary/10"
                  : "border-muted/20 bg-surface"
              }`}
              onPress={() => setDateStyle(style.value)}
            >
              <Text className="text-2xl">{style.icon}</Text>
              <Text className="text-lg text-white">{style.label}</Text>
            </TouchableOpacity>
          ))}
          <Button
            title="Next"
            onPress={() => setStep("time")}
            disabled={!dateStyle}
          />
        </View>
      )}

      {/* Step 2: Time slots */}
      {step === "time" && (
        <View className="gap-3">
          <Text className="text-lg font-semibold text-white">
            Pick 1-3 time slots
          </Text>
          <DateWindowPicker
            selected={selectedSlots}
            onToggle={toggleSlot}
          />
          <View className="mt-3 flex-row gap-3">
            <View className="flex-1">
              <Button title="Back" variant="outline" onPress={() => setStep("style")} />
            </View>
            <View className="flex-1">
              <Button
                title="Next"
                onPress={() => setStep("area")}
                disabled={selectedSlots.length === 0}
              />
            </View>
          </View>
        </View>
      )}

      {/* Step 3: Area */}
      {step === "area" && (
        <View className="gap-3">
          <Text className="text-lg font-semibold text-white">Where?</Text>
          {[...DUBLIN_AREAS, "Other"].map((a) => (
            <TouchableOpacity
              key={a}
              className={`rounded-xl border p-3 ${
                area === a ? "border-primary bg-primary/10" : "border-muted/20 bg-surface"
              }`}
              onPress={() => setArea(a)}
            >
              <Text className={area === a ? "text-primary" : "text-white"}>
                {a}
              </Text>
            </TouchableOpacity>
          ))}
          {area === "Other" && (
            <Input
              placeholder="Enter area..."
              value={customArea}
              onChangeText={setCustomArea}
            />
          )}
          <View className="mt-3 flex-row gap-3">
            <View className="flex-1">
              <Button title="Back" variant="outline" onPress={() => setStep("time")} />
            </View>
            <View className="flex-1">
              <Button
                title="Next"
                onPress={() => setStep("confirm")}
                disabled={!area || (area === "Other" && !customArea.trim())}
              />
            </View>
          </View>
        </View>
      )}

      {/* Step 4: Confirm */}
      {step === "confirm" && (
        <View className="gap-4">
          <Text className="text-lg font-semibold text-white">Confirm your plan</Text>

          <View className="rounded-xl bg-surface p-4 gap-2">
            <Text className="text-white">
              {DATE_STYLES.find((s) => s.value === dateStyle)?.icon}{" "}
              {DATE_STYLES.find((s) => s.value === dateStyle)?.label}
            </Text>
            <Text className="text-white">
              📅 {new Date(selectedSlots[0]).toLocaleDateString("en-IE", {
                weekday: "long",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
            <Text className="text-white">
              📍 {area === "Other" ? customArea : area}
            </Text>
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Button title="Back" variant="outline" onPress={() => setStep("area")} />
            </View>
            <View className="flex-1">
              <Button title="Propose" onPress={handleCreate} loading={loading} />
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
```

**Step 3: Commit**

```bash
git add app/(tabs)/plans/create.tsx components/plans/DateWindowPicker.tsx
git commit -m "feat: add plan creation flow with style, time slots, area, and confirmation"
```

---

## Task 3: Plans Tab — List Screen

**Files:**
- Create: `app/(tabs)/plans/_layout.tsx`
- Create: `app/(tabs)/plans/index.tsx`
- Create: `components/plans/PlanCard.tsx`

**Step 1: Create PlanCard component**

`components/plans/PlanCard.tsx`:
```typescript
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Badge } from "@/components/ui/Badge";

const STYLE_ICONS = { coffee: "☕", walk: "🚶", activity: "🎯", dinner: "🍽️" };
const STATUS_VARIANTS: Record<string, "default" | "verified" | "casual" | "dating"> = {
  proposed: "default",
  confirmed: "verified",
  completed: "verified",
  cancelled: "default",
  no_show: "dating",
};

type Props = {
  plan: {
    id: string;
    date_style: "coffee" | "walk" | "activity" | "dinner";
    scheduled_at: string;
    area: string;
    status: string;
    other_user: { display_name: string };
    feedback_submitted: boolean;
  };
};

export function PlanCard({ plan }: Props) {
  const router = useRouter();

  return (
    <TouchableOpacity
      className="rounded-xl border border-muted/10 bg-surface p-4"
      onPress={() => router.push(`/(tabs)/plans/${plan.id}`)}
    >
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="font-semibold text-white">
          {STYLE_ICONS[plan.date_style]} {plan.date_style} with{" "}
          {plan.other_user.display_name}
        </Text>
        <Badge label={plan.status} variant={STATUS_VARIANTS[plan.status] || "default"} />
      </View>

      <Text className="text-sm text-muted">
        {new Date(plan.scheduled_at).toLocaleDateString("en-IE", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
        {" · "}
        {plan.area}
      </Text>

      {!plan.feedback_submitted &&
        (plan.status === "completed" || plan.status === "no_show") && (
          <View className="mt-2">
            <Badge label="Leave feedback" variant="dating" />
          </View>
        )}
    </TouchableOpacity>
  );
}
```

**Step 2: Create plans layout and list screen**

`app/(tabs)/plans/_layout.tsx`:
```typescript
import { Stack } from "expo-router";

export default function PlansLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[planId]" options={{ title: "Plan Detail" }} />
      <Stack.Screen
        name="create"
        options={{ presentation: "modal", title: "Plan a Date" }}
      />
    </Stack>
  );
}
```

`app/(tabs)/plans/index.tsx`:
```typescript
import { useEffect } from "react";
import { View, Text, SectionList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePlans } from "@/hooks/usePlans";
import { PlanCard } from "@/components/plans/PlanCard";

export default function PlansListScreen() {
  const { plans, isLoading, fetchPlans } = usePlans();

  useEffect(() => {
    fetchPlans();
  }, []);

  const now = new Date();
  const upcoming = plans.filter(
    (p) =>
      new Date(p.scheduled_at) >= now &&
      (p.status === "proposed" || p.status === "confirmed")
  );
  const past = plans.filter(
    (p) =>
      new Date(p.scheduled_at) < now ||
      p.status === "completed" ||
      p.status === "cancelled" ||
      p.status === "no_show"
  );

  const sections = [
    { title: "Upcoming", data: upcoming },
    { title: "Past", data: past },
  ].filter((s) => s.data.length > 0);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="px-5 py-3">
        <Text className="text-2xl font-bold text-white">Plans</Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        onRefresh={fetchPlans}
        refreshing={isLoading}
        renderSectionHeader={({ section }) => (
          <Text className="bg-background px-5 py-2 text-sm font-medium text-muted">
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => (
          <View className="px-4 py-1.5">
            <PlanCard plan={item as any} />
          </View>
        )}
        ListEmptyComponent={
          <View className="items-center py-20">
            <Text className="text-lg text-muted">No plans yet</Text>
            <Text className="mt-1 text-sm text-muted/60">
              Start one from a dating chat
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
```

**Step 3: Commit**

```bash
git add app/(tabs)/plans/ components/plans/PlanCard.tsx
git commit -m "feat: add plans list screen with upcoming/past sections and plan cards"
```

---

## Task 4: Plan Detail Screen

**Files:**
- Create: `app/(tabs)/plans/[planId].tsx`

**Step 1: Build plan detail screen**

`app/(tabs)/plans/[planId].tsx`:
```typescript
import { useEffect, useState } from "react";
import { View, Text, Alert, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { usePlans } from "@/hooks/usePlans";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const STYLE_ICONS = { coffee: "☕", walk: "🚶", activity: "🎯", dinner: "🍽️" };

export default function PlanDetailScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const userId = useAuthStore((s) => s.user?.id);
  const { confirmPlan, cancelPlan } = usePlans();

  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchPlan();
  }, [planId]);

  async function fetchPlan() {
    const { data } = await supabase
      .from("plans")
      .select("*")
      .eq("id", planId)
      .single();
    setPlan(data);
    setLoading(false);
  }

  const handleConfirm = async () => {
    setActionLoading(true);
    try {
      await confirmPlan(plan.id, plan.chat_id);
      fetchPlan();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
    setActionLoading(false);
  };

  const handleCancel = async () => {
    Alert.alert("Cancel plan?", "This cannot be undone.", [
      { text: "Keep", style: "cancel" },
      {
        text: "Cancel Plan",
        style: "destructive",
        onPress: async () => {
          setActionLoading(true);
          try {
            await cancelPlan(plan.id, plan.chat_id);
            fetchPlan();
          } catch (err: any) {
            Alert.alert("Error", err.message);
          }
          setActionLoading(false);
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#6366f1" />
      </View>
    );
  }

  if (!plan) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text className="text-muted">Plan not found</Text>
      </View>
    );
  }

  const scheduledDate = new Date(plan.scheduled_at);
  const isPast = scheduledDate < new Date();
  const isProposer = plan.proposed_by === userId;

  return (
    <View className="flex-1 bg-background px-6 py-6">
      {/* Plan info */}
      <View className="mb-6 rounded-xl bg-surface p-5 gap-3">
        <Text className="text-2xl">
          {STYLE_ICONS[plan.date_style as keyof typeof STYLE_ICONS]}
        </Text>
        <Text className="text-xl font-bold text-white capitalize">
          {plan.date_style} date
        </Text>
        <Text className="text-white">
          📅{" "}
          {scheduledDate.toLocaleDateString("en-IE", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
          {" at "}
          {scheduledDate.toLocaleTimeString("en-IE", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
        <Text className="text-white">📍 {plan.area}</Text>
        <Badge
          label={plan.status}
          variant={plan.status === "confirmed" ? "verified" : "default"}
        />
      </View>

      {/* Actions based on status */}
      {plan.status === "proposed" && !isProposer && (
        <View className="gap-3">
          <Button title="Accept" onPress={handleConfirm} loading={actionLoading} />
          <Button
            title="Decline"
            variant="outline"
            onPress={handleCancel}
          />
        </View>
      )}

      {plan.status === "proposed" && isProposer && (
        <View className="gap-3">
          <Text className="text-center text-muted">
            Waiting for them to accept...
          </Text>
          <Button
            title="Cancel Plan"
            variant="outline"
            onPress={handleCancel}
            loading={actionLoading}
          />
        </View>
      )}

      {plan.status === "confirmed" && !isPast && (
        <View className="gap-3">
          <Text className="text-center text-lg text-white">
            You're all set! See you there.
          </Text>
          <Button
            title="Cancel Plan"
            variant="outline"
            onPress={handleCancel}
            loading={actionLoading}
          />
        </View>
      )}

      {plan.status === "cancelled" && (
        <Text className="text-center text-muted">This plan was cancelled.</Text>
      )}
    </View>
  );
}
```

**Step 2: Commit**

```bash
git add app/(tabs)/plans/[planId].tsx
git commit -m "feat: add plan detail screen with confirm, cancel, and status display"
```

---

## Checkpoint: Step 07 Complete

At this point you should have:
- [ ] Plan store and hook with CRUD operations
- [ ] Plan creation flow (style → time slots → area → confirm)
- [ ] DateWindowPicker with 2-week slot generation
- [ ] Plans list screen with upcoming/past sections
- [ ] PlanCard component with status badges
- [ ] Plan detail screen with confirm/cancel actions
- [ ] System messages for plan events
- [ ] Checkin records auto-created on plan creation

**Verify:** Create a plan from a dating chat → see it in Plans tab → other user confirms → plan shows as confirmed.
