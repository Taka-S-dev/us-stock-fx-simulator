// model/persistence.js
// localStorage への永続化。Storage 互換オブジェクトを注入できるようにして、
// ブラウザなしでもテストできる形にしてある。

import { normalizePurchases, RANGE_LIMITS, clampRange } from "./purchase.js";

const STATE_PREFIX = "state::";
const THEME_KEY = "pref::theme";
const FX_CACHE_KEY = "cache::fxRate";

/** 保存フォーマットの版。読み込み時に旧版から移行する */
export const SNAPSHOT_VERSION = 2;

/**
 * 現在の状態から保存用スナップショットを作る。
 * UI 都合の値（エラー表示・行ID・取得中フラグ）は持ち出さない。
 * @param {ReturnType<typeof import("./store.js").createInitialState>} state
 * @param {number} [savedAt] epoch ms
 */
export function toSnapshot(state, savedAt = Date.now()) {
  return {
    version: SNAPSHOT_VERSION,
    savedAt,
    purchases: state.purchases.map((p) => ({
      price: p.price,
      fx: p.fx,
      qty: p.qty,
    })),
    extraCostYen: state.extraCostYen ?? 0,
    current: { ...state.current },
    view: { ...state.view },
    pins: state.pins.map((p) => ({
      fx: p.fx,
      price: p.price,
      visible: p.visible !== false,
    })),
  };
}

/**
 * 旧フォーマット（v1: 範囲がトップレベルに平置き）を現行版へ移行する。
 * @param {any} raw
 * @returns {any}
 */
export function migrateSnapshot(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.version === SNAPSHOT_VERSION) return raw;

  // v1 相当（version が無い / "1.0.0"）
  const view = {
    fxMin: raw.view?.fxMin ?? raw.fxMin,
    fxMax: raw.view?.fxMax ?? raw.fxMax,
    priceMin: raw.view?.priceMin ?? raw.priceMin,
    priceMax: raw.view?.priceMax ?? raw.priceMax,
  };
  return {
    version: SNAPSHOT_VERSION,
    savedAt: typeof raw.timestamp === "number" ? raw.timestamp : null,
    purchases: Array.isArray(raw.purchases) ? raw.purchases : [],
    extraCostYen: raw.extraCostYen ?? 0,
    view,
    pins: Array.isArray(raw.pins) ? raw.pins : [],
  };
}

/**
 * スナップショットを状態の一部へ変換する。値の妥当性はここで担保する。
 * @param {any} raw
 * @returns {{ patch: object|null, errors: string[] }}
 */
export function fromSnapshot(raw) {
  const snapshot = migrateSnapshot(raw);
  if (!snapshot)
    return { patch: null, errors: ["保存データを読めませんでした"] };

  const { purchases, errors } = normalizePurchases(snapshot.purchases);
  if (purchases.length === 0) {
    return {
      patch: null,
      errors: errors.length ? errors : ["購入情報が含まれていません"],
    };
  }

  const fx = clampRange(
    { min: Number(snapshot.view?.fxMin), max: Number(snapshot.view?.fxMax) },
    RANGE_LIMITS.fx
  );
  const price = clampRange(
    {
      min: Number(snapshot.view?.priceMin),
      max: Number(snapshot.view?.priceMax),
    },
    RANGE_LIMITS.price
  );

  const pins = (Array.isArray(snapshot.pins) ? snapshot.pins : [])
    .filter((p) => Number.isFinite(p?.fx) && Number.isFinite(p?.price))
    .map((p, i) => ({
      id: `pin-restored-${i}`,
      fx: p.fx,
      price: p.price,
      visible: p.visible !== false,
    }));

  const extraCostYen = Number(snapshot.extraCostYen);
  // 現在地は任意項目。無ければ null（＝取得レート／平均株価に自動追従）に戻す
  const finiteOrNull = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

  return {
    patch: {
      purchases,
      extraCostYen: Number.isFinite(extraCostYen) ? extraCostYen : 0,
      current: {
        fx: finiteOrNull(snapshot.current?.fx),
        price: finiteOrNull(snapshot.current?.price),
      },
      view: {
        fxMin: fx.min,
        fxMax: fx.max,
        priceMin: price.min,
        priceMax: price.max,
      },
      pins,
      cursor: null,
    },
    errors,
  };
}

/**
 * 名前付きスナップショットの読み書き
 * @param {Storage} [storage]
 */
export function createStateRepository(storage = globalThis.localStorage) {
  const guard = (fn, fallback) => {
    try {
      return storage ? fn() : fallback;
    } catch (e) {
      // プライベートブラウジングや容量超過で localStorage が使えない環境がある
      console.warn("ストレージへのアクセスに失敗しました", e);
      return fallback;
    }
  };

  return {
    list() {
      return guard(() => {
        const names = [];
        for (let i = 0; i < storage.length; i += 1) {
          const key = storage.key(i);
          if (key?.startsWith(STATE_PREFIX)) {
            const name = key.slice(STATE_PREFIX.length);
            if (name) names.push(name);
          }
        }
        return names.sort((a, b) => a.localeCompare(b, "ja"));
      }, []);
    },

    /** @returns {{ok:boolean, reason?:string}} */
    save(name, snapshot) {
      const key = String(name ?? "").trim();
      if (!key) return { ok: false, reason: "保存名を入力してください" };
      try {
        storage.setItem(STATE_PREFIX + key, JSON.stringify(snapshot));
        return { ok: true };
      } catch (e) {
        console.error("保存に失敗しました", e);
        const full = e instanceof Error && /quota/i.test(e.name + e.message);
        return {
          ok: false,
          reason: full
            ? "ブラウザの保存容量が上限に達しています。不要な保存データを削除してください"
            : "この環境では保存できません",
        };
      }
    },

    load(name) {
      return guard(() => {
        const raw = storage.getItem(STATE_PREFIX + String(name ?? "").trim());
        return raw ? JSON.parse(raw) : null;
      }, null);
    },

    remove(name) {
      return guard(() => {
        storage.removeItem(STATE_PREFIX + String(name ?? "").trim());
        return true;
      }, false);
    },
  };
}

/**
 * テーマ・為替キャッシュなど、保存データとは別枠の設定
 * @param {Storage} [storage]
 */
export function createPreferences(storage = globalThis.localStorage) {
  const read = (key) => {
    try {
      return storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  };
  const write = (key, value) => {
    try {
      storage?.setItem(key, value);
    } catch {
      /* 保存できない環境では黙って諦める（機能の主目的ではない） */
    }
  };

  return {
    /** @returns {"auto"|"light"|"dark"} */
    getTheme() {
      const v = read(THEME_KEY);
      return v === "light" || v === "dark" ? v : "auto";
    },
    setTheme(theme) {
      write(THEME_KEY, theme);
    },

    /** @returns {{value:number, fetchedAt:number}|null} */
    getFxCache() {
      try {
        const parsed = JSON.parse(read(FX_CACHE_KEY) ?? "null");
        if (
          parsed &&
          Number.isFinite(parsed.value) &&
          Number.isFinite(parsed.fetchedAt)
        ) {
          return parsed;
        }
      } catch {
        /* 壊れたキャッシュは無視して取得し直す */
      }
      return null;
    },
    setFxCache(value, fetchedAt) {
      write(FX_CACHE_KEY, JSON.stringify({ value, fetchedAt }));
    },
  };
}
