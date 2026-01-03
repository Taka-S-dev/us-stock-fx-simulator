// tests/aggregate.test.js
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { aggregatePurchases } from "../public/model/calc.js";

function truncToDigits(x, digits) {
  const m = 10 ** digits;
  return Math.trunc(x * m) / m; // 某証券表示(切り捨て想定)
}

describe("aggregatePurchases", () => {
  it("aggregates qty / costs / averages (basic)", () => {
    const purchases = [
      { fx: 150, price: 100, qty: 2 },
      { fx: 160, price: 110, qty: 1 },
    ];

    const r = aggregatePurchases(purchases);

    expect(r.totalQty).toBe(3);
    expect(r.totalCostYen).toBeCloseTo(150 * 100 * 2 + 160 * 110 * 1, 10);
    expect(r.totalCostUsd).toBeCloseTo(100 * 2 + 110 * 1, 10);

    // 加重平均（USD）: 実装に依存しない定義で検証する
    const avgPriceUsd = r.totalCostUsd / r.totalQty;
    expect(avgPriceUsd).toBeCloseTo((100 * 2 + 110) / 3, 10);
  });

  it("supports optional feeYen / feeUsd if you want to match broker statements", () => {
    const purchases = [
      { fx: 150, price: 100, qty: 3, feeYen: 100, feeUsd: 1.25 },
    ];

    const r = aggregatePurchases(purchases);

    expect(r.totalQty).toBe(3);
    expect(r.totalCostYen).toBeCloseTo(150 * 100 * 3 + 100, 8);
    expect(r.totalCostUsd).toBeCloseTo(100 * 3 + 1.25, 8);
  });
});

// Note: fixture-driven reconciliation tests are covered in display_* tests.
