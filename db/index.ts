import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "@/lib/env";
import * as schema from "./schema";

// neon() doesn't actually connect until the first query — it just constructs
// a fetcher. The placeholder URL lets `next build`'s page-data collection load
// modules that import db without throwing when env validation is skipped.
const connectionString =
  env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost/placeholder";

const sql = neon(connectionString);
export const db = drizzle(sql, { schema, logger: env.NODE_ENV === "development" });
export * from "./schema";
