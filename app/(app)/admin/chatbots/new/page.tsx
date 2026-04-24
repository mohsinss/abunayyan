import Link from "next/link";
import { availableProviders } from "@/lib/chatbots/providers";
import { ChatbotForm } from "@/components/admin/chatbots/chatbot-form";

export const dynamic = "force-dynamic";

export default function NewChatbotPage() {
  const providers = availableProviders();
  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="text-xs font-mono uppercase tracking-wide text-neutral-500">
          <Link href="/admin/chatbots" className="hover:underline">
            Chatbots
          </Link>{" "}
          / New
        </div>
        <h1 className="mt-1 text-2xl font-semibold">New chatbot</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Picks up instantly at <code className="rounded bg-neutral-100 px-1">/api/v1/chatbots/[slug]/chat</code>.
        </p>
      </header>
      <ChatbotForm mode="create" availableProviders={providers} />
    </div>
  );
}
