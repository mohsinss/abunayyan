import "server-only";
import { parseDocx } from "./docx";
import { parsePptx } from "./pptx";
import { parseXlsx } from "./xlsx";
import type { ParseResult } from "./types";

export class UnsupportedFileError extends Error {
  constructor(mime: string, filename: string) {
    super(`No parser for mime="${mime}" filename="${filename}"`);
    this.name = "UnsupportedFileError";
  }
}

const XLSX_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
]);

const XLSX_EXTS = new Set([".xlsx", ".xls", ".csv"]);
const DOCX_EXTS = new Set([".docx"]);
const PPTX_EXTS = new Set([".pptx"]);

export async function parseFile(
  buffer: ArrayBuffer,
  mime: string,
  filename: string,
): Promise<ParseResult> {
  const ext = extOf(filename);

  if (XLSX_MIMES.has(mime) || XLSX_EXTS.has(ext)) {
    return parseXlsx(buffer);
  }
  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    DOCX_EXTS.has(ext)
  ) {
    return parseDocx(buffer);
  }
  if (
    mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    PPTX_EXTS.has(ext)
  ) {
    return parsePptx(buffer);
  }
  throw new UnsupportedFileError(mime, filename);
}

function extOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot < 0 ? "" : filename.slice(dot).toLowerCase();
}

export type { ParseResult } from "./types";
