import { describe, expect, it, vi } from "vitest";
import { createInitialState, createStore } from "../public/model/store.js";
import {
  resetSelectorCache,
  selectCurrentPoint,
  selectCurrentValuation,
  selectGraphData,
  selectInputErrors,
  selectIsPlottable,
  selectProbePoint,
  selectProbeValuation,
  selectScenarios,
  selectSummary,
  selectValidPurchases,
} from "../public/model/selectors.js";
import { createPurchase, validatePurchase } from "../public/model/purchase.js";

describe("createStore", () => {
  it("更新のたびに購読者へ通知する", () => {
    const store = createStore({ count: 0 });
    const listener = vi.fn();
    store.subscribe(listener);

    store.update({ count: 1 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getState().count).toBe(1);
  });

  it("関数を渡すと現在の状態を受け取れる", () => {
    const store = createStore({ count: 1 });
    store.update((s) => ({ count: s.count + 1 }));
    expect(store.getState().count).toBe(2);
  });

  it("null を返すと通知しない（無駄な再描画を避ける）", () => {
    const store = createStore({ count: 1 });
    const listener = vi.fn();
    store.subscribe(listener);

    store.update(() => null);
    expect(listener).not.toHaveBeenCalled();
  });

  it("状態を書き換えず新しいオブジェクトに差し替える", () => {
    const store = createStore({ count: 1 });
    const before = store.getState();
    store.update({ count: 2 });
    expect(store.getState()).not.toBe(before);
    expect(before.count).toBe(1);
  });

  it("解除すると通知が止まる", () => {
    const store = createStore({ count: 0 });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.update({ count: 1 });
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("selectors", () => {
  const stateWith = (purchases) =>
    createInitialState({ purchases, savedNames: [] });

  it("有効な購入情報だけを計算対象にする", () => {
    const valid = createPurchase();
    const invalid = validatePurchase(createPurchase(), { qty: "0" });
    const state = stateWith([valid, invalid]);

    expect(selectValidPurchases(state)).toEqual([valid]);
    expect(selectIsPlottable(state)).toBe(true);
    expect(selectInputErrors(state)[0]).toContain("購入情報2");
  });

  it("有効な購入情報が無ければグラフを描かない", () => {
    const state = stateWith([validatePurchase(createPurchase(), { qty: "" })]);
    expect(selectIsPlottable(state)).toBe(false);
    expect(selectGraphData(state)).toBeNull();
  });

  it("入力が変わらなければグラフデータを作り直さない", () => {
    resetSelectorCache();
    const state = stateWith([createPurchase()]);
    expect(selectGraphData(state)).toBe(selectGraphData(state));
  });

  it("入力が変わればグラフデータを作り直す", () => {
    resetSelectorCache();
    const first = selectGraphData(stateWith([createPurchase()]));
    const second = selectGraphData(
      stateWith([validatePurchase(createPurchase(), { qty: "20" })])
    );
    expect(second).not.toBe(first);
    expect(second.aggregate.totalQty).toBe(20);
  });

  it("取得の内訳を返す", () => {
    resetSelectorCache();
    const state = stateWith([createPurchase({ price: 100, fx: 150, qty: 2 })]);
    const summary = selectSummary(state);

    // 取得総額 30,000円 / 2株 = 15,000円/株
    expect(summary.aggregate.avgAcqYen).toBeCloseTo(15000, 8);
    expect(summary.breakEvenPriceUsd).toBeCloseTo(100, 8);
  });
});

describe("現在地のセレクタ", () => {
  const stateWith = (overrides = {}) => ({
    ...createInitialState({
      purchases: [createPurchase({ price: 100, fx: 150, qty: 2 })],
      savedNames: [],
    }),
    ...overrides,
  });

  it("未入力なら取得した為替レートと平均購入株価に追従する", () => {
    resetSelectorCache();
    const state = stateWith({
      fxRate: { value: 160, fetchedAt: 1, status: "live" },
    });
    const point = selectCurrentPoint(state);

    expect(point).toMatchObject({ fx: 160, price: 100 });
    expect(point.fxAuto).toBe(true);
    expect(point.priceAuto).toBe(true);
  });

  it("入力された値は取得レートより優先される", () => {
    resetSelectorCache();
    const state = stateWith({
      fxRate: { value: 160, fetchedAt: 1, status: "live" },
      current: { fx: 145, price: 130 },
    });
    const point = selectCurrentPoint(state);

    expect(point).toMatchObject({ fx: 145, price: 130 });
    expect(point.fxAuto).toBe(false);
    expect(point.priceAuto).toBe(false);
  });

  it("為替レートが未取得でも平均購入為替で成立する", () => {
    resetSelectorCache();
    expect(selectCurrentPoint(stateWith())).toMatchObject({
      fx: 150,
      price: 100,
    });
  });

  it("現在地の評価に感応度と損益分岐距離が揃う", () => {
    resetSelectorCache();
    const state = stateWith({
      fxRate: { value: 165, fetchedAt: 1, status: "live" },
    });
    const current = selectCurrentValuation(state);

    // 為替165 × 株価100 × 2株 = 33,000円、取得30,000円
    expect(current.valuation.profitYen).toBe(3000);
    expect(current.sensitivity.perYen).toBe(200); // 株価100 × 2株
    expect(current.breakEven.breakEvenPrice).toBeCloseTo(15000 / 165, 8);
  });

  it("購入情報が無効なら null", () => {
    resetSelectorCache();
    const state = stateWith({
      purchases: [validatePurchase(createPurchase(), { qty: "0" })],
    });
    expect(selectCurrentPoint(state)).toBeNull();
    expect(selectCurrentValuation(state)).toBeNull();
    expect(selectScenarios(state)).toBeNull();
  });

  it("プローブは未指定なら現在地に一致する", () => {
    resetSelectorCache();
    const state = stateWith({
      fxRate: { value: 160, fetchedAt: 1, status: "live" },
    });
    const probe = selectProbePoint(state);

    expect(probe).toMatchObject({ fx: 160, price: 100 });
    expect(probe.followsCurrent).toBe(true);

    // 現在地と一致しているので差分は0
    const valuation = selectProbeValuation(state);
    expect(valuation.delta).toMatchObject({ fx: 0, price: 0, profitYen: 0 });
  });

  it("片方だけ指定しても、もう片方は現在地に追従する", () => {
    resetSelectorCache();
    const state = stateWith({
      fxRate: { value: 160, fetchedAt: 1, status: "live" },
      probe: { fx: null, price: 180 },
    });
    const probe = selectProbePoint(state);

    expect(probe).toMatchObject({ fx: 160, price: 180 });
    expect(probe.followsCurrent).toBe(false);
  });

  it("プローブを動かすと現在地からの差分が出る", () => {
    resetSelectorCache();
    const state = stateWith({
      fxRate: { value: 150, fetchedAt: 1, status: "live" },
      probe: { fx: 160, price: 120 },
    });
    const { valuation, delta, breakEven } = selectProbeValuation(state);

    // 為替160 × 株価120 × 2株 = 38,400円、取得30,000円
    expect(valuation.profitYen).toBe(8400);
    // 現在地（150 × 100 × 2 = 30,000円）との差
    expect(delta).toMatchObject({ fx: 10, price: 20, profitYen: 8400 });
    // 分岐水準はプローブ地点を基準に求まる
    expect(breakEven.breakEvenPrice).toBeCloseTo(15000 / 160, 8);
  });

  it("購入情報が無効ならプローブも null", () => {
    resetSelectorCache();
    const state = stateWith({
      purchases: [validatePurchase(createPurchase(), { qty: "0" })],
      probe: { fx: 160, price: 120 },
    });
    expect(selectProbePoint(state)).toBeNull();
    expect(selectProbeValuation(state)).toBeNull();
  });

  it("シナリオ表は現在地を中心に組み立てられる", () => {
    resetSelectorCache();
    const state = stateWith({
      fxRate: { value: 150, fetchedAt: 1, status: "live" },
    });
    const matrix = selectScenarios(state);

    expect(matrix.columns.map((c) => c.fx)).toEqual([140, 150, 160]);
    expect(matrix.rows[1].cells[1].profitYen).toBe(0);
  });
});
