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
    const totalQty = purchases.reduce((acc, p) => acc + p.qty, 0);
    const totalCost = purchases.reduce(
      (acc, p) => acc + p.price * p.fx * p.qty,
      0
    );
    const costDollar = purchases.reduce((acc, p) => acc + p.price * p.qty, 0);
    const avgFx =
      purchases.reduce((acc, p) => acc + p.fx * p.qty, 0) / totalQty;
    const avgPrice =
      purchases.reduce((acc, p) => acc + p.price * p.qty, 0) / totalQty;

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

    // ピン情報に損益計算を追加
    const enrichedPins = pins.map((p) => {
      const profitY = p.fx * p.price * totalQty - totalCost;
      const profitU = p.price * totalQty - costDollar;
      const rateY = `${((100 * profitY) / totalCost).toFixed(2)}%`;
      const rateU = `${((100 * profitU) / costDollar).toFixed(2)}%`;
      return { ...p, profitYen: profitY, rateYen: rateY, rateUsd: rateU };
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
      costDollar: 0,
    };
  }
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
