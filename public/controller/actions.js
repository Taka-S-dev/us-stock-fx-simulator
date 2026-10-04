// controller/actions.js
// 状態を変える操作はすべてここに集める。View はここを呼ぶだけで、
// DOM を直接書き換えたり他の View を起こしたりしない。

import {
  clampRange,
  createPurchase,
  nextId,
  RANGE_LIMITS,
  scaleRange,
  scaleRangeAt,
  validateField,
  validatePin,
  validatePurchase,
} from "../model/purchase.js";
import {
  FALLBACK_RATE,
  fetchUsdJpyRate,
  fxRangeFor,
  isCacheFresh,
} from "../model/fxRate.js";
import { createInitialState } from "../model/store.js";
import { fromSnapshot, toSnapshot } from "../model/persistence.js";

const MAX_PURCHASES = 20;
const MAX_PINS = 12;
const MAX_EXTRA_COST_YEN = 100_000_000;

/**
 * @param {Object} deps
 * @param {ReturnType<typeof import("../model/store.js").createStore>} deps.store
 * @param {ReturnType<typeof import("../model/persistence.js").createStateRepository>} deps.repository
 * @param {ReturnType<typeof import("../model/persistence.js").createPreferences>} deps.preferences
 * @param {(message:string, tone?:"success"|"info"|"warning"|"error") => void} deps.notify
 */
export function createActions({ store, repository, preferences, notify }) {
  const patchView = (patch) => {
    store.update((state) => ({ view: { ...state.view, ...patch } }));
  };

  const actions = {
    /* ---- 購入情報 ------------------------------------------------------ */

    addPurchase() {
      const state = store.getState();
      if (state.purchases.length >= MAX_PURCHASES) {
        notify(`購入情報は${MAX_PURCHASES}件までです`, "warning");
        return null;
      }
      // 直前の行を引き継ぐと、ナンピンの入力が数字だけの修正で済む
      const last = state.purchases.at(-1);
      const seed = last
        ? {
            price: last.price ?? undefined,
            fx: last.fx ?? undefined,
            qty: last.qty ?? undefined,
          }
        : { fx: state.fxRate.value ?? undefined };
      const purchase = createPurchase(seed);
      store.update({ purchases: [...state.purchases, purchase] });
      return purchase.id;
    },

    updatePurchaseField(id, field, rawValue) {
      store.update((state) => ({
        purchases: state.purchases.map((p) =>
          p.id === id ? validatePurchase(p, { [field]: rawValue }) : p
        ),
      }));
    },

    removePurchase(id) {
      store.update((state) => {
        if (state.purchases.length <= 1) return null;
        return { purchases: state.purchases.filter((p) => p.id !== id) };
      });
    },

    /* ---- 現在地 -------------------------------------------------------- */

    /**
     * 現在の為替／株価を手入力で上書きする。
     * 空欄にすると null に戻り、取得レート・平均購入株価への自動追従が復活する。
     * @param {"fx"|"price"} field
     * @param {string} rawValue
     */
    setCurrent(field, rawValue) {
      const text = String(rawValue ?? "").trim();
      if (text === "") {
        store.update((state) => ({
          current: { ...state.current, [field]: null },
        }));
        return;
      }

      const { value, error } = validateField(field, text);
      if (error) {
        notify(error, "warning");
        return;
      }
      store.update((state) => ({
        current: { ...state.current, [field]: value },
      }));
    },

    setExtraCost(rawValue) {
      const text = String(rawValue ?? "").trim();
      if (text === "") {
        store.update({ extraCostYen: 0 });
        return;
      }
      const value = Number(text);
      if (!Number.isFinite(value) || value < 0 || value > MAX_EXTRA_COST_YEN) {
        notify("手数料・諸経費は0以上の金額で入力してください", "warning");
        return;
      }
      store.update({ extraCostYen: Math.round(value) });
    },

    /* ---- 表示範囲 ------------------------------------------------------ */

    updateView(patch) {
      const state = store.getState();
      const next = { ...state.view, ...patch };

      const fx = clampRange(
        { min: next.fxMin, max: next.fxMax },
        RANGE_LIMITS.fx
      );
      const price = clampRange(
        { min: next.priceMin, max: next.priceMax },
        RANGE_LIMITS.price
      );

      patchView({
        fxMin: fx.min,
        fxMax: fx.max,
        priceMin: price.min,
        priceMax: price.max,
      });
    },

    /**
     * 中心を動かさずに表示範囲を拡大・縮小する。
     * @param {"fx"|"price"} axis
     * @param {number} factor 1未満で狭める / 1より大きいと広げる
     */
    zoomView(axis, factor) {
      const { view } = store.getState();
      const spec = RANGE_LIMITS[axis];

      if (axis === "fx") {
        const next = scaleRange(
          { min: view.fxMin, max: view.fxMax },
          factor,
          spec
        );
        actions.updateView({ fxMin: next.min, fxMax: next.max });
      } else {
        const next = scaleRange(
          { min: view.priceMin, max: view.priceMax },
          factor,
          spec
        );
        actions.updateView({ priceMin: next.min, priceMax: next.max });
      }
    },

    /**
     * 指定した点を動かさずに、縦横を同じ倍率で拡大・縮小する。
     * 両軸の比率が保たれるので、等高線の形が崩れない。
     * @param {{fx:number, price:number}} point
     * @param {number} factor 1未満で狭める / 1より大きいと広げる
     */
    zoomViewAt(point, factor) {
      const { view } = store.getState();
      const fx = scaleRangeAt(
        { min: view.fxMin, max: view.fxMax },
        factor,
        point.fx,
        RANGE_LIMITS.fx
      );
      const price = scaleRangeAt(
        { min: view.priceMin, max: view.priceMax },
        factor,
        point.price,
        RANGE_LIMITS.price
      );
      actions.updateView({
        fxMin: fx.min,
        fxMax: fx.max,
        priceMin: price.min,
        priceMax: price.max,
      });
    },

    /**
     * 平均購入点と現在地の両方が収まるように表示範囲を合わせる。
     * どちらもグラフ外にあると損益分岐の位置関係が読めないため。
     */
    fitView() {
      const points = keyPointsOf(store.getState());
      if (points.length === 0) return;

      const fxValues = points.map((p) => p.fx);
      const priceValues = points.map((p) => p.price);
      // 点が1つでも幅が出るよう、最低限のマージンを確保する
      const fxPad = Math.max(
        8,
        (Math.max(...fxValues) - Math.min(...fxValues)) * 0.6
      );
      const pricePad = Math.max(
        Math.max(...priceValues) * 0.25,
        (Math.max(...priceValues) - Math.min(...priceValues)) * 0.6
      );

      actions.updateView({
        fxMin: Number((Math.min(...fxValues) - fxPad).toFixed(1)),
        fxMax: Number((Math.max(...fxValues) + fxPad).toFixed(1)),
        priceMin: Math.max(
          RANGE_LIMITS.price.min,
          Math.floor(Math.min(...priceValues) - pricePad)
        ),
        priceMax: Math.ceil(Math.max(...priceValues) + pricePad),
      });
    },

    /**
     * 平均購入点や現在地が表示範囲から外れていたら、自動で合わせ直す。
     * ユーザーが自分で決めた範囲は、外れていない限り触らない。
     * @returns {boolean} 調整したかどうか
     */
    autoFitIfOffscreen() {
      const state = store.getState();
      const points = keyPointsOf(state);
      if (points.length === 0) return false;

      const { view } = state;
      const offscreen = points.some(
        (p) =>
          p.fx < view.fxMin ||
          p.fx > view.fxMax ||
          p.price < view.priceMin ||
          p.price > view.priceMax
      );
      if (!offscreen) return false;

      actions.fitView();
      return true;
    },

    /* ---- ピン ---------------------------------------------------------- */

    addPin(rawFx, rawPrice) {
      const { pin, error } = validatePin(rawFx, rawPrice);
      if (error) {
        notify(error, "warning");
        return false;
      }

      const state = store.getState();
      if (state.pins.length >= MAX_PINS) {
        notify(`ピンは${MAX_PINS}個までです`, "warning");
        return false;
      }
      const duplicated = state.pins.some(
        (p) =>
          Math.abs(p.fx - pin.fx) < 0.01 && Math.abs(p.price - pin.price) < 0.01
      );
      if (duplicated) {
        notify("同じ位置にピンがすでにあります", "warning");
        return false;
      }

      store.update({
        pins: [...state.pins, { id: nextId("pin"), ...pin, visible: true }],
      });
      // 追加されたことはグラフ上の点とピンの一覧で見えている。ここも黙って通す
      return true;
    },

    togglePin(id, visible) {
      store.update((state) => ({
        pins: state.pins.map((p) => (p.id === id ? { ...p, visible } : p)),
      }));
    },

    removePin(id) {
      store.update((state) => ({
        pins: state.pins.filter((p) => p.id !== id),
      }));
    },

    /* ---- 売却条件（プローブ） -------------------------------------- */

    /**
     * グラフ上の座標へプローブを置く（クリック・タップ・ドラッグ）
     * @param {{fx:number, price:number}} point
     */
    placeProbe(point) {
      const { view } = store.getState();
      const fx = clamp(point.fx, view.fxMin, view.fxMax);
      const price = clamp(point.price, view.priceMin, view.priceMax);

      store.update((state) => {
        // 同じ位置なら通知しない（ドラッグ中の無駄な再描画を防ぐ）
        if (
          Math.abs((state.probe.fx ?? NaN) - fx) < 1e-9 &&
          Math.abs((state.probe.price ?? NaN) - price) < 1e-9
        ) {
          return null;
        }
        return { probe: { fx, price } };
      });
    },

    /**
     * 矢印キーによる微調整。表示範囲に対する相対量で動かすので、
     * どこまで拡大していても同じ操作感になる。
     * @param {{dx?:number, dy?:number, coarse?:boolean}} move dx/dy は -1 / 0 / 1
     */
    nudgeProbe({ dx = 0, dy = 0, coarse = false }) {
      const state = store.getState();
      const point = currentProbePoint(state);
      if (!point) return;

      const { view } = state;
      const divisor = coarse ? 20 : 100;
      const fxStep = (view.fxMax - view.fxMin) / divisor;
      const priceStep = (view.priceMax - view.priceMin) / divisor;

      actions.placeProbe({
        fx: point.fx + dx * fxStep,
        price: point.price + dy * priceStep,
      });
    },

    /**
     * 数値入力での直接指定。空欄にすると現在地への追従に戻る。
     * @param {"fx"|"price"} field
     * @param {string} rawValue
     */
    setProbeField(field, rawValue) {
      const text = String(rawValue ?? "").trim();
      if (text === "") {
        actions.resetProbe();
        return;
      }

      const { value, error } = validateField(field, text);
      if (error) {
        notify(error, "warning");
        return;
      }

      const point = currentProbePoint(store.getState());
      if (!point) return;

      const next = { ...point, [field]: value };
      // 数値で明示された値は丸めない。表示範囲の外なら範囲の方を広げる
      // （クリックやドラッグと違い、打ち込んだ値を勝手に変えられると気づけない）
      actions.ensurePointInView(next);
      actions.placeProbe(next);
    },

    /**
     * 指定した点が表示範囲に入るように、必要な分だけ範囲を広げる。
     * @param {{fx:number, price:number}} point
     */
    ensurePointInView(point) {
      const { view } = store.getState();
      const patch = {};
      const fxPad = (view.fxMax - view.fxMin) * 0.05;
      const pricePad = (view.priceMax - view.priceMin) * 0.05;

      if (point.fx < view.fxMin) patch.fxMin = point.fx - fxPad;
      if (point.fx > view.fxMax) patch.fxMax = point.fx + fxPad;
      if (point.price < view.priceMin) patch.priceMin = point.price - pricePad;
      if (point.price > view.priceMax) patch.priceMax = point.price + pricePad;

      if (Object.keys(patch).length > 0) actions.updateView(patch);
    },

    /** 現在地に戻す（＝追従状態に戻す） */
    resetProbe() {
      store.update((state) =>
        state.probe.fx == null && state.probe.price == null
          ? null
          : { probe: { fx: null, price: null } }
      );
    },

    /** 売却条件をピンとして残す */
    pinProbe() {
      const point = currentProbePoint(store.getState());
      if (!point) return false;
      return actions.addPin(point.fx, point.price);
    },

    /* ---- 保存・復元 ---------------------------------------------------- */

    refreshSavedNames() {
      store.update({ savedNames: repository.list() });
    },

    saveSnapshot(name) {
      const trimmed = String(name ?? "").trim();
      if (!trimmed) {
        notify("保存名を入力してください", "warning");
        return false;
      }
      const result = repository.save(trimmed, toSnapshot(store.getState()));
      if (!result.ok) {
        notify(result.reason ?? "保存できませんでした", "error");
        return false;
      }
      actions.refreshSavedNames();
      notify(`「${trimmed}」を保存しました`, "success");
      return true;
    },

    restoreSnapshot(name) {
      const raw = repository.load(name);
      if (!raw) {
        notify("保存データが見つかりませんでした", "error");
        return false;
      }
      const { patch, errors } = fromSnapshot(raw);
      if (!patch) {
        notify(errors[0] ?? "保存データを復元できませんでした", "error");
        return false;
      }
      store.update(patch);
      if (errors.length > 0) {
        notify(
          `一部の購入情報を読み込めませんでした（${errors.length}件）`,
          "warning"
        );
      } else {
        notify(`「${name}」を復元しました`, "success");
      }
      return true;
    },

    deleteSnapshot(name) {
      repository.remove(name);
      actions.refreshSavedNames();
      notify(`「${name}」を削除しました`, "success");
    },

    /** 入力内容を初期状態に戻す（保存データは消さない） */
    reset() {
      const state = store.getState();
      const initial = createInitialState();
      store.update({
        ...initial,
        // 取得済みの為替と保存一覧は引き継ぐ
        fxRate: state.fxRate,
        savedNames: state.savedNames,
        purchases: [createPurchase({ fx: state.fxRate.value ?? undefined })],
        view: state.fxRate.value
          ? { ...initial.view, ...pickFxRange(state.fxRate.value) }
          : initial.view,
      });
      notify("入力内容をリセットしました", "info");
    },

    /* ---- 為替レート ---------------------------------------------------- */

    /**
     * @param {{ force?: boolean, applyToPurchases?: boolean }} [options]
     */
    async refreshFxRate({ force = false, applyToPurchases = false } = {}) {
      const cache = preferences.getFxCache();
      if (!force && isCacheFresh(cache)) {
        applyRate(cache.value, cache.fetchedAt, "cache", applyToPurchases);
        return;
      }

      store.update((state) => ({
        fxRate: { ...state.fxRate, status: "loading" },
      }));

      const result = await fetchUsdJpyRate();

      if (result.ok) {
        const fetchedAt = Date.now();
        preferences.setFxCache(result.value, fetchedAt);
        applyRate(result.value, fetchedAt, "live", applyToPurchases);
        /*
          成功したことは告げない。
          押したボタンのすぐ下に「レート 最新 <時刻>」が出ており、値が変われば
          グラフも動く。見えている結果をもう一度言葉で繰り返すと、
          通知そのものが読み流す対象になり、本当に伝えたい失敗のときに効かなくなる。
          取得に失敗したときだけ報せる（下の warning）。
        */
        return;
      }

      if (cache) {
        applyRate(cache.value, cache.fetchedAt, "cache", applyToPurchases);
        notify(`${result.reason}。前回取得した値を使用します`, "warning");
        return;
      }

      applyRate(FALLBACK_RATE, null, "fallback", applyToPurchases);
      notify(`${result.reason}。参考値で表示します`, "warning");
    },
  };

  /** 為替レートを状態へ反映し、必要なら表示範囲と購入情報の初期値も合わせる */
  function applyRate(value, fetchedAt, status, applyToPurchases) {
    store.update((state) => {
      const patch = { fxRate: { value, fetchedAt, status } };

      if (applyToPurchases) {
        patch.view = { ...state.view, ...pickFxRange(value) };
        // まだ編集されていない初期値の行にだけ反映する
        patch.purchases = state.purchases.map((p) =>
          p.pristine ? { ...p, fx: Number(value.toFixed(1)) } : p
        );
      }
      return patch;
    });
  }

  return actions;
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/**
 * プローブの現在座標。未指定なら現在地に追従する（selectors と同じ規則）。
 * @returns {{fx:number, price:number}|null}
 */
function currentProbePoint(state) {
  const points = keyPointsOf(state);
  if (points.length === 0) return null;
  const current = points[1];
  return {
    fx: state.probe.fx ?? current.fx,
    price: state.probe.price ?? current.price,
  };
}

/**
 * グラフに必ず収まっていてほしい点（平均購入点と現在地）を集める。
 * @returns {Array<{fx:number, price:number}>}
 */
function keyPointsOf(state) {
  const valid = state.purchases.filter(
    (p) => p.price != null && p.fx != null && p.qty != null
  );
  if (valid.length === 0) return [];

  const totalQty = valid.reduce((acc, p) => acc + p.qty, 0);
  if (!(totalQty > 0)) return [];

  const average = {
    fx: valid.reduce((acc, p) => acc + p.fx * p.qty, 0) / totalQty,
    price: valid.reduce((acc, p) => acc + p.price * p.qty, 0) / totalQty,
  };

  const current = {
    fx: state.current.fx ?? state.fxRate.value ?? average.fx,
    price: state.current.price ?? average.price,
  };

  return [average, current];
}

/**
 * 為替レートから表示範囲を作る。
 * スライダーの刻み幅に合わせて丸めておかないと、初期表示直後にハンドルが
 * 勝手に動いたように見えてしまう。
 */
function pickFxRange(rate) {
  const step = RANGE_LIMITS.fx.step;
  const snap = (v) => Math.round(v / step) * step;

  const { fxMin, fxMax } = fxRangeFor(rate);
  const clamped = clampRange(
    { min: snap(fxMin), max: snap(fxMax) },
    RANGE_LIMITS.fx
  );
  return { fxMin: clamped.min, fxMax: clamped.max };
}
