/**
 * Chunks the extracted plain-text/markdown document into retrieval units.
 *
 * Strategy: split on Markdown H2/H3 headings (lines starting with `## `
 * or `### `, produced by the extractor's heading-marker pass). If the
 * document has no headings at all (e.g., a flat blog post), fall back to
 * paragraph grouping by target size.
 */

const TARGET_CHUNK_CHARS = 1200;
const PARAGRAPH_OVERLAP_CHARS = 200;

export interface RawChunk {
  section: string;
  content: string;
}

export function chunkDocument(text: string, fallbackTitle: string): RawChunk[] {
  const headingRe = /^(##+ )(.+)$/m;
  if (headingRe.test(text)) {
    return chunkByHeadings(text, fallbackTitle);
  }
  return chunkByParagraphs(text, fallbackTitle);
}

function chunkByHeadings(text: string, fallbackTitle: string): RawChunk[] {
  // Split keeping the heading line as part of the following chunk.
  const lines = text.split("\n");
  const chunks: RawChunk[] = [];
  let currentSection = fallbackTitle;
  let currentBody: string[] = [];

  function flush() {
    const body = currentBody.join("\n").trim();
    if (body.length > 0) {
      chunks.push({
        section: currentSection,
        content: `${currentSection}\n\n${body}`
      });
    }
    currentBody = [];
  }

  let seenHeading = false;
  for (const line of lines) {
    const m = line.match(/^##+\s+(.+)$/);
    if (m) {
      if (seenHeading) flush();
      else currentBody = [];
      currentSection = m[1].trim();
      seenHeading = true;
    } else {
      currentBody.push(line);
    }
  }
  flush();
  return chunks.filter((c) => {
    const prefix = `${c.section}\n\n`;
    const body = c.content.startsWith(prefix)
      ? c.content.slice(prefix.length)
      : c.content;
    return body.trim().length > 5;
  });
}

function chunkByParagraphs(text: string, fallbackTitle: string): RawChunk[] {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim());
  const chunks: RawChunk[] = [];
  let buf = "";
  for (const p of paragraphs) {
    if (buf.length + p.length + 2 > TARGET_CHUNK_CHARS) {
      if (buf) {
        chunks.push({
          section: fallbackTitle,
          content: `${fallbackTitle}\n\n${buf.trim()}`
        });
        // Keep tail overlap for context continuity.
        buf = buf.slice(-PARAGRAPH_OVERLAP_CHARS) + "\n\n" + p;
      } else {
        buf = p;
      }
    } else {
      buf = buf ? `${buf}\n\n${p}` : p;
    }
  }
  if (buf.trim()) {
    chunks.push({
      section: fallbackTitle,
      content: `${fallbackTitle}\n\n${buf.trim()}`
    });
  }
  return chunks;
}
