# Step 06: Dating Upgrade

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the casual→dating upgrade flow, including the request/accept/decline UI, inline dating setup prompt, values badges reveal, and the dating nudge system message.

**Architecture:** Upgrade requests stored in `upgrade_requests` table. On acceptance, chat lane changes to dating, values badges become visible. Dating nudge sent by Edge Function cron after 48h / 10+ messages.

**Depends on:** Step 05 (Chat Features) complete.

---

## Task 1: Upgrade Request Flow

**Files:**
- Create: `app/(tabs)/chats/upgrade.tsx`
- Modify: `hooks/useChatActions.ts`

**Step 1: Add upgrade methods to chat actions hook**

Add to `hooks/useChatActions.ts`:
```typescript
async function requestUpgrade() {
  if (!userId || !chatId) return;

  // Check if user has dating setup done
  const { data: profile } = await supabase
    .from("profiles")
    .select("dating_setup_done")
    .eq("id", userId)
    .single();

  if (!profile?.dating_setup_done) {
    return { needsSetup: true };
  }

  const { error } = await supabase.from("upgrade_requests").insert({
    chat_id: chatId,
    requester_id: userId,
  });

  if (error) throw error;

  // System message
  await supabase.from("messages").insert({
    chat_id: chatId,
    sender_id: userId,
    content: "wants to upgrade this chat to Dating",
    is_system: true,
  });

  return { needsSetup: false };
}

async function respondToUpgrade(requestId: string, accept: boolean) {
  const { error } = await supabase
    .from("upgrade_requests")
    .update({
      status: accept ? "accepted" : "declined",
      responded_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) throw error;

  if (accept) {
    // Upgrade the chat
    await supabase
      .from("chats")
      .update({
        lane: "dating",
        is_upgraded: true,
        upgraded_at: new Date().toISOString(),
        // Recalculate expiry to 7 days
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", chatId);

    await supabase.from("messages").insert({
      chat_id: chatId,
      sender_id: userId!,
      content: "Chat upgraded to Dating! Values cards are now visible.",
      is_system: true,
    });
  } else {
    await supabase.from("messages").insert({
      chat_id: chatId,
      sender_id: userId!,
      content: "declined the upgrade — chat continues as casual",
      is_system: true,
    });
  }
}

async function getPendingUpgradeRequest() {
  const { data } = await supabase
    .from("upgrade_requests")
    .select("*")
    .eq("chat_id", chatId)
    .eq("status", "pending")
    .single();
  return data;
}
```

**Step 2: Commit**

```bash
git add hooks/useChatActions.ts
git commit -m "feat: add upgrade request and response methods to chat actions"
```

---

## Task 2: Upgrade UI in Chat

**Files:**
- Modify: `app/(tabs)/chats/[chatId].tsx`

**Step 1: Add upgrade request inline prompt**

In the chat screen, when a pending upgrade request exists and the current user is NOT the requester, show an inline banner:

```typescript
// Inline upgrade prompt component
function UpgradePrompt({
  requesterName,
  onAccept,
  onDecline,
}: {
  requesterName: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <View className="mx-4 mb-2 rounded-xl border border-pink-500/30 bg-pink-500/10 p-4">
      <Text className="mb-2 font-semibold text-white">
        {requesterName} wants to upgrade to Dating
      </Text>
      <Text className="mb-3 text-sm text-muted">
        This will reveal values cards and extend the chat to 7 days.
      </Text>
      <View className="flex-row gap-3">
        <TouchableOpacity
          className="flex-1 items-center rounded-xl bg-pink-500 py-2.5"
          onPress={onAccept}
        >
          <Text className="font-semibold text-white">Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 items-center rounded-xl border border-muted/20 py-2.5"
          onPress={onDecline}
        >
          <Text className="text-muted">Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
```

**Step 2: Add "Upgrade to Dating" to chat menu**

Add to the "..." menu options: "Upgrade to Dating" (only visible for casual 1:1 chats). When tapped:
- If dating setup incomplete → navigate to `/(auth)/dating-setup`
- Else → send upgrade request

**Step 3: Show values badges after upgrade**

When the chat lane is "dating", show a banner at the top of the chat with both users' values card summaries (looking_for, relationship_intent).

```typescript
// ValuesReveal component
function ValuesReveal({ otherUserId }: { otherUserId: string }) {
  const [card, setCard] = useState<any>(null);

  useEffect(() => {
    supabase
      .from("values_cards")
      .select("looking_for, relationship_intent")
      .eq("user_id", otherUserId)
      .single()
      .then(({ data }) => setCard(data));
  }, [otherUserId]);

  if (!card) return null;

  return (
    <View className="mx-4 mb-2 rounded-xl bg-surface p-3">
      <Text className="mb-1 text-xs font-medium text-pink-400">
        Their values card
      </Text>
      <Text className="text-sm text-white">{card.looking_for}</Text>
      <Badge label={card.relationship_intent} variant="dating" />
    </View>
  );
}
```

**Step 4: Commit**

```bash
git add app/(tabs)/chats/[chatId].tsx
git commit -m "feat: add dating upgrade UI with accept/decline, values reveal, and menu option"
```

---

## Task 3: Dating Nudge Edge Function

**Files:**
- Create: `supabase/functions/dating-nudge/index.ts`

**Step 1: Create dating-nudge edge function**

`supabase/functions/dating-nudge/index.ts`:
```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  // Find dating chats eligible for nudge
  const { data: chats } = await supabase
    .from("chats")
    .select("id")
    .eq("lane", "dating")
    .eq("status", "active")
    .eq("nudge_sent", false)
    .lt("created_at", cutoff);

  if (!chats || chats.length === 0) {
    return new Response(JSON.stringify({ nudged: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  let nudgedCount = 0;

  for (const chat of chats) {
    // Check message count
    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("chat_id", chat.id)
      .eq("is_system", false);

    if (count && count >= 10) {
      // Send nudge system message
      await supabase.from("messages").insert({
        chat_id: chat.id,
        sender_id: "00000000-0000-0000-0000-000000000000", // system user
        content: "You've been chatting for a while! Want to plan something?",
        is_system: true,
      });

      // Mark nudge as sent
      await supabase
        .from("chats")
        .update({ nudge_sent: true, nudge_sent_at: new Date().toISOString() })
        .eq("id", chat.id);

      nudgedCount++;
    }
  }

  return new Response(JSON.stringify({ nudged: nudgedCount }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

> **Deployment:** Set as cron every 30 minutes in Supabase Dashboard.

**Step 2: Commit**

```bash
git add supabase/functions/dating-nudge/
git commit -m "feat: add dating-nudge edge function for 48h/10msg chat nudge"
```

---

## Checkpoint: Step 06 Complete

At this point you should have:
- [ ] Upgrade to Dating request flow (requester side)
- [ ] Upgrade accept/decline UI (recipient side)
- [ ] Inline dating setup redirect if not completed
- [ ] Values card reveal after upgrade
- [ ] Chat lane change on acceptance
- [ ] System messages for upgrade events
- [ ] Dating nudge edge function (48h + 10 messages)

**Verify:** Start casual chat → upgrade to dating → values cards appear. Dating chat with 10+ messages after 48h → nudge appears.
