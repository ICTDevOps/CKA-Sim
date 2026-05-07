import { describe, expect, it } from "vitest";
import { extractText } from "@/lib/kb/crawler/extract";

describe("extractText", () => {
  it("strips script/style/nav and keeps body content", () => {
    const html = `
      <html>
        <head><style>body{color:red}</style></head>
        <body>
          <nav>nav</nav>
          <script>alert(1)</script>
          <main><p>Hello world.</p></main>
          <footer>fff</footer>
        </body>
      </html>`;
    const out = extractText(html);
    expect(out).toContain("Hello world.");
    expect(out).not.toContain("nav");
    expect(out).not.toContain("alert(1)");
    expect(out).not.toContain("fff");
  });

  it("scopes to <main> when present", () => {
    const html = `
      <body>
        <p>outside</p>
        <main><p>inside</p></main>
      </body>`;
    const out = extractText(html);
    expect(out).toContain("inside");
    expect(out).not.toContain("outside");
  });

  it("preserves heading levels as Markdown ATX", () => {
    const html = `<body><h2>Hello</h2><p>p</p><h3>Sub</h3><p>q</p></body>`;
    const out = extractText(html);
    expect(out).toMatch(/## Hello/);
    expect(out).toMatch(/### Sub/);
  });

  it("decodes common entities", () => {
    const html = `<body><p>Tom &amp; Jerry &lt;3 &nbsp;forever&#39;s</p></body>`;
    expect(extractText(html)).toBe("Tom & Jerry <3 forever's");
  });

  it("handles missing body", () => {
    expect(extractText("just plain text")).toBe("just plain text");
  });
});
