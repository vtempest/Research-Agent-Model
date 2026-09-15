import { afterAll, beforeAll, describe, it, expect } from "bun:test";
import { convertPDFToHTML } from "../src/pdf-to-html";
import { minimalPDFBuffer } from "./helpers/minimal-pdf";

const TIMEOUT = 30_000;

/**
 * Serves the fixture PDF from localhost for the URL case below.
 *
 * That test used to fetch https://www.africau.edu/images/default/sample.pdf.
 * The host now answers 403, so an unrelated third party going down turned the
 * whole extract-pdf suite red on every branch. Serving our own bytes still
 * drives the real URL branch of `convertPDFToHTML` — `grab()` fetches it as an
 * arraybuffer and the result goes through the same parser — without depending
 * on anything outside the repo.
 */
let pdfServer: ReturnType<typeof Bun.serve>;
let pdfUrl: string;

beforeAll(() => {
  const pdf = minimalPDFBuffer();

  // Port 0 asks the OS for a free port, so parallel test files cannot collide.
  pdfServer = Bun.serve({
    port: 0,
    fetch: () =>
      new Response(pdf, { headers: { "content-type": "application/pdf" } }),
  });

  pdfUrl = `http://localhost:${pdfServer.port}/sample.pdf`;
});

afterAll(() => {
  pdfServer?.stop(true);
});

describe("convertPDFToHTML", () => {
  it("returns html and format fields from a buffer", async () => {
    const result = (await convertPDFToHTML(minimalPDFBuffer())) as any;
    expect(result.error).toBeUndefined();
    expect(result.format).toBe("pdf");
    expect(typeof result.html).toBe("string");
    expect(result.html.length).toBeGreaterThan(0);
  }, TIMEOUT);

  it("html contains text extracted from the PDF", async () => {
    const result = (await convertPDFToHTML(minimalPDFBuffer())) as any;
    expect(result.html).toContain("Test Document");
    expect(result.html).toContain("sample paragraph");
  }, TIMEOUT);

  it("addPageNumbers inserts [1] marker", async () => {
    const result = (await convertPDFToHTML(minimalPDFBuffer(), {
      addPageNumbers: true,
    })) as any;
    expect(result.html).toMatch(/\[1\]/);
  }, TIMEOUT);

  it("addCitation: false returns html without extracting metadata", async () => {
    const result = (await convertPDFToHTML(minimalPDFBuffer(), {
      addCitation: false,
    })) as any;
    expect(typeof result.html).toBe("string");
    expect(result.html.length).toBeGreaterThan(0);
    expect(result.author).toBeUndefined();
    expect(result.title).toBeUndefined();
  }, TIMEOUT);

  it("returns error object for an invalid buffer", async () => {
    const bad = new Uint8Array([0x00, 0x01, 0x02, 0x03]).buffer;
    const result = await convertPDFToHTML(bad);
    expect(result).toHaveProperty("error");
  }, TIMEOUT);

  it("accepts a PDF by URL", async () => {
    const result = (await convertPDFToHTML(pdfUrl)) as any;
    expect(result.error).toBeUndefined();

    // Same assertions as the buffer case: fetching the bytes over HTTP must
    // land in the parser identically to handing them over directly.
    expect(result.format).toBe("pdf");
    expect(result.html).toContain("Test Document");
    expect(result.html).toContain("sample paragraph");
  }, TIMEOUT);
});
