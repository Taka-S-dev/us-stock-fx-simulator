// model/state.js

import { getPurchaseInputs, updatePurchaseUI } from "../view/form.js"; // 🆕 view 層の input 情報を取得
import { renderPinSettings } from "../view/pinSettings.js";

import { getPins, setPins } from "./pins.js";
import { getPurchases, setPurchases, getPurchasesFromStorage } from "./calc.js";
import { showToast } from "../view/toast.js";
import { updateGraph } from "../controller/graphController.js";

const STORAGE_KEY = "fx_simulator_state";

/**
 * アプリケーションの状態をクリア
 */
export function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(AUTO_SAVE_KEY);
  } catch (error) {
    console.error("状態クリアエラー:", error);
  }
}

/**
 * 現在のアプリケーション状態を取得
 * @returns {Object} アプリケーション状態
 */
export function getCurrentAppState() {
  try {
    // メインコンテナの入力値を確認
    const mainEntries = document.querySelectorAll(
      "#purchase-container .purchase-entry"
    );
    mainEntries.forEach((entry, index) => {
      const priceInput = entry.querySelector(".price");
      const fxInput = entry.querySelector(".fx");
      const qtyInput = entry.querySelector(".qty");
    });

    // モーダルコンテナの入力値を確認
    const modalEntries = document.querySelectorAll(
      "#purchase-container-modal .purchase-entry"
    );
    modalEntries.forEach((entry, index) => {
      const priceInput = entry.querySelector(".price");
      const fxInput = entry.querySelector(".fx");
      const qtyInput = entry.querySelector(".qty");
    });

    const fxSlider = document.getElementById("fx-slider")?.noUiSlider;
    const priceSlider = document.getElementById("price-slider")?.noUiSlider;

    // スライダーから値を取得
    let [fxMin, fxMax] = fxSlider?.get().map(parseFloat) ?? [null, null];
    let [priceMin, priceMax] = priceSlider?.get().map(parseFloat) ?? [
      null,
      null,
    ];

    // 入力フィールドからも値を取得（フォールバック）
    const fxMinInput = document.getElementById("fx-min-input");
    const fxMaxInput = document.getElementById("fx-max-input");
    const priceMinInput = document.getElementById("price-min-input");
    const priceMaxInput = document.getElementById("price-max-input");

    if (fxMinInput && fxMaxInput && (fxMin === null || fxMax === null)) {
      fxMin = parseFloat(fxMinInput.value);
      fxMax = parseFloat(fxMaxInput.value);
    }

    if (
      priceMinInput &&
      priceMaxInput &&
      (priceMin === null || priceMax === null)
    ) {
      priceMin = parseFloat(priceMinInput.value);
      priceMax = parseFloat(priceMaxInput.value);
    }

    const { purchases } = getPurchaseInputs();

    const state = {
      fxMin,
      fxMax,
      priceMin,
      priceMax,
      purchases,
      pins: getPins(),
      timestamp: Date.now(),
      version: "1.0.0",
    };

    // 状態の検証
    if (!validateState(state)) {
      console.warn("無効な状態データが検出されました");
      return null;
    }

    return state;
  } catch (error) {
    console.error("状態取得エラー:", error);
    return null;
  }
}

/**
 * 状態データの検証
 * @param {Object} state - 検証する状態データ
 * @returns {boolean} 有効かどうか
 */
function validateState(state) {
  if (!state || typeof state !== "object") {
    console.warn("状態データが無効です");
    return false;
  }

  // 基本的なフィールドのチェック（必須ではない）
  const basicFields = ["fxMin", "fxMax", "priceMin", "priceMax"];
  for (const field of basicFields) {
    if (field in state) {
      const value = state[field];
      if (typeof value !== "number" || isNaN(value)) {
        console.warn(`無効な数値フィールド: ${field} = ${value}`);
        return false;
      }
    }
  }

  // 配列フィールドの検証（必須ではない）
  if ("purchases" in state && !Array.isArray(state.purchases)) {
    console.warn("purchasesが配列ではありません");
    return false;
  }

  if ("pins" in state && !Array.isArray(state.pins)) {
    console.warn("pinsが配列ではありません");
    return false;
  }

  return true;
}

/**
 * アプリケーション状態を適用
 * @param {Object} state - 適用する状態データ
 * @param {string} storageKey - ストレージキー（オプション）
 */
export function applyAppState(state, storageKey = null) {
  try {
    // 状態データの検証
    if (!validateState(state)) {
      console.error("無効な状態データです");
      showToast("無効なデータのため復元できませんでした", "error");
      return;
    }

    // スライダーの初期化を待つ（高速化版）
    const waitForSliders = () => {
      const fxSlider = document.getElementById("fx-slider")?.noUiSlider;
      const priceSlider = document.getElementById("price-slider")?.noUiSlider;
      const priceMaxToggle = document.getElementById("price-max-toggle");

      if (!fxSlider || !priceSlider) {
        // スライダーがまだ初期化されていない場合は少し待つ
        setTimeout(waitForSliders, 100);
        return;
      }

      // スライダーが完全に初期化されていることを確認
      if (!fxSlider.get || !priceSlider.get) {
        setTimeout(waitForSliders, 100);
        return;
      }

      // スライダー最大値を事前に調整（priceMaxが1000超なら拡張）
      if (state.priceMax != null) {
        const EXTENDED_PRICE_MAX = 5000;
        const DEFAULT_PRICE_MAX = 1000;
        const newMax =
          state.priceMax > DEFAULT_PRICE_MAX
            ? EXTENDED_PRICE_MAX
            : DEFAULT_PRICE_MAX;

        // スイッチ状態も反映（ON/OFF切り替え）
        if (priceMaxToggle) {
          priceMaxToggle.checked = newMax === EXTENDED_PRICE_MAX;
        }

        priceSlider.updateOptions({
          range: { min: 1, max: newMax },
        });
      }

      if (
        state.fxMin != null &&
        state.fxMax != null &&
        state.priceMin != null &&
        state.priceMax != null
      ) {
        // スライダーの値を設定

        fxSlider.set([state.fxMin, state.fxMax]);
        priceSlider.set([state.priceMin, state.priceMax]);

        // 設定が正しく反映されたか確認
        setTimeout(() => {
          const [currentFxMin, currentFxMax] = fxSlider.get().map(parseFloat);
          const [currentPriceMin, currentPriceMax] = priceSlider
            .get()
            .map(parseFloat);

          if (
            Math.abs(currentFxMin - state.fxMin) > 0.1 ||
            Math.abs(currentFxMax - state.fxMax) > 0.1 ||
            Math.abs(currentPriceMin - state.priceMin) > 0.1 ||
            Math.abs(currentPriceMax - state.priceMax) > 0.1
          ) {
            // 値が正しく設定されていない場合は再設定
            fxSlider.set([state.fxMin, state.fxMax]);
            priceSlider.set([state.priceMin, state.priceMax]);
          }
        }, 50);

        // 入力フィールドの値も同期
        const fxMinInput = document.getElementById("fx-min-input");
        const fxMaxInput = document.getElementById("fx-max-input");
        const priceMinInput = document.getElementById("price-min-input");
        const priceMaxInput = document.getElementById("price-max-input");

        if (fxMinInput) fxMinInput.value = state.fxMin;
        if (fxMaxInput) fxMaxInput.value = state.fxMax;
        if (priceMinInput) priceMinInput.value = state.priceMin;
        if (priceMaxInput) priceMaxInput.value = state.priceMax;
      }

      // 購入履歴
      let purchases = state.purchases;

      if ((!purchases || purchases.length === 0) && storageKey) {
        purchases = getPurchasesFromStorage(storageKey);
      }

      if (purchases) {
        setPurchases(purchases);
        updatePurchaseUI();

        // 購入履歴の復元が完了したことを確認
        const restoredPurchases = getPurchases();

        // モーダル内の購入情報も更新（モーダルが開いている場合のみ）
        const modalContainer = document.getElementById(
          "purchase-container-modal"
        );
        const mobileModal = document.getElementById("mobileModal");
        const isModalOpen =
          mobileModal && mobileModal.classList.contains("show");

        if (modalContainer && isModalOpen) {
          modalContainer.innerHTML = "";

          purchases.forEach((purchase, index) => {
            const div = document.createElement("div");
            div.className = "purchase-entry";
            div.innerHTML = `
              <div class="purchase-index">購入情報${index + 1}</div>
              <div class="d-flex justify-content-between align-items-start">
                <div style="flex: 1;">
                  <label>購入株価（USD）:
                    <input type="number" step="0.1" value="${
                      purchase.price
                    }" class="form-control price" min="0.1" />
                  </label>
                  <label>為替レート（円/USD）:
                    <input type="number" step="0.1" value="${
                      purchase.fx
                    }" class="form-control fx" min="0.1" />
                  </label>
                  <label>株数:
                    <input type="number" value="${
                      purchase.qty
                    }" min="1" class="form-control qty" />
                  </label>
                </div>
                <button type="button" class="btn-close ms-2 mt-1" aria-label="削除" data-index="${index}"></button>
              </div>
            `;

            // 削除ボタンの表示制御（1番目は非表示）
            const deleteBtn = div.querySelector(".btn-close");
            if (index === 0) {
              deleteBtn.style.display = "none";
            }

            modalContainer.appendChild(div);
          });

          // モーダル内の削除ボタンにイベントを追加
          modalContainer
            .querySelectorAll(".btn-close")
            .forEach((btn, index) => {
              if (index === 0) {
                btn.style.display = "none";
              } else {
                btn.addEventListener("click", () => {
                  try {
                    btn.closest(".purchase-entry").remove();
                    document.dispatchEvent(new CustomEvent("inputChanged"));
                  } catch (error) {
                    console.error("モーダル内購入フォーム削除エラー:", error);
                  }
                });
              }
            });

          // モーダル内の入力フィールドにイベントを追加
          modalContainer.addEventListener("input", () => {
            try {
              // モーダル内の変更を即座にメインコンテナに反映
              const mainContainer =
                document.getElementById("purchase-container");
              if (mainContainer) {
                mainContainer.innerHTML = modalContainer.innerHTML;

                // メインコンテナの削除ボタンにイベントを追加
                mainContainer
                  .querySelectorAll(".btn-close")
                  .forEach((btn, index) => {
                    if (index === 0) {
                      btn.style.display = "none";
                    } else {
                      btn.addEventListener("click", () => {
                        try {
                          btn.closest(".purchase-entry").remove();
                          document.dispatchEvent(
                            new CustomEvent("inputChanged")
                          );
                        } catch (error) {
                          console.error(
                            "メインコンテナ購入フォーム削除エラー:",
                            error
                          );
                        }
                      });
                    }
                  });
              }
              document.dispatchEvent(new CustomEvent("inputChanged"));
            } catch (error) {
              console.error("モーダル内入力イベントエラー（復元後）:", error);
            }
          });
        } else if (modalContainer) {
        }
      }

      if (state.pins) {
        setPins(state.pins);
        renderPinSettings();
      }

      // 購入履歴の復元完了後にグラフ更新を実行
      const updateGraphAfterRestore = () => {
        // 購入履歴の状態を確認
        const currentPurchases = getPurchases();

        // スライダーの状態を確認
        const fxSlider = document.getElementById("fx-slider")?.noUiSlider;
        const priceSlider = document.getElementById("price-slider")?.noUiSlider;

        if (fxSlider && priceSlider) {
          const [fxMin, fxMax] = fxSlider.get().map(parseFloat);
          const [priceMin, priceMax] = priceSlider.get().map(parseFloat);
        }

        document.dispatchEvent(new CustomEvent("inputChanged"));

        setTimeout(() => {
          updateGraph();
        }, 150);
      };

      // 購入履歴の復元が完了した後にグラフ更新を実行
      setTimeout(updateGraphAfterRestore, 500);
    };

    // スライダーの初期化を待つ
    waitForSliders();
  } catch (error) {
    console.error("状態適用エラー:", error);
    showToast("状態の適用中にエラーが発生しました", "error");
  }
}

/**
 * 保存済み状態の一覧を取得
 * @returns {Array} 保存済み状態名の配列
 */
export function getSavedStateNames() {
  try {
    return Object.keys(localStorage)
      .filter((key) => key.startsWith("state::"))
      .map((key) => key.replace("state::", ""))
      .filter((name) => name !== "保存済み一覧");
  } catch (error) {
    console.error("保存済み状態一覧取得エラー:", error);
    return [];
  }
}

/**
 * 状態を保存
 * @param {string} name - 保存名
 * @returns {boolean} 成功したかどうか
 */
export function saveState(name) {
  try {
    if (!name || name.trim() === "") {
      showToast("保存名を入力してください", "warning");
      return false;
    }

    if (name === "保存済み一覧") {
      showToast("「保存済み一覧」は使用できません", "warning");
      return false;
    }

    const state = getCurrentAppState();

    if (!state) {
      showToast("保存するデータが無効です", "error");
      return false;
    }

    const key = "state::" + name;
    const jsonData = JSON.stringify(state);

    localStorage.setItem(key, jsonData);
    showToast(`設定を「${name}」として保存しました`, "success");
    return true;
  } catch (error) {
    console.error("状態保存エラー:", error);
    showToast("保存中にエラーが発生しました", "error");
    return false;
  }
}

/**
 * 状態を復元
 * @param {string} name - 復元する保存名
 * @returns {boolean} 成功したかどうか
 */
export function restoreState(name) {
  try {
    if (!name || name.trim() === "") {
      showToast("復元する設定を選択してください", "warning");
      return false;
    }

    if (name === "保存済み一覧") {
      showToast("「保存済み一覧」は復元できません", "warning");
      return false;
    }

    const key = "state::" + name;

    const savedData = localStorage.getItem(key);

    if (!savedData) {
      showToast("選択された設定が見つかりません", "error");
      return false;
    }

    const state = JSON.parse(savedData);

    if (!validateState(state)) {
      showToast("保存されたデータが無効です", "error");
      return false;
    }

    applyAppState(state, key);
    showToast(`設定「${name}」を復元しました`, "success");
    return true;
  } catch (error) {
    console.error("状態復元エラー:", error);
    showToast("復元中にエラーが発生しました", "error");
    return false;
  }
}

/**
 * 状態を削除
 * @param {string} name - 削除する保存名
 * @returns {boolean} 成功したかどうか
 */
export function deleteState(name) {
  try {
    if (!name || name.trim() === "") {
      showToast("削除する設定を選択してください", "warning");
      return false;
    }

    if (name === "保存済み一覧") {
      showToast("「保存済み一覧」は削除できません", "warning");
      return false;
    }

    localStorage.removeItem("state::" + name);
    showToast(`設定「${name}」を削除しました`, "success");
    return true;
  } catch (error) {
    console.error("状態削除エラー:", error);
    showToast("削除中にエラーが発生しました", "error");
    return false;
  }
}
