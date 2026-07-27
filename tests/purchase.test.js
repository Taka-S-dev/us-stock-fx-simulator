import { describe, expect, it } from "vitest";
import {
  clampRange,
  createPurchase,
  isPurchaseValid,
  normalizePurchases,
  RANGE_LIMITS,
  scalePercent,
  scaleRange,
  validateField,
  validatePin,
  validatePurchase,
} from "../public/model/purchase.js";

describe("validateField", () => {
  it("正常な値を数値として返す", () => {
    expect(validateField("price", "123.45")).toEqual({
      value: 123.45,
      error: null,
    });
  });

  it("空欄はエラーにする", () => {
    const result = validateField("fx", "  ");
    expect(result.value).toBeNull();
    expect(result.error).toContain("入力してください");
  });

  it("数値でない入力を弾く", () => {
    expect(validateField("price", "abc").error).toContain("数値");
  });

  it("株数は整数のみ受け付ける", () => {
    expect(validateField("qty", "1.5").error).toContain("整数");
    expect(validateField("qty", "3").value).toBe(3);
  });

  it("範囲外を弾く（不正値をデフォルト値に差し替えない）", () => {
    expect(validateField("price", "0").error).toContain("範囲");
    expect(validateField("price", "0").value).toBeNull();
    expect(validateField("fx", "5000").error).toContain("範囲");
  });

  it("刻み幅の桁数に丸めて浮動小数のゴミを持ち込まない", () => {
    // 為替は小数2桁（銭単位）まで、株数は整数
    expect(validateField("fx", "140.061").value).toBe(140.06);
    expect(validateField("price", "12.345").value).toBe(12.35);
  });
});

describe("validatePurchase / isPurchaseValid", () => {
  it("編集すると pristine が下りる", () => {
    const purchase = createPurchase();
    expect(purchase.pristine).toBe(true);
    expect(validatePurchase(purchase, { price: "200" }).pristine).toBe(false);
  });

  it("不正な値はエラーとして保持され、計算対象から外れる", () => {
    const invalid = validatePurchase(createPurchase(), { qty: "0" });
    expect(invalid.errors.qty).toBeTruthy();
    expect(isPurchaseValid(invalid)).toBe(false);
  });

  it("初期値は計算に使える", () => {
    expect(isPurchaseValid(createPurchase())).toBe(true);
  });
});

describe("normalizePurchases", () => {
  it("有効な要素だけを残し、落とした理由を返す", () => {
    const { purchases, errors } = normalizePurchases([
      { price: 100, fx: 150, qty: 2 },
      { price: -1, fx: 150, qty: 2 },
      null,
    ]);

    expect(purchases).toHaveLength(1);
    expect(purchases[0]).toMatchObject({ price: 100, fx: 150, qty: 2 });
    expect(errors).toHaveLength(2);
  });

  it("配列でなければ空を返す", () => {
    expect(normalizePurchases(undefined).purchases).toEqual([]);
  });
});

describe("validatePin", () => {
  it("為替と株価の両方を検証する", () => {
    expect(validatePin("150", "120").pin).toEqual({ fx: 150, price: 120 });
    expect(validatePin("0", "120").error).toBeTruthy();
    expect(validatePin("150", "").error).toBeTruthy();
  });
});

describe("clampRange", () => {
  const spec = RANGE_LIMITS.fx;

  it("最小幅を下回ったら片側をずらす", () => {
    const result = clampRange({ min: 150, max: 151 }, spec, "min");
    expect(result.min).toBe(150);
    expect(result.max - result.min).toBeGreaterThanOrEqual(spec.gap);
  });

  it("上限に張り付いたときは反対側を動かす", () => {
    const result = clampRange({ min: spec.max, max: spec.max }, spec, "min");
    expect(result.max).toBe(spec.max);
    expect(result.max - result.min).toBeGreaterThanOrEqual(spec.gap);
  });

  it("許容範囲の外には出ない", () => {
    const result = clampRange({ min: -100, max: 9999 }, spec);
    expect(result.min).toBeGreaterThanOrEqual(spec.min);
    expect(result.max).toBeLessThanOrEqual(spec.max);
  });

  it("数値でない入力は仕様値にフォールバックする", () => {
    const result = clampRange({ min: NaN, max: NaN }, spec);
    expect(Number.isFinite(result.min)).toBe(true);
    expect(Number.isFinite(result.max)).toBe(true);
  });
});

describe("scaleRange", () => {
  const spec = { min: 100, max: 250, gap: 2 };

  it("中心を保ったまま狭める", () => {
    const result = scaleRange({ min: 150, max: 170 }, 0.5, spec);
    expect((result.min + result.max) / 2).toBeCloseTo(160, 8);
    expect(result.max - result.min).toBeCloseTo(10, 8);
  });

  it("中心を保ったまま広げる", () => {
    const result = scaleRange({ min: 150, max: 170 }, 2, spec);
    expect((result.min + result.max) / 2).toBeCloseTo(160, 8);
    expect(result.max - result.min).toBeCloseTo(40, 8);
  });

  it("端に当たったら中心をずらさずに拡大を抑える", () => {
    // 中心 110 なので、下限 100 までの 10 が取れる最大の半幅
    const result = scaleRange({ min: 105, max: 115 }, 10, spec);
    expect((result.min + result.max) / 2).toBeCloseTo(110, 8);
    expect(result.min).toBeGreaterThanOrEqual(spec.min);
    expect(result.max - result.min).toBeCloseTo(20, 8);
  });

  it("最小幅より狭くならない", () => {
    const result = scaleRange({ min: 159, max: 161 }, 0.01, spec);
    expect(result.max - result.min).toBeGreaterThanOrEqual(spec.gap);
    expect((result.min + result.max) / 2).toBeCloseTo(160, 8);
  });

  it("何度縮小・拡大しても中心が動かない", () => {
    let range = { min: 152, max: 176 };
    const center = (range.min + range.max) / 2;
    for (let i = 0; i < 6; i++) range = scaleRange(range, 0.8, spec);
    for (let i = 0; i < 6; i++) range = scaleRange(range, 1.25, spec);
    expect((range.min + range.max) / 2).toBeCloseTo(center, 6);
  });

  it("許容範囲を超えない", () => {
    const result = scaleRange({ min: 100, max: 250 }, 5, spec);
    expect(result.min).toBeGreaterThanOrEqual(spec.min);
    expect(result.max).toBeLessThanOrEqual(spec.max);
  });
});

describe("scalePercent", () => {
  const linear = { min: 100, max: 250 };
  const { scale } = RANGE_LIMITS.price;

  it("線形スケールは素直に比例する", () => {
    expect(scalePercent(linear, 100)).toBe(0);
    expect(scalePercent(linear, 250)).toBe(100);
    expect(scalePercent(linear, 175)).toBeCloseTo(50, 8);
  });

  it("区分線形スケールは各区切りが定義どおりの位置になる", () => {
    expect(scalePercent(scale, 1)).toBe(0);
    expect(scalePercent(scale, 50)).toBeCloseTo(25, 8);
    expect(scalePercent(scale, 200)).toBeCloseTo(50, 8);
    expect(scalePercent(scale, 1000)).toBeCloseTo(75, 8);
    expect(scalePercent(scale, 5000)).toBe(100);
  });

  it("区間の中は、その区間だけで比例する（全体を線形に見ない）", () => {
    // $125 は $50〜$200 の中央 -> 25% と 50% の中央
    expect(scalePercent(scale, 125)).toBeCloseTo(37.5, 8);
    // 全体を線形に見た場合の 2.5% とは大きく違う
    expect(scalePercent(scale, 125)).not.toBeCloseTo(2.5, 1);
  });

  it("範囲の外は端に丸める", () => {
    expect(scalePercent(scale, 0.5)).toBe(0);
    expect(scalePercent(scale, 9999)).toBe(100);
  });

  it("数値でなければ null", () => {
    expect(scalePercent(scale, NaN)).toBeNull();
    expect(scalePercent(scale, null)).toBeNull();
  });
});
