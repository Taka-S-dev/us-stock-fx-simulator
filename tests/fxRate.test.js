import { describe, expect, it, vi } from "vitest";
import {
  CACHE_TTL_MS,
  fetchUsdJpyRate,
  fxRangeFor,
  isCacheFresh,
} from "../public/model/fxRate.js";

const jsonResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
});

describe("fetchUsdJpyRate", () => {
  it("USD/JPY を取り出す", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ rates: { JPY: 152.3456 } })
    );
    const result = await fetchUsdJpyRate({ fetchImpl });

    expect(result).toEqual({ ok: true, value: 152.35 });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("必ずタイムアウト用のシグナルを渡す", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ rates: { JPY: 150 } }));
    await fetchUsdJpyRate({ fetchImpl, timeoutMs: 1000 });

    const [, options] = fetchImpl.mock.calls[0];
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it("HTTPエラーは理由付きで失敗にする", async () => {
    const result = await fetchUsdJpyRate({
      fetchImpl: async () => jsonResponse({}, false, 503),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("503");
  });

  it("応答にレートが無ければ失敗にする", async () => {
    const result = await fetchUsdJpyRate({
      fetchImpl: async () => jsonResponse({ rates: {} }),
    });
    expect(result.ok).toBe(false);
  });

  it("タイムアウトを専用のメッセージで返す", async () => {
    const result = await fetchUsdJpyRate({
      fetchImpl: async () => {
        const error = new Error("timeout");
        error.name = "TimeoutError";
        throw error;
      },
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("タイムアウト");
  });

  it("fetch が使えない環境でも例外を投げない", async () => {
    const result = await fetchUsdJpyRate({ fetchImpl: null });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("取得できません");
  });
});

describe("fxRangeFor", () => {
  it("レートを中心に上下へ広げる", () => {
    expect(fxRangeFor(150.04)).toEqual({ fxMin: 138, fxMax: 162, fxMid: 150 });
  });
});

describe("isCacheFresh", () => {
  const now = 1_700_000_000_000;

  it("有効期限内なら true", () => {
    expect(isCacheFresh({ fetchedAt: now - 1000 }, now)).toBe(true);
  });

  it("期限切れなら false", () => {
    expect(isCacheFresh({ fetchedAt: now - CACHE_TTL_MS - 1 }, now)).toBe(
      false
    );
  });

  it("キャッシュが無ければ false", () => {
    expect(isCacheFresh(null, now)).toBe(false);
  });
});
