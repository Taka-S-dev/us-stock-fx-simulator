import { describe, expect, it } from "vitest";
import {
  aggregatePurchases,
  breakEvenCurve,
  breakEvenPriceUsd,
  buildProfitGrid,
  calculateGraphData,
  linspace,
  valuationAt,
} from "../public/model/calc.js";

const view = { fxMin: 140, fxMax: 160, priceMin: 90, priceMax: 110 };

describe("linspace", () => {
  it("端点をちょうど含む", () => {
    const values = linspace(1, 2, 5);
    expect(values).toHaveLength(5);
    expect(values[0]).toBe(1);
    expect(values.at(-1)).toBe(2);
  });
});

describe("aggregatePurchases", () => {
  it("手数料・諸経費を取得総額に加算する", () => {
    const purchases = [{ fx: 150, price: 100, qty: 2 }];
    const withoutFee = aggregatePurchases(purchases);
    const withFee = aggregatePurchases(purchases, 5000);

    expect(withoutFee.totalCostYen).toBe(30000);
    expect(withFee.totalCostYen).toBe(35000);
    // 平均取得価額には反映されるが、平均購入点（グラフ上の星）は入力値のまま
    expect(withFee.avgAcqYen).toBe(17500);
    expect(withFee.avgFx).toBe(150);
    expect(withFee.avgPrice).toBe(100);
  });

  it("株数が0なら全項目を0で返す", () => {
    expect(aggregatePurchases([{ fx: 150, price: 100, qty: 0 }])).toMatchObject(
      {
        totalQty: 0,
        totalCostYen: 0,
        avgAcqYen: 0,
      }
    );
  });
});

describe("buildProfitGrid", () => {
  it("z[株価][為替] の並びで損益を返す", () => {
    const agg = aggregatePurchases([{ fx: 150, price: 100, qty: 2 }]);
    const grid = buildProfitGrid(agg, view, 3);

    expect(grid.priceVals).toEqual([90, 100, 110]);
    expect(grid.fxVals).toEqual([140, 150, 160]);
    expect(grid.profitYen).toHaveLength(3);

    // 損益 = fx * price * qty - 取得総額(30000)
    expect(grid.profitYen[0][0]).toBeCloseTo(140 * 90 * 2 - 30000, 8);
    expect(grid.profitYen[2][2]).toBeCloseTo(160 * 110 * 2 - 30000, 8);
  });

  it("購入点そのものの損益は0になる", () => {
    const agg = aggregatePurchases([{ fx: 150, price: 100, qty: 2 }]);
    const grid = buildProfitGrid(agg, view, 3);
    expect(grid.profitYen[1][1]).toBeCloseTo(0, 8);
  });
});

describe("breakEvenCurve", () => {
  it("曲線上のすべての点で損益がちょうど0になる", () => {
    const agg = aggregatePurchases([
      { fx: 150, price: 100, qty: 2 },
      { fx: 160, price: 120, qty: 3 },
    ]);
    const points = breakEvenCurve(agg, view, 25);

    expect(points.length).toBeGreaterThan(0);
    for (const { fx, price } of points) {
      const profit = fx * price * agg.totalQty - agg.totalCostYen;
      expect(profit).toBeCloseTo(0, 6);
    }
  });

  it("表示範囲の外にはみ出さない", () => {
    const agg = aggregatePurchases([{ fx: 150, price: 100, qty: 2 }]);
    const narrow = { fxMin: 140, fxMax: 160, priceMin: 95, priceMax: 105 };
    const points = breakEvenCurve(agg, narrow, 50);

    for (const { fx, price } of points) {
      expect(fx).toBeGreaterThanOrEqual(narrow.fxMin - 1e-9);
      expect(fx).toBeLessThanOrEqual(narrow.fxMax + 1e-9);
      expect(price).toBeGreaterThanOrEqual(narrow.priceMin - 1e-9);
      expect(price).toBeLessThanOrEqual(narrow.priceMax + 1e-9);
    }
  });

  it("表示範囲と交わらなければ空を返す", () => {
    const agg = aggregatePurchases([{ fx: 150, price: 100, qty: 2 }]);
    const far = { fxMin: 100, fxMax: 110, priceMin: 10, priceMax: 20 };
    expect(breakEvenCurve(agg, far)).toEqual([]);
  });

  it("購入情報がなければ空を返す", () => {
    expect(breakEvenCurve(aggregatePurchases([]), view)).toEqual([]);
  });
});

describe("breakEvenPriceUsd", () => {
  it("USD建ての平均取得価額と一致する", () => {
    const agg = aggregatePurchases([
      { fx: 150, price: 100, qty: 1 },
      { fx: 150, price: 120, qty: 1 },
    ]);
    expect(breakEvenPriceUsd(agg)).toBeCloseTo(110, 8);
  });

  it("購入情報がなければ null", () => {
    expect(breakEvenPriceUsd(aggregatePurchases([]))).toBeNull();
  });
});

describe("valuationAt", () => {
  const agg = aggregatePurchases([{ fx: 150, price: 100, qty: 2 }]);

  it("購入点では損益0", () => {
    const v = valuationAt({ fx: 150, price: 100 }, agg);
    expect(v.profitYen).toBe(0);
    expect(v.rateYenPct).toBe(0);
    expect(v.profitUsd).toBe(0);
  });

  it("為替だけ上がると円建てにのみ利益が出る", () => {
    const v = valuationAt({ fx: 165, price: 100 }, agg);
    expect(v.profitYen).toBe(165 * 100 * 2 - 30000);
    expect(v.rateYenPct).toBeCloseTo(10, 8);
    expect(v.profitUsd).toBe(0);
  });

  it("株数0でも例外にならない", () => {
    const v = valuationAt({ fx: 150, price: 100 }, aggregatePurchases([]));
    expect(v).toMatchObject({ profitYen: 0, rateYenPct: 0, profitUsd: 0 });
  });
});

describe("calculateGraphData", () => {
  it("ピンに損益を数値で付与する", () => {
    const result = calculateGraphData({
      purchases: [{ fx: 150, price: 100, qty: 2 }],
      view,
      pins: [
        { fx: 150, price: 100 },
        { fx: 160, price: 110, visible: false },
      ],
      resolution: 10,
    });

    expect(result.pins).toHaveLength(2);
    expect(result.pins[0].profitYen).toBe(0);
    // 表示整形は View の責務。model は数値のまま返す
    expect(typeof result.pins[0].rateYenPct).toBe("number");
    expect(result.pins[0].visible).toBe(true);
    expect(result.pins[1].visible).toBe(false);
  });

  it("グラフ描画に必要な要素が揃っている", () => {
    const result = calculateGraphData({
      purchases: [{ fx: 150, price: 100, qty: 2 }],
      view,
      resolution: 10,
    });

    expect(result.fxVals).toHaveLength(10);
    expect(result.priceVals).toHaveLength(10);
    expect(result.profitYen[0]).toHaveLength(10);
    expect(result.averagePoint).toEqual({ fx: 150, price: 100 });
    expect(result.purchases).toEqual([{ fx: 150, price: 100, qty: 2 }]);
    expect(result.breakEvenPoints.length).toBeGreaterThan(0);
  });
});
