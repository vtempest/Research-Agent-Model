import {
  sqliteTable,
  text,
  integer,
  real,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

// User table
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).default(false),
  image: text("image"),
  apiKey: text("api_key").unique(),
  usageCount: integer("usage_count").default(0),
  alpacaKeyId: text("alpaca_key_id"),
  alpacaSecretKey: text("alpaca_secret_key"),
  alpacaPaper: integer("alpaca_paper", { mode: "boolean" }).default(true),
  surveyResponse: text("survey_response"), // JSON string of survey responses

  // KYC Verification (Didit.me)
  kycStatus: text("kyc_status").default("not_started"), // not_started, pending, in_review, approved, rejected, abandoned, expired
  kycSessionId: text("kyc_session_id"),
  kycVerifiedAt: integer("kyc_verified_at", { mode: "timestamp" }),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Session table
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Account table (for OAuth)
export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  accessTokenExpiresAt: integer("access_token_expires_at", {
    mode: "timestamp",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Verification table
export const verifications = sqliteTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

// Wallet addresses table (for SIWE / Web3 auth)
export const walletAddresses = sqliteTable("wallet_addresses", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  address: text("address").notNull().unique(),
  chainId: integer("chain_id").notNull(),
  isPrimary: integer("is_primary", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// User Settings (API Keys & Broker Credentials)
export const userSettings = sqliteTable("user_settings", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),

  // LLM Provider API Keys
  groqApiKey: text("groq_api_key"),
  openaiApiKey: text("openai_api_key"),
  anthropicApiKey: text("anthropic_api_key"),
  xaiApiKey: text("xai_api_key"),
  googleApiKey: text("google_api_key"),
  togetheraiApiKey: text("togetherai_api_key"),
  perplexityApiKey: text("perplexity_api_key"),
  cloudflareApiKey: text("cloudflare_api_key"),

  // Broker API Keys
  alpacaApiKey: text("alpaca_api_key"),
  alpacaApiSecret: text("alpaca_api_secret"),
  alpacaBaseUrl: text("alpaca_base_url"),

  // Broker Credentials
  webullUsername: text("webull_username"),
  webullPassword: text("webull_password"),
  robinhoodUsername: text("robinhood_username"),
  robinhoodPassword: text("robinhood_password"),
  ibkrUsername: text("ibkr_username"),
  ibkrPassword: text("ibkr_password"),

  // Data Provider API Keys
  alphaVantageApiKey: text("alpha_vantage_api_key"),
  finnhubApiKey: text("finnhub_api_key"),
  polygonApiKey: text("polygon_api_key"),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// User Strategies
export const strategies = sqliteTable("strategies", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(), // momentum, mean-reversion, breakout, day-scalp
  status: text("status").notNull().default("paused"), // running, paused, paper
  riskLevel: text("risk_level").notNull().default("medium"),

  // Performance metrics
  todayPnL: real("today_pnl").default(0),
  last7DaysPnL: real("last_7days_pnl").default(0),
  last30DaysPnL: real("last_30days_pnl").default(0),
  winRate: real("win_rate").default(0),
  activeMarkets: integer("active_markets").default(0),
  tradesToday: integer("trades_today").default(0),

  // Configuration
  config: text("config"), // JSON string of strategy parameters

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// User Watchlists (Collections)
export const watchlists = sqliteTable("watchlists", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// User Watchlist Items
export const watchlist = sqliteTable("watchlist", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  watchlistId: text("watchlist_id").references(() => watchlists.id, {
    onDelete: "cascade",
  }), // Nullable (NULL = Default/Favorites)
  symbol: text("symbol").notNull(),
  name: text("name"), // Stock name (optional)
  addedAt: integer("added_at", { mode: "timestamp" }).notNull(),
});

// User Watchlist/Signals
export const signals = sqliteTable("signals", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  asset: text("asset").notNull(),
  type: text("type").notNull(), // stock, prediction_market

  // Scores
  combinedScore: real("combined_score").notNull(),
  scoreLabel: text("score_label").notNull(), // Strong Buy, Buy, Hold, Sell, Strong Sell

  // Driver scores
  fundamentalsScore: real("fundamentals_score"),
  vixScore: real("vix_score"),
  technicalScore: real("technical_score"),
  sentimentScore: real("sentiment_score"),

  // Metadata
  strategy: text("strategy"),
  timeframe: text("timeframe"),
  suggestedAction: text("suggested_action"),
  suggestedSize: text("suggested_size"),

  // Additional data
  metadata: text("metadata"), // JSON string with extra data

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// User Positions
export const positions = sqliteTable("positions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  asset: text("asset").notNull(),
  type: text("type").notNull(), // stock, prediction_market

  entryPrice: real("entry_price").notNull(),
  currentPrice: real("current_price").notNull(),
  size: real("size").notNull(),

  unrealizedPnL: real("unrealized_pnl").default(0),
  unrealizedPnLPercent: real("unrealized_pnl_percent").default(0),

  strategy: text("strategy"),
  openedBy: text("opened_by"),
  openedAt: integer("opened_at", { mode: "timestamp" }).notNull(),
  closedAt: integer("closed_at", { mode: "timestamp" }),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// User Trades
export const trades = sqliteTable("trades", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  asset: text("asset").notNull(),
  type: text("type").notNull(), // stock, prediction_market
  action: text("action").notNull(), // buy, sell

  price: real("price").notNull(),
  size: real("size").notNull(),
  pnl: real("pnl"),

  strategy: text("strategy"),
  copiedFrom: text("copied_from"),

  timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// Portfolio Summary
export const portfolios = sqliteTable("portfolios", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),

  totalEquity: real("total_equity").default(100000),
  cash: real("cash").default(100000),
  stocks: real("stocks").default(0),
  predictionMarkets: real("prediction_markets").default(0),
  margin: real("margin").default(0),

  dailyPnL: real("daily_pnl").default(0),
  dailyPnLPercent: real("daily_pnl_percent").default(0),
  winRate: real("win_rate").default(0),
  openPositions: integer("open_positions").default(0),

  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// ============================================================================
// Polymarket Trader Tracking
// ============================================================================

// Polymarket Leaders/Traders
export const polymarketLeaders = sqliteTable("polymarket_leaders", {
  trader: text("trader").primaryKey(),
  rank: integer("rank"),
  userName: text("user_name"),
  xUsername: text("x_username"),
  verifiedBadge: integer("verified_badge", { mode: "boolean" }),
  profileImage: text("profile_image"),

  // Volume and PnL from new leaderboard API
  vol: real("vol"),
  pnl: real("pnl"),

  // Legacy fields from old API (keep for backward compatibility)
  overallGain: real("overall_gain"),
  winRate: real("win_rate"),
  activePositions: integer("active_positions"),
  totalPositions: integer("total_positions"),
  currentValue: real("current_value"),
  winAmount: real("win_amount"),
  lossAmount: real("loss_amount"),

  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

// Polymarket Positions
export const polymarketPositions = sqliteTable("polymarket_positions", {
  id: text("id").primaryKey(),
  traderId: text("trader_id").notNull(),
  marketId: text("market_id"),
  marketTitle: text("market_title"),
  cashPnl: real("cash_pnl"),
  realizedPnl: real("realized_pnl"),
  tags: text("tags"), // JSON array
  createdAt: integer("created_at", { mode: "timestamp" }),
});

// Polymarket Categories
export const polymarketCategories = sqliteTable("polymarket_categories", {
  tag: text("tag").primaryKey(),
  pnl: real("pnl"),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

// Polymarket Markets - Store prediction markets data
export const polymarketMarkets = sqliteTable("polymarket_markets", {
  id: text("id").primaryKey(),
  conditionId: text("condition_id"), // Condition ID for Polymarket data-api queries
  question: text("question").notNull(),
  slug: text("slug").notNull(),
  eventSlug: text("event_slug"), // Event slug for constructing polymarket.com URLs
  description: text("description"),
  image: text("image"),

  // Volume metrics
  volume24hr: real("volume_24hr"),
  volumeTotal: real("volume_total"),

  // Market status
  active: integer("active", { mode: "boolean" }).default(true),
  closed: integer("closed", { mode: "boolean" }).default(false),

  // Outcomes and prices (stored as JSON strings)
  outcomes: text("outcomes").notNull(), // JSON array: ["Yes", "No"]
  outcomePrices: text("outcome_prices").notNull(), // JSON array: ["0.65", "0.35"]
  clobTokenIds: text("clob_token_ids"), // JSON array of token IDs for price history

  // Additional metadata
  tags: text("tags"), // JSON array
  category: text("category"), // Primary category: Politics, Sports, Crypto, etc.
  subcategory: text("subcategory"), // Subcategory within primary category
  endDate: text("end_date"),
  groupItemTitle: text("group_item_title"),
  enableOrderBook: integer("enable_order_book", { mode: "boolean" }),

  // Tracking
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Polymarket Market Positions - Detailed order book positions
export const polymarketMarketPositions = sqliteTable(
  "polymarket_market_positions",
  {
    id: text("id").primaryKey(),
    marketId: text("market_id").notNull(),
    outcome: text("outcome").notNull(), // "Yes" or "No"
    price: real("price").notNull(),
    size: real("size").notNull(),
    side: text("side").notNull(), // "buy" or "sell"
    totalValue: real("total_value").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
);

// Polymarket Debate Analysis - LLM-generated debate on both sides
export const polymarketDebates = sqliteTable("polymarket_debates", {
  id: text("id").primaryKey(),
  marketId: text("market_id").notNull().unique(),
  question: text("question").notNull(),

  // Debate arguments
  yesArguments: text("yes_arguments").notNull(), // JSON array of arguments
  noArguments: text("no_arguments").notNull(), // JSON array of arguments

  // Analysis
  yesSummary: text("yes_summary").notNull(),
  noSummary: text("no_summary").notNull(),
  keyFactors: text("key_factors").notNull(), // JSON array
  uncertainties: text("uncertainties").notNull(), // JSON array

  // Metadata
  currentYesPrice: real("current_yes_price"),
  currentNoPrice: real("current_no_price"),
  llmProvider: text("llm_provider"),
  model: text("model"),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Polymarket Price History - Historical price data for market tokens
export const polymarketPriceHistory = sqliteTable("polymarket_price_history", {
  id: text("id").primaryKey(),
  tokenId: text("token_id").notNull(), // The market token ID
  timestamp: integer("timestamp").notNull(), // Unix timestamp from API
  price: real("price").notNull(), // Price in 0-1 range (or absolute if abs=true)
  interval: text("interval").notNull(), // "1h", "1d", "max", etc.
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// Polymarket Holders - Top holders for a market
export const polymarketHolders = sqliteTable("polymarket_holders", {
  id: text("id").primaryKey(),
  marketId: text("market_id").notNull(),
  address: text("address").notNull(),
  userName: text("user_name"), // Polymarket username if available
  profileImage: text("profile_image"), // Profile image URL
  rank: integer("rank").notNull(),
  outcome: text("outcome"), // "Yes" or "No" - which side they're on
  balance: real("balance").notNull(), // Number of shares
  value: real("value").notNull(), // Value in USD
  overallGain: real("overall_gain"), // Overall PnL from polymarketLeaders lookup
  winRate: real("win_rate"), // Win rate percentage (0-100)
  totalProfit: real("total_profit"), // Total profit from winning positions
  totalLoss: real("total_loss"), // Total loss from losing positions
  totalPositions: integer("total_positions"), // Total number of positions
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Polymarket Trade History - Full trade history for leaderboard traders
export const polymarketTradeHistory = sqliteTable("polymarket_trade_history", {
  id: text("id").primaryKey(), // Unique trade ID (transactionHash-outcomeIndex)
  traderId: text("trader_id").notNull(), // Trader wallet address (proxyWallet)
  transactionHash: text("transaction_hash").notNull(),

  // Market info
  conditionId: text("condition_id").notNull(), // Market condition ID
  marketTitle: text("market_title"), // Market title
  marketSlug: text("market_slug"), // Market slug for URL
  eventSlug: text("event_slug"), // Event slug for URL

  // Trade details
  type: text("type").notNull(), // TRADE, SPLIT, MERGE, REDEEM, REWARD, CONVERSION, MAKER_REBATE
  side: text("side"), // BUY or SELL (for TRADE type)
  outcome: text("outcome"), // Outcome name (e.g., "Yes", "No")
  outcomeIndex: integer("outcome_index"), // 0 or 1

  // Amounts
  size: real("size").notNull(), // Number of shares/tokens
  usdcSize: real("usdc_size").notNull(), // USDC amount
  price: real("price"), // Price per share (0-1 range)

  // Trader profile (snapshot at time of trade)
  traderName: text("trader_name"), // pseudonym
  traderBio: text("trader_bio"),
  traderProfileImage: text("trader_profile_image"),

  // Timestamps
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull(), // Trade execution time
  syncedAt: integer("synced_at", { mode: "timestamp" }).notNull(), // When we synced this
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// Polymarket Trade Sync Status - Track sync progress for traders
export const polymarketTradeSyncStatus = sqliteTable(
  "polymarket_trade_sync_status",
  {
    traderId: text("trader_id").primaryKey(),
    lastSyncedTimestamp: integer("last_synced_timestamp", {
      mode: "timestamp",
    }), // Most recent trade timestamp synced
    totalTradesSynced: integer("total_trades_synced").default(0),
    syncStatus: text("sync_status").notNull().default("pending"), // pending, in_progress, completed, error
    errorMessage: text("error_message"),
    lastSyncAttempt: integer("last_sync_attempt", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
);

// ============================================================================
// NVSTLY Leaders Tracking
// ============================================================================

// NVSTLY Leaders/Traders
export const nvstlyLeaders = sqliteTable("nvstly_leaders", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  rank: integer("rank"),
  rep: real("rep"), // reputation score
  trades: integer("trades"),
  winRate: real("win_rate"),
  totalGain: real("total_gain"),
  avgReturn: real("avg_return"),
  broker: text("broker"),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

// NVSTLY Trades
export const nvstlyTrades = sqliteTable("nvstly_trades", {
  id: text("id").primaryKey(),
  traderId: text("trader_id").notNull(),
  symbol: text("symbol").notNull(),
  type: text("type").notNull(), // buy, sell, short
  price: real("price"),
  previousPrice: real("previous_price"),
  gain: real("gain"),
  time: integer("time", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }),
});

// ============================================================================
// Zulu Traders Tracking
// ============================================================================

// Zulu Traders
export const zuluTraders = sqliteTable("zulu_traders", {
  providerId: integer("provider_id").primaryKey(),
  name: text("name"),
  strategyDesc: text("strategy_desc"),
  countryCode: text("country_code"),
  countryName: text("country_name"),
  brokerName: text("broker_name"),
  balance: real("balance"),
  equity: real("equity"),
  followers: integer("followers"),
  liveFollowers: integer("live_followers"),
  roiAnnualized: real("roi_annualized"),
  roiProfit: real("roi_profit"),
  zuluRank: integer("zulu_rank"),
  bestTrade: real("best_trade"),
  worstTrade: real("worst_trade"),
  profitableTrades: integer("profitable_trades"),
  losingTrades: integer("losing_trades"),
  avgDrawdown: real("avg_drawdown"),
  maxDrawdown: real("max_drawdown"),
  maxDrawdownPercent: real("max_drawdown_percent"),
  leverage: real("leverage"),
  isEa: integer("is_ea"), // 1 for EA (Expert Advisor), 0 for manual
  currencies: text("currencies"),
  weeks: integer("weeks"),
  demo: integer("demo"), // 1 for demo, 0 for live
  avgTradeSeconds: integer("avg_trade_seconds"),
  avgPnlPerTrade: real("avg_pnl_per_trade"),
  winRate: real("win_rate"),
  totalTrades: integer("total_trades"),
  pageVisits: integer("page_visits"),
  includedInWatchlist: integer("included_in_watchlist"),
  registrationDate: integer("registration_date", { mode: "timestamp" }),
  lastOpenTradeDate: integer("last_open_trade_date", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

// Zulu Currency Stats
export const zuluCurrencyStats = sqliteTable("zulu_currency_stats", {
  id: text("id").primaryKey(),
  providerId: integer("provider_id").notNull(),
  currencyName: text("currency_name"),
  totalCount: integer("total_count"),
  winCount: integer("win_count"),
  winPercent: real("win_percent"),
  totalBuyCount: integer("total_buy_count"),
  totalSellCount: integer("total_sell_count"),
  pips: real("pips"),
  createdAt: integer("created_at", { mode: "timestamp" }),
});

// ============================================================================
// Agent API Logs
// ============================================================================

export const agentApiLogs = sqliteTable("agent_api_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }), // Optional, linking to user if authenticated
  symbol: text("symbol").notNull(),
  requestPayload: text("request_payload"), // JSON string
  responseSignal: text("response_signal"), // JSON string
  responseAnalysis: text("response_analysis"), // JSON string
  llmProvider: text("llm_provider"),
  model: text("model_used"),
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ============================================================================
// Organizations & Teams
// ============================================================================

// Organizations - Companies or groups
export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  image: text("image"),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Organization Members
export const organizationMembers = sqliteTable("organization_members", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"), // owner, admin, member
  joinedAt: integer("joined_at", { mode: "timestamp" }).notNull(),
});

// Teams - Sub-groups within organizations
export const teams = sqliteTable("teams", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),

  // Team Pro upgrades feature
  upgradeMembers: integer("upgrade_members", { mode: "boolean" }).default(
    false,
  ), // Toggle for Pro upgrades
  maxMembers: integer("max_members").default(8), // Max 8 members for Team subscription

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Team Members
export const teamMembers = sqliteTable("team_members", {
  id: text("id").primaryKey(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"), // lead, member
  joinedAt: integer("joined_at", { mode: "timestamp" }).notNull(),
});

// ============================================================================
// User Social Features
// ============================================================================

// User Follows - Users following other users
export const userFollows = sqliteTable("user_follows", {
  id: text("id").primaryKey(),
  followerId: text("follower_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  followingId: text("following_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// User Invitations - Invite users via email
export const userInvitations = sqliteTable("user_invitations", {
  id: text("id").primaryKey(),
  inviterId: text("inviter_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  status: text("status").notNull().default("pending"), // pending, accepted, expired
  organizationId: text("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  teamId: text("team_id").references(() => teams.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ============================================================================
// Sharing & Notifications
// ============================================================================

// Shared Items - Stock alerts, debate reports, etc.
export const sharedItems = sqliteTable("shared_items", {
  id: text("id").primaryKey(),
  sharedById: text("shared_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  sharedWithEmail: text("shared_with_email").notNull(),
  sharedWithUserId: text("shared_with_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  itemType: text("item_type").notNull(), // stock_alert, debate_report, signal, strategy
  itemId: text("item_id").notNull(), // Reference to the shared item
  symbol: text("symbol"), // For stock-related shares
  title: text("title"),
  message: text("message"), // Optional message from sender
  metadata: text("metadata"), // JSON string with additional data
  viewedAt: integer("viewed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// Notifications
export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // share, follow, invite, comment, like, mention
  title: text("title").notNull(),
  message: text("message").notNull(),
  actionUrl: text("action_url"), // Link to the relevant item
  fromUserId: text("from_user_id").references(() => users.id, {
    onDelete: "cascade",
  }),
  relatedItemType: text("related_item_type"), // stock_alert, debate_report, comment, etc.
  relatedItemId: text("related_item_id"),
  read: integer("read", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ============================================================================
// Comments & Likes
// ============================================================================

// Comments - On debate reports and news tips
export const comments = sqliteTable("comments", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  itemType: text("item_type").notNull(), // debate_report, news_tip, signal, strategy
  itemId: text("item_id").notNull(), // ID of the item being commented on
  parentCommentId: text("parent_comment_id").references(
    (): AnySQLiteColumn => comments.id,
    { onDelete: "cascade" },
  ), // For nested comments
  content: text("content").notNull(),
  editedAt: integer("edited_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Likes - On debate reports, comments, and news tips
export const likes = sqliteTable("likes", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  itemType: text("item_type").notNull(), // debate_report, news_tip, signal, strategy, comment
  itemId: text("item_id").notNull(), // ID of the item being liked
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ============================================================================
// Stock Data Cache
// ============================================================================

// Stock Quote Cache - Cache real-time quote data from yfinance/finnhub/alpaca
export const stockQuoteCache = sqliteTable("stock_quote_cache", {
  symbol: text("symbol").primaryKey(),
  price: real("price").notNull(),
  change: real("change"),
  changePercent: real("change_percent"),
  open: real("open"),
  high: real("high"),
  low: real("low"),
  previousClose: real("previous_close"),
  volume: real("volume"),
});

// Stock Fundamentals - Store fundamental data like PE ratio, etc.
export const stockFundamentals = sqliteTable("stock_fundamentals", {
  symbol: text("symbol").primaryKey(),
  peRatio: real("pe_ratio"),
  eps: real("eps"),
  dividendYield: real("dividend_yield"),
  beta: real("beta"),
  fiftyTwoWeekHigh: real("fifty_two_week_high"),
  fiftyTwoWeekLow: real("fifty_two_week_low"),
  fiftyDayAverage: real("fifty_day_average"),
  twoHundredDayAverage: real("two_hundred_day_average"),
  sharesOutstanding: real("shares_outstanding"),
  bookValue: real("book_value"),
  priceToBook: real("price_to_book"),
  trailingPE: real("trailing_pe"),
  forwardPE: real("forward_pe"),
  lastFetched: integer("last_fetched", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Historical Quote Data - Store daily historical quotes
export const stockHistoricalQuotes = sqliteTable("stock_historical_quotes", {
  id: text("id").primaryKey(),
  symbol: text("symbol").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD format
  open: real("open").notNull(),
  high: real("high").notNull(),
  low: real("low").notNull(),
  close: real("close").notNull(),
  volume: real("volume"),
  adjustedClose: real("adjusted_close"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ============================================================================
// Dukascopy Index Data Cache
// ============================================================================

// Dukascopy Index Cache - Cache index data from Dukascopy API
export const dukascopyIndexCache = sqliteTable("dukascopy_index_cache", {
  symbol: text("symbol").primaryKey(), // Index symbol (e.g., "usa500idxusd")
  name: text("name").notNull(), // Display name (e.g., "S&P 500")
  country: text("country").notNull(), // Country name
  countryCode: text("country_code").notNull(), // Country code (e.g., "US")

  // Current price data
  price: real("price").notNull(),
  dailyChange: real("daily_change").notNull(),
  dailyChangePercent: real("daily_change_percent").notNull(),
  volume: real("volume").default(0),

  // Historical change percentages
  monthlyChangePercent: real("monthly_change_percent").default(0),
  yearlyChangePercent: real("yearly_change_percent").default(0),

  // Chart data stored as JSON array
  chartData: text("chart_data").notNull(), // JSON array of close prices

  // Cache metadata
  lastFetched: integer("last_fetched", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
