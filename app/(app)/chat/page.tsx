import { Chat } from "@/components/ai/chat";

export const metadata = { title: "Chat" };

export default function ChatPage() {
  return (
    <div className="container max-w-3xl py-8">
      <h1 className="mb-4 text-2xl font-bold">Chat</h1>
      <Chat />
    </div>
  );
}
