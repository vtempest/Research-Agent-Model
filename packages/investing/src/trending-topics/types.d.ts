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
