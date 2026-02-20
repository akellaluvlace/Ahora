# Step 03: Feed & Posts

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the feed screen with casual/dating tab switching, post card component, create post flow, feed pagination, and post expiry edge function.

**Architecture:** Feed uses cursor-based pagination from Supabase. Posts are rendered as cards with tag badges. Feed is filtered by lane (casual/dating) with the dating tab gated behind `dating_setup_done`. Post expiry handled by a Supabase Edge Function cron.

**Depends on:** Step 02 (Onboarding) complete.

---

## Task 1: Feed Store & Hook

**Files:**
- Create: `stores/feedStore.ts`
- Create: `hooks/useFeed.ts`

**Step 1: Create feed store**

`stores/feedStore.ts`:
```typescript
import { create } from "zustand";

type Post = {
  id: string;
  author_id: string;
  lane: "casual" | "dating";
  vibe_tag_id: string;
  topic_tag_id: string;
  prompt_text: string;
  format: "one_on_one" | "group";
  max_participants: number;
  current_joins: number;
  is_full: boolean;
  expires_at: string;
  created_at: string;
  author: {
    display_name: string;
    photo_url: string | null;
    age: number;
    show_age: boolean;
    reliability_tier: string;
    verification_status: string;
  };
  vibe_tag: { name: string; emoji: string | null };
  topic_tag: { name: string; emoji: string | null };
};

type FeedState = {
  posts: Post[];
  lane: "casual" | "dating";
  isLoading: boolean;
  isRefreshing: boolean;
  hasMore: boolean;
  setPosts: (posts: Post[]) => void;
  appendPosts: (posts: Post[]) => void;
  setLane: (lane: "casual" | "dating") => void;
  setLoading: (loading: boolean) => void;
  setRefreshing: (refreshing: boolean) => void;
  setHasMore: (hasMore: boolean) => void;
  reset: () => void;
};

export const useFeedStore = create<FeedState>((set) => ({
  posts: [],
  lane: "casual",
  isLoading: false,
  isRefreshing: false,
  hasMore: true,
  setPosts: (posts) => set({ posts }),
  appendPosts: (posts) => set((s) => ({ posts: [...s.posts, ...posts] })),
  setLane: (lane) => set({ lane, posts: [], hasMore: true }),
  setLoading: (isLoading) => set({ isLoading }),
  setRefreshing: (isRefreshing) => set({ isRefreshing }),
  setHasMore: (hasMore) => set({ hasMore }),
  reset: () => set({ posts: [], hasMore: true }),
}));
```

**Step 2: Create feed hook with pagination**

`hooks/useFeed.ts`:
```typescript
import { useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useFeedStore } from "@/stores/feedStore";

const PAGE_SIZE = 20;

export function useFeed() {
  const store = useFeedStore();

  const fetchPosts = useCallback(
    async (refresh = false) => {
      if (store.isLoading) return;

      if (refresh) {
        store.setRefreshing(true);
        store.reset();
      } else {
        store.setLoading(true);
      }

      const cursor = refresh
        ? undefined
        : store.posts[store.posts.length - 1]?.created_at;

      let query = supabase
        .from("posts")
        .select(
          `
          *,
          author:profiles!author_id(display_name, photo_url, age, show_age, reliability_tier, verification_status),
          vibe_tag:vibe_tags!vibe_tag_id(name, emoji),
          topic_tag:topic_tags!topic_tag_id(name, emoji)
        `
        )
        .eq("lane", store.lane)
        .eq("is_expired", false)
        .eq("is_reported", false)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (cursor) {
        query = query.lt("created_at", cursor);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Feed fetch error:", error);
      } else if (data) {
        if (refresh) {
          store.setPosts(data as any);
        } else {
          store.appendPosts(data as any);
        }
        store.setHasMore(data.length === PAGE_SIZE);
      }

      store.setLoading(false);
      store.setRefreshing(false);
    },
    [store.lane, store.posts.length, store.isLoading]
  );

  return {
    posts: store.posts,
    lane: store.lane,
    isLoading: store.isLoading,
    isRefreshing: store.isRefreshing,
    hasMore: store.hasMore,
    setLane: store.setLane,
    fetchPosts,
    refresh: () => fetchPosts(true),
    loadMore: () => fetchPosts(false),
  };
}
```

**Step 3: Commit**

```bash
git add stores/feedStore.ts hooks/useFeed.ts
git commit -m "feat: add feed store and hook with cursor-based pagination"
```

---

## Task 2: Post Card Component

**Files:**
- Create: `components/feed/PostCard.tsx`
- Create: `components/ui/Badge.tsx`

**Step 1: Create Badge component**

`components/ui/Badge.tsx`:
```typescript
import { View, Text } from "react-native";

type BadgeProps = {
  label: string;
  variant?: "default" | "casual" | "dating" | "verified" | "reliability";
};

const VARIANTS = {
  default: "bg-surface border-muted/20",
  casual: "bg-blue-500/20 border-blue-500/40",
  dating: "bg-pink-500/20 border-pink-500/40",
  verified: "bg-green-500/20 border-green-500/40",
  reliability: "bg-accent/20 border-accent/40",
};

const TEXT_VARIANTS = {
  default: "text-muted",
  casual: "text-blue-400",
  dating: "text-pink-400",
  verified: "text-green-400",
  reliability: "text-accent",
};

export function Badge({ label, variant = "default" }: BadgeProps) {
  return (
    <View className={`rounded-full border px-2.5 py-0.5 ${VARIANTS[variant]}`}>
      <Text className={`text-xs font-medium ${TEXT_VARIANTS[variant]}`}>
        {label}
      </Text>
    </View>
  );
}
```

**Step 2: Create PostCard component**

`components/feed/PostCard.tsx`:
```typescript
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

type PostCardProps = {
  post: {
    id: string;
    lane: "casual" | "dating";
    prompt_text: string;
    format: "one_on_one" | "group";
    max_participants: number;
    current_joins: number;
    is_full: boolean;
    created_at: string;
    author: {
      display_name: string;
      age: number;
      show_age: boolean;
      reliability_tier: string;
      verification_status: string;
    };
    vibe_tag: { name: string; emoji: string | null };
    topic_tag: { name: string; emoji: string | null };
  };
};

function timeAgo(dateString: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateString).getTime()) / 1000
  );
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function PostCard({ post }: PostCardProps) {
  const router = useRouter();

  return (
    <TouchableOpacity
      className="rounded-2xl border border-muted/10 bg-surface p-4"
      onPress={() => router.push(`/(tabs)/feed/${post.id}`)}
      activeOpacity={0.8}
    >
      {/* Tags row */}
      <View className="mb-3 flex-row flex-wrap gap-1.5">
        <Badge
          label={post.lane === "casual" ? "Casual" : "Dating"}
          variant={post.lane}
        />
        <Badge
          label={`${post.vibe_tag.emoji || ""} ${post.vibe_tag.name}`.trim()}
        />
        <Badge
          label={`${post.topic_tag.emoji || ""} ${post.topic_tag.name}`.trim()}
        />
      </View>

      {/* Prompt */}
      <Text className="mb-3 text-base leading-6 text-white">
        "{post.prompt_text}"
      </Text>

      {/* Author + time */}
      <View className="mb-3 flex-row items-center gap-2">
        <Text className="text-sm text-muted">
          {post.author.display_name}
          {post.author.show_age ? ` · ${post.author.age}` : ""}
        </Text>
        <Text className="text-xs text-muted/60">
          · {timeAgo(post.created_at)}
        </Text>
      </View>

      {/* Dating badges */}
      {post.lane === "dating" && (
        <View className="mb-3 flex-row gap-1.5">
          {post.author.verification_status !== "unverified" && (
            <Badge label="✓ Verified" variant="verified" />
          )}
          {post.author.reliability_tier !== "new" && (
            <Badge
              label={`Reliability: ${post.author.reliability_tier}`}
              variant="reliability"
            />
          )}
        </View>
      )}

      {/* CTA */}
      <View className="flex-row items-center justify-between">
        {post.is_full ? (
          <Text className="text-sm text-muted">Conversation taken</Text>
        ) : (
          <Button
            title="Join Chat"
            onPress={() => router.push(`/(tabs)/feed/${post.id}`)}
            variant="primary"
          />
        )}
        {post.format === "group" && !post.is_full && (
          <Text className="text-sm text-muted">
            {post.current_joins}/{post.max_participants} spots
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}
```

**Step 3: Commit**

```bash
git add components/feed/PostCard.tsx components/ui/Badge.tsx
git commit -m "feat: add PostCard component with lane badges, author info, and CTA"
```

---

## Task 3: Feed Screen with Lane Tabs

**Files:**
- Create: `app/(tabs)/feed/_layout.tsx`
- Create: `app/(tabs)/feed/index.tsx`
- Create: `components/feed/FeedTabs.tsx`

**Step 1: Create FeedTabs component**

`components/feed/FeedTabs.tsx`:
```typescript
import { View, Text, TouchableOpacity } from "react-native";

type Props = {
  lane: "casual" | "dating";
  onChangeLane: (lane: "casual" | "dating") => void;
  showDating: boolean;
};

export function FeedTabs({ lane, onChangeLane, showDating }: Props) {
  return (
    <View className="flex-row border-b border-muted/10 bg-background">
      <TouchableOpacity
        className={`flex-1 items-center py-3 ${
          lane === "casual" ? "border-b-2 border-primary" : ""
        }`}
        onPress={() => onChangeLane("casual")}
      >
        <Text
          className={`font-semibold ${
            lane === "casual" ? "text-primary" : "text-muted"
          }`}
        >
          Casual
        </Text>
      </TouchableOpacity>

      {showDating && (
        <TouchableOpacity
          className={`flex-1 items-center py-3 ${
            lane === "dating" ? "border-b-2 border-pink-500" : ""
          }`}
          onPress={() => onChangeLane("dating")}
        >
          <Text
            className={`font-semibold ${
              lane === "dating" ? "text-pink-400" : "text-muted"
            }`}
          >
            Dating
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
```

**Step 2: Create feed layout**

`app/(tabs)/feed/_layout.tsx`:
```typescript
import { Stack } from "expo-router";

export default function FeedLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="[postId]"
        options={{ headerShown: true, title: "Post", headerBackTitle: "Feed" }}
      />
      <Stack.Screen
        name="create"
        options={{ presentation: "modal", title: "New Post" }}
      />
    </Stack>
  );
}
```

**Step 3: Build feed screen**

`app/(tabs)/feed/index.tsx`:
```typescript
import { useEffect } from "react";
import { View, FlatList, ActivityIndicator, TouchableOpacity, Text } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { PostCard } from "@/components/feed/PostCard";
import { FeedTabs } from "@/components/feed/FeedTabs";
import { useFeed } from "@/hooks/useFeed";
import { useProfileStore } from "@/stores/profileStore";

export default function FeedScreen() {
  const router = useRouter();
  const profile = useProfileStore((s) => s.profile);
  const {
    posts,
    lane,
    isLoading,
    isRefreshing,
    hasMore,
    setLane,
    refresh,
    loadMore,
  } = useFeed();

  const showDating =
    profile?.intent === "dating" || profile?.intent === "both";

  useEffect(() => {
    refresh();
  }, [lane]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-3">
        <Text className="text-2xl font-bold text-white">ahora</Text>
      </View>

      {/* Lane tabs */}
      <FeedTabs lane={lane} onChangeLane={setLane} showDating={showDating} />

      {/* Post list */}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="px-4 py-2">
            <PostCard post={item} />
          </View>
        )}
        onRefresh={refresh}
        refreshing={isRefreshing}
        onEndReached={() => hasMore && loadMore()}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isLoading ? (
            <ActivityIndicator className="py-4" color="#6366f1" />
          ) : null
        }
        ListEmptyComponent={
          !isLoading ? (
            <View className="flex-1 items-center justify-center py-20">
              <Text className="text-lg text-muted">No posts yet</Text>
              <Text className="mt-1 text-sm text-muted/60">
                Be the first to post something
              </Text>
            </View>
          ) : null
        }
      />

      {/* FAB */}
      <TouchableOpacity
        className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg"
        onPress={() => router.push("/(tabs)/feed/create")}
      >
        <Text className="text-2xl text-white">+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
```

**Step 4: Verify feed screen renders**

```bash
npx expo start
```
Expected: Feed screen with lane tabs, empty state, FAB button.

**Step 5: Commit**

```bash
git add app/(tabs)/feed/ components/feed/FeedTabs.tsx
git commit -m "feat: add feed screen with casual/dating lane tabs and post list"
```

---

## Task 4: Create Post Flow

**Files:**
- Create: `app/(tabs)/feed/create.tsx`

**Step 1: Build create post screen**

`app/(tabs)/feed/create.tsx`:
```typescript
import { useState } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TagChips } from "@/components/profile/TagChips";
import { PostCard } from "@/components/feed/PostCard";
import { useTags } from "@/hooks/useTags";
import { useAuthStore } from "@/stores/authStore";
import { useProfileStore } from "@/stores/profileStore";
import { supabase } from "@/lib/supabase";
import { CONFIG } from "@/constants/config";

export default function CreatePostScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const profile = useProfileStore((s) => s.profile);
  const { vibeTags, topicTags } = useTags();

  const canPostDating = profile?.dating_setup_done;

  const [lane, setLane] = useState<"casual" | "dating">("casual");
  const [vibeTagId, setVibeTagId] = useState<string | null>(null);
  const [topicTagId, setTopicTagId] = useState<string | null>(null);
  const [promptText, setPromptText] = useState("");
  const [format, setFormat] = useState<"one_on_one" | "group">("one_on_one");
  const [maxParticipants, setMaxParticipants] = useState(2);
  const [shortExpiry, setShortExpiry] = useState(false);
  const [loading, setLoading] = useState(false);

  const handlePost = async () => {
    if (!vibeTagId || !topicTagId || !promptText.trim()) {
      Alert.alert("Please fill in all fields.");
      return;
    }

    setLoading(true);
    try {
      const expiryHours = shortExpiry
        ? CONFIG.POST_SHORT_EXPIRY_HOURS
        : CONFIG.POST_EXPIRY_HOURS;

      const { error } = await supabase.from("posts").insert({
        author_id: user!.id,
        lane,
        vibe_tag_id: vibeTagId,
        topic_tag_id: topicTagId,
        prompt_text: promptText.trim(),
        format: lane === "dating" ? "one_on_one" : format,
        max_participants: lane === "dating" ? 2 : format === "one_on_one" ? 2 : maxParticipants,
        expires_at: new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString(),
      });

      if (error) throw error;
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
      {/* Lane picker */}
      <Text className="mb-2 text-sm font-medium text-muted">Lane</Text>
      <View className="mb-5 flex-row gap-3">
        <Button
          title="Casual"
          variant={lane === "casual" ? "primary" : "outline"}
          onPress={() => setLane("casual")}
        />
        {canPostDating && (
          <Button
            title="Dating"
            variant={lane === "dating" ? "secondary" : "outline"}
            onPress={() => setLane("dating")}
          />
        )}
      </View>

      {/* Vibe tag */}
      <Text className="mb-2 text-sm font-medium text-muted">Vibe</Text>
      <TagChips
        tags={vibeTags}
        selected={vibeTagId ? [vibeTagId] : []}
        onToggle={(id) => setVibeTagId(vibeTagId === id ? null : id)}
        maxSelect={1}
      />

      {/* Topic tag */}
      <Text className="mb-2 mt-5 text-sm font-medium text-muted">Topic</Text>
      <TagChips
        tags={topicTags}
        selected={topicTagId ? [topicTagId] : []}
        onToggle={(id) => setTopicTagId(topicTagId === id ? null : id)}
        maxSelect={1}
      />

      {/* Prompt */}
      <View className="mt-5">
        <Input
          label={`What's on your mind? (${promptText.length}/${CONFIG.MAX_PROMPT_LENGTH})`}
          placeholder="Need a good thriller rec. What's the best you've seen?"
          value={promptText}
          onChangeText={(text) =>
            text.length <= CONFIG.MAX_PROMPT_LENGTH && setPromptText(text)
          }
          autoCapitalize="sentences"
        />
      </View>

      {/* Format (casual only) */}
      {lane === "casual" && (
        <View className="mt-5">
          <Text className="mb-2 text-sm font-medium text-muted">Format</Text>
          <View className="flex-row gap-3">
            <Button
              title="1:1"
              variant={format === "one_on_one" ? "primary" : "outline"}
              onPress={() => {
                setFormat("one_on_one");
                setMaxParticipants(2);
              }}
            />
            <Button
              title="Group"
              variant={format === "group" ? "primary" : "outline"}
              onPress={() => {
                setFormat("group");
                setMaxParticipants(4);
              }}
            />
          </View>
          {format === "group" && (
            <View className="mt-3">
              <Input
                label="Max participants (2-8)"
                placeholder="4"
                value={String(maxParticipants)}
                onChangeText={(t) => {
                  const n = parseInt(t, 10);
                  if (!isNaN(n) && n >= 2 && n <= CONFIG.MAX_GROUP_PARTICIPANTS)
                    setMaxParticipants(n);
                }}
                keyboardType="number-pad"
              />
            </View>
          )}
        </View>
      )}

      {/* Post button */}
      <View className="mt-8">
        <Button title="Post" onPress={handlePost} loading={loading} />
      </View>
    </ScrollView>
  );
}
```

**Step 2: Verify create post flow**

```bash
npx expo start
```
Expected: Modal with lane picker, tag selectors, prompt input, format toggle, post button.

**Step 3: Commit**

```bash
git add app/(tabs)/feed/create.tsx
git commit -m "feat: add create post screen with lane, tags, prompt, and format"
```

---

## Task 5: Post Detail / Join Screen

**Files:**
- Create: `app/(tabs)/feed/[postId].tsx`

**Step 1: Build post detail screen**

`app/(tabs)/feed/[postId].tsx`:
```typescript
import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export default function PostDetailScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    fetchPost();
  }, [postId]);

  async function fetchPost() {
    const { data, error } = await supabase
      .from("posts")
      .select(`
        *,
        author:profiles!author_id(display_name, photo_url, age, show_age, reliability_tier, verification_status),
        vibe_tag:vibe_tags!vibe_tag_id(name, emoji),
        topic_tag:topic_tags!topic_tag_id(name, emoji)
      `)
      .eq("id", postId)
      .single();

    if (data) setPost(data);
    setLoading(false);
  }

  async function handleJoin() {
    if (!user || !post) return;
    setJoining(true);

    try {
      // Create chat
      const expiryMs =
        post.lane === "dating"
          ? 7 * 24 * 60 * 60 * 1000
          : 72 * 60 * 60 * 1000;

      const { data: chat, error: chatError } = await supabase
        .from("chats")
        .insert({
          post_id: post.id,
          lane: post.lane,
          expires_at: new Date(Date.now() + expiryMs).toISOString(),
          last_message_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (chatError) throw chatError;

      // Add both participants
      const { error: participantsError } = await supabase
        .from("chat_participants")
        .insert([
          { chat_id: chat.id, user_id: post.author_id },
          { chat_id: chat.id, user_id: user.id },
        ]);

      if (participantsError) throw participantsError;

      // Update post join count
      await supabase
        .from("posts")
        .update({
          current_joins: post.current_joins + 1,
          is_full: post.current_joins + 1 >= post.max_participants,
        })
        .eq("id", post.id);

      // System message
      await supabase.from("messages").insert({
        chat_id: chat.id,
        sender_id: user.id,
        content: `joined from your post about ${post.topic_tag.name}`,
        is_system: true,
      });

      // Navigate to chat
      router.replace(`/(tabs)/chats/${chat.id}`);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#6366f1" />
      </View>
    );
  }

  if (!post) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text className="text-muted">Post not found</Text>
      </View>
    );
  }

  const isOwnPost = post.author_id === user?.id;

  return (
    <View className="flex-1 bg-background px-6 py-6">
      {/* Tags */}
      <View className="mb-4 flex-row gap-2">
        <Badge label={post.lane === "casual" ? "Casual" : "Dating"} variant={post.lane} />
        <Badge label={`${post.vibe_tag.emoji || ""} ${post.vibe_tag.name}`} />
        <Badge label={`${post.topic_tag.emoji || ""} ${post.topic_tag.name}`} />
      </View>

      {/* Prompt */}
      <Text className="mb-4 text-xl leading-7 text-white">
        "{post.prompt_text}"
      </Text>

      {/* Author */}
      <Text className="mb-6 text-muted">
        Posted by {post.author.display_name}
        {post.author.show_age ? `, ${post.author.age}` : ""}
      </Text>

      {/* CTA */}
      {isOwnPost ? (
        <Text className="text-center text-muted">This is your post</Text>
      ) : post.is_full ? (
        <Text className="text-center text-lg text-muted">
          This conversation is taken
        </Text>
      ) : (
        <Button title="Join Chat" onPress={handleJoin} loading={joining} />
      )}
    </View>
  );
}
```

**Step 2: Commit**

```bash
git add app/(tabs)/feed/[postId].tsx
git commit -m "feat: add post detail screen with join flow creating chat and participants"
```

---

## Task 6: Post Expiry Edge Function

**Files:**
- Create: `supabase/functions/chat-expiry/index.ts`

**Step 1: Create chat-expiry edge function**

`supabase/functions/chat-expiry/index.ts`:
```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Expire posts past their expiry time
  const { data: expiredPosts, error: postError } = await supabase
    .from("posts")
    .update({ is_expired: true })
    .eq("is_expired", false)
    .lt("expires_at", new Date().toISOString())
    .select("id");

  // Expire active chats past their expiry time
  const { data: expiredChats, error: chatError } = await supabase
    .from("chats")
    .update({ status: "expired" })
    .eq("status", "active")
    .lt("expires_at", new Date().toISOString())
    .select("id");

  return new Response(
    JSON.stringify({
      expired_posts: expiredPosts?.length ?? 0,
      expired_chats: expiredChats?.length ?? 0,
      errors: { postError, chatError },
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
```

> **Deployment note:** Set up as cron via Supabase Dashboard: every 15 minutes.

**Step 2: Commit**

```bash
git add supabase/functions/chat-expiry/
git commit -m "feat: add chat-expiry edge function for post and chat auto-expiry"
```

---

## Task 7: Tab Navigator Setup

**Files:**
- Create: `app/(tabs)/_layout.tsx`

**Step 1: Build tab navigator**

`app/(tabs)/_layout.tsx`:
```typescript
import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useProfileStore } from "@/stores/profileStore";

export default function TabsLayout() {
  const profile = useProfileStore((s) => s.profile);
  const showPlans =
    profile?.intent === "dating" || profile?.intent === "both";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: "#11111b", borderTopColor: "#1e1e2e" },
        tabBarActiveTintColor: "#6366f1",
        tabBarInactiveTintColor: "#6c7086",
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: "Feed",
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📡</Text>,
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: "Chats",
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>💬</Text>,
        }}
      />
      <Tabs.Screen
        name="plans"
        options={{
          title: "Plans",
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📅</Text>,
          href: showPlans ? undefined : null, // hide if casual-only
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>👤</Text>,
        }}
      />
    </Tabs>
  );
}
```

**Step 2: Verify tab navigation works**

```bash
npx expo start
```
Expected: Bottom tabs with Feed, Chats, Plans (if dating), Profile.

**Step 3: Commit**

```bash
git add app/(tabs)/_layout.tsx
git commit -m "feat: add tab navigator with conditional Plans tab visibility"
```

---

## Checkpoint: Step 03 Complete

At this point you should have:
- [ ] Feed store and hook with cursor-based pagination
- [ ] PostCard component with lane badges, tags, author info
- [ ] Feed screen with casual/dating lane tab switching
- [ ] Create post flow (lane, vibe, topic, prompt, format)
- [ ] Post detail screen with join flow
- [ ] Post + chat expiry edge function
- [ ] Tab navigator (Feed, Chats, Plans, Profile)

**Verify:** Create a post, see it in feed, tap to view detail.
