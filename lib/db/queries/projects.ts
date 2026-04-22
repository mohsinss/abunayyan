import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, projects, type NewProject, type Project } from "@/db";

export async function listProjectsByUser(userId: string) {
  return db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.createdAt));
}

export async function getProject(id: string, userId: string) {
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createProject(input: NewProject) {
  const [row] = await db.insert(projects).values(input).returning();
  return row;
}

export async function updateProjectAnalysis(
  id: string,
  userId: string,
  analysis: NonNullable<Project["analysis"]>,
) {
  const [row] = await db
    .update(projects)
    .set({ analysis, updatedAt: new Date() })
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .returning();
  return row ?? null;
}
