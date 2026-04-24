import "server-only";
import { embedTextMany } from "@/lib/ai/embed";
import {
  findUnembeddedDatasetDocuments,
  updateDocumentEmbedding,
} from "@/lib/db/queries/documents";

const PAGE_SIZE = 64;

// Finds chunks with NULL embedding for the dataset, batch-embeds them, and
// writes the vectors back one at a time. Safe to rerun — chunks that already
// have an embedding are skipped by the query. Returns the count embedded.
//
// Used both by the /reembed admin endpoint and internally when re-enabling
// search after an OpenAI outage or model swap.
export async function backfillDatasetEmbeddings(datasetId: string): Promise<number> {
  let total = 0;
  // Loop until no more NULL-embedding chunks for this dataset.
  while (true) {
    const pending = await findUnembeddedDatasetDocuments(datasetId, PAGE_SIZE);
    if (pending.length === 0) break;

    const embeddings = await embedTextMany(pending.map((d) => d.content));
    for (let i = 0; i < pending.length; i++) {
      const doc = pending[i];
      const emb = embeddings[i];
      if (!doc || !emb) continue;
      await updateDocumentEmbedding(doc.id, emb);
      total++;
    }
    // If we got fewer than a full page, we're done.
    if (pending.length < PAGE_SIZE) break;
  }
  return total;
}
