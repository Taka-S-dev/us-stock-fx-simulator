// tests/display_jpy_valuation_all.test.js
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { computeYenValuationTruncTowardZero } from "../public/model/calc.js";

// 計算は calc.js の純粋関数で検証する（表示仕様: 円未満/小数2桁は0方向切り捨て）

function loadAllSnapshots(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".json"))
    .map((f) => {
      const full = path.join(dir, f);
      return { file: f, data: JSON.parse(fs.readFileSync(full, "utf-8")) };
    });
}

describe("Display valuation JPY reconciliation (all fixtures)", () => {
  // 既存のフィクスチャ配置をそのまま利用
  const dir = path.resolve("tests/fixtures/securities_yen");
  const cases = loadAllSnapshots(dir);

  it("has at least one fixture under tests/fixtures/securities_yen", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  for (const c of cases) {
    it(`matches exactly: ${c.file}`, () => {
      const s = c.data;

      const mustBeFinite = (k) => expect(Number.isFinite(s[k])).toBe(true);

      mustBeFinite("qty");
      mustBeFinite("avgAcqYen");
      mustBeFinite("currentValueYen");
      mustBeFinite("profitLossYen");
      mustBeFinite("profitLossRatePct");

      // calc.js の表示仕様ロジックと一致するか検証
      const { profitLossYen, profitLossRatePct } =
        computeYenValuationTruncTowardZero(
          s.avgAcqYen,
          s.qty,
          s.currentValueYen
        );
      expect(profitLossYen).toBe(s.profitLossYen);
      expect(profitLossRatePct).toBe(s.profitLossRatePct);
    });
  }
});
