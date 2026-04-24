"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Step = "describe" | "upload" | "generating";
type FileRow = {
  id: string;
  filename: string;
  sizeBytes: number;
  status: "queued" | "parsing" | "ready" | "failed";
  parseError: string | null;
};

export function CreateWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("describe");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const createDraft = useCallback(async () => {
    setError(null);
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/datasets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, description: description || null }),
      });
      if (!res.ok) {
        const body = await res.text();
        setError(body || `Create failed (${res.status})`);
        return;
      }
      const data = (await res.json()) as { id: string; slug: string };
      setDraftId(data.id);
      setStep("upload");
    } finally {
      setBusy(false);
    }
  }, [title, description]);

  const uploadFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!draftId || !fileList || fileList.length === 0) return;
      setError(null);
      for (const f of Array.from(fileList)) {
        const form = new FormData();
        form.append("file", f);
        const res = await fetch(`/api/v1/datasets/${draftId}/files`, {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const body = await res.text();
          setError(body || `Upload failed for ${f.name}`);
          continue;
        }
        const data = (await res.json()) as {
          fileId: string;
          filename: string;
          sizeBytes: number;
          status: FileRow["status"];
        };
        setFiles((prev) => [
          ...prev,
          {
            id: data.fileId,
            filename: data.filename,
            sizeBytes: data.sizeBytes,
            status: data.status,
            parseError: null,
          },
        ]);
      }
    },
    [draftId],
  );

  // Poll status of files until they're all terminal (ready/failed).
  const pollingRef = useRef(false);
  useEffect(() => {
    if (!draftId) return;
    if (files.length === 0) return;
    const anyPending = files.some((f) => f.status === "queued" || f.status === "parsing");
    if (!anyPending) return;
    if (pollingRef.current) return;
    pollingRef.current = true;

    const iv = setInterval(async () => {
      const res = await fetch(`/api/v1/datasets/${draftId}`);
      if (!res.ok) return;
      const data = (await res.json()) as { files: FileRow[] };
      setFiles(data.files);
      if (!data.files.some((f) => f.status === "queued" || f.status === "parsing")) {
        clearInterval(iv);
        pollingRef.current = false;
      }
    }, 2000);
    return () => {
      clearInterval(iv);
      pollingRef.current = false;
    };
  }, [draftId, files]);

  const propose = useCallback(async () => {
    if (!draftId) return;
    setError(null);
    setStep("generating");
    try {
      const res = await fetch(`/api/v1/datasets/${draftId}/propose`, { method: "POST" });
      if (!res.ok) {
        const body = await res.text();
        setError(body || `Proposal failed (${res.status})`);
        setStep("upload");
        return;
      }
      router.push(`/dashboard/new/review?draft=${draftId}`);
    } catch (err) {
      setError((err as Error).message);
      setStep("upload");
    }
  }, [draftId, router]);

  const readyCount = files.filter((f) => f.status === "ready").length;
  const anyPending = files.some((f) => f.status === "queued" || f.status === "parsing");
  const canPropose = !anyPending && readyCount > 0;

  return (
    <div className="mx-auto max-w-2xl">
      <Stepper current={step} />
      {error ? (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {step === "describe" ? (
        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={160}
              placeholder="Q1 Supplier Spend Review"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="What this dataset covers, who uses it, what decisions it drives."
              className="mt-1"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={createDraft} disabled={busy || !title.trim()}>
              {busy ? "Creating…" : "Next: upload files"}
            </Button>
          </div>
        </div>
      ) : null}

      {step === "upload" || step === "generating" ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Accepted: .xlsx, .xls, .csv, .docx, .pptx. Each file parses in the background.
          </p>
          <input
            type="file"
            multiple
            accept=".xlsx,.xls,.csv,.docx,.pptx"
            onChange={(e) => uploadFiles(e.target.files)}
            disabled={step === "generating"}
            className="block w-full text-sm file:mr-4 file:rounded-md file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted/80"
          />

          <ul className="space-y-2">
            {files.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm"
              >
                <span className="truncate font-medium">{f.filename}</span>
                <StatusBadge status={f.status} error={f.parseError} />
              </li>
            ))}
            {files.length === 0 ? (
              <li className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                No files yet. Select one or more above.
              </li>
            ) : null}
          </ul>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep("describe")} disabled={step === "generating"}>
              Back
            </Button>
            <Button onClick={propose} disabled={!canPropose || step === "generating"}>
              {step === "generating" ? "Asking the model…" : "Generate proposal →"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stepper({ current }: { current: Step }) {
  const order: Step[] = ["describe", "upload", "generating"];
  const labels: Record<Step, string> = {
    describe: "1. Describe",
    upload: "2. Upload",
    generating: "3. Generate",
  };
  const idx = order.indexOf(current);
  return (
    <ol className="mb-6 flex items-center gap-4 text-xs text-muted-foreground">
      {order.map((s, i) => (
        <li
          key={s}
          className={
            i === idx
              ? "font-medium text-foreground"
              : i < idx
                ? "text-foreground/70"
                : undefined
          }
        >
          {labels[s]}
        </li>
      ))}
    </ol>
  );
}

function StatusBadge({
  status,
  error,
}: {
  status: FileRow["status"];
  error: string | null;
}) {
  const base = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";
  if (status === "ready")
    return <span className={`${base} bg-green-100 text-green-800`}>ready</span>;
  if (status === "failed")
    return (
      <span className={`${base} bg-red-100 text-red-800`} title={error ?? undefined}>
        failed
      </span>
    );
  return <span className={`${base} bg-amber-100 text-amber-800`}>{status}…</span>;
}
