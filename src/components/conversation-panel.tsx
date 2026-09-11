import { useEffect, useRef, useState } from "react";
import { SendHorizonal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { listConversation, sendMessage } from "@/lib/api/conversation";
import type { ConversationDTO } from "@/lib/types";

export function ConversationPanel({
  bookingId,
  agentName,
}: {
  bookingId: string;
  agentName: string;
}) {
  const [conversation, setConversation] = useState<ConversationDTO | null>(null);
  const [draft, setDraft] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refresh = async () => {
    setConversation(await listConversation({ data: bookingId }));
  };

  useEffect(() => {
    void refresh();
  }, [bookingId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [conversation?.messages.length]);

  const handleSend = async () => {
    if (!draft.trim()) return;
    setSending(true);
    try {
      await sendMessage({
        data: {
          bookingId,
          senderType: "AGENT",
          senderName: agentName,
          message: draft,
          isInternal,
        },
      });
      setDraft("");
      setIsInternal(false);
      await refresh();
    } catch (error) {
      toast.error(
        "Could not send message",
        error instanceof Error ? { description: error.message } : {},
      );
    } finally {
      setSending(false);
    }
  };

  if (!conversation) {
    return <p className="text-sm text-muted-foreground">Loading conversation…</p>;
  }

  return (
    <div>
      <div ref={scrollRef} className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
        {conversation.messages.length === 0 && (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No messages yet. Start the conversation with your customer.
          </p>
        )}
        {conversation.messages.map((m) => {
          if (m.isInternal) {
            return (
              <div
                key={m.id}
                className="rounded-xl border border-dashed bg-secondary/40 p-3 text-sm"
              >
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Internal · {m.senderName}
                </p>
                <p className="mt-1">{m.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(m.createdAt).toLocaleString()}
                </p>
              </div>
            );
          }
          const isAgent = m.senderType === "AGENT";
          return (
            <div key={m.id} className={`flex ${isAgent ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                  isAgent
                    ? "gradient-lagoon text-primary-foreground"
                    : m.senderType === "SYSTEM"
                      ? "border bg-muted text-muted-foreground"
                      : "border bg-card"
                }`}
              >
                <p className="text-xs font-medium opacity-80">{m.senderName}</p>
                <p className="mt-0.5">{m.message}</p>
                <p className="mt-1 text-xs opacity-70">{new Date(m.createdAt).toLocaleString()}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 space-y-2">
        <Textarea
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Reply as ${agentName}…`}
        />
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={isInternal} onCheckedChange={setIsInternal} />
            <span>Internal (staff only)</span>
          </label>
          <Button size="sm" disabled={!draft.trim() || sending} onClick={handleSend}>
            <SendHorizonal className="size-4" /> Send
          </Button>
        </div>
      </div>
    </div>
  );
}
