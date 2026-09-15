import { describe, it, expect } from "vitest";
import { normalizeChartQuotes } from "../src/stocks/yahoo-finance-wrapper";

/**
 * Regression tests for the "Yahoo Finance historical error for WMT" failure.
 *
 * yahoo-finance2's deprecated `historical()` helper throws
 * "Historical returned a result with SOME (but not all) null values" whenever
 * Yahoo returns a partially populated row. getHistorical() now goes through
 * `chart()` and normalizes those rows instead.
 */
describe("normalizeChartQuotes", () => {
  const fullRow = {
    date: new Date("2026-09-02T13:30:00Z"),
    open: 100,
    high: 105,
    low: 99,
    close: 104,
    adjclose: 103.5,
    volume: 1_000_000,
  };

  it("returns an empty array for missing or non-array input", () => {
    expect(normalizeChartQuotes(undefined)).toEqual([]);
    expect(normalizeChartQuotes(null as any)).toEqual([]);
    expect(normalizeChartQuotes([])).toEqual([]);
  });

  it("maps a complete row and renames adjclose to adjClose", () => {
    const [row] = normalizeChartQuotes([fullRow]);

    expect(row).toEqual({
      date: fullRow.date,
      open: 100,
      high: 105,
      low: 99,
      close: 104,
      adjClose: 103.5,
      volume: 1_000_000,
    });
  });

  it("keeps a partially populated row instead of throwing", () => {
    // The shape that broke WMT: a price but no volume/high/low yet.
    const rows = normalizeChartQuotes([
      fullRow,
      {
        date: new Date("2026-09-03T13:30:00Z"),
        open: null,
        high: null,
        low: null,
        close: 106,
        adjclose: null,
        volume: null,
      },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual({
      date: new Date("2026-09-03T13:30:00Z"),
      open: 106,
      high: 106,
      low: 106,
      close: 106,
      adjClose: 106,
      volume: 0,
    });
  });

  it("backfills missing high/low from the prices that are present", () => {
    const [row] = normalizeChartQuotes([
      {
        date: new Date("2026-09-03T13:30:00Z"),
        open: 110,
        high: null,
        low: null,
        close: 104,
        volume: 5,
      },
    ]);

    expect(row.high).toBe(110);
    expect(row.low).toBe(104);
    expect(row.adjClose).toBe(104);
  });

  it("drops rows with no usable price data or an invalid date", () => {
    const rows = normalizeChartQuotes([
      fullRow,
      {
        date: new Date("2026-09-03T13:30:00Z"),
        open: null,
        high: null,
        low: null,
        close: null,
        adjclose: null,
        volume: null,
      },
      { date: "not-a-date", close: 10 },
      null,
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].close).toBe(104);
  });

  it("ignores NaN/Infinity values coming back from the API", () => {
    const [row] = normalizeChartQuotes([
      { ...fullRow, volume: Number.NaN, high: Number.POSITIVE_INFINITY },
    ]);

    expect(row.volume).toBe(0);
    expect(row.high).toBe(104);
  });

  it("accepts epoch-style dates", () => {
    const ts = Date.UTC(2026, 8, 3, 13, 30);
    const [row] = normalizeChartQuotes([{ ...fullRow, date: ts }]);

    expect(row.date.getTime()).toBe(ts);
  });
});
