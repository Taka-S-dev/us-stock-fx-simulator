import { describe, it, expect } from "vitest";
import { calculateGraphData } from "../public/model/calc.js";

describe("calculateGraphData (minimal)", () => {
  it("single purchase: profitYen matches qty*(fx*price - fx0*price0)", () => {
    const purchases = [{ fx: 150, price: 100, qty: 2 }]; // totalCost = 150*100*2 = 30000
    const pins = [];

    // fxとpriceの範囲を「2点」にすると、配列のどこを見るかが簡単
    const fxMin = 140,
      fxMax = 160;
    const priceMin = 90,
      priceMax = 110;

    const r = calculateGraphData(
      purchases,
      fxMin,
      fxMax,
      priceMin,
      priceMax,
      pins
    );

    // 返却の基本形が崩れてないか（回帰に効く）
    expect(r.fxVals.length).toBeGreaterThan(0);
    expect(r.priceVals.length).toBeGreaterThan(0);
    expect(r.profitYen.length).toBe(r.priceVals.length);
    expect(r.profitYen[0].length).toBe(r.fxVals.length);

    // 任意の1点を拾って期待値チェック（手計算しやすい）
    const fx = r.fxVals[0];
    const price = r.priceVals[0];

    const expected = 2 * (fx * price - 150 * 100);
    const actual = r.profitYen[0][0];

    // 浮動小数が混ざる可能性があるので近似で
    expect(actual).toBeCloseTo(expected, 8);
  });

  it("pins are enriched with profitYen and rates (single purchase)", () => {
    const purchases = [{ fx: 150, price: 100, qty: 2 }];
    const pins = [{ fx: 150, price: 100, label: "at cost" }];

    const r = calculateGraphData(purchases, 149, 151, 99, 101, pins);

    expect(r.enrichedPins.length).toBe(1);
    expect(r.enrichedPins[0].profitYen).toBeCloseTo(0, 8); // 購入点なので損益0
    expect(r.enrichedPins[0].rateYen).toMatch(/%$/);
    expect(r.enrichedPins[0].rateUsd).toMatch(/%$/);
  });
});
