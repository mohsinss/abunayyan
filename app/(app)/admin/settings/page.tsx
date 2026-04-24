import { ensurePlatformSettingsRow, getPlatformSettings } from "@/lib/chatbots/settings";
import { AI_PROVIDERS } from "@/db/schema/chatbots";
import { SIGNUP_POLICIES } from "@/db/schema/platform-settings";
import { updateSettingsActionVoid } from "@/app/(app)/admin/actions";
import { availableProviders } from "@/lib/chatbots/providers";
import { ArchivalPanel } from "@/components/admin/archival-panel";

export const dynamic = "force-dynamic";

const WINDOWS = ["1 m", "5 m", "15 m", "1 h", "1 d"] as const;

export default async function AdminSettingsPage() {
  await ensurePlatformSettingsRow();
  const [s, providers] = await Promise.all([
    getPlatformSettings(),
    Promise.resolve(availableProviders()),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold">Platform settings</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Global controls. Every change is written to the audit log.
        </p>
      </header>

      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
        <strong>Configured providers:</strong>{" "}
        {providers.length ? providers.join(", ") : "none"}.
      </div>

      <form action={updateSettingsActionVoid} className="flex flex-col gap-6">
        <section className="rounded-md border border-neutral-200 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Kill switch
          </h2>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="globalChatDisabled"
              defaultChecked={s.globalChatDisabled}
            />
            Global chat disabled — every bot returns 503.
          </label>
        </section>

        <section className="rounded-md border border-neutral-200 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Defaults for new bots
          </h2>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <Field label="Rate-limit tokens">
              <input
                type="number"
                min={1}
                name="defaultRateLimitTokens"
                defaultValue={s.defaultRateLimitTokens}
                className="input"
              />
            </Field>
            <Field label="Window">
              <select
                name="defaultRateLimitWindow"
                defaultValue={s.defaultRateLimitWindow}
                className="input"
              >
                {WINDOWS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Daily cost cap (USD)">
              <input
                type="number"
                step="0.01"
                min={0}
                name="defaultDailyCostCapUsd"
                defaultValue={s.defaultDailyCostCapUsd}
                className="input"
              />
            </Field>
          </div>
        </section>

        <section className="rounded-md border border-neutral-200 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Platform
          </h2>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <Field label="Fallback provider" hint="If configured provider fails">
              <select
                name="fallbackProvider"
                defaultValue={s.fallbackProvider ?? ""}
                className="input"
              >
                <option value="">none</option>
                {AI_PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Signup policy">
              <select name="signupPolicy" defaultValue={s.signupPolicy} className="input">
                {SIGNUP_POLICIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Data retention (days)">
              <input
                type="number"
                min={1}
                name="dataRetentionDays"
                defaultValue={s.dataRetentionDays}
                className="input"
              />
            </Field>
            <Field label="Brand name">
              <input name="brandName" defaultValue={s.brandName} className="input" />
            </Field>
            <Field label="Brand primary color">
              <input
                name="brandPrimaryColor"
                defaultValue={s.brandPrimaryColor ?? ""}
                placeholder="#1a1a1a"
                className="input"
              />
            </Field>
          </div>
        </section>

        <div>
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-5 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Save settings
          </button>
        </div>
      </form>

      <ArchivalPanel />

      <style>{`
        .input { width: 100%; border: 1px solid rgb(212 212 212); border-radius: .375rem; padding: .5rem .75rem; font-size: .875rem; outline: none; background: white; }
        .input:focus { border-color: rgb(23 23 23); }
      `}</style>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      {children}
      {hint && <span className="text-xs text-neutral-500">{hint}</span>}
    </label>
  );
}
