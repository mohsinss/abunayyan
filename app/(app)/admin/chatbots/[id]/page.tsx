import Link from "next/link";
import { notFound } from "next/navigation";
import { getBotById } from "@/lib/chatbots/registry";
import { availableProviders } from "@/lib/chatbots/providers";
import { listPromptHistory } from "@/lib/chatbots/prompts";
import { ChatbotForm } from "@/components/admin/chatbots/chatbot-form";
import { PromptTestPanel } from "@/components/admin/chatbots/prompt-test-panel";
import { rollbackPromptActionVoid } from "@/app/(app)/admin/actions";

export const dynamic = "force-dynamic";

export default async function EditChatbotPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bot = await getBotById(id);
  if (!bot) notFound();
  const [providers, history] = await Promise.all([
    Promise.resolve(availableProviders()),
    listPromptHistory(id),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <div className="text-xs font-mono uppercase tracking-wide text-neutral-500">
          <Link href="/admin/chatbots" className="hover:underline">
            Chatbots
          </Link>{" "}
          / {bot.slug}
        </div>
        <h1 className="mt-1 text-2xl font-semibold">{bot.name}</h1>
        <p className="mt-1 text-sm text-neutral-600">
          <code className="rounded bg-neutral-100 px-1">
            POST /api/v1/chatbots/{bot.slug}/chat
          </code>
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Configuration
        </h2>
        <ChatbotForm mode="edit" bot={bot} availableProviders={providers} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Test prompt live
        </h2>
        <PromptTestPanel botId={bot.id} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Prompt history
        </h2>
        <div className="overflow-hidden rounded-md border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2">Version</th>
                <th className="px-3 py-2">Note</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {history.map((p) => (
                <tr key={p.id} className={p.version === bot.systemPromptVersion ? "bg-amber-50" : ""}>
                  <td className="px-3 py-2 font-mono text-xs">
                    v{p.version}
                    {p.version === bot.systemPromptVersion && (
                      <span className="ml-2 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] uppercase text-amber-900">
                        active
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-neutral-600">{p.note ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs text-neutral-500">
                    {new Date(p.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {p.version !== bot.systemPromptVersion && (
                      <form action={rollbackPromptActionVoid}>
                        <input type="hidden" name="botId" value={bot.id} />
                        <input type="hidden" name="toVersion" value={p.version} />
                        <button
                          type="submit"
                          className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs hover:bg-neutral-100"
                        >
                          Restore
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
