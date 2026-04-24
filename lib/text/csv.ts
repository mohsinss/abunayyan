/**
 * Format a single CSV field: wrap in double quotes if it contains a quote,
 * comma, newline, or carriage return; escape embedded quotes by doubling.
 * Per RFC 4180.
 */
export function csvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Join a row of values into a CSV line terminated by CRLF. */
export function csvRow(values: readonly unknown[]): string {
  return values.map(csvField).join(",") + "\r\n";
}
