"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Column = {
  id: string;
  label: string;
  type: "number" | "integer" | "string" | "date" | "boolean";
  source: { fileId: string; sheet?: string; column: string };
  nullable: boolean;
};

type AnyView = { id: string; kind: string; title: string } & Record<string, unknown>;

type Initial = {
  title: string;
  description: string;
  narrative: string;
  chatbotSystemPrompt: string;
  starterPrompts?: string[];
  columns: unknown[];
  views: unknown[];
};

export function ReviewForm({ datasetId, initial }: { datasetId: string; initial: Initial }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [narrative, setNarrative] = useState(initial.narrative);
  const [systemPrompt, setSystemPrompt] = useState(initial.chatbotSystemPrompt);
  const [starterPrompts, setStarterPrompts] = useState<string[]>(
    initial.starterPrompts && initial.starterPrompts.length >= 3
      ? initial.starterPrompts
      : [],
  );
  const [views, setViews] = useState<AnyView[]>(
    (initial.views as AnyView[]) ?? [],
  );
  const columns = useMemo(() => (initial.columns as Column[]) ?? [], [initial.columns]);

  const updateStarter = useCallback((idx: number, next: string) => {
    setStarterPrompts((prev) => prev.map((p, i) => (i === idx ? next : p)));
  }, []);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateViewTitle = useCallback((id: string, next: string) => {
    setViews((prev) => prev.map((v) => (v.id === id ? { ...v, title: next } : v)));
  }, []);

  const removeView = useCallback((id: string) => {
    setViews((prev) => prev.filter((v) => v.id !== id));
  }, []);

  const submit = useCallback(async () => {
    setError(null);
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (views.length === 0) {
      setError("At least one view is required");
      return;
    }
    setBusy(true);
    try {
      const trimmedStarters = starterPrompts
        .map((s) => s.trim())
        .filter((s) => s.length >= 8 && s.length <= 110);
      const body = {
        title,
        description: description || null,
        config: {
          columns,
          views,
          narrative: narrative || undefined,
          chatbotSystemPrompt: systemPrompt || undefined,
          starterPrompts: trimmedStarters.length >= 3 ? trimmedStarters : undefined,
        },
      };
      const res = await fetch(`/api/v1/datasets/${datasetId}/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        setError(txt || `Generate failed (${res.status})`);
        return;
      }
      const data = (await res.json()) as { slug: string };
      router.push(`/dashboard/${data.slug}`);
    } finally {
      setBusy(false);
    }
  }, [title, description, narrative, systemPrompt, starterPrompts, columns, views, datasetId, router]);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Card metadata</h2>
        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={160}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={2000}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="narrative">Narrative (for the chatbot to ground on)</Label>
          <Textarea
            id="narrative"
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
            rows={4}
            maxLength={800}
            className="mt-1"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Chatbot system prompt</h2>
        <Textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={10}
          maxLength={4000}
        />
        <p className="text-xs text-muted-foreground">
          Tells the chatbot exactly how to respond to questions about this card. The
          AI-proposed prompt instructs it to render charts/tables inline (Atlas-style)
          and never invent numbers.
        </p>
      </section>

      {starterPrompts.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">
            Starter questions{" "}
            <span className="text-sm text-muted-foreground">
              ({starterPrompts.length})
            </span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Shown as buttons in the chat&apos;s empty state. Each one should be
            answerable by the chatbot using the columns above.
          </p>
          <div className="space-y-2">
            {starterPrompts.map((p, i) => (
              <Input
                key={i}
                value={p}
                onChange={(e) => updateStarter(i, e.target.value)}
                maxLength={110}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Detected columns <span className="text-sm text-muted-foreground">({columns.length})</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          {columns.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
              title={`${c.source.column} (${c.source.fileId})`}
            >
              <span className="font-medium">{c.label}</span>
              <span className="text-muted-foreground">{c.type}</span>
            </span>
          ))}
          {columns.length === 0 ? (
            <span className="text-sm text-muted-foreground">
              No tabular columns — the card is document-only.
            </span>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Views <span className="text-sm text-muted-foreground">({views.length})</span>
        </h2>
        <ul className="space-y-3">
          {views.map((v) => (
            <li key={v.id} className="rounded-md border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {v.kind}
                  </div>
                  <Input
                    value={v.title}
                    onChange={(e) => updateViewTitle(v.id, e.target.value)}
                    className="mt-1 font-medium"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeView(v.id)}
                  aria-label="Remove view"
                >
                  Remove
                </Button>
              </div>
              <pre className="mt-3 overflow-x-auto rounded bg-muted px-3 py-2 text-xs text-muted-foreground">
                {JSON.stringify(
                  Object.fromEntries(
                    Object.entries(v).filter(([k]) => k !== "id" && k !== "title" && k !== "kind"),
                  ),
                  null,
                  2,
                )}
              </pre>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.back()}>
          Back
        </Button>
        <Button onClick={submit} disabled={busy || views.length === 0}>
          {busy ? "Generating…" : "Generate card"}
        </Button>
      </div>
    </div>
  );
}
