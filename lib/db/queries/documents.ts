import "server-only";
import { eq, sql } from "drizzle-orm";
import { db, documents, type NewDocument } from "@/db";

export async function insertDocument(input: NewDocument) {
  const [row] = await db.insert(documents).values(input).returning();
  return row;
}

export async function searchDocumentsByEmbedding(
  userId: string,
  embedding: number[],
  limit = 5,
) {
  return db
    .select({
      id: documents.id,
      content: documents.content,
      distance: sql<number>`${documents.embedding} <=> ${sql.raw(`'[${embedding.join(",")}]'::vector`)}`,
    })
    .from(documents)
    .where(eq(documents.userId, userId))
    .orderBy(
      sql`${documents.embedding} <=> ${sql.raw(`'[${embedding.join(",")}]'::vector`)}`,
    )
    .limit(limit);
}
