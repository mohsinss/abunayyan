import "server-only";
import { put, del, type PutBlobResult } from "@vercel/blob";
import { env } from "@/lib/env";

export class BlobNotConfiguredError extends Error {
  constructor() {
    super("BLOB_READ_WRITE_TOKEN is not set");
    this.name = "BlobNotConfiguredError";
  }
}

function token(): string {
  if (!env.BLOB_READ_WRITE_TOKEN) throw new BlobNotConfiguredError();
  return env.BLOB_READ_WRITE_TOKEN;
}

export function isBlobConfigured(): boolean {
  return Boolean(env.BLOB_READ_WRITE_TOKEN);
}

export async function uploadBlob(
  pathname: string,
  body: Blob | ArrayBuffer | Buffer,
  contentType: string,
): Promise<PutBlobResult> {
  // `addRandomSuffix: true` means each upload gets a collision-proof pathname
  // even if the caller reuses the same key. Returned URL embeds that suffix.
  return put(pathname, body, {
    access: "public",
    contentType,
    addRandomSuffix: true,
    token: token(),
  });
}

export async function deleteBlob(url: string): Promise<void> {
  await del(url, { token: token() });
}

export async function fetchBlob(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch blob at ${url}: ${res.status}`);
  return res.arrayBuffer();
}
