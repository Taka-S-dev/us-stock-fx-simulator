// model/calc.js
// 損益計算のコア。DOM / View / Controller に一切依存しない純粋関数のみを置く。
//
// 用語
//   totalCostYen : 取得総額（円）。株価×為替×株数 ＋ 手数料等の実費
//   totalCostUsd : 取得総額（USD）
//   avgAcqYen    : 平均取得価額（円/株）= totalCostYen / totalQty
//   avgFx/avgPrice : 「平均購入点」としてグラフに打つ座標。数量加重平均で、手数料を含まない

/** グラフのグリッド解像度（片側の分割数） */
export const GRID_RESOLUTION = 120;

/**
 * 指定範囲を均等分割した配列を生成
 * @param {number} start
 * @param {number} end
 * @param {number} num 2以上
 * @returns {number[]}
 */
export function linspace(start, end, num) {
  if (num < 2) return [start];
  const step = (end - start) / (num - 1);
  const arr = new Array(num);
  for (let i = 0; i < num; i++) arr[i] = start + step * i;
  // 浮動小数の累積誤差で端がずれないよう終端を厳密に合わせる
  arr[num - 1] = end;
  return arr;
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * 購入履歴の集計
 * @param {Array<{price:number, fx:number, qty:number, feeYen?:number, feeUsd?:number}>} purchases
 * @param {number} [extraCostYen] 購入履歴に紐づかない実費（円）。取得総額に加算する
 * @returns {{
 *   totalQty:number, totalCostYen:number, totalCostUsd:number,
 *   avgFx:number, avgPrice:number, avgAcqYen:number, avgAcqUsd:number
 * }}
 */
export function aggregatePurchases(purchases, extraCostYen = 0) {
  const empty = {
    totalQty: 0,
    totalCostYen: 0,
    totalCostUsd: 0,
    avgFx: 0,
    avgPrice: 0,
    avgAcqYen: 0,
    avgAcqUsd: 0,
  };
  if (!Array.isArray(purchases) || purchases.length === 0) return empty;

  const totalQty = purchases.reduce((acc, p) => acc + num(p.qty), 0);
  if (totalQty <= 0) return empty;

  const totalCostYen =
    purchases.reduce(
      (acc, p) => acc + num(p.price) * num(p.fx) * num(p.qty) + num(p.feeYen),
      0
    ) + num(extraCostYen);

  const totalCostUsd = purchases.reduce(
    (acc, p) => acc + num(p.price) * num(p.qty) + num(p.feeUsd),
    0
  );

  const avgFx =
    purchases.reduce((acc, p) => acc + num(p.fx) * num(p.qty), 0) / totalQty;
  const avgPrice =
    purchases.reduce((acc, p) => acc + num(p.price) * num(p.qty), 0) / totalQty;

  return {
    totalQty,
    totalCostYen,
    totalCostUsd,
    avgFx,
    avgPrice,
    avgAcqYen: totalCostYen / totalQty,
    avgAcqUsd: totalCostUsd / totalQty,
  };
}

/* -------------------------------------------------------------------------- */
/* 丸め                                                                        */
/* -------------------------------------------------------------------------- */

/** 小数桁を「0方向」に切り捨て 例) -1.239,2桁 -> -1.23 / 1.239,2桁 -> 1.23 */
export function truncToDigitsTowardZero(x, digits) {
  const m = 10 ** digits;
  return Math.trunc(x * m) / m;
}

/** 小数桁を四捨五入 */
export function roundToDigits(x, digits) {
  const m = 10 ** digits;
  return Math.round(x * m) / m;
}

/** 円未満切り捨て（0方向） */
export function truncToIntYen(x) {
  return Math.trunc(x);
}

/* -------------------------------------------------------------------------- */
/* 評価損益                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 円評価（証券会社の一般的な表示仕様を再現）
 * - 取得総額(円) = 平均取得価額[円] × 数量 を円未満切り捨て
 * - 損益(円)     = 時価評価額[円] − 取得総額(円)
 * - 損益率(%)    = 損益 ÷ 取得総額 × 100 を小数2桁で0方向切り捨て
 *
 * @param {number} avgAcqYen 平均取得価額（円/株）
 * @param {number} qty 数量（株）
 * @param {number} currentValueYen 時価評価額（円）
 * @returns {{ totalAcqYen:number, profitLossYen:number, profitLossRatePct:number }}
 */
export function computeYenValuationTruncTowardZero(
  avgAcqYen,
  qty,
  currentValueYen
) {
  const totalAcqYen = truncToIntYen(num(avgAcqYen) * num(qty));
  const profitLossYen = num(currentValueYen) - totalAcqYen;
  const profitLossRatePct =
    totalAcqYen !== 0
      ? truncToDigitsTowardZero((profitLossYen / totalAcqYen) * 100, 2)
      : 0;
  return { totalAcqYen, profitLossYen, profitLossRatePct };
}

/**
 * USD評価の候補集合（証券会社ごとの丸め順の揺れを許容するため候補で返す）
 * @param {number} avgAcqUsd
 * @param {number} qty
 * @param {number} currentPriceUsd
 * @returns {{ currentValueUsd:number, acqCandidates:number[], pnlCandidates:Set<number>, rateCandidates:Set<number> }}
 */
export function computeUsdValuationCandidates(avgAcqUsd, qty, currentPriceUsd) {
  const q = num(qty);
  const avg = num(avgAcqUsd);
  const px = num(currentPriceUsd);

  const currentValueUsd = roundToDigits(px * q, 2);
  const acqTotalRaw = avg * q;
  const acqCandidates = [
    acqTotalRaw,
    roundToDigits(acqTotalRaw, 2),
    truncToDigitsTowardZero(acqTotalRaw, 2),
  ];

  const pnlCandidates = new Set();
  const rateCandidates = new Set();
  for (const acq of acqCandidates) {
    pnlCandidates.add(roundToDigits(currentValueUsd - acq, 2));
    pnlCandidates.add(truncToDigitsTowardZero(currentValueUsd - acq, 2));
    if (acq === 0) continue;
    const r = ((currentValueUsd - acq) / acq) * 100;
    rateCandidates.add(roundToDigits(r, 2));
    rateCandidates.add(truncToDigitsTowardZero(r, 2));
  }

  return { currentValueUsd, acqCandidates, pnlCandidates, rateCandidates };
}

/**
 * 任意の1点（為替 × 株価）での損益を求める。
 * グラフのホバー表示・ピン・画像出力すべてがこの関数を使うことで表示値の食い違いを防ぐ。
 *
 * @param {{fx:number, price:number}} point
 * @param {ReturnType<typeof aggregatePurchases>} agg
 * @returns {{ profitYen:number, rateYenPct:number, profitUsd:number, rateUsdPct:number, valueYen:number, valueUsd:number }}
 */
export function valuationAt({ fx, price }, agg) {
  const { totalQty, totalCostUsd, avgAcqYen } = agg;
  if (!(totalQty > 0)) {
    return {
      profitYen: 0,
      rateYenPct: 0,
      profitUsd: 0,
      rateUsdPct: 0,
      valueYen: 0,
      valueUsd: 0,
    };
  }

  const valueYen = truncToIntYen(num(fx) * num(price) * totalQty);
  const { profitLossYen, profitLossRatePct } =
    computeYenValuationTruncTowardZero(avgAcqYen, totalQty, valueYen);

  const valueUsd = num(price) * totalQty;
  const profitUsd = valueUsd - totalCostUsd;
  const rateUsdPct =
    totalCostUsd !== 0
      ? truncToDigitsTowardZero((profitUsd / totalCostUsd) * 100, 2)
      : 0;

  return {
    profitYen: profitLossYen,
    rateYenPct: profitLossRatePct,
    profitUsd,
    rateUsdPct,
    valueYen,
    valueUsd,
  };
}

/* -------------------------------------------------------------------------- */
/* 損益分岐                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 損益分岐ライン（円建て）。
 *
 * 損益 = fx × price × totalQty − totalCostYen なので、損益0の条件は
 *   fx × price = totalCostYen / totalQty = avgAcqYen
 * という双曲線で閉じた形で解ける。グリッド走査は不要。
 *
 * 表示範囲で切り取った区間だけを返すため、範囲外に伸びる無駄な点を持たない。
 *
 * @param {ReturnType<typeof aggregatePurchases>} agg
 * @param {{fxMin:number, fxMax:number, priceMin:number, priceMax:number}} view
 * @param {number} [resolution] 曲線の分割数
 * @returns {Array<{fx:number, price:number}>}
 */
export function breakEvenCurve(agg, view, resolution = GRID_RESOLUTION) {
  const { totalQty, avgAcqYen } = agg;
  if (!(totalQty > 0) || !(avgAcqYen > 0)) return [];

  // price = avgAcqYen / fx を表示範囲でクリップ
  const fxLo = Math.max(view.fxMin, avgAcqYen / view.priceMax);
  const fxHi = Math.min(view.fxMax, avgAcqYen / view.priceMin);
  if (!(fxHi > fxLo)) return [];

  return linspace(fxLo, fxHi, resolution).map((fx) => ({
    fx,
    price: avgAcqYen / fx,
  }));
}

/**
 * USD建ての損益分岐株価（= 平均取得価額 USD/株）。為替に依存しない水平線。
 * @param {ReturnType<typeof aggregatePurchases>} agg
 * @returns {number|null}
 */
export function breakEvenPriceUsd(agg) {
  return agg.totalQty > 0 ? agg.avgAcqUsd : null;
}

/* -------------------------------------------------------------------------- */
/* グラフ用データ                                                              */
/* -------------------------------------------------------------------------- */

/**
 * 損益グリッド。z[priceIndex][fxIndex] の2次元配列（Plotlyのz形式に合わせる）。
 *
 * 損益率は z から一次変換で求まるだけなので配列化しない（旧実装は同サイズの
 * 文字列配列を2枚持っていて、再描画ごとに数万個の文字列を生成していた）。
 *
 * @param {ReturnType<typeof aggregatePurchases>} agg
 * @param {{fxMin:number, fxMax:number, priceMin:number, priceMax:number}} view
 * @param {number} [resolution]
 * @returns {{ fxVals:number[], priceVals:number[], profitYen:number[][] }}
 */
export function buildProfitGrid(agg, view, resolution = GRID_RESOLUTION) {
  const fxVals = linspace(view.fxMin, view.fxMax, resolution);
  const priceVals = linspace(view.priceMin, view.priceMax, resolution);
  const { totalQty, totalCostYen } = agg;

  const profitYen = priceVals.map((price) => {
    const row = new Array(fxVals.length);
    const priceQty = price * totalQty;
    for (let j = 0; j < fxVals.length; j++) {
      row[j] = fxVals[j] * priceQty - totalCostYen;
    }
    return row;
  });

  return { fxVals, priceVals, profitYen };
}

/**
 * グラフ描画に必要な一式を組み立てる。
 *
 * @param {Object} params
 * @param {Array<{price:number, fx:number, qty:number}>} params.purchases
 * @param {{fxMin:number, fxMax:number, priceMin:number, priceMax:number}} params.view
 * @param {Array<{fx:number, price:number, visible?:boolean}>} [params.pins]
 * @param {number} [params.extraCostYen]
 * @param {number} [params.resolution]
 * @returns {{
 *   fxVals:number[], priceVals:number[], profitYen:number[][],
 *   aggregate:ReturnType<typeof aggregatePurchases>,
 *   averagePoint:{fx:number, price:number}|null,
 *   breakEvenPoints:Array<{fx:number, price:number}>,
 *   breakEvenPriceUsd:number|null,
 *   pins:Array<{fx:number, price:number, visible:boolean, profitYen:number, rateYenPct:number, profitUsd:number, rateUsdPct:number}>
 * }}
 */
export function calculateGraphData({
  purchases,
  view,
  pins = [],
  extraCostYen = 0,
  resolution = GRID_RESOLUTION,
}) {
  const aggregate = aggregatePurchases(purchases, extraCostYen);
  const { fxVals, priceVals, profitYen } = buildProfitGrid(
    aggregate,
    view,
    resolution
  );

  return {
    fxVals,
    priceVals,
    profitYen,
    aggregate,
    purchases: purchases.map((p) => ({
      fx: p.fx,
      price: p.price,
      qty: p.qty,
    })),
    averagePoint:
      aggregate.totalQty > 0
        ? { fx: aggregate.avgFx, price: aggregate.avgPrice }
        : null,
    breakEvenPoints: breakEvenCurve(aggregate, view, resolution),
    breakEvenPriceUsd: breakEvenPriceUsd(aggregate),
    pins: pins.map((pin) => ({
      ...pin,
      visible: pin.visible !== false,
      ...valuationAt(pin, aggregate),
    })),
  };
}
