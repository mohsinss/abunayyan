"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
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
  // Client-only: 0–100 for an in-flight XHR upload, undefined once the
  // server returns the file row.
  uploadProgress?: number;
};

// Coarse weights: a file is ~10% when upload completes, ~60% while parsing,
// 100% when ready. Matches what the user sees: queued starts the parse work,
// parsing is the bulk of it, ready means everything landed.
function progressFor(f: FileRow): number {
  if (f.status === "ready") return 100;
  if (f.status === "failed") return 100;
  if (f.status === "parsing") return 60;
  if (f.status === "queued") return 30;
  // Still uploading from the browser.
  return Math.max(0, Math.min(100, Math.round((f.uploadProgress ?? 0) * 0.1)));
}

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
        // XHR (not fetch) because we need real upload progress events.
        // Render an optimistic row keyed by filename + size + random id so
        // the progress bar lights up the second we start streaming.
        const tempId = `tmp-${Math.random().toString(36).slice(2, 10)}`;
        setFiles((prev) => [
          ...prev,
          {
            id: tempId,
            filename: f.name,
            sizeBytes: f.size,
            status: "queued",
            parseError: null,
            uploadProgress: 0,
          },
        ]);

        try {
          const data = await uploadOne(`/api/v1/datasets/${draftId}/files`, f, (pct) => {
            setFiles((prev) =>
              prev.map((row) => (row.id === tempId ? { ...row, uploadProgress: pct } : row)),
            );
          });
          setFiles((prev) =>
            prev.map((row) =>
              row.id === tempId
                ? {
                    id: data.fileId,
                    filename: data.filename,
                    sizeBytes: data.sizeBytes,
                    status: data.status,
                    parseError: null,
                  }
                : row,
            ),
          );
        } catch (err) {
          setFiles((prev) => prev.filter((row) => row.id !== tempId));
          setError((err as Error).message || `Upload failed for ${f.name}`);
        }
      }
    },
    [draftId],
  );

  // Poll status of files until they're all terminal (ready/failed). Merges
  // server rows (authoritative on status/parseError) with in-flight optimistic
  // rows (authoritative on uploadProgress until the server row arrives).
  const pollingRef = useRef(false);
  useEffect(() => {
    if (!draftId) return;
    if (files.length === 0) return;
    const anyPending = files.some(
      (f) => f.status === "queued" || f.status === "parsing" || f.id.startsWith("tmp-"),
    );
    if (!anyPending) return;
    if (pollingRef.current) return;
    pollingRef.current = true;

    const iv = setInterval(async () => {
      const res = await fetch(`/api/v1/datasets/${draftId}`);
      if (!res.ok) return;
      const data = (await res.json()) as { files: FileRow[] };
      setFiles((prev) => {
        const serverIds = new Set(data.files.map((f) => f.id));
        const unfinishedOptimistic = prev.filter(
          (f) => f.id.startsWith("tmp-") && !serverIds.has(f.id),
        );
        return [...data.files, ...unfinishedOptimistic];
      });
      if (!data.files.some((f) => f.status === "queued" || f.status === "parsing")) {
        // Stop polling only if there are no optimistic uploads still in flight.
        const hasInFlight = files.some((f) => f.id.startsWith("tmp-"));
        if (!hasInFlight) {
          clearInterval(iv);
          pollingRef.current = false;
        }
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
  const failedCount = files.filter((f) => f.status === "failed").length;
  const anyPending =
    files.some((f) => f.status === "queued" || f.status === "parsing") ||
    files.some((f) => f.id.startsWith("tmp-"));
  const canPropose = !anyPending && readyCount > 0;
  const aggregateProgress =
    files.length === 0
      ? 0
      : Math.round(files.reduce((sum, f) => sum + progressFor(f), 0) / files.length);

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

          {files.length > 0 ? (
            <div className="space-y-2 rounded-md border border-border bg-card p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">
                  {readyCount} of {files.length} ready
                  {failedCount > 0 ? ` · ${failedCount} failed` : null}
                </span>
                <span className="tabular-nums text-muted-foreground">{aggregateProgress}%</span>
              </div>
              <ProgressBar value={aggregateProgress} indeterminate={anyPending && aggregateProgress < 100} />
            </div>
          ) : null}

          <ul className="space-y-2">
            {files.map((f) => {
              const pct = progressFor(f);
              return (
                <li
                  key={f.id}
                  className="space-y-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-medium">{f.filename}</span>
                    <StatusIcon file={f} />
                  </div>
                  <ProgressBar
                    value={pct}
                    failed={f.status === "failed"}
                    indeterminate={f.status === "parsing" || f.status === "queued"}
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{stageLabel(f)}</span>
                    <span className="tabular-nums">{pct}%</span>
                  </div>
                </li>
              );
            })}
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

function StatusIcon({ file }: { file: FileRow }) {
  if (file.status === "ready") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (file.status === "failed")
    return <XCircle className="h-4 w-4 text-red-600" aria-label={file.parseError ?? "failed"} />;
  return <Loader2 className="h-4 w-4 animate-spin text-amber-600" />;
}

function stageLabel(f: FileRow): string {
  if (f.id.startsWith("tmp-")) return `Uploading ${f.uploadProgress ?? 0}%…`;
  if (f.status === "queued") return "Queued — waiting for parser";
  if (f.status === "parsing") return "Parsing, chunking, and embedding";
  if (f.status === "ready") return "Ready";
  if (f.status === "failed") return f.parseError ?? "Failed";
  return "";
}

function ProgressBar({
  value,
  indeterminate = false,
  failed = false,
}: {
  value: number;
  indeterminate?: boolean;
  failed?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const fillColor = failed
    ? "bg-red-500"
    : pct >= 100
      ? "bg-green-500"
      : "bg-primary";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full transition-[width] duration-500 ease-out ${fillColor} ${
          indeterminate ? "animate-pulse" : ""
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// XHR-based upload so we can wire progress events into the UI. fetch() has
// no native upload-progress support; swapping to XHR keeps the server
// contract identical.
function uploadOne(
  url: string,
  file: File,
  onProgress: (_pct: number) => void,
): Promise<{ fileId: string; filename: string; sizeBytes: number; status: FileRow["status"] }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.addEventListener("progress", (e) => {
      if (!e.lengthComputable) return;
      onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (err) {
          reject(new Error(`Bad JSON from server: ${(err as Error).message}`));
        }
      } else {
        reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`));
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
    xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}
