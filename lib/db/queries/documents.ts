import "server-only";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db, documents, type NewDocument } from "@/db";

function vectorLiteral(embedding: number[]) {
  return sql.raw(`'[${embedding.join(",")}]'::vector`);
}

export async function insertDocument(input: NewDocument) {
  const [row] = await db.insert(documents).values(input).returning();
  return row;
}

export async function searchDocumentsByEmbedding(
  userId: string,
  embedding: number[],
  limit = 5,
) {
  const lit = vectorLiteral(embedding);
  return db
    .select({
      id: documents.id,
      content: documents.content,
      distance: sql<number>`${documents.embedding} <=> ${lit}`,
    })
    .from(documents)
    .where(and(eq(documents.userId, userId), isNotNull(documents.embedding)))
    .orderBy(sql`${documents.embedding} <=> ${lit}`)
    .limit(limit);
}

// Scoped to a single dataset card. Used by the searchDatasetDocs tool so
// each card's chatbot only retrieves chunks from its own uploads.
// NOTE: deliberately does NOT filter by userId — dataset chunks are
// readable by any authed viewer of the card (plus anonymous viewers via
// public share links, see §11 in docs).
export async function searchDocumentsByDatasetEmbedding(
  datasetId: string,
  embedding: number[],
  limit = 5,
) {
  const lit = vectorLiteral(embedding);
  return db
    .select({
      id: documents.id,
      content: documents.content,
      distance: sql<number>`${documents.embedding} <=> ${lit}`,
    })
    .from(documents)
    .where(and(eq(documents.datasetId, datasetId), isNotNull(documents.embedding)))
    .orderBy(sql`${documents.embedding} <=> ${lit}`)
    .limit(limit);
}

export async function findUnembeddedDatasetDocuments(datasetId: string, limit = 200) {
  return db
    .select({ id: documents.id, content: documents.content })
    .from(documents)
    .where(and(eq(documents.datasetId, datasetId), isNull(documents.embedding)))
    .limit(limit);
}

export async function updateDocumentEmbedding(id: string, embedding: number[]) {
  await db.update(documents).set({ embedding }).where(eq(documents.id, id));
}
