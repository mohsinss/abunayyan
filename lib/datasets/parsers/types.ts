export type ParsedRow = {
  sheet: string | null;
  rowIndex: number;
  data: Record<string, unknown>;
};

export type ParseResult = {
  rows: ParsedRow[];
  chunks: string[];
};

export const MIN_CHUNK_CHARS = 30;
