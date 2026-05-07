/**
 * Minimal HTML → plain-text extractor for the user-source crawler.
 *
 * Strategy:
 *  1. Strip script/style/nav/header/footer/aside (chrome we never want)
 *  2. Try to scope to <main> or <article>; fall back to <body>; fall
 *     back to the raw input
 *  3. Convert structural close tags to newlines (p, div, li, h*, tr, br)
 *  4. Strip remaining tags
 *  5. Decode common HTML entities
 *  6. Collapse whitespace
 *
 * It's deliberately not a full Readability port — we trade fidelity for
 * a zero-dependency MVP. If quality becomes an issue, swap in
 * @mozilla/readability + linkedom.
 */
export function extractText(html: string): string {
  let s = html;

  s = s.replace(
    /<(script|style|nav|header|footer|aside|noscript)[^>]*>[\s\S]*?<\/\1>/gi,
    ""
  );
  s = s.replace(/<!--([\s\S]*?)-->/g, "");

  const main = s.match(/<(main|article)[^>]*>([\s\S]*?)<\/\1>/i);
  if (main) {
    s = main[2];
  } else {
    const body = s.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (body) s = body[1];
  }

  // Preserve heading semantics by injecting markers we can chunk on later.
  s = s.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, lvl, txt) => {
    const stripped = txt.replace(/<[^>]+>/g, "").trim();
    return `\n\n${"#".repeat(Number(lvl))} ${stripped}\n\n`;
  });

  s = s.replace(/<\/(p|div|li|tr)>/gi, "\n");
  s = s.replace(/<br\s*\/?\s*>/gi, "\n");
  s = s.replace(/<li[^>]*>/gi, "- ");

  // Strip everything else.
  s = s.replace(/<[^>]+>/g, "");

  // Decode the most common entities.
  s = s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

  // Collapse runs of blank lines and trim each line.
  s = s
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}
