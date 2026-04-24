import "server-only";
import JSZip from "jszip";
import type { ParseResult } from "./types";
import { MIN_CHUNK_CHARS } from "./types";

// .pptx = zip of XML. Each slide N has text inside <a:t>...</a:t> tags in
// ppt/slides/slideN.xml and speaker notes in ppt/notesSlides/notesSlideN.xml.
// For v1 we extract all <a:t> runs per slide and emit one chunk per slide.
// A proper XML parse would be more correct, but slides have a simple enough
// shape that regex matches what we need without pulling in another dep.
export async function parsePptx(buffer: ArrayBuffer): Promise<ParseResult> {
  const zip = await JSZip.loadAsync(buffer);
  const chunks: string[] = [];

  // Sort by slide number so the chunks come out in presentation order.
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort(compareSlidePath);

  for (const slidePath of slideFiles) {
    const slideNum = extractSlideNumber(slidePath);
    const slideText = await readText(zip, slidePath);
    const notesPath = `ppt/notesSlides/notesSlide${slideNum}.xml`;
    const notesText = zip.files[notesPath] ? await readText(zip, notesPath) : "";

    const body = extractText(slideText);
    const notes = extractText(notesText);
    const combined = [`Slide ${slideNum}: ${body}`, notes ? `Notes: ${notes}` : null]
      .filter(Boolean)
      .join("\n\n");

    if (combined.length >= MIN_CHUNK_CHARS) chunks.push(combined);
  }

  return { rows: [], chunks };
}

async function readText(zip: JSZip, path: string): Promise<string> {
  const file = zip.file(path);
  if (!file) return "";
  return file.async("string");
}

function extractText(xml: string): string {
  if (!xml) return "";
  const matches = xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g);
  const parts: string[] = [];
  for (const m of matches) {
    const raw = m[1];
    if (!raw) continue;
    const decoded = decodeEntities(raw).trim();
    if (decoded) parts.push(decoded);
  }
  return parts.join(" ").trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractSlideNumber(path: string): number {
  const match = path.match(/slide(\d+)\.xml$/);
  return match ? parseInt(match[1] ?? "0", 10) : 0;
}

function compareSlidePath(a: string, b: string): number {
  return extractSlideNumber(a) - extractSlideNumber(b);
}
