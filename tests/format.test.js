import { describe, expect, it } from "vitest";
import {
  formatCount,
  formatNumber,
  formatSignedPct,
  formatSignedUsd,
  formatSignedYen,
  formatTimestamp,
  formatUsd,
  formatYen,
  toneClass,
} from "../public/utils/format.js";

describe("金額の整形", () => {
  it("円は桁区切りで整数表示", () => {
    expect(formatYen(1234567.89)).toBe("1,234,567");
  });

  it("符号付きの円は ± を明示する", () => {
    expect(formatSignedYen(1234)).toBe("+1,234");
    expect(formatSignedYen(-1234)).toBe("-1,234");
    expect(formatSignedYen(0)).toBe("±0");
  });

  it("USDは常に小数2桁", () => {
    expect(formatUsd(12.5)).toBe("12.50");
    expect(formatSignedUsd(-12.5)).toBe("-12.50");
  });

  it("損益率は符号付きで表示する", () => {
    expect(formatSignedPct(12.34)).toBe("+12.34%");
    expect(formatSignedPct(-0.5)).toBe("-0.5%");
  });

  it("株数は桁区切り", () => {
    expect(formatCount(12345)).toBe("12,345");
  });

  it("桁数を指定できる", () => {
    expect(formatNumber(1.005, 2)).toBe("1.01");
    expect(formatNumber(150, 1)).toBe("150.0");
  });
});

describe("toneClass", () => {
  it("損益の符号で色クラスを切り替える", () => {
    expect(toneClass(1)).toBe("text-success");
    expect(toneClass(-1)).toBe("text-danger");
    expect(toneClass(0)).toBe("text-secondary");
  });
});

describe("formatTimestamp", () => {
  it("数値でなければダッシュを返す", () => {
    expect(formatTimestamp(null)).toBe("—");
  });

  it("日時を文字列にする", () => {
    expect(formatTimestamp(1_700_000_000_000)).toMatch(/\d/);
  });
});
