"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Sparkles, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Step = "upload" | "generating";
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
  const [step, setStep] = useState<Step>("upload");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Tracks whether the AI suggest-meta call has already populated title +
  // description. Latch so a second wave of files doesn't stomp the admin's
  // manual edits.
  const [suggestState, setSuggestState] = useState<"idle" | "running" | "done">("idle");

  // Lazy create a draft dataset row on first file drop. Title is server-defaulted
  // ("Untitled dataset <ts>") and replaced once the admin edits or
  // suggest-meta returns.
  const ensureDraft = useCallback(async (): Promise<string | null> => {
    if (draftId) return draftId;
    const res = await fetch("/api/v1/datasets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const body = await res.text();
      setError(body || `Create failed (${res.status})`);
      return null;
    }
    const data = (await res.json()) as { id: string; slug: string };
    setDraftId(data.id);
    return data.id;
  }, [draftId]);

  const uploadFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      setError(null);
      const id = await ensureDraft();
      if (!id) return;

      for (const f of Array.from(fileList)) {
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
          const data = await uploadOne(`/api/v1/datasets/${id}/files`, f, (pct) => {
            setFiles((prev) =>
              prev.map((row) => (row.id === tempId ? { ...row, uploadProgress: pct } : row)),
            );
          });
          setFiles((prev) => {
            // Race: the 2s poll may have already added the real server row
            // before this XHR callback fires. If so, just drop the tmp
            // placeholder — replacing it would create a duplicate key.
            if (prev.some((r) => r.id === data.fileId)) {
              return prev.filter((r) => r.id !== tempId);
            }
            return prev.map((row) =>
              row.id === tempId
                ? {
                    id: data.fileId,
                    filename: data.filename,
                    sizeBytes: data.sizeBytes,
                    status: data.status,
                    parseError: null,
                  }
                : row,
            );
          });
        } catch (err) {
          setFiles((prev) => prev.filter((row) => row.id !== tempId));
          setError((err as Error).message || `Upload failed for ${f.name}`);
        }
      }
    },
    [ensureDraft],
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

  // Auto-fill title + description from the AI as soon as the first file is
  // ready. Runs once per draft. Admin can still type over the suggestions.
  useEffect(() => {
    if (!draftId) return;
    if (suggestState !== "idle") return;
    const anyReady = files.some((f) => f.status === "ready");
    const anyPending = files.some((f) => f.status === "queued" || f.status === "parsing");
    if (!anyReady || anyPending) return;

    let cancelled = false;
    setSuggestState("running");
    (async () => {
      try {
        const res = await fetch(`/api/v1/datasets/${draftId}/suggest-meta`, { method: "POST" });
        if (!res.ok) {
          // Soft-fail: admin can still type their own title.
          if (!cancelled) setSuggestState("done");
          return;
        }
        const data = (await res.json()) as { title: string; description: string };
        if (cancelled) return;
        setTitle((current) => (current.trim() ? current : data.title));
        setDescription((current) => (current.trim() ? current : data.description));
        setSuggestState("done");
      } catch {
        if (!cancelled) setSuggestState("done");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draftId, files, suggestState]);

  const propose = useCallback(async () => {
    if (!draftId) return;
    setError(null);
    setStep("generating");
    try {
      // Save admin-edited title/description first so /propose runs against
      // the latest text and the row reflects the admin's framing in /review.
      const patch = await fetch(`/api/v1/datasets/${draftId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, description: description || null }),
      });
      if (!patch.ok) {
        const body = await patch.text();
        setError(body || `Save failed (${patch.status})`);
        setStep("upload");
        return;
      }
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
  }, [draftId, title, description, router]);

  const readyCount = files.filter((f) => f.status === "ready").length;
  const failedCount = files.filter((f) => f.status === "failed").length;
  const anyPending =
    files.some((f) => f.status === "queued" || f.status === "parsing") ||
    files.some((f) => f.id.startsWith("tmp-"));
  const canPropose = !anyPending && readyCount > 0 && title.trim().length > 0;
  const aggregateProgress =
    files.length === 0
      ? 0
      : Math.round(files.reduce((sum, f) => sum + progressFor(f), 0) / files.length);

  const showDetails = readyCount > 0;

  return (
    <div className="mx-auto max-w-2xl">
      <Stepper current={step} hasFiles={files.length > 0} canPropose={canPropose} />
      {error ? (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Drop one or more files. Accepted: .xlsx, .xls, .csv, .docx, .pptx. Each file parses in
          the background — title and description fill in automatically when the first one is
          ready.
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
            <ProgressBar
              value={aggregateProgress}
              indeterminate={anyPending && aggregateProgress < 100}
            />
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
              No files yet. Pick one or more above.
            </li>
          ) : null}
        </ul>

        {showDetails ? (
          <section className="space-y-3 rounded-md border border-border bg-card p-4">
            <header className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Card details</h2>
              {suggestState === "running" ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                  Suggesting…
                </span>
              ) : suggestState === "done" && (title || description) ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5" />
                  AI-suggested · edit anything
                </span>
              ) : null}
            </header>
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={160}
                placeholder={
                  suggestState === "running" ? "Suggesting…" : "Q1 Supplier Spend Review"
                }
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
                placeholder={
                  suggestState === "running"
                    ? "Suggesting…"
                    : "What this dataset covers, who uses it, what decisions it drives."
                }
                className="mt-1"
              />
            </div>
          </section>
        ) : null}

        <div className="flex justify-end">
          <Button onClick={propose} disabled={!canPropose || step === "generating"}>
            {step === "generating"
              ? "Asking the model…"
              : !title.trim() && readyCount > 0
                ? "Title required"
                : "Generate proposal →"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stepper({
  current,
  hasFiles,
  canPropose,
}: {
  current: Step;
  hasFiles: boolean;
  canPropose: boolean;
}) {
  // Three perceived phases mapped onto the two real steps. Lights as the
  // user moves through them so the wizard doesn't feel single-page.
  const steps = [
    { key: "upload", label: "1. Upload", active: true },
    { key: "details", label: "2. Review details", active: hasFiles && canPropose },
    { key: "generate", label: "3. Generate", active: current === "generating" },
  ];
  return (
    <ol className="mb-6 flex items-center gap-4 text-xs text-muted-foreground">
      {steps.map((s) => (
        <li key={s.key} className={s.active ? "font-medium text-foreground" : undefined}>
          {s.label}
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
