import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { listThreadsWithBotForUser } from "@/lib/chatbots/persistence";
import { listEnabledBotsForRole } from "@/lib/chatbots/registry";
import { ensureDefaultBotsSeeded } from "@/lib/chatbots/seed-defaults";

export const metadata = { title: "Chat" };
export const dynamic = "force-dynamic";

export default async function ChatIndexPage() {
  const user = await requireUser();
  await ensureDefaultBotsSeeded();
  const [threads, bots] = await Promise.all([
    listThreadsWithBotForUser(user.id, { limit: 100 }),
    listEnabledBotsForRole(user.role),
  ]);

  return (
    <div className="container max-w-4xl py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Your chats</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Pick up a past conversation or start a new one with any assistant you have access to.
        </p>
      </header>

      <section className="mb-8">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Start a new chat
        </h2>
        {bots.length === 0 ? (
          <div className="rounded-md border border-dashed border-neutral-300 p-6 text-sm text-neutral-600">
            No chatbots are available to your account.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {bots.map((b) => (
              <Link
                key={b.id}
                href={`/chat/new/${b.slug}`}
                className="group flex flex-col rounded-md border border-neutral-200 bg-white p-4 transition-colors hover:border-neutral-400"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-neutral-900">{b.name}</h3>
                  <span className="font-mono text-[10px] uppercase tracking-wide text-neutral-500">
                    {b.provider}
                  </span>
                </div>
                {b.description && (
                  <p className="mt-1.5 text-xs text-neutral-600">{b.description}</p>
                )}
                <span className="mt-3 text-xs font-medium text-neutral-900 underline-offset-2 group-hover:underline">
                  Start →
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Recent
        </h2>
        {threads.length === 0 ? (
          <div className="rounded-md border border-dashed border-neutral-300 p-6 text-sm text-neutral-600">
            No conversations yet. Start one above.
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-md border border-neutral-200 bg-white">
            {threads.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/chat/${t.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-neutral-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-neutral-900">
                      {t.title ?? "(untitled)"}
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-500">{t.botName}</div>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-wide text-neutral-400">
                    {new Date(t.updatedAt).toLocaleDateString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
