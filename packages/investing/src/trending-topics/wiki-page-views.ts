/**
 * TypeScript wrapper for Wikipedia Pageviews API
 */

// Type definitions
export type AccessType = "all-access" | "desktop" | "mobile-web" | "mobile-app";
export type AccessSiteType =
  | "all-sites"
  | "desktop-site"
  | "mobile-site"
  | "all-access";
export type AgentType = "all-agents" | "user" | "spider" | "bot";
export type GranularityAggregated = "daily" | "hourly" | "monthly";
export type GranularityPerArticle = "daily" | "monthly";
export type GranularityUniques = "daily" | "monthly";

export interface BaseParams {
  project?: string;
  projects?: string[] | "all-projects";
}

export interface PerArticleParams extends BaseParams {
  article?: string;
  articles?: string[];
  start: string | Date;
  end: string | Date;
  access?: AccessType;
  agent?: AgentType;
  granularity?: GranularityPerArticle;
}

export interface AggregatedParams extends BaseParams {
  start: string | Date;
  end: string | Date;
  access?: AccessType;
  agent?: AgentType;
  granularity?: GranularityAggregated;
}

export interface LegacyPagecountsParams extends BaseParams {
  start: string | Date;
  end: string | Date;
  accessSite?: AccessSiteType;
  granularity?: GranularityAggregated;
}

export interface TopPageviewsParams extends BaseParams {
  year?: number | string;
  month?: number | string;
  day?: number | string;
  date?: string | Date;
  access?: AccessType;
  limit?: number;
}

export interface TopPageviewsByCountryParams extends BaseParams {
  year: number | string;
  month: number | string;
  access?: AccessType;
}

export interface UniqueDevicesParams {
  project: string;
  start: string | Date;
  end: string | Date;
  accessSite?: AccessSiteType;
  granularity?: GranularityUniques;
}

export interface PageviewItem {
  project: string;
  article?: string;
  granularity?: string;
  timestamp: string;
  access?: string;
  agent?: string;
  views: number;
}

export interface PageviewResponse {
  items: PageviewItem[];
}

export interface TopArticle {
  article: string;
  views: number;
  rank: number;
}

export interface TopPageviewsResponse {
  items: Array<{
    project: string;
    access: string;
    year: string;
    month: string;
    day: string;
    articles: TopArticle[];
  }>;
}

/**
 * Wikipedia Pageviews API Client
 */
export class WikiPageviews {
  private readonly BASE_URL = "https://wikimedia.org/api/rest_v1";
  private readonly userAgent: string;

  constructor(userAgent?: string) {
    this.userAgent = userAgent || "wiki-pageviews-ts/1.0.0";
  }

  /**
   * Format date to YYYYMMDD or YYYYMMDDHH format
   */
  private formatDate(
    date: string | Date,
    includeHour: boolean = false
  ): string {
    const d = typeof date === "string" ? new Date(date) : date;

    if (typeof date === "string" && /^\d{8}(\d{2})?$/.test(date)) {
      return date;
    }

    const pad = (n: number) => n.toString().padStart(2, "0");

    const formatted = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(
      d.getUTCDate()
    )}`;

    if (includeHour) {
      return `${formatted}${pad(d.getUTCHours())}`;
    }

    return formatted;
  }

  /**
   * Make API request
   */
  private async request<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      headers: {
        "User-Agent": this.userAgent,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      let errorMessage = `HTTP ${response.status}`;

      try {
        const errorData = JSON.parse(text);
        errorMessage = errorData.detail || errorData.title || errorMessage;
      } catch {
        // Use default error message
      }

      throw new Error(errorMessage);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Validate project name
   */
  private validateProject(project?: string): void {
    if (!project) return;

    if (
      project !== "all-projects" &&
      project !== "wikidata" &&
      !project.includes(".")
    ) {
      throw new Error(
        'Invalid project name. Must be a valid wiki domain (e.g., "en.wikipedia.org")'
      );
    }
  }

  /**
   * Get pageviews for a specific article
   */
  async getPerArticlePageviews(
    params: PerArticleParams
  ): Promise<PageviewResponse | PageviewResponse[]> {
    const project = params.project || "en.wikipedia.org";

    this.validateProject(project);

    // Handle multiple articles
    if (params.articles) {
      const promises = params.articles.map((article) =>
        this.getPerArticlePageviews({ ...params, article, articles: undefined })
      );
      return Promise.all(promises) as Promise<PageviewResponse[]>;
    }

    if (!params.article) {
      throw new Error('Required parameter "article" missing');
    }

    const article = encodeURIComponent(params.article.replace(/\s/g, "_"));
    const start = this.formatDate(params.start);
    const end = this.formatDate(params.end);
    const access = params.access || "all-access";
    const agent = params.agent || "all-agents";
    const granularity = params.granularity || "daily";

    const url = `${this.BASE_URL}/metrics/pageviews/per-article/${project}/${access}/${agent}/${article}/${granularity}/${start}/${end}`;

    return this.request<PageviewResponse>(url);
  }

  /**
   * Get aggregated pageviews for project(s)
   */
  async getAggregatedPageviews(
    params: AggregatedParams
  ): Promise<PageviewResponse | PageviewResponse[]> {
    // Handle multiple projects
    if (params.projects && params.projects !== "all-projects") {
      const projects = Array.isArray(params.projects)
        ? params.projects
        : [params.projects];
      const promises = projects.map((project) =>
        this.getAggregatedPageviews({ ...params, project, projects: undefined })
      );
      return Promise.all(promises) as Promise<PageviewResponse[]>;
    }

    const project = params.project || params.projects || "en.wikipedia.org";
    this.validateProject(project as string);

    const start = this.formatDate(params.start, true);
    const end = this.formatDate(params.end, true);
    const access = params.access || "all-access";
    const agent = params.agent || "all-agents";
    const granularity = params.granularity || "daily";

    const url = `${this.BASE_URL}/metrics/pageviews/aggregate/${project}/${access}/${agent}/${granularity}/${start}/${end}`;

    return this.request<PageviewResponse>(url);
  }

  /**
   * Get legacy pagecounts (Dec 2007 - Aug 2016)
   */
  async getAggregatedLegacyPagecounts(
    params: LegacyPagecountsParams
  ): Promise<PageviewResponse | PageviewResponse[]> {
    // Handle multiple projects
    if (params.projects && params.projects !== "all-projects") {
      const projects = Array.isArray(params.projects)
        ? params.projects
        : [params.projects];
      const promises = projects.map((project) =>
        this.getAggregatedLegacyPagecounts({
          ...params,
          project,
          projects: undefined,
        })
      );
      return Promise.all(promises) as Promise<PageviewResponse[]>;
    }

    const project = params.project || params.projects || "en.wikipedia.org";
    this.validateProject(project as string);

    const start = this.formatDate(params.start, true);
    const end = this.formatDate(params.end, true);
    const accessSite = params.accessSite || "all-sites";
    const granularity = params.granularity || "hourly";

    const url = `${this.BASE_URL}/metrics/legacy/pagecounts/aggregate/${project}/${accessSite}/${granularity}/${start}/${end}`;

    return this.request<PageviewResponse>(url);
  }

  /**
   * Get top viewed articles for a given period
   */
  async getTopPageviews(
    params: TopPageviewsParams
  ): Promise<TopPageviewsResponse | TopPageviewsResponse[]> {
    // Handle date parameter
    if (params.date) {
      const d =
        typeof params.date === "string" ? new Date(params.date) : params.date;
      params.year = d.getUTCFullYear();
      params.month = d.getUTCMonth() + 1;
      params.day = d.getUTCDate();
    }

    if (!params.year || !params.month || !params.day) {
      throw new Error('Required parameters "year", "month", and "day" missing');
    }

    // Handle multiple projects
    if (params.projects) {
      const projects = Array.isArray(params.projects)
        ? params.projects
        : [params.projects];
      const promises = projects.map((project) =>
        this.getTopPageviews({ ...params, project, projects: undefined })
      );
      return Promise.all(promises) as Promise<TopPageviewsResponse[]>;
    }

    const project = params.project || "en.wikipedia.org";
    this.validateProject(project);

    const year = params.year.toString();
    const month = params.month.toString().padStart(2, "0");
    const day = params.day.toString().padStart(2, "0");
    const access = params.access || "all-access";

    const url = `${this.BASE_URL}/metrics/pageviews/top/${project}/${access}/${year}/${month}/${day}`;

    const result = await this.request<TopPageviewsResponse>(url);

    // Apply limit if specified
    if (params.limit && result.items[0]?.articles) {
      result.items[0].articles = result.items[0].articles.slice(
        0,
        params.limit
      );
    }

    return result;
  }

  /**
   * Get top pageviews by country
   */
  async getTopPageviewsByCountry(
    params: TopPageviewsByCountryParams
  ): Promise<any> {
    if (!params.year || !params.month) {
      throw new Error('Required parameters "year" and "month" missing');
    }

    // Handle multiple projects
    if (params.projects) {
      const projects = Array.isArray(params.projects)
        ? params.projects
        : [params.projects];
      const promises = projects.map((project) =>
        this.getTopPageviewsByCountry({
          ...params,
          project,
          projects: undefined,
        })
      );
      return Promise.all(promises);
    }

    const project = params.project || "en.wikipedia.org";
    this.validateProject(project);

    const year = params.year.toString();
    const month = params.month.toString().padStart(2, "0");
    const access = params.access || "all-access";

    const url = `${this.BASE_URL}/metrics/pageviews/top-by-country/${project}/${access}/${year}/${month}`;

    return this.request(url);
  }

  /**
   * Get unique devices count
   */
  async getUniqueDevices(
    params: UniqueDevicesParams
  ): Promise<PageviewResponse> {
    if (!params.project) {
      throw new Error('Required parameter "project" missing');
    }

    this.validateProject(params.project);

    const project = params.project;
    const start = this.formatDate(params.start);
    const end = this.formatDate(params.end);
    const accessSite = params.accessSite || "all-sites";
    const granularity = params.granularity || "daily";

    const url = `${this.BASE_URL}/metrics/unique-devices/${project}/${accessSite}/${granularity}/${start}/${end}`;

    return this.request<PageviewResponse>(url);
  }

  /**
   * Get pageviews dimensions (API root)
   */
  async getPageviewsDimensions(): Promise<any> {
    const url = `${this.BASE_URL}/metrics/pageviews/`;
    return this.request(url);
  }
}

// Export default instance
export const pageviews = new WikiPageviews();

// Export for CommonJS compatibility
export default WikiPageviews;
