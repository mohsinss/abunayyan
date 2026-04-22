"use client";
import { useChat } from "@ai-sdk/react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export function Chat() {
  const { messages, input, handleInputChange, handleSubmit, status } = useChat({
    api: "/api/v1/ai/chat",
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">Ask anything to get started.</p>
        )}
        {messages.map((m) => (
          <Card key={m.id} className="p-4">
            <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
              {m.role}
            </div>
            <div className="whitespace-pre-wrap text-sm">{m.content}</div>
            {m.toolInvocations?.map((t) => (
              <pre key={t.toolCallId} className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
                {t.toolName}({JSON.stringify(t.args)})
                {"result" in t ? `\n→ ${JSON.stringify(t.result, null, 2)}` : ""}
              </pre>
            ))}
          </Card>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask anything…"
          disabled={status === "submitted" || status === "streaming"}
        />
        <Button type="submit" disabled={status === "submitted" || status === "streaming"}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
