/** Prefijos que Excel/LibreOffice interpretan como fórmula (CSV injection). */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\n\r]/;

/** Serializa un valor como celda CSV segura. Los números no se tocan (G/B pueden ser negativos). */
export function toCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) return value.toISOString();

  let text = String(value);
  if (FORMULA_PREFIX.test(text)) text = `'${text}`;
  if (NEEDS_QUOTES.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsvRow(values: unknown[]): string {
  return values.map(toCsvCell).join(',');
}
