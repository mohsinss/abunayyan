"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { setUserPref } from "@/lib/auth/prefs";

// Pref keys live in one place so the page (server) and the client
// island stay in sync. Add more as new view toggles land.
export const WC_PREF_KEYS = {
  showNwcTrendlines: "wcShowNwcTrendlines",
} as const;

export async function setShowNwcTrendlinesAction(value: boolean) {
  const user = await requireUser();
  await setUserPref(user.id, WC_PREF_KEYS.showNwcTrendlines, !!value);
  // Cheap revalidate so a server-rendered re-fetch picks up the new
  // pref if the user reloads. The client also updates optimistically.
  revalidatePath("/dashboard/working-capital-data");
  return { ok: true as const };
}
