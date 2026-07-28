// model/fxRate.js
// USD/JPY の取得。fetch を差し替えられるようにして単体テストできる形にしている。

const ENDPOINT = "https://open.er-api.com/v6/latest/USD";

/** 取得できなかった場合に使う値。取得日を明示できないので UI 側で「参考値」と示す */
export const FALLBACK_RATE = 150;

/** キャッシュの有効期間（1時間）。為替は日中変動するが、初期表示用途にはこれで足る */
export const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * USD/JPY を取得する。
 * - タイムアウトを必ず付ける（無応答のときにローディング表示のまま固まらないように）
 * - 失敗理由は throw ではなく戻り値で返し、呼び出し側の分岐を単純にする
 *
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [options]
 * @returns {Promise<{ ok: true, value: number } | { ok: false, reason: string }>}
 */
export async function fetchUsdJpyRate({
  fetchImpl = globalThis.fetch,
  timeoutMs = 4000,
} = {}) {
  if (typeof fetchImpl !== "function") {
    return { ok: false, reason: "この環境では為替を取得できません" };
  }

  try {
    const res = await fetchImpl(ENDPOINT, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return {
        ok: false,
        reason: `為替APIがエラーを返しました (${res.status})`,
      };
    }

    const data = await res.json();
    const value = Number(data?.rates?.JPY);
    if (!Number.isFinite(value) || value <= 0) {
      return { ok: false, reason: "為替APIの応答を解釈できませんでした" };
    }
    return { ok: true, value: Number(value.toFixed(2)) };
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    return {
      ok: false,
      reason: timedOut
        ? "為替の取得がタイムアウトしました"
        : "為替の取得に失敗しました",
    };
  }
}

/**
 * 為替レートから、初期表示に使う表示範囲を決める。
 * @param {number} rate
 * @param {{ spread?: number }} [options]
 * @returns {{ fxMin: number, fxMax: number, fxMid: number }}
 */
export function fxRangeFor(rate, { spread = 12 } = {}) {
  const fxMid = Number(rate.toFixed(1));
  return {
    fxMin: Number((fxMid - spread).toFixed(1)),
    fxMax: Number((fxMid + spread).toFixed(1)),
    fxMid,
  };
}

/**
 * キャッシュがまだ有効か
 * @param {{fetchedAt:number}|null} cache
 * @param {number} [now]
 */
export function isCacheFresh(cache, now = Date.now()) {
  return !!cache && now - cache.fetchedAt < CACHE_TTL_MS;
}
