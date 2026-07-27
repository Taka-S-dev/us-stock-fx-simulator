import { describe, expect, it } from "vitest";
import { aggregatePurchases, valuationAt } from "../public/model/calc.js";
import {
  breakEvenDistanceFrom,
  currencyDivergence,
  niceContourStep,
  scenarioMatrix,
  sensitivityAt,
} from "../public/model/analysis.js";

// 取得総額 150 × 100 × 2 = 30,000 円 / 平均取得価額 15,000 円/株
const agg = aggregatePurchases([{ fx: 150, price: 100, qty: 2 }]);

describe("sensitivityAt", () => {
  it("感応度が実際の損益の差分と一致する", () => {
    const point = { fx: 150, price: 100 };
    const s = sensitivityAt(point, agg);

    const base = valuationAt(point, agg).profitYen;
    const afterYen = valuationAt({ fx: 151, price: 100 }, agg).profitYen;
    const afterDollar = valuationAt({ fx: 150, price: 101 }, agg).profitYen;

    expect(s.perYen).toBeCloseTo(afterYen - base, 6);
    expect(s.perDollar).toBeCloseTo(afterDollar - base, 6);
  });

  it("率で見た影響は為替と株価で等しい", () => {
    const point = { fx: 150, price: 100 };
    const s = sensitivityAt(point, agg);

    const base = valuationAt(point, agg).profitYen;
    const fxUp1Pct = valuationAt({ fx: 151.5, price: 100 }, agg).profitYen;
    const priceUp1Pct = valuationAt({ fx: 150, price: 101 }, agg).profitYen;

    expect(fxUp1Pct - base).toBeCloseTo(s.perPercent, 6);
    expect(priceUp1Pct - base).toBeCloseTo(s.perPercent, 6);
  });

  it("1単位あたりで影響が大きい方を示す", () => {
    // 為替150 > 株価100 なので、$1 動くほうが効く
    expect(sensitivityAt({ fx: 150, price: 100 }, agg).dominant).toBe("price");
    expect(sensitivityAt({ fx: 100, price: 150 }, agg).dominant).toBe("fx");
    expect(sensitivityAt({ fx: 120, price: 120 }, agg).dominant).toBe("even");
  });

  it("購入情報がなければ null", () => {
    expect(
      sensitivityAt({ fx: 150, price: 100 }, aggregatePurchases([]))
    ).toBeNull();
  });
});

describe("breakEvenDistanceFrom", () => {
  it("求めた分岐水準で実際に損益が0になる", () => {
    const point = { fx: 160, price: 110 };
    const d = breakEvenDistanceFrom(point, agg);

    expect(
      valuationAt({ fx: point.fx, price: d.breakEvenPrice }, agg).profitYen
    ).toBeCloseTo(0, 6);
    expect(
      valuationAt({ fx: d.breakEvenFx, price: point.price }, agg).profitYen
    ).toBeCloseTo(0, 6);
  });

  it("利益が出ている地点では分岐まで下げしろがある", () => {
    const d = breakEvenDistanceFrom({ fx: 160, price: 110 }, agg);
    expect(d.inProfit).toBe(true);
    expect(d.priceDelta).toBeLessThan(0);
    expect(d.fxDelta).toBeLessThan(0);
  });

  it("損失が出ている地点では上げしろが必要", () => {
    const d = breakEvenDistanceFrom({ fx: 140, price: 90 }, agg);
    expect(d.inProfit).toBe(false);
    expect(d.priceDelta).toBeGreaterThan(0);
    expect(d.pricePct).toBeGreaterThan(0);
  });

  it("購入点そのものでは距離0", () => {
    const d = breakEvenDistanceFrom({ fx: 150, price: 100 }, agg);
    expect(d.priceDelta).toBeCloseTo(0, 8);
    expect(d.fxDelta).toBeCloseTo(0, 8);
  });

  it("不正な入力では null", () => {
    expect(breakEvenDistanceFrom({ fx: 0, price: 100 }, agg)).toBeNull();
  });
});

describe("scenarioMatrix", () => {
  it("3×3のセルすべてに損益が入る", () => {
    const matrix = scenarioMatrix({ fx: 150, price: 100 }, agg);

    expect(matrix.columns).toHaveLength(3);
    expect(matrix.rows).toHaveLength(3);
    for (const row of matrix.rows) {
      expect(row.cells).toHaveLength(3);
      for (const cell of row.cells) {
        expect(Number.isFinite(cell.profitYen)).toBe(true);
      }
    }
  });

  it("中央のセルは現在地の損益と一致する", () => {
    const point = { fx: 155, price: 120 };
    const matrix = scenarioMatrix(point, agg);
    const center = matrix.rows[1].cells[1];

    expect(center.profitYen).toBe(valuationAt(point, agg).profitYen);
  });

  it("行は株価の高い順、列は円高から円安の順に並ぶ", () => {
    const matrix = scenarioMatrix({ fx: 150, price: 100 }, agg);

    expect(matrix.rows[0].price).toBeGreaterThan(matrix.rows[2].price);
    expect(matrix.columns[0].fx).toBeLessThan(matrix.columns[2].fx);
    // 右上ほど利益が大きい
    expect(matrix.rows[0].cells[2].profitYen).toBeGreaterThan(
      matrix.rows[2].cells[0].profitYen
    );
  });

  it("購入情報がなければ null", () => {
    expect(
      scenarioMatrix({ fx: 150, price: 100 }, aggregatePurchases([]))
    ).toBeNull();
  });
});

describe("niceContourStep", () => {
  it("1 / 2 / 5 × 10^n のいずれかを返す", () => {
    for (const extent of [800, 3_000, 47_000, 250_000, 1_234_567]) {
      const step = niceContourStep(extent);
      const normalized = step / 10 ** Math.floor(Math.log10(step));
      expect([1, 2, 5]).toContain(Math.round(normalized));
    }
  });

  it("おおよそ指定した本数に収まる", () => {
    const step = niceContourStep(100_000, 5);
    const lines = 100_000 / step;
    expect(lines).toBeGreaterThanOrEqual(2);
    expect(lines).toBeLessThanOrEqual(10);
  });

  it("幅が0以下でも壊れない", () => {
    expect(niceContourStep(0)).toBe(1);
  });
});

describe("currencyDivergence", () => {
  // 取得: 150円 × $100 × 2株 = 30,000円 / $200
  it("株価が上がっても円高で円換算が損失なら usdOnly", () => {
    // 株価 $110（USD建ては +$20）だが、為替 130 円だと 130×110×2=28,600 < 30,000
    const v = valuationAt({ fx: 130, price: 110 }, agg);
    expect(v.profitUsd).toBeGreaterThan(0);
    expect(v.profitYen).toBeLessThan(0);
    expect(currencyDivergence(v)).toBe("usdOnly");
  });

  it("株価が下がっても円安で円換算が利益なら yenOnly", () => {
    // 株価 $90（USD建ては -$20）だが、為替 180 円だと 180×90×2=32,400 > 30,000
    const v = valuationAt({ fx: 180, price: 90 }, agg);
    expect(v.profitUsd).toBeLessThan(0);
    expect(v.profitYen).toBeGreaterThan(0);
    expect(currencyDivergence(v)).toBe("yenOnly");
  });

  it("符号が一致していれば null", () => {
    expect(
      currencyDivergence(valuationAt({ fx: 180, price: 120 }, agg))
    ).toBeNull();
    expect(
      currencyDivergence(valuationAt({ fx: 130, price: 80 }, agg))
    ).toBeNull();
  });

  it("どちらかが 0 なら判定しない", () => {
    expect(currencyDivergence({ profitYen: 0, profitUsd: 100 })).toBeNull();
    expect(currencyDivergence({ profitYen: 100, profitUsd: 0 })).toBeNull();
  });

  it("数値でない場合は null", () => {
    expect(currencyDivergence({ profitYen: NaN, profitUsd: 1 })).toBeNull();
  });

  it("2本の損益分岐ラインに挟まれた領域と一致する", () => {
    // 円建ての分岐は fx × price = 15,000、USD建ての分岐は price = 100。
    // 片方だけ超えている点が「食い違い」の領域になる
    //   $120（USD建ては黒字）だが 120 × 120 = 14,400 < 15,000 で円換算は赤字
    expect(currencyDivergence(valuationAt({ fx: 120, price: 120 }, agg))).toBe(
      "usdOnly"
    );
    //   $95（USD建ては赤字）だが 170 × 95 = 16,150 > 15,000 で円換算は黒字
    expect(currencyDivergence(valuationAt({ fx: 170, price: 95 }, agg))).toBe(
      "yenOnly"
    );
    // 両方とも超えている／どちらも超えていない点は食い違わない
    expect(
      currencyDivergence(valuationAt({ fx: 140, price: 110 }, agg))
    ).toBeNull();
  });
});
