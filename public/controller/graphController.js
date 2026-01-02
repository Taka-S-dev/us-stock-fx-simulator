import { getPurchaseInputs } from "../view/form.js";

import { calculateGraphData } from "../model/calc.js";
import { renderGraph } from "../view/plot.js";
import { customPins } from "../model/pins.js";
import { renderPinSettings } from "../view/pinSettings.js";

import { showToast } from "../view/toast.js";

// デバウンス用のタイマー
let graphUpdateTimeout = null;
let isGraphUpdating = false;

// デバウンス付きグラフ更新関数
const debouncedUpdateGraph = () => {
  if (graphUpdateTimeout) {
    clearTimeout(graphUpdateTimeout);
  }
  graphUpdateTimeout = setTimeout(() => {
    if (!isGraphUpdating) {
      updateGraphInternal();
    }
  }, 60); // 60msのデバウンス（バランス型）
};

// 内部グラフ更新関数
function updateGraphInternal() {
  try {
    isGraphUpdating = true;

    // スライダーから直接値を取得
    const fxSlider = document.getElementById("fx-slider")?.noUiSlider;
    const priceSlider = document.getElementById("price-slider")?.noUiSlider;

    let fxMin = 120,
      fxMax = 160,
      priceMin = 100,
      priceMax = 300;

    if (fxSlider && priceSlider) {
      try {
        [fxMin, fxMax] = fxSlider.get().map(parseFloat);
        [priceMin, priceMax] = priceSlider.get().map(parseFloat);
      } catch (error) {
        console.error("❌ スライダー値取得エラー:", error);
      }
    } else {
      // スライダーが見つからない場合は入力フィールドから取得
      const fxMinInput = document.getElementById("fx-min-input");
      const fxMaxInput = document.getElementById("fx-max-input");
      const priceMinInput = document.getElementById("price-min-input");
      const priceMaxInput = document.getElementById("price-max-input");

      if (fxMinInput && fxMaxInput) {
        fxMin = parseFloat(fxMinInput.value) || 120;
        fxMax = parseFloat(fxMaxInput.value) || 160;
      }
      if (priceMinInput && priceMaxInput) {
        priceMin = parseFloat(priceMinInput.value) || 100;
        priceMax = parseFloat(priceMaxInput.value) || 300;
      }
    }

    const { purchases } = getPurchaseInputs();

    // 購入データが空でもグラフ更新を実行（警告表示のため）
    if (!purchases || purchases.length === 0) {
      // デフォルト値でグラフ更新
      const defaultPurchases = [{ price: 150, fx: 140, qty: 10 }];
      const graphData = calculateGraphData(
        defaultPurchases,
        fxMin,
        fxMax,
        priceMin,
        priceMax,
        customPins
      );
      renderGraph(graphData, defaultPurchases);
      renderPinSettings();
      isGraphUpdating = false;
      return;
    }

    // グラフデータの計算
    const graphData = calculateGraphData(
      purchases,
      fxMin,
      fxMax,
      priceMin,
      priceMax,
      customPins
    );

    // グラフの描画

    renderGraph(graphData, purchases);

    // ピン設定の更新
    renderPinSettings();
  } catch (error) {
    console.error("❌ グラフ更新エラー:", error);
    showToast("グラフの更新中にエラーが発生しました", "error");
  } finally {
    isGraphUpdating = false;
  }
}

export function updateGraph() {
  // デバウンス付きでグラフ更新を実行
  debouncedUpdateGraph();
}
