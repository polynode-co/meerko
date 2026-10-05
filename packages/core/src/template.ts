const VAR_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** Replaces `{{column_key}}` with row values; missing or null values render as "". */
export function renderTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(VAR_RE, (_, key: string) => {
    const v = data[key];
    if (v === null || v === undefined) return "";
    return typeof v === "object" ? JSON.stringify(v) : String(v);
  });
}

/** Column keys a template references, in order of first use. */
export function templateVars(template: string): string[] {
  return [...new Set([...template.matchAll(VAR_RE)].map((m) => m[1]!))];
}
