"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateNarrativeAction } from "./actions";

export function NarrativeRow({
  id,
  slot,
  title,
  body,
}: {
  id: string;
  slot: string;
  title: string;
  body: string;
}) {
  const [pending, start] = useTransition();
  const [t, setTitle] = useState(title);
  const [b, setBody] = useState(body);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await updateNarrativeAction(fd);
      if ("error" in res) toast.error(res.error);
      else toast.success(`Saved “${slot}”`);
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-lg border border-neutral-200 bg-white p-4"
    >
      <input type="hidden" name="id" value={id} />
      <div className="flex items-center justify-between">
        <code className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-xs text-neutral-700">
          {slot}
        </code>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-neutral-200 bg-white px-3 py-1 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <input
        name="title"
        value={t}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional)"
        className="mt-3 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm font-medium"
      />
      <textarea
        name="body"
        value={b}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        className="mt-2 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
      />
    </form>
  );
}
