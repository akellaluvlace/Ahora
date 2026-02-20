# Step 05: Chat Features

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add ephemeral chat expiry, mutual save flow, content filter (database trigger), report/block functionality, and block impact on feed + chats.

**Architecture:** Expiry handled by Edge Function cron. Mutual save via database trigger (already created in schema). Content filter as a database trigger on messages INSERT. Block trigger closes shared chats.

**Depends on:** Step 04 (Chat Core) complete.

---

## Task 1: Chat Expiry Display

**Files:**
- Modify: `app/(tabs)/chats/[chatId].tsx`

**Step 1: Add expiry countdown to chat header**

Add a header subtitle showing time remaining: "Expires in 2d 4h" for active chats, "Saved" for saved chats.

```typescript
// Utility function
function expiryCountdown(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return "Expires soon";
  if (hours < 24) return `Expires in ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Expires in ${days}d ${hours % 24}h`;
}
```

Fetch chat metadata (status, expires_at) when entering the chat screen and display in the navigation header.

**Step 2: Commit**

```bash
git add app/(tabs)/chats/[chatId].tsx
git commit -m "feat: add chat expiry countdown display in chat header"
```

---

## Task 2: Mutual Save Flow

**Files:**
- Modify: `app/(tabs)/chats/[chatId].tsx`
- Create: `hooks/useChatActions.ts`

**Step 1: Create chat actions hook**

`hooks/useChatActions.ts`:
```typescript
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";

export function useChatActions(chatId: string) {
  const userId = useAuthStore((s) => s.user?.id);

  async function saveChat() {
    if (!userId || !chatId) return;

    // Update own participation
    const { error } = await supabase
      .from("chat_participants")
      .update({ has_saved: true })
      .eq("chat_id", chatId)
      .eq("user_id", userId);

    if (error) throw error;

    // Insert system message
    await supabase.from("messages").insert({
      chat_id: chatId,
      sender_id: userId,
      content: "wants to save this chat",
      is_system: true,
    });
  }

  async function reportUser(targetId: string, reason: string, details?: string) {
    if (!userId) return;

    const { error } = await supabase.from("reports").insert({
      reporter_id: userId,
      target_id: targetId,
      chat_id: chatId,
      reason,
      details,
    });

    if (error) throw error;
  }

  async function blockUser(targetId: string) {
    if (!userId) return;

    const { error } = await supabase.from("blocks").insert({
      blocker_id: userId,
      blocked_id: targetId,
    });

    if (error) throw error;
    // Block trigger in DB will close shared chats automatically
  }

  async function getChatStatus() {
    const { data } = await supabase
      .from("chats")
      .select("status, expires_at, lane, is_upgraded")
      .eq("id", chatId)
      .single();
    return data;
  }

  async function getParticipantSaveStatus() {
    const { data } = await supabase
      .from("chat_participants")
      .select("user_id, has_saved")
      .eq("chat_id", chatId);
    return data;
  }

  return {
    saveChat,
    reportUser,
    blockUser,
    getChatStatus,
    getParticipantSaveStatus,
  };
}
```

**Step 2: Add chat menu with save/report/block options**

Update `app/(tabs)/chats/[chatId].tsx` to include a "..." menu in the header with options:
- Save Chat → calls `saveChat()`, shows system message
- Report → shows reason picker → calls `reportUser()`
- Block → confirmation alert → calls `blockUser()`, navigates back

**Step 3: Commit**

```bash
git add hooks/useChatActions.ts app/(tabs)/chats/[chatId].tsx
git commit -m "feat: add mutual save, report, and block actions for chats"
```

---

## Task 3: Content Filter (Database Trigger)

**Files:**
- Create: `supabase/migrations/010_content_filter.sql`

**Step 1: Create content filter trigger**

`supabase/migrations/010_content_filter.sql`:
```sql
CREATE OR REPLACE FUNCTION filter_message_content()
RETURNS TRIGGER AS $$
DECLARE
  chat_record RECORD;
  has_confirmed_plan BOOLEAN;
  is_contact_allowed BOOLEAN;
BEGIN
  -- Skip system messages
  IF NEW.is_system THEN
    RETURN NEW;
  END IF;

  -- Get chat info
  SELECT status, lane INTO chat_record FROM chats WHERE id = NEW.chat_id;

  -- Check if contact sharing is allowed
  is_contact_allowed := false;

  -- Allowed if chat is saved
  IF chat_record.status = 'saved' THEN
    is_contact_allowed := true;
  END IF;

  -- Allowed if confirmed plan exists
  SELECT EXISTS(
    SELECT 1 FROM plans
    WHERE chat_id = NEW.chat_id AND status = 'confirmed'
  ) INTO has_confirmed_plan;

  IF has_confirmed_plan THEN
    is_contact_allowed := true;
  END IF;

  -- If not allowed, check for blocked patterns
  IF NOT is_contact_allowed THEN
    IF NEW.content ~ '(\+?\d[\d\s\-()]{7,}\d)' THEN
      NEW.content := '[Message filtered — contact info not allowed yet]';
      NEW.is_filtered := true;
      RETURN NEW;
    END IF;

    IF NEW.content ~* '(instagram|insta|ig|snapchat|snap|tiktok|twitter|x\.com)[\s:]*@?\w+' THEN
      NEW.content := '[Message filtered — social handles not allowed yet]';
      NEW.is_filtered := true;
      RETURN NEW;
    END IF;

    IF NEW.content ~ '@\w{3,}' THEN
      NEW.content := '[Message filtered — contact info not allowed yet]';
      NEW.is_filtered := true;
      RETURN NEW;
    END IF;

    IF NEW.content ~* 'https?://\S+' THEN
      NEW.content := '[Message filtered — links not allowed yet]';
      NEW.is_filtered := true;
      RETURN NEW;
    END IF;

    IF NEW.content ~* '[\w.]+@[\w.]+\.\w+' THEN
      NEW.content := '[Message filtered — contact info not allowed yet]';
      NEW.is_filtered := true;
      RETURN NEW;
    END IF;
  END IF;

  -- Check blocked terms table
  IF EXISTS (
    SELECT 1 FROM blocked_terms
    WHERE (NOT is_regex AND NEW.content ILIKE '%' || term || '%')
       OR (is_regex AND NEW.content ~* term)
  ) THEN
    NEW.content := '[Message filtered]';
    NEW.is_filtered := true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER filter_messages_before_insert
  BEFORE INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION filter_message_content();
```

**Step 2: Add client-side filter warning**

Create `lib/contentFilter.ts` as a client-side preview:
```typescript
const CONTACT_PATTERNS = [
  /(\+?\d[\d\s\-()]{7,}\d)/,
  /(instagram|insta|ig|snapchat|snap|tiktok|twitter|x\.com)[\s:]*@?\w+/i,
  /@\w{3,}/,
  /https?:\/\/\S+/,
  /[\w.]+@[\w.]+\.\w+/,
];

export function containsContactInfo(text: string): boolean {
  return CONTACT_PATTERNS.some((pattern) => pattern.test(text));
}
```

Show inline warning in ChatInput when user types contact info and chat is not saved.

**Step 3: Commit**

```bash
git add supabase/migrations/010_content_filter.sql lib/contentFilter.ts
git commit -m "feat: add content filter trigger and client-side preview warning"
```

---

## Task 4: Report Flow UI

**Files:**
- Create: `components/chat/ReportModal.tsx`

**Step 1: Create report modal**

`components/chat/ReportModal.tsx`:
```typescript
import { useState } from "react";
import { View, Text, TouchableOpacity, Modal } from "react-native";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const REPORT_REASONS = [
  { value: "harassment", label: "Harassment" },
  { value: "spam", label: "Spam" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "fake_profile", label: "Fake profile" },
  { value: "no_show", label: "No-show on date" },
  { value: "other", label: "Other" },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: string, details?: string) => void;
};

export function ReportModal({ visible, onClose, onSubmit }: Props) {
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");

  const handleSubmit = () => {
    if (!reason) return;
    onSubmit(reason, details || undefined);
    setReason(null);
    setDetails("");
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end bg-black/50">
        <View className="rounded-t-3xl bg-background px-6 py-6">
          <Text className="mb-4 text-xl font-bold text-white">
            Report user
          </Text>

          <View className="gap-2">
            {REPORT_REASONS.map((r) => (
              <TouchableOpacity
                key={r.value}
                className={`rounded-xl border p-3 ${
                  reason === r.value
                    ? "border-red-500 bg-red-500/10"
                    : "border-muted/20 bg-surface"
                }`}
                onPress={() => setReason(r.value)}
              >
                <Text className={reason === r.value ? "text-red-400" : "text-white"}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {reason && (
            <View className="mt-4">
              <Input
                label="Additional details (optional)"
                placeholder="Tell us more..."
                value={details}
                onChangeText={setDetails}
                autoCapitalize="sentences"
              />
            </View>
          )}

          <View className="mt-4 flex-row gap-3">
            <View className="flex-1">
              <Button title="Cancel" variant="outline" onPress={onClose} />
            </View>
            <View className="flex-1">
              <Button
                title="Submit"
                onPress={handleSubmit}
                disabled={!reason}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
```

**Step 2: Commit**

```bash
git add components/chat/ReportModal.tsx
git commit -m "feat: add report modal with reason selection and details input"
```

---

## Task 5: Block Impact Integration

**Files:**
- Already handled by database trigger in `007_moderation.sql`

**Step 1: Verify block trigger works**

The `handle_block()` trigger function (from Step 01) already:
- Closes all shared chats between blocker and blocked user
- RLS policies on posts hide blocked users' content
- RLS policies on profiles hide blocked users

**Step 2: Add client-side handling**

When a user blocks someone:
1. Call `blockUser()` from `useChatActions`
2. Navigate back to chat list
3. Refresh chat list (blocked user's chats are now closed/hidden)
4. Feed refresh will automatically exclude blocked user's posts (via RLS)

**Step 3: Test block flow**

- Block a user from chat menu
- Verify their chats disappear from chat list
- Verify their posts disappear from feed
- Verify the blocked user can no longer see the blocker's content

**Step 4: Commit**

```bash
git commit -m "chore: verify block impact on chats and feed via RLS"
```

---

## Checkpoint: Step 05 Complete

At this point you should have:
- [ ] Chat expiry countdown displayed in chat header
- [ ] Mutual save flow (both must save → chat becomes permanent)
- [ ] Content filter database trigger blocking contact info sharing
- [ ] Client-side content filter preview warning
- [ ] Report modal with reason selection
- [ ] Block functionality closing shared chats
- [ ] Block impact on feed (blocked users' posts hidden)

**Verify:** Send a phone number in unsaved chat → gets filtered. Save chat → phone numbers go through. Block user → their content disappears.
