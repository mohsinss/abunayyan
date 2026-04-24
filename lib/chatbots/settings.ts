import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  platformSettings,
  type PlatformSettings,
} from "@/db/schema/platform-settings";

const DEFAULT: PlatformSettings = {
  id: 1,
  globalChatDisabled: false,
  defaultRateLimitTokens: 20,
  defaultRateLimitWindow: "1 h",
  defaultDailyCostCapUsd: 5,
  fallbackProvider: null,
  signupPolicy: "open",
  dataRetentionDays: 90,
  brandName: "Abunayyan",
  brandPrimaryColor: null,
  datasetMaxFileBytes: 26_214_400,
  datasetMaxFilesPerDataset: 10,
  datasetMaxDatasets: 50,
  datasetMaxRowsPerDataset: 100_000,
  defaultChatbotModelId: null,
  defaultChatbotTemperature: 0.3,
  publicShareRateLimitTokens: 10,
  publicShareRateLimitWindow: "1 h",
  publicShareDailyCostCapUsd: 2,
  updatedAt: new Date(0),
  updatedBy: null,
};

export const getPlatformSettings = cache(async (): Promise<PlatformSettings> => {
  try {
    const [row] = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.id, 1))
      .limit(1);
    return row ?? DEFAULT;
  } catch {
    return DEFAULT;
  }
});

export async function ensurePlatformSettingsRow() {
  await db.insert(platformSettings).values({ id: 1 }).onConflictDoNothing();
}
