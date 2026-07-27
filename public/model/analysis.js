// model/analysis.js
// 「で、結局どうなのか」に数字で答えるための分析。すべて純粋関数。
//
// 損益は
//     P(fx, price) = fx × price × qty − 取得総額(円)
// という双一次式なので、感応度も損益分岐までの距離も近似を使わずに解ける。

import { valuationAt } from "./calc.js";

/**
 * ある地点における感応度（1単位動いたときに損益が何円変わるか）。
 *
 *   ∂P/∂fx    = price × qty   … 為替が 1 円動いたときの損益変化
 *   ∂P/∂price = fx × qty      … 株価が $1 動いたときの損益変化
 *
 * 率で見た場合はどちらも fx × price × qty × 1% で等しくなる。
 * 「％では為替も株価も同じだけ効くが、1円/1ドル単位ではこちらが効く」という
 * 比較ができるようにするため、両方を返す。
 *
 * @param {{fx:number, price:number}} point
 * @param {ReturnType<typeof import("./calc.js").aggregatePurchases>} agg
 */
export function sensitivityAt({ fx, price }, agg) {
  const { totalQty } = agg;
  if (!(totalQty > 0)) return null;

  const perYen = price * totalQty;
  const perDollar = fx * totalQty;
  const perPercent = (fx * price * totalQty) / 100;

  return {
    perYen,
    perDollar,
    perPercent,
    /** 1円/1ドル単位で影響が大きいのはどちらか */
    dominant: perDollar > perYen ? "price" : perYen > perDollar ? "fx" : "even",
  };
}

/**
 * 損益分岐点までの距離。
 * 損益0の条件は fx × price = 平均取得価額(円/株) なので、片方を固定すれば
 * もう片方の分岐水準がそのまま逆算できる。
 *
 * @param {{fx:number, price:number}} point
 * @param {ReturnType<typeof import("./calc.js").aggregatePurchases>} agg
 */
export function breakEvenDistanceFrom({ fx, price }, agg) {
  const { avgAcqYen } = agg;
  if (!(avgAcqYen > 0) || !(fx > 0) || !(price > 0)) return null;

  const breakEvenPrice = avgAcqYen / fx; // 為替を今のままとした場合
  const breakEvenFx = avgAcqYen / price; // 株価を今のままとした場合

  return {
    breakEvenPrice,
    priceDelta: breakEvenPrice - price,
    pricePct: (breakEvenPrice / price - 1) * 100,

    breakEvenFx,
    fxDelta: breakEvenFx - fx,
    fxPct: (breakEvenFx / fx - 1) * 100,

    /** すでに利益が出ているか（分岐点より上か） */
    inProfit: fx * price > avgAcqYen,
  };
}

/**
 * 円建てとUSD建てで損益の符号が食い違っているかを判定する。
 *
 * このアプリが存在する理由そのもの。損益を動かす要因は株価と為替の2つしかないので、
 * 符号がずれていれば原因は必ず為替である:
 *
 *   "usdOnly" … 株価では利益だが、円高に食われて円換算では損失
 *   "yenOnly" … 株価では損失だが、円安に助けられて円換算では利益
 *
 * グラフ上では「損益分岐ライン（円建て）」と「損益分岐（USD建て）」に挟まれた
 * 領域がこれにあたる。
 *
 * @param {{profitYen:number, profitUsd:number}} valuation
 * @returns {"usdOnly"|"yenOnly"|null} 一致していれば null
 */
export function currencyDivergence({ profitYen, profitUsd }) {
  if (!Number.isFinite(profitYen) || !Number.isFinite(profitUsd)) return null;
  if (profitYen === 0 || profitUsd === 0) return null;
  if (profitYen > 0 === profitUsd > 0) return null;
  return profitUsd > 0 ? "usdOnly" : "yenOnly";
}

/** シナリオ比較表の既定の振れ幅 */
export const DEFAULT_SCENARIOS = {
  /** 為替の振れ幅（円）。マイナスが円高 */
  fxDeltas: [-10, 0, 10],
  /** 株価の変化率。降順に並べるとグラフの縦軸と向きが揃う */
  priceRatios: [0.2, 0, -0.2],
};

/**
 * 為替 × 株価のシナリオ比較表を作る。
 * @param {{fx:number, price:number}} point 基準となる現在地
 * @param {ReturnType<typeof import("./calc.js").aggregatePurchases>} agg
 * @param {{fxDeltas:number[], priceRatios:number[]}} [scenarios]
 */
export function scenarioMatrix(point, agg, scenarios = DEFAULT_SCENARIOS) {
  if (!(agg.totalQty > 0)) return null;

  const columns = scenarios.fxDeltas.map((fxDelta) => ({
    fxDelta,
    fx: point.fx + fxDelta,
  }));

  const rows = scenarios.priceRatios.map((priceRatio) => {
    const price = point.price * (1 + priceRatio);
    return {
      priceRatio,
      price,
      cells: columns.map((column) => ({
        ...column,
        price,
        ...valuationAt({ fx: column.fx, price }, agg),
      })),
    };
  });

  return { columns, rows };
}

/**
 * 等高線の間隔を「切りのいい数字」に丸める。
 * 1 / 2 / 5 × 10^n から選ぶことで、ラベルが 10万・20万 のように読みやすくなる。
 *
 * @param {number} extent 0 から端までの幅
 * @param {number} [targetLines] 片側に引きたい本数の目安
 */
export function niceContourStep(extent, targetLines = 5) {
  if (!(extent > 0)) return 1;
  const raw = extent / targetLines;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const factor =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return factor * magnitude;
}
