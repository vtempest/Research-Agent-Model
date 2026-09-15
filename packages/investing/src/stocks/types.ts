// TypeScript type definitions for stocks API

// ==========================================
// Yahoo Finance Types
// ==========================================

export interface QuoteResponse {
  success: boolean;
  symbol: string;
  data: any;
  timestamp: string;
}

export interface HistoricalDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjClose: number;
}

export interface HistoricalResponse {
  success: boolean;
  symbol: string;
  period: {
    start: string;
    end: string;
  };
  interval: string;
  dataPoints: number;
  data: HistoricalDataPoint[];
  timestamp: string;
}

export interface PERatioDataPoint {
  date: string;
  price: number;
  ttmEPS: number;
  peRatio: number | null;
}

export interface PEStatistics {
  count: number;
  current: number | null;
  average: number;
  median: number;
  min: number;
  max: number;
}

export interface PERatioResponse {
  success: boolean;
  symbol: string;
  period: {
    start: string;
    end: string;
  };
  interval: string;
  statistics: PEStatistics;
  dataPoints: number;
  data: PERatioDataPoint[];
  timestamp: string;
}

export interface SearchResult {
  symbol: string;
  name: string;
  exch: string;
  type: string;
  exchDisp: string;
  typeDisp: string;
}

export interface SearchResponse {
  success: boolean;
  query: string;
  count: number;
  data: SearchResult[];
  timestamp: string;
}

// ==========================================
// SEC Filing Types
// ==========================================

export interface Ticker {
  symbol: string;
  exchange: string;
}

export interface FilingMetadata {
  primaryDocUrl: string;
  accessionNumber: string;
  tickers: Ticker[];
  companyName: string;
  filingDate: string;
  reportDate: string;
  primaryDocDescription: string;
  items: string;
  formType: string;
  cik: string;
}

export interface RequestedFilings {
  tickerOrCik: string;
  formType: string;
  limit: number | null;
}

export interface CompanyAndAccessionNumber {
  tickerOrCik: string;
  accessionNumber: string;
}

export interface FileContent {
  path: string;
  content: string;
}

export interface TickerToCikMapping {
  [ticker: string]: string;
}

// ==========================================
// P/E Calculator Types
// ==========================================

export interface EarningsDataPoint {
  date: Date;
  eps: number;
  period: string;
}

export interface PriceDataPoint {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjClose: number;
}

export interface CalculatedPERatio {
  date: Date;
  price: number;
  ttmEPS: number | null;
  peRatio: number | null;
}

export interface PECalculationResult {
  priceData: PriceDataPoint[];
  earningsData: EarningsDataPoint[];
  peRatios: CalculatedPERatio[];
  statistics: PEStatistics | null;
}



// ==========================================
// Statistical Prediction Types
// ==========================================

export interface XGBoostParams {
  verbosity?: number;
  max_depth?: number;
  eta?: number;
  objective?: string;
  nthread?: number;
  subsample?: number;
  colsample_bytree?: number;
  colsample_bylevel?: number;
  min_child_weight?: number;
  gamma?: number;
  alpha?: number;
  lambda?: number;
  early_stopping_rounds?: number;
  seed?: number;
  nrounds?: number;
  tree_method?: string;
  grow_policy?: string;
}

export interface TrainModelsOptions {
  xgbParams?: XGBoostParams;
  testSize?: number;
  featuresToUse?: string[];
}

export interface PredictOptions {
  featuresToUse?: string[];
}

export interface TrainTestSplit {
  trainFeatures: any[][];
  testFeatures: any[][];
  trainTarget: number[];
  testTarget: number[];
}



export interface ContractData {
  contractSymbol?: string;
  strike?: number;
  currency?: string;
  lastPrice?: number;
  change?: number;
  percentChange?: number;
  volume?: number;
  openInterest?: number;
  bid?: number;
  ask?: number;
  contractSize?: string;
  expiration?: number;
  lastTradeDate?: number;
  impliedVolatility?: number;
  inTheMoney?: boolean;
  delta?: number;
  theta?: number;
  vega?: number;
  gamma?: number;
  rho?: number;
  leverage?: number;
}

export interface ContractDataByStrike {
  [strike: number]: ContractData | undefined;
}

export interface OptionChain {
  call: ContractDataByStrike;
  put: ContractDataByStrike;
}

export interface Expiration {
  expirationString: string;
  expirationTimestamp: number;
}

export interface OptionMeta {
  strikes: number[];
  expirations: Expiration[];
}

export interface Quote {
  language?: string;
  region?: string;
  quoteType?: string;
  triggerable?: number;
  quoteSourceName?: string;
  currency?: string;
  regularMarketPreviousClose?: number;
  bid?: number;
  ask?: number;
  bidSize?: number;
  askSize?: number;
  fullExchangeName?: string;
  financialCurrency?: string;
  regularMarketOpen?: number;
  averageDailyVolume3Month?: number;
  averageDailyVolume10Day?: number;
  fiftyTwoWeekLowChange?: number;
  fiftyTwoWeekLowChangePercent?: number;
  fiftyTwoWeekRange?: string;
  fiftyTwoWeekHighChange?: number;
  fiftyTwoWeekHighChangePercent?: number;
  exchange?: string;
  shortName?: string;
  longName?: string;
  messageBoardId?: string;
  exchangeTimezoneName?: string;
  exchangeTimezoneShortName?: string;
  gmtOffSetMilliseconds?: number;
  market?: string;
  esgPopulated?: number;
  sharesOutstanding?: number;
  fiftyDayAverage?: number;
  fiftyDayAverageChange?: number;
  fiftyDayAverageChangePercent?: number;
  twoHundredDayAverage?: number;
  twoHundredDayAverageChange?: number;
  twoHundredDayAverageChangePercent?: number;
  marketCap?: number;
  sourceInterval?: number;
  exchangeDataDelayedBy?: number;
  tradeable?: number;
  firstTradeDateMilliseconds?: number;
  priceHint?: number;
  postMarketChangePercent?: number;
  postMarketTime?: number;
  postMarketPrice?: number;
  postMarketChange?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketTime?: number;
  regularMarketPrice?: number;
  regularMarketDayHigh?: number;
  regularMarketDayRange?: string;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
  ytdReturn?: number;
  trailingThreeMonthReturns?: number;
  trailingThreeMonthNavReturns?: number;
  marketState?: string;
  symbol?: string;
}

// ==========================================
// Finnhub API Types
// ==========================================

export interface HistoricalDataOptions {
  symbol: string;
  period1: string | Date;
  period2: string | Date;
  interval?: "1" | "5" | "15" | "30" | "60" | "D" | "W" | "M";
}

export interface QuoteOptions {
  symbol: string;
  modules?: string[];
}

export interface FinnhubQuote {
  c: number; // Current price
  d: number; // Change
  dp: number; // Percent change
  h: number; // High price of the day
  l: number; // Low price of the day
  o: number; // Open price of the day
  pc: number; // Previous close price
  t: number; // Timestamp
}

export interface FinnhubCandle {
  c: number[]; // Close prices
  h: number[]; // High prices
  l: number[]; // Low prices
  o: number[]; // Open prices
  s: string; // Status
  t: number[]; // Timestamps
  v: number[]; // Volumes
}

export interface FinnhubProfile {
  country: string;
  currency: string;
  exchange: string;
  ipo: string;
  marketCapitalization: number;
  name: string;
  phone: string;
  shareOutstanding: number;
  ticker: string;
  weburl: string;
  logo: string;
  finnhubIndustry: string;
}

export interface FinnhubMetrics {
  metric: {
    "10DayAverageTradingVolume": number;
    "52WeekHigh": number;
    "52WeekLow": number;
    beta: number;
    currentRatio: number;
    dividendYieldIndicatedAnnual: number;
    epsBasicExclExtraItemsTTM: number;
    epsGrowth3Y: number;
    epsGrowth5Y: number;
    epsGrowthTTMYoy: number;
    freeCashFlowPerShareTTM: number;
    grossMarginTTM: number;
    netProfitMarginTTM: number;
    operatingMarginTTM: number;
    pbAnnual: number;
    peBasicExclExtraTTM: number;
    peExclExtraHighTTM: number;
    peNormalizedAnnual: number;
    pfcfShareTTM: number;
    "priceRelativeToS&P50052Week": number;
    psTTM: number;
    revenueGrowth3Y: number;
    revenueGrowth5Y: number;
    revenueGrowthTTMYoy: number;
    roaeTTM: number;
    roeTTM: number;
    roicTTM: number;
    totalDebtToEquity: number;
    [key: string]: number;
  };
  series: {
    annual: {
      [key: string]: Array<{ period: string; v: number }>;
    };
  };
}

export interface FinnhubQuoteData {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface QuoteMeta {
  symbol: string;
  exchangeName?: string;
  regularMarketPrice?: number | null;
}

export interface HistoricalDataResponse {
  success: boolean;
  symbol?: string;
  source?: string;
  data?: {
    quotes: FinnhubQuoteData[];
    meta: QuoteMeta;
  };
  meta?: QuoteMeta;
  error?: string;
}

export interface AlpacaBar {
  t: string; // Timestamp
  o: number; // Open
  h: number; // High
  l: number; // Low
  c: number; // Close
  v: number; // Volume
  Timestamp?: string;
  OpenPrice?: number;
  HighPrice?: number;
  LowPrice?: number;
  ClosePrice?: number;
  Volume?: number;
}

export interface AlpacaBarsResponse {
  bars: AlpacaBar[];
  next_page_token?: string | null;
}

export interface PriceData {
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
  regularMarketOpen: number;
  regularMarketPreviousClose: number;
  regularMarketTime: Date;
  currency?: string;
  longName?: string;
  shortName?: string;
  marketCap?: number | null;
  exchange?: string;
}

export interface SummaryDetail {
  previousClose: number;
  open: number;
  dayHigh: number;
  dayLow: number;
  regularMarketVolume: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  trailingPE: number | null;
  dividendYield: number | null;
  beta: number | null;
  marketCap?: number | null;
}

export interface DefaultKeyStatistics {
  priceToBook: number | null;
  enterpriseValue: number | null;
  forwardPE: number | null;
  pegRatio: number | null;
  beta: number | null;
  sharesOutstanding: number | null;
}

export interface FinancialData {
  currentPrice: number;
  targetHighPrice: number | null;
  targetLowPrice: number | null;
  targetMeanPrice: number | null;
  targetMedianPrice: number | null;
  recommendationMean: number | null;
  recommendationKey: string | null;
  numberOfAnalystOpinions: number | null;
  totalCash: number | null;
  totalDebt: number | null;
  totalRevenue: number | null;
  returnOnEquity: number | null;
  returnOnAssets: number | null;
  profitMargins: number | null;
  operatingMargins: number | null;
  grossMargins: number | null;
  freeCashflow: number | null;
  operatingCashflow: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  currentRatio: number | null;
  debtToEquity: number | null;
}

export interface SummaryProfile {
  industry: string;
  sector: string;
  website: string;
  country: string;
  fullTimeEmployees: number | null;
  longBusinessSummary: string | null;
}

export interface FinnhubQuoteResponse {
  price: PriceData;
  summaryDetail: SummaryDetail;
  defaultKeyStatistics: DefaultKeyStatistics;
  financialData: FinancialData;
  summaryProfile: SummaryProfile | null;
}

export interface FinnhubQuoteSummaryResponse {
  success: boolean;
  symbol?: string;
  data?: FinnhubQuoteResponse;
  error?: string;
}

export interface FinnhubSearchResult {
  symbol: string;
  shortname: string;
  exchange: string;
  quoteType: string;
}

export interface FinnhubSearchResponse {
  success: boolean;
  query?: string;
  results?: FinnhubSearchResult[];
  error?: string;
}

export interface PeersResponse {
  success: boolean;
  symbol?: string;
  peers?: string[];
  error?: string;
}

export interface RecommendationTrend {
  period: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

export interface RecommendationsData {
  recommendationTrend: {
    trend: RecommendationTrend[];
  };
}

export interface RecommendationsResponse {
  success: boolean;
  symbol?: string;
  data?: RecommendationsData;
  error?: string;
}

export interface FinancialsData {
  earnings: {
    earningsChart: Record<string, unknown>;
    financialsChart: Record<string, unknown>;
  };
  incomeStatementHistory: Record<string, unknown>;
  balanceSheetHistory: Record<string, unknown>;
  cashflowStatementHistory: Record<string, unknown>;
  metrics: FinnhubMetrics["metric"];
  series: FinnhubMetrics["series"];
}

export interface FinancialsResponse {
  success: boolean;
  symbol?: string;
  data?: FinancialsData;
  error?: string;
}

export interface NewsItem {
  title: string;
  link: string;
  publisher: string;
  publishedAt: Date;
  summary: string;
  image: string;
  category: string;
  related: string;
}

export interface NewsResponse {
  success: boolean;
  symbol?: string;
  news?: NewsItem[];
  error?: string;
}

export interface ForexResponse {
  success: boolean;
  baseCurrency?: string;
  quoteCurrency?: string;
  rate?: number | null;
  error?: string;
}
