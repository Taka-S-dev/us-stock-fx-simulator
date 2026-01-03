// controller/stateController.js
import {
  validateState,
  saveState,
  loadState,
  deleteState,
} from "../model/state.js";
import {
  getPurchasesFromStorage,
  getPurchases,
  setPurchases,
} from "../model/calc.js";
import { getPins, setPins } from "../model/pins.js";
import { getPurchaseInputs, updatePurchaseUI } from "../view/form.js";
import { renderPinSettings } from "../view/pinSettings.js";
import { showToast } from "../view/toast.js";
import { updateSavedStateList } from "../utils/stateUtils.js";
import { updateGraph } from "./graphController.js";

/**
 * 現在のアプリケーション状態を構築（DOMから読み取り）
 * @returns {Object|null} アプリケーション状態
 */
export function buildCurrentAppState() {
  try {
    const mainEntries = document.querySelectorAll(
      "#purchase-container .purchase-entry"
    );
    mainEntries.forEach((entry) => {
      entry.querySelector(".price");
      entry.querySelector(".fx");
      entry.querySelector(".qty");
    });

    const modalEntries = document.querySelectorAll(
      "#purchase-container-modal .purchase-entry"
    );
    modalEntries.forEach((entry) => {
      entry.querySelector(".price");
      entry.querySelector(".fx");
      entry.querySelector(".qty");
    });

    const fxSlider = document.getElementById("fx-slider")?.noUiSlider;
    const priceSlider = document.getElementById("price-slider")?.noUiSlider;

    let [fxMin, fxMax] = fxSlider?.get().map(parseFloat) ?? [null, null];
    let [priceMin, priceMax] = priceSlider?.get().map(parseFloat) ?? [
      null,
      null,
    ];

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
 * アプリケーション状態をUIへ適用（DOM更新）
 * @param {Object} state - 適用する状態データ
 * @param {string|null} storageName - 保存名（"state::" なし）
 */
export function applyAppStateToUI(state, storageName = null) {
  try {
    if (!validateState(state)) {
      console.error("無効な状態データです");
      showToast("無効なデータのため復元できませんでした", "error");
      return;
    }

    const waitForSliders = () => {
      const fxSlider = document.getElementById("fx-slider")?.noUiSlider;
      const priceSlider = document.getElementById("price-slider")?.noUiSlider;
      const priceMaxToggle = document.getElementById("price-max-toggle");

      if (!fxSlider || !priceSlider) {
        setTimeout(waitForSliders, 100);
        return;
      }

      if (!fxSlider.get || !priceSlider.get) {
        setTimeout(waitForSliders, 100);
        return;
      }

      if (state.priceMax != null) {
        const EXTENDED_PRICE_MAX = 5000;
        const DEFAULT_PRICE_MAX = 1000;
        const newMax =
          state.priceMax > DEFAULT_PRICE_MAX
            ? EXTENDED_PRICE_MAX
            : DEFAULT_PRICE_MAX;

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
        fxSlider.set([state.fxMin, state.fxMax]);
        priceSlider.set([state.priceMin, state.priceMax]);

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
            fxSlider.set([state.fxMin, state.fxMax]);
            priceSlider.set([state.priceMin, state.priceMax]);
          }
        }, 50);

        const fxMinInput = document.getElementById("fx-min-input");
        const fxMaxInput = document.getElementById("fx-max-input");
        const priceMinInput = document.getElementById("price-min-input");
        const priceMaxInput = document.getElementById("price-max-input");

        if (fxMinInput) fxMinInput.value = state.fxMin;
        if (fxMaxInput) fxMaxInput.value = state.fxMax;
        if (priceMinInput) priceMinInput.value = state.priceMin;
        if (priceMaxInput) priceMaxInput.value = state.priceMax;
      }

      let purchases = state.purchases;

      if ((!purchases || purchases.length === 0) && storageName) {
        purchases = getPurchasesFromStorage(storageName);
      }

      if (purchases) {
        setPurchases(purchases);
        updatePurchaseUI();

        getPurchases();

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

            const deleteBtn = div.querySelector(".btn-close");
            if (index === 0) {
              deleteBtn.style.display = "none";
            }

            modalContainer.appendChild(div);
          });

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

          modalContainer.addEventListener("input", () => {
            try {
              const mainContainer =
                document.getElementById("purchase-container");
              if (mainContainer) {
                mainContainer.innerHTML = modalContainer.innerHTML;

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
        }
      }

      if (state.pins) {
        setPins(state.pins);
        renderPinSettings();
      }

      const updateGraphAfterRestore = () => {
        getPurchases();

        const fxSlider = document.getElementById("fx-slider")?.noUiSlider;
        const priceSlider = document.getElementById("price-slider")?.noUiSlider;

        if (fxSlider && priceSlider) {
          fxSlider.get().map(parseFloat);
          priceSlider.get().map(parseFloat);
        }

        document.dispatchEvent(new CustomEvent("inputChanged"));

        setTimeout(() => {
          updateGraph();
        }, 150);
      };

      setTimeout(updateGraphAfterRestore, 500);
    };

    waitForSliders();
  } catch (error) {
    console.error("状態適用エラー:", error);
    showToast("状態の適用中にエラーが発生しました", "error");
  }
}

export function setupStateEventHandlers() {
  document.getElementById("btn-save-state").addEventListener("click", () => {
    const name = document.getElementById("save-name").value.trim();
    if (!name) return alert("保存名を入力してください");

    const state = buildCurrentAppState();
    if (!state) {
      showToast("保存するデータが無効です", "error");
      return;
    }

    if (!validateState(state)) {
      showToast("保存するデータが無効です", "error");
      return;
    }

    const ok = saveState(name, state);
    if (!ok) {
      showToast("保存中にエラーが発生しました", "error");
      return;
    }

    updateSavedStateList();
    showToast("✅ 保存しました！");
    document.getElementById("save-name").value = "";
  });

  document.getElementById("btn-restore-state").addEventListener("click", () => {
    const select = document.getElementById("saved-states");
    const name = select.value;
    if (!name || name === "保存済み一覧")
      return alert("保存名を選択してください");

    const state = loadState(name);
    if (!state) {
      showToast("選択された設定が見つかりません", "error");
      return;
    }

    if (!validateState(state)) {
      showToast("保存されたデータが無効です", "error");
      return;
    }

    applyAppStateToUI(state, name); // ← "state::" なしの保存名を渡す
    showToast("📥 復元しました！");
  });

  document.getElementById("btn-delete-state").addEventListener("click", () => {
    const select = document.getElementById("saved-states");
    const name = select.value;
    if (!name || name === "保存済み一覧")
      return alert("保存名を選択してください");

    if (confirm(`"${name}" を削除しますか？`)) {
      const ok = deleteState(name);
      if (!ok) {
        showToast("削除中にエラーが発生しました", "error");
        return;
      }
      updateSavedStateList();
      showToast(`設定「${name}」を削除しました`, "success");
    }
  });
}
