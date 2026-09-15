// tradingview-mcp-server.js

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const DEFAULT_RANGE = [0, 50];
const URL = 'https://scanner.tradingview.com/{market}/scan';
const HEADERS = {
    'accept': 'text/plain, */*; q=0.01',
    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'referer': 'https://www.tradingview.com/'
};

class Column {
    constructor(name) {
        this.name = name;
    }

    eq(value) {
        return { left: this.name, operation: 'equal', right: value };
    }

    gt(value) {
        return {
            left: this.name,
            operation: 'greater',
            right: value instanceof Column ? value.name : value
        };
    }

    gte(value) {
        return {
            left: this.name,
            operation: 'egreater',
            right: value instanceof Column ? value.name : value
        };
    }

    lt(value) {
        return {
            left: this.name,
            operation: 'less',
            right: value instanceof Column ? value.name : value
        };
    }

    lte(value) {
        return {
            left: this.name,
            operation: 'eless',
            right: value instanceof Column ? value.name : value
        };
    }

    between(left, right) {
        return {
            left: this.name,
            operation: 'in_range',
            right: [
                left instanceof Column ? left.name : left,
                right instanceof Column ? right.name : right
            ]
        };
    }

    isin(values) {
        return { left: this.name, operation: 'in_range', right: values };
    }
}

class SimpleQuery {
    constructor() {
        this.query = {
            markets: ['america'],
            symbols: { query: { types: [] }, tickers: [] },
            options: { lang: 'en' },
            columns: ['name', 'close', 'volume', 'market_cap_basic'],
            sort: { sortBy: 'Value.Traded', sortOrder: 'desc' },
            range: [...DEFAULT_RANGE]
        };
        this.url = 'https://scanner.tradingview.com/america/scan';
    }

    select(...columns) {
        this.query.columns = columns;
        return this;
    }

    where(...expressions) {
        this.query.filter = expressions;
        return this;
    }

    orderBy(column, ascending = true) {
        this.query.sort = {
            sortBy: column,
            sortOrder: ascending ? 'asc' : 'desc'
        };
        return this;
    }

    limit(limit) {
        this.query.range[1] = limit;
        return this;
    }

    setMarkets(...markets) {
        if (markets.length === 1) {
            this.url = URL.replace('{market}', markets[0]);
            this.query.markets = [markets[0]];
        } else {
            this.url = URL.replace('{market}', 'global');
            this.query.markets = markets;
        }
        return this;
    }

    setTickers(...tickers) {
        this.query.symbols.tickers = tickers;
        this.setMarkets();
        return this;
    }

    async execute() {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        try {
            const response = await fetch(this.url, {
                method: 'POST',
                headers: HEADERS,
                body: JSON.stringify(this.query),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const body = await response.text();
                throw new Error(`HTTP ${response.status}: ${body}`);
            }

            const json = await response.json();
            const rows = json.data.map(row => {
                const obj = { ticker: row.s };
                this.query.columns.forEach((col, idx) => {
                    obj[col] = row.d[idx];
                });
                return obj;
            });

            return {
                totalCount: json.totalCount,
                data: rows
            };
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
}

function col(name) {
    return new Column(name);
}

// MCP Server setup
const server = new Server(
    {
        name: 'tradingview-screener',
        version: '1.0.0',
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'screen_stocks',
                description: 'Screen stocks with custom filters and columns. Returns top matches from TradingView.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        columns: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Columns to return (e.g., ["close", "volume", "market_cap_basic", "RSI"])',
                            default: ['name', 'close', 'volume', 'market_cap_basic']
                        },
                        filters: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    column: { type: 'string' },
                                    operator: {
                                        type: 'string',
                                        enum: ['gt', 'gte', 'lt', 'lte', 'eq', 'between', 'isin']
                                    },
                                    value: {}
                                },
                                required: ['column', 'operator', 'value']
                            },
                            description: 'Filter conditions'
                        },
                        orderBy: {
                            type: 'string',
                            description: 'Column to sort by'
                        },
                        ascending: {
                            type: 'boolean',
                            default: false,
                            description: 'Sort order'
                        },
                        limit: {
                            type: 'number',
                            default: 50,
                            description: 'Max results to return'
                        },
                        market: {
                            type: 'string',
                            default: 'america',
                            description: 'Market to scan (america, italy, crypto, forex, etc.)'
                        }
                    }
                }
            },
            {
                name: 'get_ticker_data',
                description: 'Get current data for specific tickers',
                inputSchema: {
                    type: 'object',
                    properties: {
                        tickers: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Ticker symbols (e.g., ["NASDAQ:TSLA", "NYSE:GME"])'
                        },
                        columns: {
                            type: 'array',
                            items: { type: 'string' },
                            default: ['name', 'close', 'volume', 'VWAP', 'market_cap_basic']
                        }
                    },
                    required: ['tickers']
                }
            },
            {
                name: 'find_top_gainers',
                description: 'Find top gaining stocks by change percent',
                inputSchema: {
                    type: 'object',
                    properties: {
                        limit: {
                            type: 'number',
                            default: 20,
                            description: 'Number of results'
                        },
                        minVolume: {
                            type: 'number',
                            description: 'Minimum volume filter'
                        },
                        minPrice: {
                            type: 'number',
                            description: 'Minimum price filter'
                        }
                    }
                }
            },
            {
                name: 'find_high_volume',
                description: 'Find stocks with high relative volume',
                inputSchema: {
                    type: 'object',
                    properties: {
                        minRelativeVolume: {
                            type: 'number',
                            default: 2.0,
                            description: 'Minimum relative volume (e.g., 2.0 = 200% of average)'
                        },
                        limit: {
                            type: 'number',
                            default: 50
                        }
                    }
                }
            },
            {
                name: 'technical_scan',
                description: 'Scan stocks based on technical indicators (RSI, MACD, moving averages)',
                inputSchema: {
                    type: 'object',
                    properties: {
                        rsiMin: { type: 'number', description: 'Min RSI value' },
                        rsiMax: { type: 'number', description: 'Max RSI value' },
                        macdPositive: { type: 'boolean', description: 'MACD above signal' },
                        priceAboveEMA20: { type: 'boolean', description: 'Price above 20 EMA' },
                        limit: { type: 'number', default: 50 }
                    }
                }
            }
        ]
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        switch (name) {
            case 'screen_stocks': {
                const query = new SimpleQuery();

                if (args.columns?.length) {
                    query.select(...args.columns);
                }

                if (args.market) {
                    query.setMarkets(args.market);
                }

                if (args.filters?.length) {
                    const expressions = args.filters.map(f => {
                        const column = col(f.column);
                        switch (f.operator) {
                            case 'gt': return column.gt(f.value);
                            case 'gte': return column.gte(f.value);
                            case 'lt': return column.lt(f.value);
                            case 'lte': return column.lte(f.value);
                            case 'eq': return column.eq(f.value);
                            case 'between': return column.between(f.value[0], f.value[1]);
                            case 'isin': return column.isin(f.value);
                            default: throw new Error(`Unknown operator: ${f.operator}`);
                        }
                    });
                    query.where(...expressions);
                }

                if (args.orderBy) {
                    query.orderBy(args.orderBy, args.ascending ?? false);
                }

                if (args.limit) {
                    query.limit(args.limit);
                }

                const result = await query.execute();

                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }]
                };
            }

            case 'get_ticker_data': {
                const query = new SimpleQuery()
                    .setTickers(...args.tickers)
                    .select(...(args.columns || ['name', 'close', 'volume', 'VWAP', 'market_cap_basic']));

                const result = await query.execute();

                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }]
                };
            }

            case 'find_top_gainers': {
                const query = new SimpleQuery()
                    .select('name', 'close', 'change', 'volume', 'market_cap_basic')
                    .orderBy('change', false)
                    .limit(args.limit || 20);

                const filters = [];
                if (args.minVolume) {
                    filters.push(col('volume').gte(args.minVolume));
                }
                if (args.minPrice) {
                    filters.push(col('close').gte(args.minPrice));
                }

                if (filters.length) {
                    query.where(...filters);
                }

                const result = await query.execute();

                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }]
                };
            }

            case 'find_high_volume': {
                const query = new SimpleQuery()
                    .select('name', 'close', 'volume', 'relative_volume_10d_calc', 'change')
                    .where(col('relative_volume_10d_calc').gte(args.minRelativeVolume || 2.0))
                    .orderBy('relative_volume_10d_calc', false)
                    .limit(args.limit || 50);

                const result = await query.execute();

                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }]
                };
            }

            case 'technical_scan': {
                const filters = [];

                if (args.rsiMin !== undefined) {
                    filters.push(col('RSI').gte(args.rsiMin));
                }
                if (args.rsiMax !== undefined) {
                    filters.push(col('RSI').lte(args.rsiMax));
                }
                if (args.macdPositive) {
                    filters.push(col('MACD.macd').gte(col('MACD.signal')));
                }
                if (args.priceAboveEMA20) {
                    filters.push(col('close').gte(col('EMA20')));
                }

                const query = new SimpleQuery()
                    .select('name', 'close', 'volume', 'RSI', 'MACD.macd', 'EMA20', 'change')
                    .where(...filters)
                    .limit(args.limit || 50);

                const result = await query.execute();

                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }]
                };
            }

            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error) {
        return {
            content: [{
                type: 'text',
                text: `Error: ${error.message}`
            }],
            isError: true
        };
    }
});

// Start server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('TradingView MCP Server running on stdio');
}

main().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
});
