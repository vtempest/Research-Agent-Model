// SEC EDGAR Filing Downloader
// Migrated from JavaScript to TypeScript

import axios from 'axios';
import type {
    FilingMetadata,
    Ticker,
    RequestedFilings,
    CompanyAndAccessionNumber,
    TickerToCikMapping,
    FilingOptions
} from './types';

const AMENDS_SUFFIX = '/A';
const CIK_LENGTH = 10;
const SUBMISSION_FILE_FORMAT = 'CIK{cik}.json';
const URL_SUBMISSIONS = 'https://data.sec.gov/submissions/{submission}';
const accessionNumberRe = /^\d{10}-\d{2}-\d{6}$/;

export class Downloader {
    private companyName: string;
    private emailAddress: string;
    private _tickerToCikMapping: TickerToCikMapping | null = null;
    private _initPromise: Promise<void> | null = null;

    constructor(companyName: string, emailAddress: string) {
        this.companyName = companyName;
        this.emailAddress = emailAddress;
    }

    get userAgent(): string {
        return `${this.companyName} ${this.emailAddress}`;
    }

    async init(): Promise<void> {
        if (!this._initPromise) {
            this._initPromise = this._loadTickerToCikMapping();
        }
        return this._initPromise;
    }

    private async _loadTickerToCikMapping(): Promise<void> {
        if (!this._tickerToCikMapping) {
            this._tickerToCikMapping = await getTickerToCikMapping(this.userAgent);
        }
    }

    async getFilingMetadatas(
        query: string | RequestedFilings | CompanyAndAccessionNumber,
        options: FilingOptions = {}
    ): Promise<FilingMetadata[]> {
        await this.init();

        const { includeAmends = false } = options;

        if (typeof query === 'string') {
            const companyAndAccession = CompanyAndAccessionNumberClass.fromString(query, false);
            if (companyAndAccession) {
                query = companyAndAccession;
            }
        }

        if (query instanceof CompanyAndAccessionNumberClass) {
            return [
                await getFilingMetadata({
                    tickerOrCik: query.tickerOrCik,
                    accessionNumber: query.accessionNumber,
                    userAgent: this.userAgent,
                    tickerToCikMapping: this._tickerToCikMapping!,
                    includeAmends
                })
            ];
        }

        if (typeof query === 'string') {
            query = RequestedFilingsClass.fromString(query);
        }

        if (query instanceof RequestedFilingsClass) {
            return await getLatestFilingsMetadata({
                requested: query,
                userAgent: this.userAgent,
                tickerToCikMapping: this._tickerToCikMapping!,
                includeAmends
            });
        }

        throw new Error(`Invalid input: ${query}`);
    }

    async downloadFiling({ url }: { url: string }): Promise<Buffer> {
        return await downloadFiling(url, this.userAgent);
    }

    async getFilingHtml(options: {
        query?: string;
        ticker?: string;
        form?: string;
    } = {}): Promise<Buffer> {
        let { query, ticker, form } = options;

        if (query && (ticker || form)) {
            throw new Error('Error: Ticker or form should not be provided when query is specified.');
        }

        if ((ticker || form) && query) {
            throw new Error('Error: Query should not be provided when ticker or form is specified.');
        }

        if (ticker || form) {
            query = `${ticker}/${form}`;
        }

        if (!query) {
            throw new Error('Error: Either query or ticker and form must be specified.');
        }

        const metadatas = await this.getFilingMetadatas(query);

        if (metadatas.length === 0) {
            throw new Error(`Could not find filing for ${query}`);
        }

        if (metadatas.length > 1) {
            throw new Error(
                `Found multiple filings for ${query}. Use 'getFilingMetadatas()' and 'downloadFiling()' instead.`
            );
        }

        const html = await this.downloadFiling({ url: metadatas[0].primaryDocUrl });
        return html;
    }
}

// Helper classes
export class RequestedFilingsClass implements RequestedFilings {
    tickerOrCik: string;
    formType: string;
    limit: number | null;

    constructor(tickerOrCik: string, formType: string, limit: number | null = null) {
        this.tickerOrCik = tickerOrCik;
        this.formType = formType;
        this.limit = limit;
    }

    static fromString(queryString: string): RequestedFilingsClass {
        const parts = queryString.split('/');
        if (parts.length < 2) {
            throw new Error(`Invalid query string format: ${queryString}`);
        }
        const [tickerOrCik, formType, limitStr] = parts;
        const limit = limitStr ? parseInt(limitStr) : null;
        return new RequestedFilingsClass(tickerOrCik, formType, limit);
    }
}

export class CompanyAndAccessionNumberClass implements CompanyAndAccessionNumber {
    tickerOrCik: string;
    accessionNumber: string;

    constructor(tickerOrCik: string, accessionNumber: string) {
        this.tickerOrCik = tickerOrCik;
        this.accessionNumber = accessionNumber;
    }

    static fromString(queryString: string, mustMatch = true): CompanyAndAccessionNumberClass | null {
        const parts = queryString.split('/');
        if (parts.length === 2) {
            const [tickerOrCik, accessionNumber] = parts;
            if (accessionNumberRe.test(accessionNumber) || accessionNumber.length === 18) {
                return new CompanyAndAccessionNumberClass(tickerOrCik, accessionNumber);
            }
        }
        if (mustMatch) {
            throw new Error(`Invalid company and accession number format: ${queryString}`);
        }
        return null;
    }
}

// Utility functions
function validateAndConvertTickerOrCik(
    tickerOrCik: string,
    tickerToCikMapping: TickerToCikMapping
): string {
    if (/^\d+$/.test(tickerOrCik)) {
        return tickerOrCik.padStart(CIK_LENGTH, '0');
    }

    const cik = tickerToCikMapping[tickerOrCik.toUpperCase()];
    if (!cik) {
        throw new Error(`Could not find CIK for ticker: ${tickerOrCik}`);
    }
    return cik.padStart(CIK_LENGTH, '0');
}

async function getTickerToCikMapping(userAgent: string): Promise<TickerToCikMapping> {
    try {
        // Try local file first
        const fs = await import('fs/promises');
        const path = await import('path');
        const filePath = path.join(__dirname, '../data', 'company_tickers.json');
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(fileContent);

        const tickerMapping: TickerToCikMapping = {};

        if (Array.isArray(data)) {
            for (const row of data) {
                if (row && row.length >= 3 && row[0] && row[2]) {
                    const cik = String(row[0]).padStart(CIK_LENGTH, '0');
                    const ticker = row[2].toUpperCase();
                    tickerMapping[ticker] = cik;
                }
            }
        }

        return tickerMapping;
    } catch (error) {
        // Fallback to SEC API
        const url = 'https://www.sec.gov/files/company_tickers.json';
        const response = await axios.get(url, {
            headers: { 'User-Agent': userAgent }
        });

        const tickerMapping: TickerToCikMapping = {};
        const data = response.data;

        for (const key in data) {
            const company = data[key];
            if (company.ticker && company.cik_str) {
                const cik = String(company.cik_str).padStart(CIK_LENGTH, '0');
                const ticker = company.ticker.toUpperCase();
                tickerMapping[ticker] = cik;
            }
        }

        return tickerMapping;
    }
}

async function downloadFiling(url: string, userAgent: string): Promise<Buffer> {
    try {
        const response = await axios.get(url, {
            headers: { 'User-Agent': userAgent },
            responseType: 'arraybuffer'
        });
        return Buffer.from(response.data);
    } catch (error) {
        throw new Error(`Failed to download filing from ${url}: ${error}`);
    }
}

async function getFilingMetadata(options: {
    tickerOrCik: string;
    accessionNumber: string;
    userAgent: string;
    tickerToCikMapping: TickerToCikMapping;
    includeAmends: boolean;
}): Promise<FilingMetadata> {
    const { tickerOrCik, accessionNumber, userAgent, tickerToCikMapping, includeAmends } = options;

    let cleanAccessionNumber = accessionNumber;
    if (accessionNumber.length === 18) {
        cleanAccessionNumber = `${accessionNumber.slice(0, 10)}-${accessionNumber.slice(10, 12)}-${accessionNumber.slice(12)}`;
    }

    if (!accessionNumberRe.test(cleanAccessionNumber)) {
        throw new Error(`Invalid Accession Number: ${accessionNumber}`);
    }

    const cik = validateAndConvertTickerOrCik(tickerOrCik, tickerToCikMapping);
    const result = await getMetadatas({
        cik,
        userAgent,
        limit: 1,
        accessionNumber: cleanAccessionNumber,
        includeAmends
    });

    if (result.length === 0) {
        throw new Error(`Could not find filing for ${accessionNumber}`);
    }

    return result[0];
}

async function getLatestFilingsMetadata(options: {
    requested: RequestedFilingsClass;
    userAgent: string;
    tickerToCikMapping: TickerToCikMapping;
    includeAmends: boolean;
}): Promise<FilingMetadata[]> {
    const { requested, userAgent, tickerToCikMapping, includeAmends } = options;

    const cik = validateAndConvertTickerOrCik(requested.tickerOrCik, tickerToCikMapping);

    let limit: number;
    if (requested.limit === null) {
        limit = Number.MAX_SAFE_INTEGER;
    } else {
        limit = parseInt(String(requested.limit));
        if (limit < 1) {
            throw new Error('Invalid amount. Please enter a number greater than 1.');
        }
    }

    return await getMetadatas({
        cik,
        userAgent,
        limit,
        tickerOrCik: requested.tickerOrCik,
        formType: requested.formType,
        includeAmends
    });
}

async function getMetadatas(options: {
    cik: string;
    userAgent: string;
    limit: number;
    tickerOrCik?: string;
    accessionNumber?: string;
    formType?: string;
    includeAmends?: boolean;
}): Promise<FilingMetadata[]> {
    const {
        cik,
        userAgent,
        limit,
        tickerOrCik,
        accessionNumber,
        formType,
        includeAmends = false
    } = options;

    const submissionFile = SUBMISSION_FILE_FORMAT.replace('{cik}', cik);
    const submissionsUri = URL_SUBMISSIONS.replace('{submission}', submissionFile);

    const response = await axios.get(submissionsUri, {
        headers: { 'User-Agent': userAgent }
    });

    const respJson = response.data;
    const filingsJson = respJson.filings.recent;
    const foundMetadatas: FilingMetadata[] = [];

    const accessionNumbers = filingsJson.accessionNumber || [];
    const primaryDocumentUrls = filingsJson.primaryDocument || [];
    const filingDates = filingsJson.filingDate || [];
    const reportDates = filingsJson.reportDate || [];
    const formTypes = filingsJson.form || [];

    for (let i = 0; i < accessionNumbers.length && foundMetadatas.length < limit; i++) {
        const thisAccessionNumber = accessionNumbers[i];
        const primaryDocFilename = primaryDocumentUrls[i];
        const filingDate = filingDates[i];
        const reportDate = reportDates[i];
        let thisFormType = formTypes[i];

        const isAmend = thisFormType.endsWith(AMENDS_SUFFIX);
        thisFormType = isAmend ? thisFormType.slice(0, -2) : thisFormType;

        if (
            (formType && formType !== thisFormType) ||
            (accessionNumber && accessionNumber !== thisAccessionNumber) ||
            (isAmend && !includeAmends)
        ) {
            continue;
        }

        const accessionNumberClean = thisAccessionNumber.replace(/-/g, '');
        const primaryDocUri = `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/${accessionNumberClean}/${primaryDocFilename}`;

        foundMetadatas.push({
            primaryDocUrl: primaryDocUri,
            accessionNumber: thisAccessionNumber,
            tickers: (respJson.tickers || []).map((ticker: string, idx: number) => ({
                symbol: ticker,
                exchange: respJson.exchanges?.[idx] || ''
            })),
            companyName: respJson.name,
            filingDate: filingDate,
            reportDate: reportDate,
            primaryDocDescription: '',
            items: '',
            formType: thisFormType,
            cik: String(respJson.cik).padStart(CIK_LENGTH, '0')
        });
    }

    return foundMetadatas;
}

export default Downloader;
