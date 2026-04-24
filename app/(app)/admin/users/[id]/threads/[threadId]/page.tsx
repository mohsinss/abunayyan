import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { threads } from "@/db/schema/threads";
import { and, eq } from "drizzle-orm";
import { getMessagesForThread } from "@/lib/chatbots/persistence";
import { getBotById } from "@/lib/chatbots/registry";
import { getUserById } from "@/lib/auth/queries";

export const dynamic = "force-dynamic";

export default async function AdminThreadPage({
  params,
}: {
  params: Promise<{ id: string; threadId: string }>;
}) {
  const { id, threadId } = await params;
  const [thread] = await db
    .select()
    .from(threads)
    .where(and(eq(threads.id, threadId), eq(threads.userId, id)))
    .limit(1);
  if (!thread) notFound();

  const [user, bot, msgs] = await Promise.all([
    getUserById(id),
    getBotById(thread.chatbotId),
    getMessagesForThread(threadId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="text-xs font-mono uppercase tracking-wide text-neutral-500">
          <Link href="/admin/users" className="hover:underline">
            Users
          </Link>{" "}
          /{" "}
          <Link href={`/admin/users/${id}`} className="hover:underline">
            {user?.email ?? id.slice(0, 8)}
          </Link>{" "}
          / thread
        </div>
        <h1 className="mt-1 text-2xl font-semibold">{thread.title ?? "(untitled)"}</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {bot?.name ?? bot?.slug ?? thread.chatbotId} · started{" "}
          {new Date(thread.createdAt).toLocaleString()}
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {msgs.map((m) => (
          <div key={m.id} className="rounded-md border border-neutral-200 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-mono uppercase tracking-wide text-neutral-500">
              <span className="rounded bg-neutral-100 px-2 py-0.5">{m.role}</span>
              <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
              {m.modelId && <span>· {m.modelId}</span>}
              {m.promptVersion != null && <span>· prompt v{m.promptVersion}</span>}
              {m.tokensIn != null && <span>· in {m.tokensIn}</span>}
              {m.tokensOut != null && <span>· out {m.tokensOut}</span>}
              {m.costUsd != null && <span>· ${m.costUsd.toFixed(4)}</span>}
              {m.status !== "complete" && (
                <span className="rounded bg-red-100 px-2 py-0.5 text-red-700">{m.status}</span>
              )}
            </div>
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
            {Array.isArray(m.toolCalls) && m.toolCalls.length > 0 && (
              <details className="mt-3 rounded bg-neutral-50 p-3 text-xs">
                <summary className="cursor-pointer font-medium">
                  {m.toolCalls.length} tool call{m.toolCalls.length === 1 ? "" : "s"}
                </summary>
                <pre className="mt-2 overflow-x-auto font-mono text-[11px] text-neutral-700">
                  {JSON.stringify(m.toolCalls, null, 2)}
                </pre>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
