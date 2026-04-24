import Link from "next/link";
import { listBots } from "@/lib/chatbots/registry";
import { availableProviders } from "@/lib/chatbots/providers";
import { ensureDefaultBotsSeeded } from "@/lib/chatbots/seed-defaults";

export const dynamic = "force-dynamic";

export default async function AdminChatbotsPage() {
  await ensureDefaultBotsSeeded();
  const [bots, providers] = await Promise.all([listBots(), Promise.resolve(availableProviders())]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Chatbots</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Create and configure chatbots — provider, model, prompt, tools, access, limits.
          </p>
        </div>
        <Link
          href="/admin/chatbots/new"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          + New chatbot
        </Link>
      </header>

      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
        <strong>Providers configured:</strong>{" "}
        {providers.length ? providers.join(", ") : "none — add API keys in env"}.
      </div>

      <div className="grid gap-4">
        {bots.length === 0 && (
          <div className="rounded-md border border-dashed border-neutral-300 p-12 text-center">
            <p className="text-sm text-neutral-600">No chatbots yet.</p>
            <Link
              href="/admin/chatbots/new"
              className="mt-3 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              + Create the first one
            </Link>
          </div>
        )}
        {bots.map((b) => (
          <Link
            key={b.id}
            href={`/admin/chatbots/${b.id}`}
            className="flex items-center justify-between rounded-md border border-neutral-200 bg-white p-4 transition-colors hover:border-neutral-400"
          >
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-base font-semibold">{b.name}</h3>
                {!b.enabled && (
                  <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                    disabled
                  </span>
                )}
                <span className="font-mono text-xs text-neutral-500">{b.slug}</span>
              </div>
              {b.description && (
                <p className="mt-1 text-sm text-neutral-600">{b.description}</p>
              )}
              <div className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
                <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-700">
                  {b.provider}
                </span>
                <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono">
                  {b.modelId}
                </span>
                <span>· {b.tools.length} tools</span>
                <span>· {b.rateLimitTokens}/{b.rateLimitWindow}</span>
                {b.dailyCostCapUsd > 0 && <span>· cap ${b.dailyCostCapUsd}/day</span>}
              </div>
            </div>
            <div className="text-sm font-medium text-neutral-900">Edit →</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
