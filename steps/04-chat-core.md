# Step 04: Chat Core

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the core chat system — chat list screen, real-time messaging via Supabase Realtime, chat screen UI with message bubbles, system messages, and opener selection on join.

**Architecture:** Chat uses Supabase Realtime subscriptions filtered by `chat_id`. Messages stored in `messages` table. Chat list sorted by `last_message_at`. Subscriptions managed in a custom hook, not the store.

**Depends on:** Step 03 (Feed & Posts) complete.

---

## Task 1: Chat Store

**Files:**
- Create: `stores/chatStore.ts`

**Step 1: Create chat store**

`stores/chatStore.ts`:
```typescript
import { create } from "zustand";

type ChatPreview = {
  id: string;
  post_id: string;
  lane: "casual" | "dating";
  status: "active" | "expired" | "saved" | "closed";
  is_upgraded: boolean;
  last_message_at: string | null;
  expires_at: string;
  other_user: {
    id: string;
    display_name: string;
    photo_url: string | null;
  };
  last_message?: {
    content: string;
    sender_id: string;
    created_at: string;
    is_system: boolean;
  };
  unread_count: number;
};

type Message = {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  is_system: boolean;
  is_filtered: boolean;
  created_at: string;
};

type ChatState = {
  chats: ChatPreview[];
  messages: Message[];
  isLoading: boolean;
  setChats: (chats: ChatPreview[]) => void;
  setMessages: (messages: Message[]) => void;
  appendMessage: (message: Message) => void;
  prependMessages: (messages: Message[]) => void;
  setLoading: (loading: boolean) => void;
};

export const useChatStore = create<ChatState>((set) => ({
  chats: [],
  messages: [],
  isLoading: false,
  setChats: (chats) => set({ chats }),
  setMessages: (messages) => set({ messages }),
  appendMessage: (message) =>
    set((s) => ({
      messages: [...s.messages, message],
    })),
  prependMessages: (messages) =>
    set((s) => ({
      messages: [...messages, ...s.messages],
    })),
  setLoading: (isLoading) => set({ isLoading }),
}));
```

**Step 2: Commit**

```bash
git add stores/chatStore.ts
git commit -m "feat: add chat store with chat list and messages state"
```

---

## Task 2: Chat List Hook

**Files:**
- Create: `hooks/useChat.ts`

**Step 1: Create chat hook**

`hooks/useChat.ts`:
```typescript
import { useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useChatStore } from "@/stores/chatStore";
import { useAuthStore } from "@/stores/authStore";

export function useChat() {
  const store = useChatStore();
  const userId = useAuthStore((s) => s.user?.id);

  const fetchChats = useCallback(async () => {
    if (!userId) return;
    store.setLoading(true);

    // Get all chats the user participates in
    const { data: participations } = await supabase
      .from("chat_participants")
      .select("chat_id")
      .eq("user_id", userId);

    if (!participations || participations.length === 0) {
      store.setChats([]);
      store.setLoading(false);
      return;
    }

    const chatIds = participations.map((p) => p.chat_id);

    const { data: chats } = await supabase
      .from("chats")
      .select("*")
      .in("id", chatIds)
      .in("status", ["active", "saved"])
      .order("last_message_at", { ascending: false });

    if (!chats) {
      store.setChats([]);
      store.setLoading(false);
      return;
    }

    // For each chat, get the other participant and last message
    const chatPreviews = await Promise.all(
      chats.map(async (chat) => {
        // Other participant
        const { data: participants } = await supabase
          .from("chat_participants")
          .select("user_id, profiles:profiles!user_id(id, display_name, photo_url)")
          .eq("chat_id", chat.id)
          .neq("user_id", userId);

        const otherUser = participants?.[0]?.profiles as any;

        // Last message
        const { data: lastMessages } = await supabase
          .from("messages")
          .select("content, sender_id, created_at, is_system")
          .eq("chat_id", chat.id)
          .order("created_at", { ascending: false })
          .limit(1);

        return {
          id: chat.id,
          post_id: chat.post_id,
          lane: chat.lane as "casual" | "dating",
          status: chat.status as any,
          is_upgraded: chat.is_upgraded,
          last_message_at: chat.last_message_at,
          expires_at: chat.expires_at,
          other_user: otherUser || { id: "", display_name: "Unknown", photo_url: null },
          last_message: lastMessages?.[0],
          unread_count: 0, // TODO: implement unread tracking
        };
      })
    );

    store.setChats(chatPreviews);
    store.setLoading(false);
  }, [userId]);

  return {
    chats: store.chats,
    isLoading: store.isLoading,
    fetchChats,
  };
}
```

**Step 2: Commit**

```bash
git add hooks/useChat.ts
git commit -m "feat: add useChat hook with chat list fetching and other user resolution"
```

---

## Task 3: Realtime Messages Hook

**Files:**
- Create: `hooks/useRealtimeMessages.ts`

**Step 1: Create realtime messages hook**

`hooks/useRealtimeMessages.ts`:
```typescript
import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useChatStore } from "@/stores/chatStore";

const MESSAGES_PER_PAGE = 50;

export function useRealtimeMessages(chatId: string | undefined) {
  const store = useChatStore();
  const subscriptionRef = useRef<any>(null);

  // Fetch initial messages
  const fetchMessages = useCallback(async () => {
    if (!chatId) return;

    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false })
      .limit(MESSAGES_PER_PAGE);

    if (data) {
      store.setMessages(data.reverse());
    }
  }, [chatId]);

  // Load older messages (pagination)
  const loadOlderMessages = useCallback(async () => {
    if (!chatId || store.messages.length === 0) return;

    const oldestMessage = store.messages[0];
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .lt("created_at", oldestMessage.created_at)
      .order("created_at", { ascending: false })
      .limit(MESSAGES_PER_PAGE);

    if (data && data.length > 0) {
      store.prependMessages(data.reverse());
    }
  }, [chatId, store.messages]);

  // Send message
  const sendMessage = useCallback(
    async (content: string, isSystem = false) => {
      if (!chatId) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("messages").insert({
        chat_id: chatId,
        sender_id: user.id,
        content,
        is_system: isSystem,
      });

      if (error) throw error;
    },
    [chatId]
  );

  // Subscribe to new messages
  useEffect(() => {
    if (!chatId) return;

    fetchMessages();

    subscriptionRef.current = supabase
      .channel(`messages:${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const newMessage = payload.new as any;
          // Only append if we don't already have this message
          const exists = store.messages.some((m) => m.id === newMessage.id);
          if (!exists) {
            store.appendMessage(newMessage);
          }
        }
      )
      .subscribe();

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
      store.setMessages([]);
    };
  }, [chatId]);

  return {
    messages: store.messages,
    sendMessage,
    loadOlderMessages,
  };
}
```

**Step 2: Commit**

```bash
git add hooks/useRealtimeMessages.ts
git commit -m "feat: add realtime messages hook with Supabase subscription and pagination"
```

---

## Task 4: Chat UI Components

**Files:**
- Create: `components/chat/MessageBubble.tsx`
- Create: `components/chat/ChatInput.tsx`
- Create: `components/chat/SystemMessage.tsx`

**Step 1: Create MessageBubble**

`components/chat/MessageBubble.tsx`:
```typescript
import { View, Text } from "react-native";

type Props = {
  content: string;
  isOwn: boolean;
  timestamp: string;
  isFiltered: boolean;
};

export function MessageBubble({ content, isOwn, timestamp, isFiltered }: Props) {
  const time = new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <View className={`mb-2 max-w-[80%] ${isOwn ? "self-end" : "self-start"}`}>
      <View
        className={`rounded-2xl px-4 py-2.5 ${
          isOwn ? "rounded-br-sm bg-primary" : "rounded-bl-sm bg-surface"
        } ${isFiltered ? "opacity-60" : ""}`}
      >
        <Text className={isOwn ? "text-white" : "text-white"}>
          {isFiltered ? "[Message filtered]" : content}
        </Text>
      </View>
      <Text
        className={`mt-0.5 text-[10px] text-muted/50 ${
          isOwn ? "text-right" : "text-left"
        }`}
      >
        {time}
      </Text>
    </View>
  );
}
```

**Step 2: Create SystemMessage**

`components/chat/SystemMessage.tsx`:
```typescript
import { View, Text } from "react-native";

type Props = {
  content: string;
};

export function SystemMessage({ content }: Props) {
  return (
    <View className="my-2 items-center">
      <Text className="rounded-full bg-surface/50 px-4 py-1.5 text-center text-xs text-muted">
        {content}
      </Text>
    </View>
  );
}
```

**Step 3: Create ChatInput**

`components/chat/ChatInput.tsx`:
```typescript
import { useState } from "react";
import { View, TextInput, TouchableOpacity, Text } from "react-native";

type Props = {
  onSend: (text: string) => void;
  disabled?: boolean;
};

export function ChatInput({ onSend, disabled = false }: Props) {
  const [text, setText] = useState("");

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  };

  return (
    <View className="flex-row items-end gap-2 border-t border-muted/10 bg-background px-4 py-3">
      <TextInput
        className="flex-1 rounded-2xl bg-surface px-4 py-2.5 text-base text-white"
        placeholder="Message..."
        placeholderTextColor="#6c7086"
        value={text}
        onChangeText={setText}
        multiline
        maxLength={1000}
        editable={!disabled}
      />
      <TouchableOpacity
        className={`h-10 w-10 items-center justify-center rounded-full ${
          text.trim() ? "bg-primary" : "bg-muted/20"
        }`}
        onPress={handleSend}
        disabled={!text.trim() || disabled}
      >
        <Text className="text-lg text-white">↑</Text>
      </TouchableOpacity>
    </View>
  );
}
```

**Step 4: Commit**

```bash
git add components/chat/
git commit -m "feat: add chat UI components (MessageBubble, SystemMessage, ChatInput)"
```

---

## Task 5: Chat List Screen

**Files:**
- Create: `app/(tabs)/chats/_layout.tsx`
- Create: `app/(tabs)/chats/index.tsx`

**Step 1: Create chats layout**

`app/(tabs)/chats/_layout.tsx`:
```typescript
import { Stack } from "expo-router";

export default function ChatsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="[chatId]"
        options={{ headerShown: true, headerBackTitle: "Chats" }}
      />
    </Stack>
  );
}
```

**Step 2: Build chat list screen**

`app/(tabs)/chats/index.tsx`:
```typescript
import { useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useChat } from "@/hooks/useChat";
import { Badge } from "@/components/ui/Badge";

function timeAgo(dateString: string | null): string {
  if (!dateString) return "";
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function ChatsListScreen() {
  const router = useRouter();
  const { chats, isLoading, fetchChats } = useChat();

  useEffect(() => {
    fetchChats();
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="px-5 py-3">
        <Text className="text-2xl font-bold text-white">Chats</Text>
      </View>

      <FlatList
        data={chats}
        keyExtractor={(item) => item.id}
        onRefresh={fetchChats}
        refreshing={isLoading}
        renderItem={({ item }) => (
          <TouchableOpacity
            className="flex-row items-center border-b border-muted/5 px-5 py-3.5"
            onPress={() => router.push(`/(tabs)/chats/${item.id}`)}
          >
            {/* Avatar placeholder */}
            <View className="mr-3 h-12 w-12 items-center justify-center rounded-full bg-surface">
              <Text className="text-lg">
                {item.other_user.display_name?.[0]?.toUpperCase() || "?"}
              </Text>
            </View>

            {/* Content */}
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="font-semibold text-white">
                  {item.other_user.display_name}
                </Text>
                <Badge
                  label={
                    item.is_upgraded
                      ? "Upgraded"
                      : item.lane === "casual"
                      ? "Casual"
                      : "Dating"
                  }
                  variant={item.lane}
                />
              </View>
              <Text className="mt-0.5 text-sm text-muted" numberOfLines={1}>
                {item.last_message?.is_system
                  ? `⚡ ${item.last_message.content}`
                  : item.last_message?.content || "No messages yet"}
              </Text>
            </View>

            {/* Time */}
            <Text className="text-xs text-muted/60">
              {timeAgo(item.last_message_at)}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View className="items-center py-20">
              <Text className="text-lg text-muted">No chats yet</Text>
              <Text className="mt-1 text-sm text-muted/60">
                Join a post to start chatting
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
```

**Step 3: Commit**

```bash
git add app/(tabs)/chats/
git commit -m "feat: add chat list screen with preview, lane badges, and timestamps"
```

---

## Task 6: Chat Screen

**Files:**
- Create: `app/(tabs)/chats/[chatId].tsx`

**Step 1: Build chat screen with realtime messaging**

`app/(tabs)/chats/[chatId].tsx`:
```typescript
import { useEffect, useRef } from "react";
import { View, FlatList, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { useAuthStore } from "@/stores/authStore";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { SystemMessage } from "@/components/chat/SystemMessage";
import { ChatInput } from "@/components/chat/ChatInput";

export default function ChatScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const userId = useAuthStore((s) => s.user?.id);
  const { messages, sendMessage } = useRealtimeMessages(chatId);
  const flatListRef = useRef<FlatList>(null);
  const navigation = useNavigation();

  // Set header title (could fetch other user's name)
  useEffect(() => {
    navigation.setOptions({ title: "Chat" });
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const handleSend = async (text: string) => {
    try {
      await sendMessage(text);
    } catch (err) {
      console.error("Send failed:", err);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        className="flex-1 px-4"
        contentContainerStyle={{ paddingVertical: 12 }}
        renderItem={({ item }) => {
          if (item.is_system) {
            return <SystemMessage content={item.content} />;
          }
          return (
            <MessageBubble
              content={item.content}
              isOwn={item.sender_id === userId}
              timestamp={item.created_at}
              isFiltered={item.is_filtered}
            />
          );
        }}
      />

      <ChatInput onSend={handleSend} />
    </KeyboardAvoidingView>
  );
}
```

**Step 2: Verify real-time messaging works**

```bash
npx expo start
```
Expected: Messages appear in real-time, scroll to bottom, system messages centered.

**Step 3: Commit**

```bash
git add app/(tabs)/chats/[chatId].tsx
git commit -m "feat: add chat screen with realtime messaging, auto-scroll, and message types"
```

---

## Task 7: Opener Selection on Join

**Files:**
- Create: `components/chat/OpenerPicker.tsx`
- Modify: `app/(tabs)/feed/[postId].tsx`

**Step 1: Create OpenerPicker component**

`components/chat/OpenerPicker.tsx`:
```typescript
import { View, Text, TouchableOpacity } from "react-native";
import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Props = {
  vibeName: string;
  topicName: string;
  onSelect: (opener: string) => void;
  loading: boolean;
};

function generateOpeners(vibe: string, topic: string): string[] {
  return [
    `I'm super into ${topic} too — what's your take?`,
    `This ${vibe} vibe is exactly what I need today`,
    `Been wanting to chat about ${topic} with someone — let's go!`,
  ];
}

export function OpenerPicker({ vibeName, topicName, onSelect, loading }: Props) {
  const [custom, setCustom] = useState("");
  const openers = generateOpeners(vibeName, topicName);

  return (
    <View className="gap-3">
      <Text className="text-lg font-semibold text-white">Pick an opener</Text>
      <Text className="text-sm text-muted">
        Or write your own below
      </Text>

      {openers.map((opener, i) => (
        <TouchableOpacity
          key={i}
          className="rounded-xl border border-muted/20 bg-surface p-3"
          onPress={() => onSelect(opener)}
          disabled={loading}
        >
          <Text className="text-white">"{opener}"</Text>
        </TouchableOpacity>
      ))}

      <View className="mt-2 gap-2">
        <Input
          placeholder="Write your own..."
          value={custom}
          onChangeText={setCustom}
          autoCapitalize="sentences"
        />
        {custom.trim() && (
          <Button
            title="Send"
            onPress={() => onSelect(custom.trim())}
            loading={loading}
          />
        )}
      </View>
    </View>
  );
}
```

**Step 2: Integrate opener picker into post detail join flow**

Update `app/(tabs)/feed/[postId].tsx` to show OpenerPicker as a bottom sheet/modal before creating the chat, and send the selected opener as the first message.

**Step 3: Commit**

```bash
git add components/chat/OpenerPicker.tsx app/(tabs)/feed/[postId].tsx
git commit -m "feat: add opener picker for post join flow with suggested and custom openers"
```

---

## Checkpoint: Step 04 Complete

At this point you should have:
- [ ] Chat store with chat list and messages state
- [ ] Chat list hook with participant resolution
- [ ] Realtime messages hook with Supabase subscription
- [ ] Chat UI components (MessageBubble, SystemMessage, ChatInput)
- [ ] Chat list screen sorted by last message
- [ ] Chat screen with real-time messaging
- [ ] Opener selection on post join
- [ ] Auto-scroll to bottom on new messages

**Verify:** Create a post → join from another account → real-time messaging works between both users.
