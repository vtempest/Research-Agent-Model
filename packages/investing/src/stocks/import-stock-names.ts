/*
# US Stock Symbols & Names Index

Fetch the latest data from offical APIs of NASDAQ, NYSE, and AMEX.

## Output
  \`\`\`json
  [
    ["AAPL", "Apple Inc.", 1, 5, 3000000, 320193],
    ["MSFT", "Microsoft Corporation", 1, 6, 2800000, 789019],
    ...
  ]
  \`\`\`
  Fields: [symbol, name, sectorId, industryId, marketCap, cik]

## Sectors & Industries Mapping
  Stored in data/sectors-industries.json with numeric IDs for space efficiency
*/

import fs from 'fs';

const OUTPUT_FILE = 'data/stock-names.json';
const MAPPING_FILE = 'data/sectors-industries.json';

// Configuration for output fields
// 'symbol' is the ticker
// 'name' is the company name (will be cleaned)
// 'sectorId' is the numeric ID of the sector (from mapping file)
// 'industryId' is the numeric ID of the industry (from mapping file)
// 'marketCap' is market cap in millions
// 'cik' is the SEC Central Index Key
// Other available fields from API: lastsale, netchange, pctchange, marketCap, country, ipoyear, volume, sector, industry, url
const CONFIG = {
    fields: ['symbol', 'name', 'industryId', 'marketCap', 'cik']
};

const SEC_URL = 'https://www.sec.gov/files/company_tickers.json';
const TRADINGVIEW_URL = 'https://scanner.tradingview.com/america/scan';

/*
TradingView Response Format:
{"totalCount":19641,"data":[{"s":"NYSE:MIAX","d":[]},{"s":"NASDAQ:BSMQ","d":[]},{"s":"OTC:AUCUF","d":[]},...]}
*/
const EXCHANGES = ['nasdaq', 'nyse', 'amex'];
const BASE_URL = 'https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=25&offset=0&download=true';

const includeCompaniesPerIndustry = 0;

const SUFFIXES = [
    " American Depositary Shares",
    " Depositary Shares",
    " Ordinary Shares",
    " Common Stock",
    " Common Shares",
    " Capital Stock",
    " Units",
    " Warrants",
    " Warrant",
    " Rights",
    " Preferred Stock",
    " Preferred Shares",
    " Depositary Share", // Singular
    " Ordinary Share",   // Singular
    " Common Share"      // Singular
];

const cleanName = (name: string) => {
    let cleaned = name;
    for (const suffix of SUFFIXES) {
        // Escape special regex chars if any (though our list is simple text)
        // We want to match the suffix and anything after it (.*)
        // Case insensitive match "i" to catch "ordinary share" vs "Ordinary Share"
        const regex = new RegExp(suffix + ".*$", "i");
        if (regex.test(cleaned)) {
            cleaned = cleaned.replace(regex, "");
            break; // Stop after first match to avoid over-cleaning?
                   // Usually one main asset type per name.
        }
    }
    return cleaned;
};

const formatMarketCap = (cap: string | number) => {
    if (!cap) return 0;
    // Remove ',' and '$' if present, then parse
    const num = parseFloat(String(cap).replace(/,/g, '').replace(/\$/g, ''));
    if (isNaN(num)) return 0;
    // Round to millions
    return Math.round(num / 1000000);
};

// Load existing sector/industry mappings or create new ones
function loadMappings() {
    interface Mapping {
        sectors: { [key: string]: number };
        industries: { [key: string]: number };
        sectorsReverse: { [key: number]: string };
        industriesReverse: { [key: number]: string };
        industryToSector: { [key: number]: number };
    }

    if (fs.existsSync(MAPPING_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf-8'));
            console.log(`Loaded existing mappings: ${Object.keys(data.sectors || {}).length} sectors, ${Object.keys(data.industries || {}).length} industries`);

            // Create reverse lookups for ID assignment
            const sectorsReverse: { [key: number]: string } = {};
            const industriesReverse: { [key: number]: string } = {};

            for (const [name, id] of Object.entries(data.sectors || {})) {
                sectorsReverse[id as number] = name;
            }
            for (const [name, id] of Object.entries(data.industries || {})) {
                industriesReverse[id as number] = name;
            }

            return {
                sectors: data.sectors || {},
                industries: data.industries || {},
                sectorsReverse,
                industriesReverse,
                industryToSector: data.industryToSector || {}
            };
        } catch (err) {
            console.warn('Error loading existing mappings, starting fresh:', err);
        }
    }

    return {
        sectors: {},
        industries: {},
        sectorsReverse: {},
        industriesReverse: {},
        industryToSector: {}
    };
}

// Get or assign ID for a sector/industry
function getOrAssignId(
    name: string,
    mapping: { [key: string]: number },
    reverse: { [key: number]: string }
): number {
    if (mapping[name]) {
        return mapping[name];
    }

    // Find next available ID
    const existingIds = Object.values(mapping);
    const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;

    mapping[name] = nextId;
    reverse[nextId] = name;

    return nextId;
}

async function fetchTradingViewSymbols() {
    const options = {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:85.0) Gecko/20100101 Firefox/85.0',
            'Content-Type': 'application/json'
        }
    };

    try {
        console.log('Fetching symbols from TradingView...');
        const response = await fetch(TRADINGVIEW_URL, options);
        if (!response.ok) {
            throw new Error(`TradingView request failed. Status Code: ${response.status}`);
        }
        const data = await response.json();

        // Parse symbols in format "EXCHANGE:TICKER" and filter for NYSE, NASDAQ, AMEX only
        const symbolSet = new Set<string>();
        if (data.data && Array.isArray(data.data)) {
            data.data.forEach((item: any) => {
                if (item.s) {
                    const [exchange, ticker] = item.s.split(':');
                    // Filter for main US exchanges only (exclude OTC, CBOE, etc.)
                    if (exchange && ticker && ['NYSE', 'NASDAQ', 'AMEX'].includes(exchange.toUpperCase())) {
                        symbolSet.add(ticker);
                    }
                }
            });
        }

        console.log(`Fetched ${symbolSet.size} symbols from TradingView (NYSE, NASDAQ, AMEX only)`);
        console.log(`Total count from TradingView: ${data.totalCount || 0}`);
        return symbolSet;
    } catch (err) {
        console.error('Error fetching TradingView symbols:', err);
        return new Set<string>(); // Return empty set on error
    }
}

async function fetchData(exchange: string) {
    const url = `${BASE_URL}&exchange=${exchange}`;
    const options = {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:85.0) Gecko/20100101 Firefox/85.0'
        }
    };

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`Request failed. Status Code: ${response.status}`);
        }
        return await response.json();
    } catch (err) {
        console.error(`Error fetching ${exchange}:`, err);
        return null; // Return null on error so Promise.all doesn't reject entirely if we handle it
    }
}

async function fetchSecData() {
    const SEC_FILE = 'data/company_tickers.json';

    try {
        console.log('Loading SEC CIK data from local file...');

        // Check if file exists
        if (!fs.existsSync(SEC_FILE)) {
            console.warn(`SEC data file not found: ${SEC_FILE}`);
            console.warn('Skipping CIK data. Download from: https://www.sec.gov/files/company_tickers.json');
            return { tickerToCik: new Map(), secCompanies: new Map() };
        }

        const fileContent = fs.readFileSync(SEC_FILE, 'utf-8');
        const data = JSON.parse(fileContent);

        // Parse SEC data: {"0": {"cik_str": 1045810, "ticker": "NVDA", "title": "NVIDIA CORP"}, ...}
        const tickerToCik = new Map();
        const secCompanies = new Map();

        Object.values(data).forEach((item: any) => {
            if (item.ticker && item.cik_str) {
                tickerToCik.set(item.ticker, item.cik_str);
                secCompanies.set(item.ticker, {
                    ticker: item.ticker,
                    name: item.title,
                    cik: item.cik_str
                });
            }
        });

        console.log(`Loaded ${tickerToCik.size} SEC tickers with CIK numbers from local file`);
        return { tickerToCik, secCompanies };
    } catch (err) {
        console.error('Error loading SEC data:', err);
        return { tickerToCik: new Map(), secCompanies: new Map() };
    }
}

async function main() {
    try {
        console.log('Fetching stock data...');

        // Ensure output directory exists
        if (!fs.existsSync('data')) {
            fs.mkdirSync('data');
        }

        // Load existing mappings
        const mappings = loadMappings();

        // Fetch TradingView symbols, NASDAQ data, and SEC data concurrently
        const [tradingViewSymbols, nasdaqResults, secData] = await Promise.all([
            fetchTradingViewSymbols(),
            Promise.all(EXCHANGES.map(fetchData)),
            fetchSecData()
        ]);

        const { tickerToCik, secCompanies } = secData;

        const allRows: any[] = [];
        nasdaqResults.forEach(result => {
             if (result && result.data && result.data.rows) {
                 allRows.push(...result.data.rows);
             }
         });

        console.log(`Fetched ${allRows.length} total rows from NASDAQ/NYSE/AMEX.`);

        // Create a map of NASDAQ data keyed by symbol for quick lookup
        const nasdaqDataMap = new Map();
        allRows.forEach(row => {
            if (row.symbol) {
                nasdaqDataMap.set(row.symbol.trim(), row);
            }
        });

        const uniqueTickers = new Map();

        // Process TradingView symbols as the core index
        tradingViewSymbols.forEach(symbol => {
            if (!uniqueTickers.has(symbol)) {
                const nasdaqData = nasdaqDataMap.get(symbol);
                const cik = tickerToCik.get(symbol) || 0;

                if (nasdaqData) {
                    // Use NASDAQ data if available
                    const sectorName = nasdaqData.sector ? String(nasdaqData.sector).trim() : 'Unknown';
                    const industryName = nasdaqData.industry ? String(nasdaqData.industry).trim() : 'Unknown';

                    const sectorId = getOrAssignId(sectorName, mappings.sectors, mappings.sectorsReverse);
                    const industryId = getOrAssignId(industryName, mappings.industries, mappings.industriesReverse);

                    // Map industry to sector
                    mappings.industryToSector[industryId] = sectorId;

                    const entry = CONFIG.fields.map(field => {
                        if (field === 'symbol') return symbol;
                        if (field === 'name') return cleanName(nasdaqData.name ? nasdaqData.name.trim() : '');
                        if (field === 'industryId') return industryId;
                        if (field === 'marketCap') return formatMarketCap(nasdaqData.marketCap);
                        if (field === 'cik') return cik;
                        return (nasdaqData as any)[field];
                    });
                    uniqueTickers.set(symbol, entry);
                } else {
                    // Symbol from TradingView but no NASDAQ data - add with minimal info
                    const secCompany = secCompanies.get(symbol);
                    const sectorId = getOrAssignId('Unknown', mappings.sectors, mappings.sectorsReverse);
                    const industryId = getOrAssignId('Unknown', mappings.industries, mappings.industriesReverse);

                    // Map industry to sector
                    mappings.industryToSector[industryId] = sectorId;

                    const entry = CONFIG.fields.map(field => {
                        if (field === 'symbol') return symbol;
                        if (field === 'name') return secCompany ? cleanName(secCompany.name) : symbol;
                        if (field === 'industryId') return industryId;
                        if (field === 'marketCap') return 0;
                        if (field === 'cik') return cik;
                        return 0;
                    });
                    uniqueTickers.set(symbol, entry);
                }
            }
        });

        console.log(`Total unique tickers from TradingView core index: ${uniqueTickers.size}`);
        console.log(`Tickers with NASDAQ data: ${Array.from(uniqueTickers.values()).filter((v: any) => v[3] !== 0 && v[3] !== null).length}`);
        console.log(`Total sectors: ${Object.keys(mappings.sectors).length}`);
        console.log(`Total industries: ${Object.keys(mappings.industries).length}`);
        console.log(`Industry-to-Sector mappings: ${Object.keys(mappings.industryToSector).length}`);
        console.log(`Output fields: ${JSON.stringify(CONFIG.fields)}`);

        // Save the mappings file with industry-to-sector mapping
        fs.writeFileSync(MAPPING_FILE, JSON.stringify({
            sectors: mappings.sectors,
            industries: mappings.industries,
            industryToSector: mappings.industryToSector
        }, null, 2));
        console.log(`Successfully wrote mappings to ${MAPPING_FILE}`);

        // Convert map values to array and sort by the first field (usually symbol)
        const outputList = Array.from(uniqueTickers.values())
            .sort((a, b) => {
                const valA = String(a[0] || '');
                const valB = String(b[0] || '');
                return valA.localeCompare(valB);
            });

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(outputList));
        console.log(`Successfully wrote ${outputList.length} stocks to ${OUTPUT_FILE}`);

        // Generate sector info
        // entry indices based on CONFIG: 0=symbol, 1=name, 2=industryId, 3=marketCap, 4=cik
        const sectorInfo: Record<string, any> = {};
        const overallInfo: any = {
             sector: "Overall US Public Stocks",
             totalCompanies: 0,
             totalMarketCap: 0,
             industries: {},
             companies: []
        };

        outputList.forEach(item => {
            const symbol = item[0];
            const name = item[1];
            const industryId = item[2];
            const marketCap = typeof item[3] === 'number' ? item[3] : 0;
            // item[4] is CIK, not needed for sector aggregation

            // Calculate sector from industryId using industryToSector mapping
            const sectorId = mappings.industryToSector[industryId] || 0;

            // Get actual names from reverse mapping
            const sector = mappings.sectorsReverse[sectorId] || 'Unknown';
            const industry = mappings.industriesReverse[industryId] || 'Unknown';

            // Sector aggregation
            if (!sectorInfo[sector]) {
                sectorInfo[sector] = {
                    totalCompanies: 0,
                    totalMarketCap: 0,
                    industries: {}, // Changed to object
                    companies: []
                };
            }
            sectorInfo[sector].totalCompanies++;
            sectorInfo[sector].totalMarketCap += marketCap;

            // Sector Industry aggregation
            if (!sectorInfo[sector].industries[industry]) {
                sectorInfo[sector].industries[industry] = {
                    name: industry,
                    totalCompanies: 0,
                    totalMarketCap: 0,
                    leader: { symbol: symbol, name: name, _marketCap: marketCap }
                };
            }
            sectorInfo[sector].industries[industry].totalCompanies++;
            sectorInfo[sector].industries[industry].totalMarketCap += marketCap;

            // Update leader if this company has higher market cap
            if (marketCap > sectorInfo[sector].industries[industry].leader._marketCap) {
                sectorInfo[sector].industries[industry].leader = { symbol: symbol, name: name, _marketCap: marketCap };
            }

            if(includeCompaniesPerIndustry) {
                if (!sectorInfo[sector].industries[industry].symbols) {
                    sectorInfo[sector].industries[industry].symbols = [];
                }
                sectorInfo[sector].industries[industry].symbols.push(symbol);

               sectorInfo[sector].companies.push({ symbol, name, marketCap });
            }

            // Overall aggregation
            overallInfo.totalCompanies++;
            overallInfo.totalMarketCap += marketCap;

            // Overall Industry aggregation (Keep calculating if we ever need it, but we won't output it for Overall)
            /*
            if (!overallInfo.industries[industry]) {
                overallInfo.industries[industry] = {
                    name: industry,
                    totalCompanies: 0,
                    totalMarketCap: 0
                };
            }
            overallInfo.industries[industry].totalCompanies++;
            overallInfo.industries[industry].totalMarketCap += marketCap;
            */

            overallInfo.companies.push({ symbol, name, marketCap });
        });

        const processInfo = (info: any, sectorName: string, includeIndustries = true) => {
             // Sort companies by market cap desc
            info.companies.sort((a: any, b: any) => b.marketCap - a.marketCap);

            // Top 10
            const top10 = info.companies.slice(0, 10);

            // Process and sort industries
            let industriesList = [] as any;
            if (includeIndustries) {
                industriesList = Object.values(info.industries)
                    .sort((a: any, b: any) => b.totalMarketCap - a.totalMarketCap)
                    .map((industry: any) => {
                        // Remove _marketCap from leader and return clean industry object
                        const { _marketCap, ...leaderWithoutMarketCap } = industry.leader || {};
                        return {
                            ...industry,
                            leader: leaderWithoutMarketCap
                        };
                    });
            }

            const result: any = {
                sector: sectorName,
                totalCompanies: info.totalCompanies,
                totalMarketCap: info.totalMarketCap,
                top10Companies: top10,
            };

            if (includeIndustries) {
                result.industries = industriesList;
            }

            return result;
        };

        const finalSectorOutput = Object.keys(sectorInfo).map(sector => processInfo(sectorInfo[sector], sector, true));

        // Sort sectors by Total Market Cap descending
        finalSectorOutput.sort((a, b) => b.totalMarketCap - a.totalMarketCap);

        // Add Overall entry at the top, without industries
        finalSectorOutput.unshift(processInfo(overallInfo, "Overall US Public Stocks", false));

        const OUTPUT_FILE_SECTORS = 'data/sector-info.json';
        fs.writeFileSync(OUTPUT_FILE_SECTORS, JSON.stringify(finalSectorOutput, null, 2)); // Pretty print for readability
        console.log(`Successfully wrote to ${OUTPUT_FILE_SECTORS}`);

    } catch (err) {
        console.error('An error occurred:', err);
        process.exit(1);
    }
}

main();
