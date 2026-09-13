/**
 * @module research/extractor/html-to-content/html-utils
 * @description Research library module.
 */
/**
 * Converts URL-safe escaped HTML codes like &"'`&rsquo; & to standard HTML or in reverse.
 * @param {string} str - The string to process.
 * @param {boolean} toStandardHTML  default=true - If true, converts url-safe codes
 * to standard HTML. If false, converts standard HTML to url-safe codes.
 * @return {string} The processed string.
 * @category HTML Utilities
 * @example
 * var normalHTML = convertURLSafeHTMLToHTML('&lt;p&gt;This &amp; that &copy; 2023 '+
 * '&quot;Quotes&quot;&#39;Apostrophes&#39; &euro;100 &#x263A;&lt;/p&gt;', true)
 * console.log(normalHTML) // "<p>This & that \u00a9 2023 "Quotes" 'Apostrophes' \u20ac100 \u263a</p>"
 */
export declare function convertURLSafeHTMLToHTML(str: any, toStandardHTML?: boolean): any;
/**
 * Convert relative URL to absolute URL using base URL.
 * @param {string} base base url of the domain
 * @param {string} relative partial urls like ../images/image.jpg #hash
 * @returns {string} absolute URL
 * @example
 * var absoluteURL = convertURLToAbsoluteURL('https://example.com', 'images/image.jpg')
 * console.log(absoluteURL) // Returns: "https://example.com/images/image.jpg"
 * var absoluteURL = convertURLToAbsoluteURL('https://example.com', '//images/image.jpg')
 * console.log(absoluteURL) // Returns: "https:images/image.jpg"
 * @category HTML Utilities
 * @author [vtempest (2025)](https://github.com/vtempest)
 */
export declare function convertURLToAbsoluteURL(base: any, relative: any): any;
/**
 * Converts Markdown text to HTML. It handles the following Markdown elements:
 * - Headers (h1 to h6)
 * - Bold text
 * - Italic text
 * - Unordered lists
 * - Ordered lists
 * - Paragraphs
 * - Images
 * - Links
 * - Code blocks
 * @param {string} content - The Markdown or HTML content to be converted.
 * @param {boolean} toHtml - default=true - If true, converts Markdown to HTML.
 *                          If false, converts HTML to Markdown.
 * @returns {string} The resulting HTML string.
 * @category HTML Utilities
 * @example
 * const markdown = "# Header\n\nThis is **bold** and *italic* text.\n\n* List item 1\n* List item 2";
 * const html = convertMarkdownToHTML(markdown);
 * console.log(html);
 * // Output:
 * // <h1>Header</h1>
 * // <p>This is <strong>bold</strong> and <em>italic</em> text.</p>
 * // <ul><li>List item 1</li><li>List item 2</li></ul>
 */
export declare function convertMarkdownToHTML(content: any, toHtml?: boolean): any;
/**
 * Detect whether a string is Markdown (rather than HTML or plain text) using
 * regexp checks. Content that is dominated by HTML tags is never treated as
 * Markdown, so real scraped pages pass through untouched; text needs at least
 * two distinct Markdown syntax signals (or several links/images in Markdown
 * form) to qualify. Used to catch scraper responses (e.g. the JINA reader or
 * proxies wrapping it) that return Markdown in place of HTML, so it can be
 * converted before main-content extraction — otherwise the article panel
 * renders raw `[text](url)` syntax.
 *
 * @param {string} text - The content to test.
 * @returns {boolean} True when the content should be parsed as Markdown.
 * @category HTML Utilities
 * @example
 * detectMarkdown("# Title\n\nSome **bold** text.") // true
 * detectMarkdown("<html><body><p>Hi</p></body></html>") // false
 */
export declare function detectMarkdown(text: any): boolean;
/**
 * Remove extra non-article content from a Markdown extraction using regexp
 * checks: JINA reader metadata lines, cookie/consent and navigation phrases,
 * and runs of consecutive link-only lines (menus, breadcrumbs, "related"
 * link farms) whose targets are mostly relative site navigation. Standalone
 * links inside prose are kept.
 *
 * @param {string} markdown - The Markdown content to clean.
 * @returns {string} The cleaned Markdown.
 * @category HTML Utilities
 * @example
 * removeMarkdownNavigation("Title: Page\n[Skip to content](#main)\nReal text")
 * // => "Real text"
 */
export declare function removeMarkdownNavigation(markdown: any): string;
/**
 * Convert a Markdown document to formatted HTML using regular expressions to
 * detect Markdown syntax. Unlike {@link convertMarkdownToHTML} (which relies on
 * the `marked` library), this is a dependency-free, self-contained converter
 * intended for post-processing content returned as Markdown (e.g. from the
 * JINA reader fallback in the scraper).
 *
 * Supported block elements: ATX headers (`#`..`######`), setext headers
 * (`===`/`---` underlines), fenced code blocks (```lang), blockquotes (`>`),
 * unordered lists (`-`, `*`, `+`), ordered lists (`1.`, `1)`), pipe tables,
 * horizontal rules (`---`, `***`, `___`) and paragraphs.
 * Supported inline elements: bold, italic, strikethrough, inline code, images,
 * links, linked images (`[![alt](src)](href)`) and autolinks (`<https://…>`).
 *
 * @param {string} markdown - The Markdown content to convert.
 * @returns {string} The resulting formatted HTML string.
 * @category HTML Utilities
 * @example
 * convertMarkdownToFormattedHTML("# Title\n\nSome **bold** text.");
 * // => "<h1>Title</h1>\n<p>Some <strong>bold</strong> text.</p>"
 */
export declare function convertMarkdownToFormattedHTML(markdown: any): string;
export declare function convertHTMLToMarkdown(html: any): any;
/**
 * Copy HTML to clipboard. When pasting into rich text field,
 * pastes rich text. When pasting into plain text field, pastes:
 * plain text, html, or markdown.
 *
 * @param {string} html - The HTML content to be copied.
 * @param {object} options - The options object.
 * @param {number} options.pastePlainFormat -
 * default=0
 * 0 - plain text
 * 1 - markdown
 * 2 - html
 * @returns {Promise<void>} - A promise that resolves when
 * the HTML is copied to the clipboard.
 * @category HTML Utilities
 * @author [vtempest (2025)](https://github.com/vtempest)
 */
export declare function copyHTMLToClipboard(html: any, options?: {}): Promise<void>;
