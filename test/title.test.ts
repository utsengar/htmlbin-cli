// Tests for the title-resolution precedence used when constructing the
// cloud-backend POST body. Mirrors the test plan in the PR description.

import { describe, expect, it } from "vitest";
import { resolveTitle } from "../src/title.js";

describe("resolveTitle", () => {
  it("uses the <title> tag when no explicit title is given", () => {
    const t = resolveTitle({
      html: "<!doctype html><title>Foo</title>",
      filePath: "/tmp/fixture.html",
    });
    expect(t).toBe("Foo");
  });

  it("prefers explicit --title over the <title> tag", () => {
    const t = resolveTitle({
      explicit: "Bar",
      html: "<!doctype html><title>Foo</title>",
      filePath: "/tmp/fixture.html",
    });
    expect(t).toBe("Bar");
  });

  it("falls back to the file stem when there is no <title>", () => {
    const t = resolveTitle({
      html: "<!doctype html><body>no title here</body>",
      filePath: "/tmp/no-title.html",
    });
    expect(t).toBe("no-title");
  });

  it("returns 'Untitled' when there is no <title> and no filename", () => {
    const t = resolveTitle({
      html: "<!doctype html><body>just stdin</body>",
      filePath: null,
    });
    expect(t).toBe("Untitled");
  });

  it("collapses internal whitespace inside <title>", () => {
    const t = resolveTitle({
      html: "<title>  Foo   Bar  </title>",
      filePath: "/tmp/whatever.html",
    });
    expect(t).toBe("Foo Bar");
  });

  it("matches <TITLE> case-insensitively", () => {
    const t = resolveTitle({
      html: "<TITLE>Mixed Case</TITLE>",
      filePath: "/tmp/whatever.html",
    });
    expect(t).toBe("Mixed Case");
  });

  it("decodes common HTML entities", () => {
    const t = resolveTitle({
      html: "<title>5 &lt; 10 &amp; 10 &gt; 1</title>",
      filePath: "/tmp/whatever.html",
    });
    expect(t).toBe("5 < 10 & 10 > 1");
  });

  it("decodes &quot; &#39; &apos;", () => {
    const t = resolveTitle({
      html: "<title>It&#39;s &quot;great&quot; &apos;today&apos;</title>",
      filePath: null,
    });
    expect(t).toBe("It's \"great\" 'today'");
  });

  it("does not double-decode &amp;lt; (round-trips to &lt;)", () => {
    const t = resolveTitle({
      html: "<title>&amp;lt;tag&amp;gt;</title>",
      filePath: null,
    });
    expect(t).toBe("&lt;tag&gt;");
  });

  it("treats an empty <title></title> as 'not found' and falls through", () => {
    const t = resolveTitle({
      html: "<title>   </title>",
      filePath: "/tmp/no-title.html",
    });
    expect(t).toBe("no-title");
  });

  it("ignores <title> attributes", () => {
    const t = resolveTitle({
      html: '<title data-foo="x" lang="en">Foo</title>',
      filePath: null,
    });
    expect(t).toBe("Foo");
  });

  it("takes the first <title> when multiple are present", () => {
    const t = resolveTitle({
      html: "<title>First</title><title>Second</title>",
      filePath: null,
    });
    expect(t).toBe("First");
  });

  it("trims an explicit --title and prefers it even when empty-after-trim falls through", () => {
    const t = resolveTitle({
      explicit: "  ",
      html: "<title>FromHtml</title>",
      filePath: null,
    });
    expect(t).toBe("FromHtml");
  });

  it("truncates to 200 chars to satisfy the worker's MAX_TITLE", () => {
    const long = "a".repeat(500);
    const t = resolveTitle({
      html: `<title>${long}</title>`,
      filePath: null,
    });
    expect(t).toHaveLength(200);
    expect(t).toBe("a".repeat(200));
  });
});
