# Step 02: Onboarding Complete

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the full onboarding flow — intent selection, profile setup, dating setup (phone verify, selfie, values card, location), and tag selection.

**Architecture:** Multi-step onboarding using Expo Router stack navigation within the `(auth)` group. Profile data written to Supabase `profiles` table. Dating setup writes to `values_cards`, triggers phone verification edge function.

**Depends on:** Step 01 (Foundation) complete.

---

## Task 1: Intent Selection Screen

**Files:**
- Create: `app/(auth)/intent.tsx`

**Step 1: Build intent selection screen**

`app/(auth)/intent.tsx`:
```typescript
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

const INTENTS = [
  {
    value: "casual" as const,
    title: "Just Chat",
    description: "Meet people through shared interests. No pressure.",
  },
  {
    value: "dating" as const,
    title: "Dating",
    description: "Real conversations that lead to real dates.",
  },
  {
    value: "both" as const,
    title: "Both",
    description: "Keep it open — chat and date.",
  },
];

export default function IntentScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<"casual" | "dating" | "both" | null>(null);

  const handleContinue = () => {
    if (!selected) return;
    // Pass intent as param to next screen
    router.push({
      pathname: "/(auth)/profile-setup",
      params: { intent: selected },
    });
  };

  return (
    <View className="flex-1 justify-center bg-background px-8">
      <Text className="mb-2 text-3xl font-bold text-white">
        What brings you here?
      </Text>
      <Text className="mb-8 text-muted">
        You can always change this later.
      </Text>

      <View className="gap-3">
        {INTENTS.map((intent) => (
          <TouchableOpacity
            key={intent.value}
            className={`rounded-xl border-2 p-4 ${
              selected === intent.value
                ? "border-primary bg-primary/10"
                : "border-muted/20 bg-surface"
            }`}
            onPress={() => setSelected(intent.value)}
          >
            <Text className="text-lg font-semibold text-white">
              {intent.title}
            </Text>
            <Text className="mt-1 text-sm text-muted">
              {intent.description}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View className="mt-8">
        <Button
          title="Continue"
          onPress={handleContinue}
          disabled={!selected}
        />
      </View>
    </View>
  );
}
```

**Step 2: Verify screen renders and selection works**

```bash
npx expo start
```
Navigate to intent screen. Expected: three cards, selection highlights, continue button enables.

**Step 3: Commit**

```bash
git add app/(auth)/intent.tsx
git commit -m "feat: add intent selection screen (casual/dating/both)"
```

---

## Task 2: Profile Setup Screen

**Files:**
- Create: `app/(auth)/profile-setup.tsx`
- Create: `lib/storage.ts`
- Create: `hooks/useProfile.ts`
- Create: `stores/profileStore.ts`

**Step 1: Create profile store**

`stores/profileStore.ts`:
```typescript
import { create } from "zustand";

type Profile = {
  id: string;
  display_name: string;
  age: number;
  show_age: boolean;
  intent: "casual" | "dating" | "both";
  photo_url: string | null;
  dating_setup_done: boolean;
  verification_status: string;
  reliability_tier: string;
};

type ProfileState = {
  profile: Profile | null;
  isLoading: boolean;
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
};

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  isLoading: true,
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
}));
```

**Step 2: Create profile hook**

`hooks/useProfile.ts`:
```typescript
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useProfileStore } from "@/stores/profileStore";
import { useAuthStore } from "@/stores/authStore";

export function useProfile() {
  const { profile, isLoading, setProfile, setLoading } = useProfileStore();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    fetchProfile();
  }, [user]);

  async function fetchProfile() {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user!.id)
      .single();

    if (data) setProfile(data as any);
    setLoading(false);
  }

  async function createProfile(fields: {
    display_name: string;
    age: number;
    show_age: boolean;
    intent: "casual" | "dating" | "both";
    photo_url?: string | null;
  }) {
    const { data, error } = await supabase
      .from("profiles")
      .insert({ id: user!.id, ...fields })
      .select()
      .single();

    if (error) throw error;
    setProfile(data as any);
    return data;
  }

  async function updateProfile(fields: Partial<typeof profile>) {
    const { data, error } = await supabase
      .from("profiles")
      .update(fields)
      .eq("id", user!.id)
      .select()
      .single();

    if (error) throw error;
    setProfile(data as any);
    return data;
  }

  return { profile, isLoading, fetchProfile, createProfile, updateProfile };
}
```

**Step 3: Create storage helper**

`lib/storage.ts`:
```typescript
import { supabase } from "./supabase";
import * as ImageManipulator from "expo-image-manipulator";

export async function uploadProfilePhoto(userId: string, uri: string): Promise<string> {
  // Compress image before upload
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 800 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
  );

  const response = await fetch(manipulated.uri);
  const blob = await response.blob();
  const fileName = `${userId}/profile-${Date.now()}.jpg`;

  const { error } = await supabase.storage
    .from("profile-photos")
    .upload(fileName, blob, { contentType: "image/jpeg", upsert: true });

  if (error) throw error;

  const { data } = supabase.storage
    .from("profile-photos")
    .getPublicUrl(fileName);

  return data.publicUrl;
}

export async function uploadVerificationSelfie(userId: string, uri: string): Promise<string> {
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 600 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );

  const response = await fetch(manipulated.uri);
  const blob = await response.blob();
  const fileName = `${userId}/selfie-${Date.now()}.jpg`;

  const { error } = await supabase.storage
    .from("verification-selfies")
    .upload(fileName, blob, { contentType: "image/jpeg" });

  if (error) throw error;

  return fileName; // Store path, not public URL (private bucket)
}
```

**Step 4: Build profile setup screen**

`app/(auth)/profile-setup.tsx`:
```typescript
import { useState } from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useProfile } from "@/hooks/useProfile";
import { uploadProfilePhoto } from "@/lib/storage";
import { useAuthStore } from "@/stores/authStore";
import { CONFIG } from "@/constants/config";

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { intent } = useLocalSearchParams<{ intent: string }>();
  const { createProfile } = useProfile();
  const user = useAuthStore((s) => s.user);

  const [displayName, setDisplayName] = useState("");
  const [showAge, setShowAge] = useState(true);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Age was collected at signup — retrieve from user metadata or pass as param
  const age = 22; // TODO: pass from signup screen via params

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleContinue = async () => {
    if (!displayName.trim()) {
      setError("Please enter a display name.");
      return;
    }
    if (displayName.length > CONFIG.MAX_DISPLAY_NAME_LENGTH) {
      setError(`Name must be ${CONFIG.MAX_DISPLAY_NAME_LENGTH} characters or less.`);
      return;
    }

    setLoading(true);
    setError("");

    try {
      let photoUrl: string | null = null;
      if (photoUri && user) {
        photoUrl = await uploadProfilePhoto(user.id, photoUri);
      }

      await createProfile({
        display_name: displayName.trim(),
        age,
        show_age: showAge,
        intent: (intent as "casual" | "dating" | "both") || "casual",
        photo_url: photoUrl,
      });

      // Route based on intent
      if (intent === "dating" || intent === "both") {
        router.push("/(auth)/dating-setup");
      } else {
        router.push("/(auth)/tags");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const needsDating = intent === "dating" || intent === "both";

  return (
    <View className="flex-1 justify-center bg-background px-8">
      <Text className="mb-8 text-3xl font-bold text-white">Set up your profile</Text>

      <View className="gap-5">
        {/* Photo */}
        <TouchableOpacity
          className="h-24 w-24 items-center justify-center self-center rounded-full bg-surface"
          onPress={pickPhoto}
        >
          {photoUri ? (
            <Image
              source={{ uri: photoUri }}
              className="h-24 w-24 rounded-full"
            />
          ) : (
            <Text className="text-3xl">📷</Text>
          )}
        </TouchableOpacity>
        <Text className="text-center text-sm text-muted">
          {needsDating ? "Photo required for dating" : "Optional"}
        </Text>

        {/* Display name */}
        <Input
          label="Display name"
          placeholder="First name or handle"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
        />

        {/* Age visibility */}
        <TouchableOpacity
          className="flex-row items-center gap-3"
          onPress={() => setShowAge(!showAge)}
        >
          <View
            className={`h-6 w-6 items-center justify-center rounded-md border ${
              showAge ? "border-primary bg-primary" : "border-muted/30"
            }`}
          >
            {showAge && <Text className="text-xs text-white">✓</Text>}
          </View>
          <Text className="text-white">Show my age on posts</Text>
        </TouchableOpacity>

        {error ? <Text className="text-sm text-red-400">{error}</Text> : null}

        <Button title="Continue" onPress={handleContinue} loading={loading} />

        {!needsDating && (
          <TouchableOpacity onPress={() => router.push("/(auth)/tags")}>
            <Text className="text-center text-primary">Skip for now</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
```

**Step 5: Verify profile setup flow**

```bash
npx expo start
```
Expected: Intent → Profile Setup with name, photo, age toggle.

**Step 6: Commit**

```bash
git add app/(auth)/profile-setup.tsx stores/profileStore.ts hooks/useProfile.ts lib/storage.ts
git commit -m "feat: add profile setup screen with photo upload and name input"
```

---

## Task 3: Dating Setup Flow (Multi-Step)

**Files:**
- Create: `app/(auth)/dating-setup.tsx`
- Create: `lib/location.ts`
- Create: `components/profile/ValuesCardForm.tsx`

**Step 1: Create location helper**

`lib/location.ts`:
```typescript
import * as Location from "expo-location";

export async function requestLocationAndVerify(): Promise<{
  lat: number;
  lng: number;
  isInIreland: boolean;
}> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Location permission is required for dating.");
  }

  const location = await Location.getCurrentPositionAsync({});
  const { latitude, longitude } = location.coords;

  // Rough bounding box for Ireland
  const isInIreland =
    latitude >= 51.3 &&
    latitude <= 55.5 &&
    longitude >= -10.7 &&
    longitude <= -5.9;

  return { lat: latitude, lng: longitude, isInIreland };
}
```

> **Note:** Install expo-location: `npx expo install expo-location`

**Step 2: Create ValuesCardForm component**

`components/profile/ValuesCardForm.tsx`:
```typescript
import { View, Text, TouchableOpacity } from "react-native";
import { useState } from "react";
import { Input } from "@/components/ui/Input";

const DEALBREAKER_OPTIONS = [
  "Smoking",
  "Heavy drinking",
  "No ambition",
  "Poor communication",
  "Dishonesty",
  "Different life goals",
];

const RELATIONSHIP_INTENTS = [
  "Long-term",
  "Open to anything",
  "Serious only",
];

type ValuesCardData = {
  looking_for: string;
  dealbreakers: string[];
  relationship_intent: string;
};

type Props = {
  onSubmit: (data: ValuesCardData) => void;
};

export function ValuesCardForm({ onSubmit }: Props) {
  const [lookingFor, setLookingFor] = useState("");
  const [dealbreakers, setDealbreakers] = useState<string[]>([]);
  const [relationshipIntent, setRelationshipIntent] = useState("");

  const toggleDealbreaker = (item: string) => {
    setDealbreakers((prev) =>
      prev.includes(item) ? prev.filter((d) => d !== item) : [...prev, item]
    );
  };

  const isComplete = lookingFor.trim() && relationshipIntent;

  return (
    <View className="gap-5">
      <Input
        label="What are you looking for?"
        placeholder="Someone who gets my weird humor..."
        value={lookingFor}
        onChangeText={setLookingFor}
        autoCapitalize="sentences"
      />

      <View>
        <Text className="mb-2 text-sm text-muted">Dealbreakers</Text>
        <View className="flex-row flex-wrap gap-2">
          {DEALBREAKER_OPTIONS.map((item) => (
            <TouchableOpacity
              key={item}
              className={`rounded-full px-3 py-1.5 ${
                dealbreakers.includes(item)
                  ? "bg-red-500/20 border border-red-500"
                  : "bg-surface border border-muted/20"
              }`}
              onPress={() => toggleDealbreaker(item)}
            >
              <Text
                className={
                  dealbreakers.includes(item) ? "text-red-400" : "text-muted"
                }
              >
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View>
        <Text className="mb-2 text-sm text-muted">Relationship intent</Text>
        <View className="gap-2">
          {RELATIONSHIP_INTENTS.map((intent) => (
            <TouchableOpacity
              key={intent}
              className={`rounded-xl border p-3 ${
                relationshipIntent === intent
                  ? "border-primary bg-primary/10"
                  : "border-muted/20 bg-surface"
              }`}
              onPress={() => setRelationshipIntent(intent)}
            >
              <Text className="text-white">{intent}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isComplete && (
        <TouchableOpacity
          className="mt-2"
          onPress={() =>
            onSubmit({
              looking_for: lookingFor.trim(),
              dealbreakers,
              relationship_intent: relationshipIntent,
            })
          }
        >
          <Text className="text-center text-lg font-semibold text-primary">
            Save Values Card
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
```

**Step 3: Build dating setup screen (multi-step within one screen)**

`app/(auth)/dating-setup.tsx`:
```typescript
import { useState } from "react";
import { View, Text, Alert, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ValuesCardForm } from "@/components/profile/ValuesCardForm";
import { supabase } from "@/lib/supabase";
import { uploadVerificationSelfie } from "@/lib/storage";
import { requestLocationAndVerify } from "@/lib/location";
import { useAuthStore } from "@/stores/authStore";
import { useProfile } from "@/hooks/useProfile";

type Step = "phone" | "selfie" | "values" | "location";

export default function DatingSetupScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { updateProfile } = useProfile();

  const [step, setStep] = useState<Step>("phone");
  const [loading, setLoading] = useState(false);

  // Phone state
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");

  // Selfie state
  const [selfieUri, setSelfieUri] = useState<string | null>(null);

  const handleSendOtp = async () => {
    setLoading(true);
    try {
      // Call phone-verify edge function
      const { error } = await supabase.functions.invoke("phone-verify", {
        body: { phone: phoneNumber, action: "send" },
      });
      if (error) throw error;
      setOtpSent(true);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("phone-verify", {
        body: { phone: phoneNumber, otp, action: "verify" },
      });
      if (error) throw error;

      await updateProfile({
        phone_number: phoneNumber,
        phone_verified: true,
        phone_country_code: "+353",
        verification_status: "phone_verified",
      } as any);

      setStep("selfie");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelfie = async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && user) {
      setSelfieUri(result.assets[0].uri);
      setLoading(true);
      try {
        const selfieUrl = await uploadVerificationSelfie(user.id, result.assets[0].uri);
        await updateProfile({
          selfie_url: selfieUrl,
          verification_status: "selfie_pending",
        } as any);
        setStep("values");
      } catch (err: any) {
        Alert.alert("Error", err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleValuesCard = async (data: {
    looking_for: string;
    dealbreakers: string[];
    relationship_intent: string;
  }) => {
    setLoading(true);
    try {
      const { error } = await supabase.from("values_cards").upsert({
        user_id: user!.id,
        ...data,
      });
      if (error) throw error;
      setStep("location");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLocation = async () => {
    setLoading(true);
    try {
      const { lat, lng, isInIreland } = await requestLocationAndVerify();

      if (!isInIreland) {
        Alert.alert(
          "Location",
          "Ahora is currently available in Ireland only. You can still use casual features."
        );
      }

      await updateProfile({
        location_lat: lat,
        location_lng: lng,
        location_verified: true,
        dating_setup_done: true,
      } as any);

      router.push("/(auth)/tags");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-8 py-12"
    >
      <Text className="mb-2 text-3xl font-bold text-white">Dating Setup</Text>
      <Text className="mb-8 text-muted">
        Step {["phone", "selfie", "values", "location"].indexOf(step) + 1} of 4
      </Text>

      {step === "phone" && (
        <View className="gap-4">
          <Text className="text-lg font-semibold text-white">
            Verify your phone
          </Text>
          {!otpSent ? (
            <>
              <Input
                label="Phone number"
                placeholder="+353 85 123 4567"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="number-pad"
              />
              <Button
                title="Send Code"
                onPress={handleSendOtp}
                loading={loading}
                disabled={phoneNumber.length < 8}
              />
            </>
          ) : (
            <>
              <Input
                label="Enter 6-digit code"
                placeholder="123456"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
              />
              <Button
                title="Verify"
                onPress={handleVerifyOtp}
                loading={loading}
                disabled={otp.length !== 6}
              />
            </>
          )}
        </View>
      )}

      {step === "selfie" && (
        <View className="gap-4">
          <Text className="text-lg font-semibold text-white">
            Verification selfie
          </Text>
          <Text className="text-muted">
            This won't be shown publicly — it helps us verify you're real.
          </Text>
          <Button title="Take Selfie" onPress={handleSelfie} loading={loading} />
        </View>
      )}

      {step === "values" && (
        <View className="gap-4">
          <Text className="text-lg font-semibold text-white">
            Your values card
          </Text>
          <ValuesCardForm onSubmit={handleValuesCard} />
        </View>
      )}

      {step === "location" && (
        <View className="gap-4">
          <Text className="text-lg font-semibold text-white">
            Confirm your location
          </Text>
          <Text className="text-muted">
            We use your location once to confirm you're in Ireland. We don't
            track you.
          </Text>
          <Button
            title="Share Location"
            onPress={handleLocation}
            loading={loading}
          />
        </View>
      )}
    </ScrollView>
  );
}
```

**Step 4: Verify dating setup flow**

```bash
npx expo start
```
Expected: Phone → Selfie → Values Card → Location, each step transitions.

**Step 5: Commit**

```bash
git add app/(auth)/dating-setup.tsx lib/location.ts components/profile/ValuesCardForm.tsx
git commit -m "feat: add dating setup flow (phone verify, selfie, values card, location)"
```

---

## Task 4: Tag Selection Screen

**Files:**
- Create: `app/(auth)/tags.tsx`
- Create: `components/profile/TagChips.tsx`
- Create: `hooks/useTags.ts`

**Step 1: Create tags hook**

`hooks/useTags.ts`:
```typescript
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Tag = { id: string; name: string; emoji: string | null; sort_order: number };

export function useTags() {
  const [vibeTags, setVibeTags] = useState<Tag[]>([]);
  const [topicTags, setTopicTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTags();
  }, []);

  async function fetchTags() {
    const [vibeRes, topicRes] = await Promise.all([
      supabase.from("vibe_tags").select("*").order("sort_order"),
      supabase.from("topic_tags").select("*").order("sort_order"),
    ]);
    if (vibeRes.data) setVibeTags(vibeRes.data);
    if (topicRes.data) setTopicTags(topicRes.data);
    setLoading(false);
  }

  async function saveUserTags(
    userId: string,
    selectedVibes: string[],
    selectedTopics: string[]
  ) {
    // Clear existing and insert new
    await supabase.from("user_vibe_tags").delete().eq("user_id", userId);
    await supabase.from("user_topic_tags").delete().eq("user_id", userId);

    if (selectedVibes.length > 0) {
      await supabase.from("user_vibe_tags").insert(
        selectedVibes.map((tagId) => ({ user_id: userId, vibe_tag_id: tagId }))
      );
    }
    if (selectedTopics.length > 0) {
      await supabase.from("user_topic_tags").insert(
        selectedTopics.map((tagId) => ({ user_id: userId, topic_tag_id: tagId }))
      );
    }
  }

  return { vibeTags, topicTags, loading, saveUserTags };
}
```

**Step 2: Create TagChips component**

`components/profile/TagChips.tsx`:
```typescript
import { View, Text, TouchableOpacity } from "react-native";

type Tag = { id: string; name: string; emoji: string | null };

type Props = {
  tags: Tag[];
  selected: string[];
  onToggle: (id: string) => void;
  maxSelect?: number;
};

export function TagChips({ tags, selected, onToggle, maxSelect = 5 }: Props) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {tags.map((tag) => {
        const isSelected = selected.includes(tag.id);
        const isDisabled = !isSelected && selected.length >= maxSelect;

        return (
          <TouchableOpacity
            key={tag.id}
            className={`rounded-full px-4 py-2 ${
              isSelected
                ? "bg-primary/20 border border-primary"
                : isDisabled
                ? "bg-surface/50 border border-muted/10"
                : "bg-surface border border-muted/20"
            }`}
            onPress={() => !isDisabled && onToggle(tag.id)}
            disabled={isDisabled}
          >
            <Text
              className={`text-sm ${
                isSelected
                  ? "text-primary font-semibold"
                  : isDisabled
                  ? "text-muted/50"
                  : "text-white"
              }`}
            >
              {tag.emoji ? `${tag.emoji} ` : ""}
              {tag.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
```

**Step 3: Build tag selection screen**

`app/(auth)/tags.tsx`:
```typescript
import { useState } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/ui/Button";
import { TagChips } from "@/components/profile/TagChips";
import { useTags } from "@/hooks/useTags";
import { useAuthStore } from "@/stores/authStore";

export default function TagsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { vibeTags, topicTags, loading: tagsLoading, saveUserTags } = useTags();

  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleVibe = (id: string) => {
    setSelectedVibes((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  const toggleTopic = (id: string) => {
    setSelectedTopics((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const handleContinue = async () => {
    if (selectedVibes.length < 1 || selectedTopics.length < 1) {
      Alert.alert("Pick at least 1 vibe and 1 topic tag.");
      return;
    }

    setSaving(true);
    try {
      await saveUserTags(user!.id, selectedVibes, selectedTopics);
      // Onboarding complete — navigate to main app
      router.replace("/(tabs)/feed");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-8 py-12"
    >
      <Text className="mb-2 text-3xl font-bold text-white">
        Pick your tags
      </Text>
      <Text className="mb-8 text-muted">
        These help us show you the right posts. Pick 3-5 of each.
      </Text>

      <Text className="mb-3 text-lg font-semibold text-white">Your vibes</Text>
      <TagChips tags={vibeTags} selected={selectedVibes} onToggle={toggleVibe} />

      <Text className="mb-3 mt-8 text-lg font-semibold text-white">
        Your topics
      </Text>
      <TagChips
        tags={topicTags}
        selected={selectedTopics}
        onToggle={toggleTopic}
      />

      <View className="mt-10">
        <Button
          title="Let's go"
          onPress={handleContinue}
          loading={saving}
          disabled={selectedVibes.length < 1 || selectedTopics.length < 1}
        />
      </View>
    </ScrollView>
  );
}
```

**Step 4: Verify tag selection works**

```bash
npx expo start
```
Expected: Two sections of chip/pill tags, selection highlights up to 5, "Let's go" navigates to feed.

**Step 5: Commit**

```bash
git add app/(auth)/tags.tsx components/profile/TagChips.tsx hooks/useTags.ts
git commit -m "feat: add tag selection screen with vibe and topic chips"
```

---

## Task 5: Wire Up Complete Onboarding Navigation

**Files:**
- Modify: `app/(auth)/_layout.tsx`
- Modify: `app/_layout.tsx`

**Step 1: Update auth layout to include all onboarding screens**

`app/(auth)/_layout.tsx`:
```typescript
import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    />
  );
}
```

**Step 2: Update root layout to check profile completion**

Update the auth guard in `app/_layout.tsx` to check if the user has completed onboarding (profile exists) vs needs to continue setup.

**Step 3: Test full onboarding flow end-to-end**

```
Welcome → Signup → Intent → Profile Setup → (Dating Setup) → Tags → Feed
```

**Step 4: Commit**

```bash
git add app/(auth)/_layout.tsx app/_layout.tsx
git commit -m "feat: wire up complete onboarding navigation flow"
```

---

## Checkpoint: Step 02 Complete

At this point you should have:
- [ ] Intent selection screen (casual/dating/both)
- [ ] Profile setup screen (name, photo, age toggle)
- [ ] Dating setup flow (phone verify → selfie → values card → location)
- [ ] Tag selection screen (vibe + topic chips)
- [ ] Profile store and hook for CRUD operations
- [ ] Image upload to Supabase Storage
- [ ] Location verification helper
- [ ] Full onboarding navigation: Welcome → Signup → Intent → Profile → (Dating) → Tags → Feed

**Verify:** Complete onboarding flow as both casual and dating user.
