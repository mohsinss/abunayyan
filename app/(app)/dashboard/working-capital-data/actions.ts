"use server";
import { requireUser } from "@/lib/auth/session";
import { setUserPref } from "@/lib/auth/prefs";
// Constants must live in a separate module — a "use server" file is
// restricted to exporting async functions only.
import { WC_PREF_KEYS } from "./pref-keys";

// One UPDATE on users.prefs and we're done. NO revalidatePath here:
// the client island already flipped its local state optimistically,
// and the next full page load will read the fresh pref naturally.
// revalidatePath would re-run the entire server page (group + sbus +
// narrative + prefs queries + chart serialisation), which made the
// checkbox feel ~2.5s slow on every click.
export async function setShowNwcTrendlinesAction(value: boolean) {
  const user = await requireUser();
  await setUserPref(user.id, WC_PREF_KEYS.showNwcTrendlines, !!value);
  return { ok: true as const };
}
