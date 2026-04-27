"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, wcGroups, wcNarrative, wcSbus } from "@/db";
import { requireRole } from "@/lib/auth/rbac";
import { writeAudit } from "@/lib/chatbots/audit";

const SBU_NUMERIC_FIELDS = [
  "inv", "ar", "ca", "ap", "dio", "dso", "dpo",
  "tInv", "tAr", "tCa", "tAp", "tDio", "tDso", "tDpo",
] as const;

type Result = { ok: true } | { error: string };

function parseNumber(formData: FormData, key: string): number {
  const v = formData.get(key);
  if (v == null || v === "") throw new Error(`Missing field: ${key}`);
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Invalid number for ${key}: ${String(v)}`);
  return n;
}

export async function updateGroupAction(formData: FormData): Promise<Result> {
  const actor = await requireRole("admin");
  try {
    const fiscalYear = String(formData.get("fiscalYear") ?? "").slice(0, 16);
    const groupRevenue = parseNumber(formData, "groupRevenue");
    const nwcTargetRelease = parseNumber(formData, "nwcTargetRelease");
    const notes = String(formData.get("notes") ?? "").slice(0, 2000) || null;
    if (!fiscalYear) return { error: "Fiscal year is required" };
    if (groupRevenue <= 0) return { error: "Group revenue must be positive" };

    await db
      .insert(wcGroups)
      .values({
        id: 1,
        fiscalYear,
        groupRevenue,
        nwcTargetRelease,
        notes,
        updatedBy: actor.id,
      })
      .onConflictDoUpdate({
        target: wcGroups.id,
        set: {
          fiscalYear,
          groupRevenue,
          nwcTargetRelease,
          notes,
          updatedAt: new Date(),
          updatedBy: actor.id,
        },
      });

    await writeAudit({
      actorId: actor.id,
      event: "working_capital_data.group_updated",
      payload: { fiscalYear, groupRevenue, nwcTargetRelease },
    });
    revalidatePath("/admin/working-capital");
    revalidatePath("/dashboard/working-capital-data");
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateSbuAction(formData: FormData): Promise<Result> {
  const actor = await requireRole("admin");
  try {
    const id = String(formData.get("id") ?? "");
    if (!id) return { error: "Missing id" };

    const name = String(formData.get("name") ?? "").slice(0, 64);
    const shareText = String(formData.get("shareText") ?? "").slice(0, 64) || null;
    const posture = String(formData.get("posture") ?? "").slice(0, 160) || null;
    if (!name) return { error: "Name is required" };

    const numerics: Record<string, number> = {};
    for (const f of SBU_NUMERIC_FIELDS) {
      numerics[f] = parseNumber(formData, f);
    }

    // Notes: 4 separate textareas in the form, indexed 0..3.
    const notes: string[] = [];
    for (let i = 0; i < 4; i++) {
      const v = String(formData.get(`note${i}`) ?? "").trim();
      if (v) notes.push(v.slice(0, 500));
    }

    const [updated] = await db
      .update(wcSbus)
      .set({
        name,
        shareText,
        posture,
        ...numerics,
        notes,
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(eq(wcSbus.id, id))
      .returning({ key: wcSbus.key });

    if (!updated) return { error: "SBU not found" };

    await writeAudit({
      actorId: actor.id,
      event: "working_capital_data.sbu_updated",
      payload: { sbuKey: updated.key, sbuId: id },
    });
    revalidatePath("/admin/working-capital");
    revalidatePath(`/admin/working-capital/${id}`);
    revalidatePath("/dashboard/working-capital-data");
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateNarrativeAction(formData: FormData): Promise<Result> {
  const actor = await requireRole("admin");
  try {
    const id = String(formData.get("id") ?? "");
    const title = String(formData.get("title") ?? "").slice(0, 160) || null;
    const body = String(formData.get("body") ?? "").trim();
    if (!id) return { error: "Missing id" };
    if (!body) return { error: "Body cannot be empty" };

    const [updated] = await db
      .update(wcNarrative)
      .set({
        title,
        body: body.slice(0, 8000),
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(eq(wcNarrative.id, id))
      .returning({ slot: wcNarrative.slot });

    if (!updated) return { error: "Narrative slot not found" };

    await writeAudit({
      actorId: actor.id,
      event: "working_capital_data.narrative_updated",
      payload: { slot: updated.slot, narrativeId: id },
    });
    revalidatePath("/admin/working-capital");
    revalidatePath("/dashboard/working-capital-data");
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
