import { index, pgTable, text, timestamp, uuid, vector } from "drizzle-orm/pg-core";
import { datasets } from "./datasets";
import { users } from "./users";

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Scopes a chunk to a dataset card. NULL = general per-user doc (legacy);
    // non-NULL = card chunk, used by `searchDatasetDocs` for per-card retrieval.
    datasetId: uuid("dataset_id").references(() => datasets.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    // 1536 dims = OpenAI text-embedding-3-small. Change if you swap models.
    embedding: vector("embedding", { dimensions: 1536 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    embeddingIdx: index("documents_embedding_idx").using(
      "hnsw",
      t.embedding.op("vector_cosine_ops"),
    ),
    datasetIdx: index("documents_dataset_idx").on(t.datasetId),
  }),
);

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
