import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  WikiPageviews,
  pageviews,
  type PerArticleParams,
  type PageviewResponse,
  type TopPageviewsResponse,
} from "../src/trending-topics/wiki-page-views";

describe("WikiPageviews", () => {
  let wiki: WikiPageviews;

  beforeEach(() => {
    wiki = new WikiPageviews("test-user-agent/1.0");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getPerArticlePageviews", () => {
    it("should fetch pageviews for a single article", async () => {
      const mockResponse: PageviewResponse = {
        items: [
          {
            project: "en.wikipedia.org",
            article: "Bitcoin",
            granularity: "daily",
            timestamp: "2024010100",
            access: "all-access",
            agent: "all-agents",
            views: 50000,
          },
        ],
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await wiki.getPerArticlePageviews({
        article: "Bitcoin",
        start: "20240101",
        end: "20240102",
      });

      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/metrics/pageviews/per-article/en.wikipedia.org/all-access/all-agents/Bitcoin/daily/20240101/20240102"),
        expect.objectContaining({
          headers: { "User-Agent": "test-user-agent/1.0" },
        })
      );
    });

    it("should handle articles with spaces by converting to underscores", async () => {
      const mockResponse: PageviewResponse = { items: [] };

      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      await wiki.getPerArticlePageviews({
        article: "Artificial intelligence",
        start: "20240101",
        end: "20240102",
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("Artificial_intelligence"),
        expect.any(Object)
      );
    });

    it("should fetch pageviews for multiple articles in parallel", async () => {
      const mockResponses: PageviewResponse[] = [
        { items: [{ project: "en.wikipedia.org", article: "Bitcoin", timestamp: "2024010100", views: 50000 }] },
        { items: [{ project: "en.wikipedia.org", article: "Ethereum", timestamp: "2024010100", views: 30000 }] },
      ];

      let callCount = 0;
      vi.spyOn(global, "fetch").mockImplementation(() => {
        const response = mockResponses[callCount++];
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(response),
        } as Response);
      });

      const result = await wiki.getPerArticlePageviews({
        articles: ["Bitcoin", "Ethereum"],
        start: "20240101",
        end: "20240102",
      });

      expect(Array.isArray(result)).toBe(true);
      expect((result as PageviewResponse[]).length).toBe(2);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("should throw error when article is missing", async () => {
      await expect(
        wiki.getPerArticlePageviews({
          start: "20240101",
          end: "20240102",
        } as PerArticleParams)
      ).rejects.toThrow('Required parameter "article" missing');
    });

    it("should use custom project when specified", async () => {
      const mockResponse: PageviewResponse = { items: [] };

      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      await wiki.getPerArticlePageviews({
        article: "Test",
        project: "de.wikipedia.org",
        start: "20240101",
        end: "20240102",
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("de.wikipedia.org"),
        expect.any(Object)
      );
    });

    it("should support different access types", async () => {
      const mockResponse: PageviewResponse = { items: [] };

      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      await wiki.getPerArticlePageviews({
        article: "Test",
        start: "20240101",
        end: "20240102",
        access: "mobile-web",
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/mobile-web/"),
        expect.any(Object)
      );
    });

    it("should support different agent types", async () => {
      const mockResponse: PageviewResponse = { items: [] };

      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      await wiki.getPerArticlePageviews({
        article: "Test",
        start: "20240101",
        end: "20240102",
        agent: "user",
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/user/"),
        expect.any(Object)
      );
    });

    it("should support monthly granularity", async () => {
      const mockResponse: PageviewResponse = { items: [] };

      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      await wiki.getPerArticlePageviews({
        article: "Test",
        start: "20240101",
        end: "20240201",
        granularity: "monthly",
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/monthly/"),
        expect.any(Object)
      );
    });

    it("should handle Date objects for start and end", async () => {
      const mockResponse: PageviewResponse = { items: [] };

      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      await wiki.getPerArticlePageviews({
        article: "Test",
        start: new Date("2024-01-01"),
        end: new Date("2024-01-02"),
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/20240101/20240102"),
        expect.any(Object)
      );
    });
  });

  describe("getTopPageviews", () => {
    it("should fetch top pageviews for a specific date", async () => {
      const mockResponse: TopPageviewsResponse = {
        items: [
          {
            project: "en.wikipedia.org",
            access: "all-access",
            year: "2024",
            month: "01",
            day: "15",
            articles: [
              { article: "Main_Page", views: 1000000, rank: 1 },
              { article: "Bitcoin", views: 500000, rank: 2 },
            ],
          },
        ],
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await wiki.getTopPageviews({
        year: 2024,
        month: 1,
        day: 15,
      });

      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/top/en.wikipedia.org/all-access/2024/01/15"),
        expect.any(Object)
      );
    });

    it("should support date parameter instead of year/month/day", async () => {
      const mockResponse: TopPageviewsResponse = {
        items: [{ project: "en.wikipedia.org", access: "all-access", year: "2024", month: "01", day: "15", articles: [] }],
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      await wiki.getTopPageviews({
        date: new Date("2024-01-15"),
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/2024/01/15"),
        expect.any(Object)
      );
    });

    it("should apply limit to results", async () => {
      const mockResponse: TopPageviewsResponse = {
        items: [
          {
            project: "en.wikipedia.org",
            access: "all-access",
            year: "2024",
            month: "01",
            day: "15",
            articles: [
              { article: "Main_Page", views: 1000000, rank: 1 },
              { article: "Bitcoin", views: 500000, rank: 2 },
              { article: "Ethereum", views: 300000, rank: 3 },
            ],
          },
        ],
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = (await wiki.getTopPageviews({
        year: 2024,
        month: 1,
        day: 15,
        limit: 2,
      })) as TopPageviewsResponse;

      expect(result.items[0].articles.length).toBe(2);
    });

    it("should throw error when year/month/day are missing", async () => {
      await expect(wiki.getTopPageviews({})).rejects.toThrow(
        'Required parameters "year", "month", and "day" missing'
      );
    });
  });

  describe("getAggregatedPageviews", () => {
    it("should fetch aggregated pageviews for a project", async () => {
      const mockResponse: PageviewResponse = {
        items: [
          {
            project: "en.wikipedia.org",
            timestamp: "2024010100",
            access: "all-access",
            agent: "all-agents",
            views: 250000000,
          },
        ],
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await wiki.getAggregatedPageviews({
        start: "2024010100",
        end: "2024010200",
      });

      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/aggregate/en.wikipedia.org"),
        expect.any(Object)
      );
    });

    it("should fetch aggregated pageviews for multiple projects", async () => {
      const mockResponses: PageviewResponse[] = [
        { items: [{ project: "en.wikipedia.org", timestamp: "2024010100", views: 250000000 }] },
        { items: [{ project: "de.wikipedia.org", timestamp: "2024010100", views: 50000000 }] },
      ];

      let callCount = 0;
      vi.spyOn(global, "fetch").mockImplementation(() => {
        const response = mockResponses[callCount++];
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(response),
        } as Response);
      });

      const result = await wiki.getAggregatedPageviews({
        projects: ["en.wikipedia.org", "de.wikipedia.org"],
        start: "2024010100",
        end: "2024010200",
      });

      expect(Array.isArray(result)).toBe(true);
      expect((result as PageviewResponse[]).length).toBe(2);
    });
  });

  describe("getTopPageviewsByCountry", () => {
    it("should fetch top pageviews by country", async () => {
      const mockResponse = {
        items: [
          {
            project: "en.wikipedia.org",
            access: "all-access",
            year: "2024",
            month: "01",
            countries: [
              { country: "US", views_ceil: 100000000 },
              { country: "GB", views_ceil: 50000000 },
            ],
          },
        ],
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await wiki.getTopPageviewsByCountry({
        year: 2024,
        month: 1,
      });

      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/top-by-country/en.wikipedia.org/all-access/2024/01"),
        expect.any(Object)
      );
    });

    it("should throw error when year/month are missing", async () => {
      await expect(
        wiki.getTopPageviewsByCountry({} as any)
      ).rejects.toThrow('Required parameters "year" and "month" missing');
    });
  });

  describe("getUniqueDevices", () => {
    it("should fetch unique devices count", async () => {
      const mockResponse: PageviewResponse = {
        items: [
          {
            project: "en.wikipedia.org",
            timestamp: "20240101",
            views: 150000000,
          },
        ],
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await wiki.getUniqueDevices({
        project: "en.wikipedia.org",
        start: "20240101",
        end: "20240102",
      });

      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/unique-devices/en.wikipedia.org"),
        expect.any(Object)
      );
    });

    it("should throw error when project is missing", async () => {
      await expect(
        wiki.getUniqueDevices({
          start: "20240101",
          end: "20240102",
        } as any)
      ).rejects.toThrow('Required parameter "project" missing');
    });
  });

  describe("error handling", () => {
    it("should throw error on HTTP failure", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve(JSON.stringify({ detail: "Article not found" })),
      } as Response);

      await expect(
        wiki.getPerArticlePageviews({
          article: "NonExistentArticle12345",
          start: "20240101",
          end: "20240102",
        })
      ).rejects.toThrow("Article not found");
    });

    it("should handle non-JSON error responses", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      } as Response);

      await expect(
        wiki.getPerArticlePageviews({
          article: "Test",
          start: "20240101",
          end: "20240102",
        })
      ).rejects.toThrow("HTTP 500");
    });

    it("should throw error for invalid project name", async () => {
      await expect(
        wiki.getPerArticlePageviews({
          article: "Test",
          project: "invalid",
          start: "20240101",
          end: "20240102",
        })
      ).rejects.toThrow("Invalid project name");
    });
  });

  describe("date formatting", () => {
    it("should pass through already formatted dates", async () => {
      const mockResponse: PageviewResponse = { items: [] };

      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      await wiki.getPerArticlePageviews({
        article: "Test",
        start: "20240101",
        end: "20240131",
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/20240101/20240131"),
        expect.any(Object)
      );
    });
  });

  describe("default instance", () => {
    it("should export a default pageviews instance", () => {
      expect(pageviews).toBeInstanceOf(WikiPageviews);
    });
  });
});
