"use client";

import { useState } from "react";

export function DeleteAccountPanel({ email, role }: { email: string | null; role: string }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const targetEmail = (email ?? "").trim();
  const matches = confirm.trim().toLowerCase() === targetEmail.toLowerCase() && targetEmail !== "";

  async function submit() {
    if (!matches) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/v1/me/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmEmail: confirm }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setErr(body.message ?? `${res.status} ${res.statusText}`);
        setBusy(false);
        return;
      }
      const body = (await res.json()) as { ok: true; redirectTo: string };
      // Force a full reload so middleware re-evaluates the (now-stale) session cookie.
      window.location.href = body.redirectTo ?? "/sign-in";
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  if (!email) return null;

  return (
    <section className="rounded-md border border-red-200 bg-red-50/40 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-red-700">
        Delete account
      </h2>
      <p className="mt-2 text-sm text-neutral-700">
        Disables your account immediately. You&rsquo;ll be signed out and won&rsquo;t be able
        to sign in again. Your data (threads, messages, audit history) is preserved
        for the platform&rsquo;s retention window in case you want it restored, then
        hard-deleted on the schedule set in admin settings.
      </p>
      <p className="mt-2 text-sm text-neutral-600">
        <strong>Tip:</strong> click <em>Export my data</em> above first if you want a
        local copy.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
        >
          Delete my account…
        </button>
      ) : (
        <div className="mt-4 rounded-md border border-red-200 bg-white p-4">
          <p className="text-sm text-neutral-900">
            To confirm, type your email <strong>{targetEmail}</strong> below.
          </p>
          {role === "owner" && (
            <p className="mt-2 text-xs text-amber-800">
              You&rsquo;re an owner. If you&rsquo;re the only one, promote another user to
              owner first or this will be rejected.
            </p>
          )}
          <input
            type="email"
            autoComplete="off"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={targetEmail}
            className="mt-3 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-red-500"
          />
          {err && (
            <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {err}
            </div>
          )}
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={!matches || busy}
              className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Deleting…" : "Permanently disable my account"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirm("");
                setErr(null);
              }}
              disabled={busy}
              className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
