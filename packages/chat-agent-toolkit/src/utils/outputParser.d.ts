/**
 * @module agent-toolkit/utils/outputParser
 * @description Parsers that extract values from XML-tagged sections of LLM
 * output (e.g. `<links>...</links>`, `<question>...</question>`).
 */
interface LineListOutputParserArgs {
    key?: string;
}
export declare class LineListOutputParser {
    private key;
    constructor(args?: LineListOutputParserArgs);
    parse(text: string): Promise<string[]>;
}
interface LineOutputParserArgs {
    key?: string;
}
export declare class LineOutputParser {
    private key;
    constructor(args?: LineOutputParserArgs);
    parse(text: string): Promise<string | undefined>;
}
export default LineOutputParser;
