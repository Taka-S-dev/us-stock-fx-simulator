/**
 * 米国株投資の損益を2次元グラフ用データとして計算
 * @param {Array} purchases - 購入履歴配列
 * @param {number} fxMin - 為替レート最小値
 * @param {number} fxMax - 為替レート最大値
 * @param {number} priceMin - 株価最小値
 * @param {number} priceMax - 株価最大値
 * @param {Array} pins - ピン情報配列
 * @returns {Object} グラフ描画用データ
 */

/**
 * 購入履歴の集計（View/Controller非依存）
 * - 証券ソフトなどの約定結果との突合に使えるよう、合計コスト（円/ドル）を返す
 * - 注意: 現時点では手数料・税・為替スプレッド等は未考慮（必要ならpurchaseに明示的に持たせて加算する）
 * @param {Array<{price:number, fx:number, qty:number, feeYen?:number, feeUsd?:number}>} purchases
 * @returns {{
 *   totalQty:number,
 *   totalCostYen:number,
 *   totalCostUsd:number,
 *   avgFx:number,
 *   avgPrice:number
 * }}
 */
export function aggregatePurchases(purchases) {
  if (!Array.isArray(purchases) || purchases.length === 0) {
    return {
      totalQty: 0,
      totalCostYen: 0,
      totalCostUsd: 0,
      avgFx: 0,
      avgPrice: 0,
    };
  }

  const totalQty = purchases.reduce((acc, p) => acc + (Number(p.qty) || 0), 0);
  if (totalQty === 0) {
    return {
      totalQty: 0,
      totalCostYen: 0,
      totalCostUsd: 0,
      avgFx: 0,
      avgPrice: 0,
    };
  }

  const totalCostYen = purchases.reduce((acc, p) => {
    const price = Number(p.price) || 0;
    const fx = Number(p.fx) || 0;
    const qty = Number(p.qty) || 0;
    const feeYen = Number(p.feeYen) || 0;
    // 円建ての手数料などを purchase 単位で持たせる場合に加算できる
    return acc + price * fx * qty + feeYen;
  }, 0);

  const totalCostUsd = purchases.reduce((acc, p) => {
    const price = Number(p.price) || 0;
    const qty = Number(p.qty) || 0;
    const feeUsd = Number(p.feeUsd) || 0;
    return acc + price * qty + feeUsd;
  }, 0);

  const avgFx =
    purchases.reduce(
      (acc, p) => acc + (Number(p.fx) || 0) * (Number(p.qty) || 0),
      0
    ) / totalQty;
  const avgPrice =
    purchases.reduce(
      (acc, p) => acc + (Number(p.price) || 0) * (Number(p.qty) || 0),
      0
    ) / totalQty;

  return { totalQty, totalCostYen, totalCostUsd, avgFx, avgPrice };
}

export function calculateGraphData(
  purchases,
  fxMin,
  fxMax,
  priceMin,
  priceMax,
  pins
) {
  try {
    // 入力値の検証
    const validationResult = validateCalculationInputs(
      purchases,
      fxMin,
      fxMax,
      priceMin,
      priceMax,
      pins
    );

    if (!validationResult.isValid) {
      console.error("計算入力値の検証に失敗:", validationResult.errors);
      throw new Error(
        `入力値が無効です: ${validationResult.errors.join(", ")}`
      );
    }

    const maxPoints = 200; // グラフの解像度

    // 購入データの集計
    const agg = aggregatePurchases(purchases);
    const totalQty = agg.totalQty;
    const totalCost = agg.totalCostYen;
    const costDollar = agg.totalCostUsd;
    const avgFx = agg.avgFx;
    const avgPrice = agg.avgPrice;

    // 為替・株価の範囲を均等分割
    const fxVals = linspace(fxMin, fxMax, maxPoints);
    const priceVals = linspace(priceMin, priceMax, maxPoints);

    // 損益計算用配列
    const profitYen = [];
    const profitRateYen = [];
    const profitRateUsd = [];

    // 2次元グリッドで損益を計算
    for (let i = 0; i < priceVals.length; i++) {
      const profitRow = [],
        rateYenRow = [],
        rateUsdRow = [];
      for (let j = 0; j < fxVals.length; j++) {
        const fx = fxVals[j];
        const price = priceVals[i];
        const profitY = fx * price * totalQty - totalCost;
        const profitU = price * totalQty - costDollar;

        const rateY = ((100 * profitY) / totalCost).toFixed(2);
        const rateU = ((100 * profitU) / costDollar).toFixed(2);

        profitRow.push(profitY);
        rateYenRow.push(`${rateY}%`);
        rateUsdRow.push(`${rateU}%`);
      }
      profitYen.push(profitRow);
      profitRateYen.push(rateYenRow);
      profitRateUsd.push(rateUsdRow);
    }

    // 損益分岐点の検出（損益が0になる境界線）
    const breakEvenPoints = [];
    for (let i = 0; i < priceVals.length; i++) {
      for (let j = 1; j < fxVals.length; j++) {
        const prev = profitYen[i][j - 1];
        const curr = profitYen[i][j];
        if ((prev < 0 && curr >= 0) || (prev > 0 && curr <= 0)) {
          breakEvenPoints.push({ x: fxVals[j], y: priceVals[i] });
          break;
        }
      }
    }

    // ピン情報に損益計算を追加（円表示は切り捨て仕様に統一）
    const enrichedPins = pins.map((p) => {
      const currentValueYen = Math.trunc(p.fx * p.price * totalQty);
      const avgAcqYen = totalQty ? totalCost / totalQty : 0;
      const { profitLossYen, profitLossRatePct } =
        computeYenValuationTruncTowardZero(
          avgAcqYen,
          totalQty,
          currentValueYen
        );

      const profitU = p.price * totalQty - costDollar;
      const rateU = `${((100 * profitU) / (costDollar || 1)).toFixed(2)}%`;

      return {
        ...p,
        profitYen: profitLossYen,
        rateYen: `${profitLossRatePct}%`,
        rateUsd: rateU,
      };
    });

    breakEvenPoints.sort((a, b) => a.x - b.x);
    return {
      fxVals,
      priceVals,
      profitYen,
      profitRateYen,
      profitRateUsd,
      averagePoint: { fx: avgFx, price: avgPrice },
      breakEvenPoints,
      enrichedPins,
      totalQty,
      totalCostYen: totalCost,
      costDollar,
    };
  } catch (error) {
    console.error("グラフデータ計算エラー:", error);
    // エラー時はデフォルト値を返す
    return {
      fxVals: [100, 200],
      priceVals: [1, 1000],
      profitYen: [
        [0, 0],
        [0, 0],
      ],
      profitRateYen: [
        ["0%", "0%"],
        ["0%", "0%"],
      ],
      profitRateUsd: [
        ["0%", "0%"],
        ["0%", "0%"],
      ],
      averagePoint: { fx: 140, price: 150 },
      breakEvenPoints: [],
      enrichedPins: [],
      totalQty: 0,
      totalCostYen: 0,
      costDollar: 0,
    };
  }
}

/**
 * テスト用（かつ実運用でも利用可能）: 小数桁を「0方向」に切り捨て
 * 例) -1.239,2桁 -> -1.23 /  1.239,2桁 -> 1.23
 */
export function truncToDigitsTowardZero(x, digits) {
  const m = 10 ** digits;
  return Math.trunc(x * m) / m;
}

/**
 * 小数桁を四捨五入
 */
export function roundToDigits(x, digits) {
  const m = 10 ** digits;
  return Math.round(x * m) / m;
}

/**
 * テスト用（かつ実運用でも利用可能）: 円未満切り捨て（0方向）
 */
export function truncToIntYen(x) {
  return Math.trunc(x);
}

/**
 * テスト用純粋関数（某証券表示ロジック準拠の円評価）
 * - UIやDOMに非依存
 * - 取得総額(円)は「平均取得価額[円] × 数量」を円未満切り捨て
 * - 損益(円) = 時価評価額[円] − 取得総額(円)
 * - 損益率(%) = (損益 ÷ 取得総額) × 100 を小数2桁で0方向切り捨て
 *
 * @param {number} avgAcqYen - 平均取得価額（円/株）
 * @param {number} qty - 数量（株）
 * @param {number} currentValueYen - 時価評価額（円）
 * @returns {{ totalAcqYen:number, profitLossYen:number, profitLossRatePct:number }}
 */
/**
 * 円評価（中立名）: 取得総額は円未満切り捨て、損益率は小数2桁で0方向切り捨て
 * （一般的な表示仕様を再現）
 */
export function computeYenValuationTruncTowardZero(
  avgAcqYen,
  qty,
  currentValueYen
) {
  const totalAcqYen = truncToIntYen(
    (Number(avgAcqYen) || 0) * (Number(qty) || 0)
  );
  const profitLossYen = (Number(currentValueYen) || 0) - totalAcqYen;
  const profitLossRatePct =
    totalAcqYen !== 0
      ? truncToDigitsTowardZero((profitLossYen / totalAcqYen) * 100, 2)
      : 0;
  return { totalAcqYen, profitLossYen, profitLossRatePct };
}

/**
 * USD評価の候補集合（丸め順の揺れに対応するため候補集合を返す）
 * @param {number} avgAcqUsd
 * @param {number} qty
 * @param {number} currentPriceUsd
 * @returns {{
 *  currentValueUsd:number,
 *  acqCandidates:number[],
 *  pnlCandidates:Set<number>,
 *  rateCandidates:Set<number>
 * }}
 */
export function computeUsdValuationCandidates(avgAcqUsd, qty, currentPriceUsd) {
  const q = Number(qty) || 0;
  const avg = Number(avgAcqUsd) || 0;
  const px = Number(currentPriceUsd) || 0;

  const currentValueUsd = roundToDigits(px * q, 2);
  const acqTotalRaw = avg * q;
  const acqCandidates = [
    acqTotalRaw,
    roundToDigits(acqTotalRaw, 2),
    truncToDigitsTowardZero(acqTotalRaw, 2),
  ];

  const pnlCandidates = new Set();
  for (const acq of acqCandidates) {
    pnlCandidates.add(roundToDigits(currentValueUsd - acq, 2));
    pnlCandidates.add(truncToDigitsTowardZero(currentValueUsd - acq, 2));
  }

  const rateCandidates = new Set();
  for (const acq of acqCandidates) {
    if (acq === 0) continue;
    const r = ((currentValueUsd - acq) / acq) * 100;
    rateCandidates.add(roundToDigits(r, 2));
    rateCandidates.add(truncToDigitsTowardZero(r, 2));
  }

  return { currentValueUsd, acqCandidates, pnlCandidates, rateCandidates };
}

/**
 * 計算入力値の検証
 * @param {Array} purchases - 購入履歴配列
 * @param {number} fxMin - 為替レート最小値
 * @param {number} fxMax - 為替レート最大値
 * @param {number} priceMin - 株価最小値
 * @param {number} priceMax - 株価最大値
 * @param {Array} pins - ピン情報配列
 * @returns {Object} 検証結果
 */
function validateCalculationInputs(
  purchases,
  fxMin,
  fxMax,
  priceMin,
  priceMax,
  pins
) {
  const errors = [];

  // 購入履歴の検証
  if (!Array.isArray(purchases) || purchases.length === 0) {
    errors.push("購入履歴が空です");
  } else {
    purchases.forEach((purchase, index) => {
      if (!purchase || typeof purchase !== "object") {
        errors.push(`購入履歴${index + 1}: 無効なデータ形式`);
        return;
      }

      if (!isValidNumber(purchase.price) || purchase.price <= 0) {
        errors.push(`購入履歴${index + 1}: 株価が無効 (${purchase.price})`);
      }

      if (!isValidNumber(purchase.fx) || purchase.fx <= 0) {
        errors.push(`購入履歴${index + 1}: 為替レートが無効 (${purchase.fx})`);
      }

      if (!isValidNumber(purchase.qty) || purchase.qty <= 0) {
        errors.push(`購入履歴${index + 1}: 株数が無効 (${purchase.qty})`);
      }
    });
  }

  // 為替レート範囲の検証
  if (!isValidNumber(fxMin) || fxMin <= 0) {
    errors.push(`為替レート最小値が無効 (${fxMin})`);
  }
  if (!isValidNumber(fxMax) || fxMax <= 0) {
    errors.push(`為替レート最大値が無効 (${fxMax})`);
  }
  if (fxMin >= fxMax) {
    errors.push(`為替レート範囲が無効 (${fxMin} >= ${fxMax})`);
  }

  // 株価範囲の検証
  if (!isValidNumber(priceMin) || priceMin <= 0) {
    errors.push(`株価最小値が無効 (${priceMin})`);
  }
  if (!isValidNumber(priceMax) || priceMax <= 0) {
    errors.push(`株価最大値が無効 (${priceMax})`);
  }
  if (priceMin >= priceMax) {
    errors.push(`株価範囲が無効 (${priceMin} >= ${priceMax})`);
  }

  // ピン情報の検証
  if (Array.isArray(pins)) {
    pins.forEach((pin, index) => {
      if (!pin || typeof pin !== "object") {
        errors.push(`ピン${index + 1}: 無効なデータ形式`);
        return;
      }

      if (!isValidNumber(pin.fx) || pin.fx <= 0) {
        errors.push(`ピン${index + 1}: 為替レートが無効 (${pin.fx})`);
      }

      if (!isValidNumber(pin.price) || pin.price <= 0) {
        errors.push(`ピン${index + 1}: 株価が無効 (${pin.price})`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 数値の妥当性をチェック
 * @param {any} value - チェックする値
 * @returns {boolean} 有効な数値かどうか
 */
function isValidNumber(value) {
  return typeof value === "number" && !isNaN(value) && isFinite(value);
}

/**
 * 指定範囲を均等分割した配列を生成
 * @param {number} start - 開始値
 * @param {number} end - 終了値
 * @param {number} num - 分割数
 * @returns {Array} 分割された値の配列
 */
function linspace(start, end, num) {
  const arr = [];
  const step = (end - start) / (num - 1);
  for (let i = 0; i < num; i++) arr.push(start + step * i);
  return arr;
}

// 購入履歴の状態管理
let purchases = [];

/**
 * 購入履歴を取得
 * @returns {Array} 購入履歴配列
 */
export function getPurchases() {
  return purchases;
}

/**
 * 購入履歴を設定
 * @param {Array} newPurchases - 新しい購入履歴配列
 */
export function setPurchases(newPurchases) {
  purchases.length = 0;
  purchases.push(...newPurchases);
}

/**
 * localStorageから購入履歴を復元
 * @param {string} name - 保存名
 * @returns {Array} 購入履歴配列
 */
export function getPurchasesFromStorage(name = "default") {
  const raw = localStorage.getItem("state::" + name);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return parsed.purchases ?? [];
  } catch (e) {
    console.error("JSON parse error", e);
    return [];
  }
}
