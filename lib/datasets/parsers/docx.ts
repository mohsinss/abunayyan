import "server-only";
import mammoth from "mammoth";
import type { ParseResult } from "./types";
import { MIN_CHUNK_CHARS } from "./types";

const TARGET_CHARS = 2000;
const OVERLAP_CHARS = 200;

// Extracts raw text from a .docx file and splits it into ~2000-char chunks
// along paragraph boundaries. No row data; .docx is text-only.
export async function parseDocx(buffer: ArrayBuffer): Promise<ParseResult> {
  const { value: text } = await mammoth.extractRawText({
    buffer: Buffer.from(buffer),
  });

  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunks: string[] = [];
  let buf: string[] = [];
  let length = 0;

  for (const para of paragraphs) {
    if (length + para.length + 2 > TARGET_CHARS && length > 0) {
      chunks.push(buf.join("\n\n"));
      // Overlap: keep the tail of the prior chunk so context doesn't snap.
      const tail = buf.join("\n\n").slice(-OVERLAP_CHARS);
      buf = tail ? [tail] : [];
      length = tail.length;
    }
    buf.push(para);
    length += para.length + 2;
  }
  if (buf.length) chunks.push(buf.join("\n\n"));

  return {
    rows: [],
    chunks: chunks.filter((c) => c.length >= MIN_CHUNK_CHARS),
  };
}
