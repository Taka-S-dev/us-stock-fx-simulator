// tests/display_usd_valuation_all.test.js
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { computeUsdValuationCandidates } from "../public/model/calc.js";

// 計算は calc.js の純粋関数で検証する（表示仕様由来の丸め順の揺れを許容）

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

describe("Display valuation USD reconciliation (all fixtures)", () => {
  // 既存のフィクスチャ配置をそのまま利用
  const dir = path.resolve("tests/fixtures/securities_usd");
  const cases = loadAllSnapshots(dir);

  it("has at least one fixture under tests/fixtures/securities_usd", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  for (const c of cases) {
    it(`matches: ${c.file}`, () => {
      const s = c.data;

      const mustBeFinite = (k) => expect(Number.isFinite(s[k])).toBe(true);

      mustBeFinite("qty");
      mustBeFinite("avgAcqUsd");
      mustBeFinite("currentPriceUsd");
      mustBeFinite("currentValueUsd");
      mustBeFinite("profitLossUsd");
      mustBeFinite("profitLossRatePct");

      const { currentValueUsd, pnlCandidates, rateCandidates } =
        computeUsdValuationCandidates(s.avgAcqUsd, s.qty, s.currentPriceUsd);

      // 1) 時価評価額(USD) の一致
      expect(currentValueUsd).toBe(s.currentValueUsd);

      // 2) 評価損益(USD) の候補に含まれる
      expect([...pnlCandidates]).toContain(s.profitLossUsd);

      // 3) 評価損益率(%) の候補に含まれる
      expect([...rateCandidates]).toContain(s.profitLossRatePct);
    });
  }
});
