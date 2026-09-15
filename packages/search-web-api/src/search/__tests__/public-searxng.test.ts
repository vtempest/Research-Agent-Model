/**
 * @fileoverview Unit tests for SearXNG search functionality
 */
import { beforeEach, describe, expect, it, vi, type MockedFunction } from "vitest";
import { searchWeb, searchSearxng, normalizeGrabResponse } from "../public-searxng";
import grab from "grab-url";

// Mock grab-url
vi.mock("grab-url");
const mockGrab = grab as MockedFunction<typeof grab>;

describe("searchWeb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Private SearXNG instance (JSON)", () => {
    it("should search with private SearXNG instance", async () => {
      const mockResults = {
        results: [
          {
            title: "Test Result 1",
            url: "https://example.com/1",
            content: "Test snippet 1",
            score: 0.95,
            metadata: "2024-01-01 | Example News",
          },
          {
            title: "Test Result 2",
            url: "https://example.com/2",
            content: "Test snippet 2",
            score: 0.85,
          },
        ],
        suggestions: ["suggestion1", "suggestion2"],
        infoboxes: [],
      };

      mockGrab.mockResolvedValueOnce(mockResults);

      const result = await searchWeb("test query", {
        privateSearxng: "https://search.example.com",
      });

      expect(mockGrab).toHaveBeenCalledWith(
        "https://search.example.com/search",
        expect.objectContaining({
          q: expect.stringContaining("test"),
          format: "json",
        })
      );

      expect(result).toHaveProperty("results");
      expect(result).toHaveProperty("suggestions");
      if (!Array.isArray(result)) {
        expect(result.results).toHaveLength(2);
        expect(result.results[0].title).toBe("Test Result 1");
        expect(result.results[0].score).toBe(0.95);
      }
    });

    it("should parse metadata for date and source", async () => {
      const mockResults = {
        results: [
          {
            title: "Article with Metadata",
            url: "https://example.com/article",
            content: "Content",
            score: 0.9,
            metadata: "Jan 15, 2024 | TechNews",
          },
        ],
        suggestions: [],
        infoboxes: [],
      };

      mockGrab.mockResolvedValueOnce(mockResults);

      const result = await searchWeb("test", {
        privateSearxng: "https://search.example.com",
      });

      if (!Array.isArray(result) && result.results.length > 0) {
        const firstResult = result.results[0];
        expect(firstResult.date).toBeDefined();
        expect(firstResult.source).toBeDefined();
      }
    });

    it("should clean HTML entities from titles", async () => {
      const mockResults = {
        results: [
          {
            title: "Test &amp; Title with &lt;HTML&gt; Entities",
            url: "https://example.com",
            content: "Content",
            score: 0.9,
          },
        ],
        suggestions: [],
        infoboxes: [],
      };

      mockGrab.mockResolvedValueOnce(mockResults);

      const result = await searchWeb("test", {
        privateSearxng: "https://search.example.com",
      });

      if (!Array.isArray(result) && result.results.length > 0) {
        expect(result.results[0].title).not.toContain("&amp;");
        expect(result.results[0].title).toContain("&");
        expect(result.results[0].title).not.toContain("&lt;");
      }
    });

    it("should handle breadcrumbed titles", async () => {
      const mockResults = {
        results: [
          {
            title: "Site Name | Very Long Article Title Here",
            url: "https://example.com",
            content: "Content",
            score: 0.9,
          },
        ],
        suggestions: [],
        infoboxes: [],
      };

      mockGrab.mockResolvedValueOnce(mockResults);

      const result = await searchWeb("test", {
        privateSearxng: "https://search.example.com",
      });

      if (!Array.isArray(result) && result.results.length > 0) {
        // Should extract the longest part
        expect(result.results[0].title).toContain("Very Long Article Title Here");
      }
    });

    it("should add favicon URLs", async () => {
      const mockResults = {
        results: [
          {
            title: "Test",
            url: "https://example.com/page",
            content: "Content",
            score: 0.9,
          },
        ],
        suggestions: [],
        infoboxes: [],
      };

      mockGrab.mockResolvedValueOnce(mockResults);

      const result = await searchWeb("test", {
        privateSearxng: "https://search.example.com",
      });

      if (!Array.isArray(result) && result.results.length > 0) {
        expect(result.results[0].favicon).toContain("googleusercontent.com");
        expect(result.results[0].favicon).toContain("example.com");
      }
    });

    it("should handle string response by parsing JSON", async () => {
      const mockResultsString = JSON.stringify({
        results: [
          {
            title: "Test",
            url: "https://example.com",
            content: "Content",
            score: 0.9,
          },
        ],
        suggestions: [],
        infoboxes: [],
      });

      mockGrab.mockResolvedValueOnce(mockResultsString);

      const result = await searchWeb("test", {
        privateSearxng: "https://search.example.com",
      });

      if (!Array.isArray(result)) {
        expect(result.results).toHaveLength(1);
      }
    });

    it("should handle invalid JSON gracefully", async () => {
      mockGrab.mockResolvedValueOnce("Not valid JSON");

      const result = await searchWeb("test", {
        privateSearxng: "https://search.example.com",
      });

      if (!Array.isArray(result)) {
        expect(result.results).toEqual([]);
        expect(result.suggestions).toEqual([]);
      }
    });

    it("should validate URL paths", async () => {
      const mockResults = {
        results: [
          {
            title: "Domain Only",
            url: "https://example.com/", // Just domain
            content: "Content",
            score: 0.9,
          },
          {
            title: "Full Path",
            url: "https://example.com/article/page",
            content: "Content",
            score: 0.8,
          },
        ],
        suggestions: [],
        infoboxes: [],
      };

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      mockGrab.mockResolvedValueOnce(mockResults);

      const result = await searchWeb("test", {
        privateSearxng: "https://search.example.com",
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("domain-only"),
        expect.any(String)
      );
      consoleSpy.mockRestore();
    });
  });

  describe("Public SearXNG instance (HTML scraping)", () => {
    it("should scrape results from HTML", async () => {
      const mockHtml = `
        <article class="result">
          <h3><a href="https://example.com/1">First Result</a></h3>
          <p class="content">First snippet</p>
        </article>
        <article class="result">
          <h3><a href="https://example.com/2">Second Result</a></h3>
          <p class="content">Second snippet</p>
        </article>
      `;

      mockGrab.mockResolvedValueOnce(mockHtml);

      const result = await searchWeb("test", {
        privateSearxng: false,
      });

      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result).toHaveLength(2);
        expect(result[0].title).toBe("First Result");
        expect(result[0].url).toBe("https://example.com/1");
        expect(result[0].snippet).toBe("First snippet");
      }
    });

    it("should handle HTML entities in scraped content", async () => {
      const mockHtml = `
        <article class="result">
          <h3><a href="https://example.com?param=value&amp;other=test">Test &amp; Title</a></h3>
          <p class="content">Content with &lt;entities&gt;</p>
        </article>
      `;

      mockGrab.mockResolvedValueOnce(mockHtml);

      const result = await searchWeb("test", {
        privateSearxng: false,
      });

      if (Array.isArray(result) && result.length > 0) {
        expect(result[0].title).toContain("&");
        expect(result[0].title).not.toContain("&amp;");
        expect(result[0].url).toContain("&");
        expect(result[0].snippet).toContain("<entities>");
      }
    });

    it("should add favicons to scraped results", async () => {
      const mockHtml = `
        <article class="result">
          <h3><a href="https://example.com/page">Test</a></h3>
          <p class="content">Content</p>
        </article>
      `;

      mockGrab.mockResolvedValueOnce(mockHtml);

      const result = await searchWeb("test", {
        privateSearxng: false,
      });

      if (Array.isArray(result) && result.length > 0) {
        expect(result[0].favicon).toContain("google.com/s2/favicons");
        expect(result[0].domain).toBe("example.com");
      }
    });

    it("should validate URLs in scraped results", async () => {
      const mockHtml = `
        <article class="result">
          <h3><a href="https://example.com/">Domain Only</a></h3>
          <p class="content">Content</p>
        </article>
      `;

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      mockGrab.mockResolvedValueOnce(mockHtml);

      await searchWeb("test", { privateSearxng: false });

      // The public-scrape path logs a single formatted message.
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("domain-only"));
      consoleSpy.mockRestore();
    });
  });

  describe("Retry logic", () => {
    it("should retry on fetch failure", async () => {
      mockGrab
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({
          results: [
            { title: "Retry Success", url: "https://example.com", content: "Content", score: 0.9 },
          ],
          suggestions: [],
          infoboxes: [],
        });

      const result = await searchWeb("test", {
        privateSearxng: "https://search.example.com",
        maxRetries: 3,
      });

      expect(mockGrab).toHaveBeenCalledTimes(2);
      if (!Array.isArray(result)) {
        expect(result.results[0].title).toBe("Retry Success");
      }
    });

    it("should retry on empty results", async () => {
      mockGrab
        .mockResolvedValueOnce("") // Empty HTML
        .mockResolvedValueOnce(`
          <article class="result">
            <h3><a href="https://example.com">Retry Result</a></h3>
            <p class="content">Found on retry</p>
          </article>
        `);

      const result = await searchWeb("test", {
        privateSearxng: false,
        maxRetries: 2,
      });

      expect(mockGrab).toHaveBeenCalledTimes(2);
      if (Array.isArray(result)) {
        expect(result[0].title).toBe("Retry Result");
      }
    });

    it("should return empty array after exhausting retries", async () => {
      mockGrab.mockRejectedValue(new Error("Network error"));

      const result = await searchWeb("test", {
        privateSearxng: "https://search.example.com",
        maxRetries: 2,
      });

      expect(mockGrab).toHaveBeenCalledTimes(3); // Initial + 2 retries
      expect(result).toEqual([]);
    });
  });

  describe("Search parameters", () => {
    it("should apply category filter", async () => {
      mockGrab.mockResolvedValueOnce({
        results: [],
        suggestions: [],
        infoboxes: [],
      });

      await searchWeb("test", {
        privateSearxng: "https://search.example.com",
        category: "news",
      });

      expect(mockGrab).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          category_news: 1,
        })
      );
    });

    it("should apply recency filter", async () => {
      mockGrab.mockResolvedValueOnce({
        results: [],
        suggestions: [],
        infoboxes: [],
      });

      await searchWeb("test", {
        privateSearxng: "https://search.example.com",
        recency: "week",
      });

      expect(mockGrab).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          time_range: "week",
        })
      );
    });

    it("should handle pagination", async () => {
      mockGrab.mockResolvedValueOnce({
        results: [],
        suggestions: [],
        infoboxes: [],
      });

      await searchWeb("test", {
        privateSearxng: "https://search.example.com",
        page: 3,
      });

      expect(mockGrab).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          pageno: 3,
        })
      );
    });

    it("should apply safesearch", async () => {
      mockGrab.mockResolvedValueOnce({
        results: [],
        suggestions: [],
        infoboxes: [],
      });

      await searchWeb("test", {
        privateSearxng: "https://search.example.com",
        safesearch: true,
      });

      expect(mockGrab).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          safesearch: "1",
        })
      );
    });

    it("should use custom language", async () => {
      mockGrab.mockResolvedValueOnce({
        results: [],
        suggestions: [],
        infoboxes: [],
      });

      await searchWeb("test", {
        privateSearxng: "https://search.example.com",
        lang: "es",
      });

      expect(mockGrab).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          language: "es",
        })
      );
    });
  });
});

describe("searchSearxng", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should adapt its options onto the underlying search request", async () => {
    mockGrab.mockResolvedValueOnce(`
      <article class="result">
        <h3><a href="https://example.com/article">Test</a></h3>
        <p class="content">Content</p>
      </article>
    `);

    const result = await searchSearxng("test query", {
      categories: ["news"],
      pageno: 2,
      language: "fr",
    });

    // searchSearxng maps categories[0] -> category, pageno -> page, language -> lang.
    expect(mockGrab).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ category_news: 1, pageno: 2, language: "fr" })
    );
    expect(result).toHaveProperty("results");
    expect(result).toHaveProperty("suggestions");
    expect(result.results).toHaveLength(1);
  });

  it("defaults category, page and language when no options are given", async () => {
    mockGrab.mockResolvedValueOnce(`
      <article class="result">
        <h3><a href="https://example.com/article">Test</a></h3>
        <p class="content">Content</p>
      </article>
    `);

    await searchSearxng("test query");

    expect(mockGrab).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ category_general: 1, pageno: 1, language: "en-US" })
    );
  });

  it("should handle array results from searchWeb", async () => {
    mockGrab.mockResolvedValueOnce(`
      <article class="result">
        <h3><a href="https://example.com">Test</a></h3>
        <p class="content">Content</p>
      </article>
    `);

    const result = await searchSearxng("test", { categories: ["general"] });

    expect(result.results).toHaveLength(1);
    expect(result.suggestions).toEqual([]);
  });
});

describe("grab-url response shapes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  // grab-url resolves with `{ error }` instead of rejecting, so these bodies
  // used to reach `parsedData.results.map` and throw a TypeError, which the
  // API route reported as a 500.
  it("returns an empty response when the private instance errors out", async () => {
    mockGrab.mockResolvedValue({ error: "HTTP error: 429 Too Many Requests" } as any);

    const result = await searchWeb("dd", {
      privateSearxng: "https://search.example.com",
      page: 2,
      maxRetries: 6,
    });

    expect(result).toEqual({ results: [], suggestions: [], infoboxes: [] });
    // No point hammering the same private host - the caller falls back.
    expect(mockGrab).toHaveBeenCalledTimes(1);
  });

  it("returns an empty response when the private instance serves HTML", async () => {
    mockGrab.mockResolvedValue({
      data: "<html><body>Too many requests</body></html>",
    } as any);

    const result = await searchWeb("dd", {
      privateSearxng: "https://search.example.com",
      page: 2,
    });

    expect(result).toEqual({ results: [], suggestions: [], infoboxes: [] });
  });

  it("returns an empty response when the private instance JSON has no results", async () => {
    mockGrab.mockResolvedValue({ isLoading: false, suggestions: [] } as any);

    const result = await searchWeb("dd", {
      privateSearxng: "https://search.example.com",
    });

    expect(result).toEqual({ results: [], suggestions: [], infoboxes: [] });
  });

  it("skips malformed results instead of throwing", async () => {
    mockGrab.mockResolvedValue({
      results: [
        { url: "https://example.com/no-title" },
        { title: "No URL at all" },
        null,
        {
          title: "Good",
          url: "https://example.com/good",
          content: "Snippet",
          score: "not-a-number",
          metadata: "not a date | Source",
        },
      ],
      suggestions: ["one"],
    } as any);

    const result = await searchWeb("dd", {
      privateSearxng: "https://search.example.com",
    });

    expect(Array.isArray(result)).toBe(false);
    if (!Array.isArray(result)) {
      expect(result.results).toHaveLength(2);
      expect(result.results[0].title).toBe("");
      expect(result.results[1].title).toBe("Good");
      expect(result.results[1].score).toBeUndefined();
      expect(result.results[1].date).toBeUndefined();
      expect(result.suggestions).toEqual(["one"]);
    }
  });

  it("scrapes HTML that grab-url returned on the `data` field", async () => {
    mockGrab.mockResolvedValue({
      data: `
        <article class="result">
          <h3><a href="https://example.com/1">Wrapped Result</a></h3>
          <p class="content">Wrapped snippet</p>
        </article>
      `,
    } as any);

    const result = await searchWeb("test", { privateSearxng: false });

    expect(Array.isArray(result)).toBe(true);
    if (Array.isArray(result)) {
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Wrapped Result");
      expect(result[0].url).toBe("https://example.com/1");
    }
  });

  it("tries another public instance when one errors out", async () => {
    mockGrab
      .mockResolvedValueOnce({ error: "HTTP error: 502 Bad Gateway" } as any)
      .mockResolvedValueOnce(`
        <article class="result">
          <h3><a href="https://example.com/2">Second Instance</a></h3>
          <p class="content">Snippet</p>
        </article>
      ` as any);

    const result = await searchWeb("test", { privateSearxng: false, maxRetries: 3 });

    expect(mockGrab).toHaveBeenCalledTimes(2);
    if (Array.isArray(result)) {
      expect(result[0].title).toBe("Second Instance");
    }
  });

  it("gives up with an empty array when every public instance errors out", async () => {
    mockGrab.mockResolvedValue({ error: "HTTP error: 502 Bad Gateway" } as any);

    const result = await searchWeb("test", { privateSearxng: false, maxRetries: 2 });

    expect(mockGrab).toHaveBeenCalledTimes(3); // initial + 2 retries
    expect(result).toEqual([]);
  });

  it("passes the query unencoded and disables grab-url HTML parsing", async () => {
    mockGrab.mockResolvedValueOnce({ results: [], suggestions: [] } as any);

    await searchWeb("olympic games 2028", {
      privateSearxng: "https://search.example.com",
    });

    // grab-url encodes GET params itself; pre-encoding turned spaces into
    // "%2520" and searched for the literal escape sequence.
    expect(mockGrab).toHaveBeenCalledWith(
      "https://search.example.com/search",
      expect.objectContaining({ q: "olympic games 2028", dom: false }),
    );
  });
});

describe("normalizeGrabResponse", () => {
  it("reports missing and non-object responses as errors", () => {
    expect(normalizeGrabResponse(null).error).toBeTruthy();
    expect(normalizeGrabResponse(undefined).error).toBeTruthy();
    expect(normalizeGrabResponse(42).error).toBeTruthy();
  });

  it("passes strings through as text", () => {
    expect(normalizeGrabResponse("<html></html>")).toEqual({ text: "<html></html>" });
  });

  it("surfaces the error field grab-url sets on failure", () => {
    expect(normalizeGrabResponse({ error: "HTTP error: 500" })).toEqual({
      error: "HTTP error: 500",
    });
  });

  it("treats a root-level results array as JSON", () => {
    const raw = { results: [{ url: "https://example.com" }], isLoading: false };
    expect(normalizeGrabResponse(raw)).toEqual({ json: raw });
  });

  it("unwraps text and JSON bodies carried on `data`", () => {
    expect(normalizeGrabResponse({ data: "<html></html>" })).toEqual({
      text: "<html></html>",
    });

    const nested = { results: [{ url: "https://example.com" }] };
    expect(normalizeGrabResponse({ data: nested })).toEqual({ json: nested });
  });
});
