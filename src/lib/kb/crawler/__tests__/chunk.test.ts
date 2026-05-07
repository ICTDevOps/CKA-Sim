import { describe, expect, it } from "vitest";
import { chunkDocument } from "@/lib/kb/crawler/chunk";

describe("chunkDocument", () => {
  it("splits by H2 / H3 headings", () => {
    const text = `Intro paragraph that we discard because no heading yet.

## Section One

Body of one. More text here.

### Subsection

Nested body, still under section one as a separate chunk.

## Section Two

Body of two.
`;
    const chunks = chunkDocument(text, "Title");
    const sections = chunks.map((c) => c.section);
    expect(sections).toEqual(["Section One", "Subsection", "Section Two"]);
    // Each chunk includes its section title at the top.
    expect(chunks[0].content).toMatch(/^Section One/);
    expect(chunks[1].content).toMatch(/^Subsection/);
  });

  it("falls back to paragraph grouping when no headings exist", () => {
    const para = "x".repeat(800);
    const text = [para, para, para].join("\n\n");
    const chunks = chunkDocument(text, "Title");
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    for (const c of chunks) {
      expect(c.section).toBe("Title");
      expect(c.content).toMatch(/^Title/);
    }
  });

  it("drops chunks shorter than the noise threshold", () => {
    const text = `## Tiny

x

## Real

This is a real chunk with enough body to keep it past the noise threshold.
`;
    const chunks = chunkDocument(text, "Title");
    expect(chunks.map((c) => c.section)).toEqual(["Real"]);
  });
});
