// model/selectors.js
// 状態から描画に必要な値を導出する層。状態には「入力そのもの」だけを持たせ、
// 集計・グラフ用データは常にここで導出する（同じ値を二重に持たない）。

import {
  breakEvenDistanceFrom,
  currencyDivergence,
  scenarioMatrix,
  sensitivityAt,
} from "./analysis.js";
import { calculateGraphData, valuationAt } from "./calc.js";
import { isPurchaseValid } from "./purchase.js";

/** 計算に使える購入履歴だけを取り出す */
export function selectValidPurchases(state) {
  return state.purchases.filter(isPurchaseValid);
}

/** 入力エラーを1本のリストにまとめる */
export function selectInputErrors(state) {
  const errors = [];
  state.purchases.forEach((p, i) => {
    for (const message of Object.values(p.errors ?? {})) {
      errors.push(`購入情報${i + 1}: ${message}`);
    }
  });
  return errors;
}

/** グラフを描ける状態か */
export function selectIsPlottable(state) {
  return selectValidPurchases(state).length > 0;
}

// グラフデータは配列が大きいので、入力が変わっていなければ作り直さない
let memo = { key: null, value: null };

/**
 * グラフ描画用データ。入力が同じなら前回の結果を返す。
 * @returns {ReturnType<typeof calculateGraphData>|null}
 */
export function selectGraphData(state) {
  const purchases = selectValidPurchases(state);
  if (purchases.length === 0) return null;

  const key = [
    purchases.map((p) => `${p.price}/${p.fx}/${p.qty}`).join(","),
    state.extraCostYen,
    state.view.fxMin,
    state.view.fxMax,
    state.view.priceMin,
    state.view.priceMax,
    state.pins.map((p) => `${p.fx}/${p.price}/${p.visible}`).join(","),
  ].join("|");

  if (memo.key === key) return memo.value;

  const value = calculateGraphData({
    purchases,
    view: state.view,
    pins: state.pins,
    extraCostYen: state.extraCostYen,
  });
  memo = { key, value };
  return value;
}

/** テスト用: メモをクリアする */
export function resetSelectorCache() {
  memo = { key: null, value: null };
}

/**
 * 「現在地」＝今この瞬間の為替と株価。
 *
 * state.current は、ユーザーが明示的に入力したときだけ値が入る。
 * 未入力（null）のあいだは取得した為替レートと平均購入株価に自動追従するので、
 * 「レートを再取得したら現在地も更新される」という当たり前の挙動になる。
 */
export function selectCurrentPoint(state) {
  const graph = selectGraphData(state);
  if (!graph) return null;

  const { aggregate } = graph;
  return {
    fx: state.current.fx ?? state.fxRate.value ?? aggregate.avgFx,
    price: state.current.price ?? aggregate.avgPrice,
    /** 入力欄が自動追従中かどうか（UIの補足表示に使う） */
    fxAuto: state.current.fx == null,
    priceAuto: state.current.price == null,
  };
}

/**
 * 現在地における評価。画面の主役になる数字。
 */
export function selectCurrentValuation(state) {
  const graph = selectGraphData(state);
  const point = selectCurrentPoint(state);
  if (!graph || !point) return null;

  return {
    point,
    aggregate: graph.aggregate,
    valuation: valuationAt(point, graph.aggregate),
    sensitivity: sensitivityAt(point, graph.aggregate),
    breakEven: breakEvenDistanceFrom(point, graph.aggregate),
    divergence: currencyDivergence(valuationAt(point, graph.aggregate)),
  };
}

/** シナリオ比較表 */
export function selectScenarios(state) {
  const graph = selectGraphData(state);
  const point = selectCurrentPoint(state);
  if (!graph || !point) return null;
  return scenarioMatrix(point, graph.aggregate);
}

/**
 * 平均取得のサマリー。
 */
export function selectSummary(state) {
  const graph = selectGraphData(state);
  if (!graph) return null;

  const { aggregate } = graph;
  return {
    aggregate,
    breakEvenPriceUsd: graph.breakEvenPriceUsd,
  };
}

/**
 * 検討中の条件（プローブ）の座標。
 * 未指定のあいだは現在地に追従するので、初期状態では「現在地＝検討点」になる。
 */
export function selectProbePoint(state) {
  const current = selectCurrentPoint(state);
  if (!current) return null;
  return {
    fx: state.probe.fx ?? current.fx,
    price: state.probe.price ?? current.price,
    /** 現在地に追従中か（＝まだ動かしていないか） */
    followsCurrent: state.probe.fx == null && state.probe.price == null,
  };
}

/**
 * プローブ地点の評価。
 * 現在地との差分も返すことで、「動かした結果どれだけ変わるのか」を示せる。
 */
export function selectProbeValuation(state) {
  const graph = selectGraphData(state);
  const point = selectProbePoint(state);
  const current = selectCurrentValuation(state);
  if (!graph || !point || !current) return null;

  const valuation = valuationAt(point, graph.aggregate);

  return {
    point,
    valuation,
    aggregate: graph.aggregate,
    breakEven: breakEvenDistanceFrom(point, graph.aggregate),
    /** 円建てとUSD建てで損益の符号が食い違っているか */
    divergence: currencyDivergence(valuation),
    /** 現在地からの変化 */
    delta: {
      fx: point.fx - current.point.fx,
      price: point.price - current.point.price,
      profitYen: valuation.profitYen - current.valuation.profitYen,
    },
  };
}
