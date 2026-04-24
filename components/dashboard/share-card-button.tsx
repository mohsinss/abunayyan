"use client";

import { useCallback, useState } from "react";
import { Check, Copy, Link2, Link2Off, RefreshCw, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type State = {
  enabled: boolean;
  token: string | null;
};

export function ShareCardButton({
  datasetId,
  initial,
}: {
  datasetId: string;
  initial: State;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const publicUrl =
    typeof window !== "undefined" && state.token
      ? `${window.location.origin}/s/${state.token}`
      : state.token
        ? `/s/${state.token}`
        : null;

  const enable = useCallback(
    async (opts: { rotate?: boolean } = {}) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/datasets/${datasetId}/share`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ rotate: opts.rotate === true }),
        });
        if (!res.ok) {
          setError(`Enable failed (${res.status})`);
          return;
        }
        const data = (await res.json()) as { enabled: boolean; token: string | null };
        setState({ enabled: data.enabled, token: data.token });
      } finally {
        setBusy(false);
      }
    },
    [datasetId],
  );

  const disable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/datasets/${datasetId}/share`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        setError(`Disable failed (${res.status})`);
        return;
      }
      setState((s) => ({ enabled: false, token: s.token }));
    } finally {
      setBusy(false);
    }
  }, [datasetId]);

  const copy = useCallback(async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Copy failed — select and copy manually");
    }
  }, [publicUrl]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="mr-1.5 h-4 w-4" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Public share link</DialogTitle>
          <DialogDescription>
            Anyone with the URL can view this card&apos;s charts and chat with its bot — no sign-in
            required. Rotating the token invalidates the old link immediately.
          </DialogDescription>
        </DialogHeader>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {state.enabled && publicUrl ? (
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Public URL
            </label>
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              <code className="flex-1 truncate">{publicUrl}</code>
              <Button size="sm" variant="ghost" onClick={copy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Share is currently <span className="font-medium">disabled</span>. Anyone hitting a
            stale link gets a 404.
          </p>
        )}

        <DialogFooter className="sm:justify-between">
          <div>
            {state.enabled ? (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => enable({ rotate: true })}
              >
                <RefreshCw className="mr-1.5 h-4 w-4" />
                Rotate token
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            {state.enabled ? (
              <Button variant="outline" size="sm" disabled={busy} onClick={disable}>
                <Link2Off className="mr-1.5 h-4 w-4" />
                Disable
              </Button>
            ) : (
              <Button size="sm" disabled={busy} onClick={() => enable()}>
                <Link2 className="mr-1.5 h-4 w-4" />
                Enable share
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
