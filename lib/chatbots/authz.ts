import type { Chatbot } from "@/db/schema/chatbots";
import type { UserRole } from "@/db/schema/users";

export function canUserAccessBot(
  user: { role: UserRole; disabled: boolean },
  bot: Pick<Chatbot, "allowedRoles" | "enabled" | "deletedAt">,
): boolean {
  if (user.disabled) return false;
  if (!bot.enabled) return false;
  if (bot.deletedAt) return false;
  const allowed = bot.allowedRoles ?? [];
  if (allowed.length === 0) return true;
  return allowed.includes(user.role);
}
