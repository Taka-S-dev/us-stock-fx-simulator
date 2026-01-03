import { initModalRangeSliders } from "../view/rangeSlider.js";
import { getAllSavedStateNames } from "../utils/stateUtils.js";
import { updateGraph } from "./graphController.js";

import { getPurchases } from "../model/calc.js";
import { addPin, getPins } from "../model/pins.js";
import { renderPinSettings } from "../view/pinSettings.js";
import { saveState, loadState, deleteState } from "../model/state.js";

import { showToast } from "../view/toast.js";
import {
  validateField,
  getFieldLabel,
  getFieldTypeFromClass,
} from "../view/form.js";
import { getContent } from "../utils/textContent.js";
import { buildCurrentAppState, applyAppStateToUI } from "./stateController.js";

// スマホ用モーダル機能
export function setupMobileModals() {
  try {
    const modal = new bootstrap.Modal(document.getElementById("mobileModal"));
    const modalBody = document.getElementById("mobileModalBody");
    const modalTitle = document.getElementById("mobileModalLabel");

    // モーダル開閉時のトースト位置調整
    const mobileModal = document.getElementById("mobileModal");
    const rangeModal = document.getElementById("rangeModal");
    const toastContainer = document.querySelector(".toast-container");

    function adjustToastPosition() {
      if (!toastContainer) return;

      const isModalOpen =
        (mobileModal && mobileModal.classList.contains("show")) ||
        (rangeModal && rangeModal.classList.contains("show"));

      if (isModalOpen && window.innerWidth <= 768) {
        toastContainer.className =
          "toast-container position-fixed bottom-0 start-50 translate-middle-x p-3";
        toastContainer.style.zIndex = "1090";
      } else {
        toastContainer.className =
          "toast-container position-fixed top-0 end-0 p-3";
        toastContainer.style.zIndex = "1080";
      }
    }

    // モーダル開閉イベントを監視
    if (mobileModal) {
      mobileModal.addEventListener("shown.bs.modal", adjustToastPosition);
      mobileModal.addEventListener("hidden.bs.modal", adjustToastPosition);
    }
    if (rangeModal) {
      rangeModal.addEventListener("shown.bs.modal", adjustToastPosition);
      rangeModal.addEventListener("hidden.bs.modal", adjustToastPosition);
    }

    // ウィンドウリサイズ時も調整
    window.addEventListener("resize", adjustToastPosition);

    // アプリ概要モーダル
    document
      .getElementById("btn-overview-modal")
      ?.addEventListener("click", () => {
        try {
          const overviewContent = getContent("overview");
          modalTitle.textContent = overviewContent.title;
          modalBody.innerHTML = overviewContent.content;
          modal.show();
        } catch (error) {
          console.error("アプリ概要モーダルエラー:", error);
        }
      });

    // 免責事項モーダル
    document
      .getElementById("btn-disclaimer-modal")
      ?.addEventListener("click", () => {
        try {
          const disclaimerContent = getContent("disclaimer");
          modalTitle.textContent = disclaimerContent.title;
          modalBody.innerHTML = disclaimerContent.content;
          modal.show();
        } catch (error) {
          console.error("免責事項モーダルエラー:", error);
        }
      });

    // 購入情報モーダル
    document
      .getElementById("btn-purchase-modal")
      ?.addEventListener("click", () => {
        try {
          modalTitle.textContent = "📥 購入情報の入力";

          // モーダルが既に開いているかチェック
          const existingModalContainer = document.getElementById(
            "purchase-container-modal"
          );
          const isModalAlreadyOpen =
            existingModalContainer &&
            existingModalContainer.children.length > 0;

          // モーダルが既に開いている場合は、既存の値を保持してモーダルを表示
          if (isModalAlreadyOpen) {
            modal.show();
            return;
          }

          modalBody.innerHTML = `
		  <form>
			<button type="button" class="btn btn-primary btn-sm mb-3" id="addPurchaseModal">
			  ＋購入履歴を追加
			</button>
			<div id="purchase-container-modal"></div>
		  </form>
		`;

          // 保存された購入履歴からモーダルを構築
          const modalContainer = document.getElementById(
            "purchase-container-modal"
          );
          if (modalContainer) {
            // 削除ハンドラーを設定
            setupDeleteHandler(
              "#purchase-container-modal",
              updatePurchaseModalIndices
            );
            // 保存された購入履歴を取得（getPurchases()を優先）
            let purchases = [];
            try {
              // まずgetPurchases()から購入履歴を取得（復元されたデータを優先）
              purchases = getPurchases();

              // getPurchases()が空の場合はメインコンテナから取得
              if (!purchases || purchases.length === 0) {
                const mainContainer =
                  document.getElementById("purchase-container");
                if (mainContainer) {
                  const mainEntries =
                    mainContainer.querySelectorAll(".purchase-entry");
                  purchases = [];

                  mainEntries.forEach((entry, index) => {
                    const priceInput = entry.querySelector(".price");
                    const fxInput = entry.querySelector(".fx");
                    const qtyInput = entry.querySelector(".qty");

                    if (priceInput && fxInput && qtyInput) {
                      const price = parseFloat(priceInput.value);
                      const fx = parseFloat(fxInput.value);
                      const qty = parseFloat(qtyInput.value);

                      if (
                        !isNaN(price) &&
                        !isNaN(fx) &&
                        !isNaN(qty) &&
                        price > 0 &&
                        fx > 0 &&
                        qty > 0
                      ) {
                        purchases.push({ price, fx, qty });
                      }
                    }
                  });
                }
              }
            } catch (error) {
              console.error("購入履歴取得エラー:", error);
              purchases = getPurchases();
            }

            // 購入履歴が空の場合は初期値を追加
            if (!purchases || purchases.length === 0) {
              const initialPurchase = { price: 150, fx: 140, qty: 10 };
              purchases = [initialPurchase];
            }

            // モーダルを空にする
            modalContainer.innerHTML = "";

            // 購入履歴からモーダルを構築
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
						<input type="number" value="${purchase.qty}" min="1" class="form-control qty" />
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

            // モーダル内の追加ボタンにイベントを追加（複数の方法で確実に設定）
            const addPurchaseModalBtn =
              document.querySelector("#addPurchaseModal");
            if (addPurchaseModalBtn) {
              // 既存のイベントリスナーを削除
              addPurchaseModalBtn.replaceWith(
                addPurchaseModalBtn.cloneNode(true)
              );
              const newAddPurchaseModalBtn =
                document.querySelector("#addPurchaseModal");

              if (newAddPurchaseModalBtn) {
                newAddPurchaseModalBtn.addEventListener("click", (e) => {
                  try {
                    e.preventDefault();
                    e.stopPropagation();

                    // 現在の購入履歴の数を取得して次の番号を計算
                    const currentEntries =
                      modalContainer.querySelectorAll(".purchase-entry");
                    const nextIndex = currentEntries.length + 1;

                    // 新しい購入エントリを作成
                    const div = document.createElement("div");
                    div.className = "purchase-entry";
                    div.innerHTML = `
					  <div class="purchase-index">購入情報${nextIndex}</div>
					  <div class="d-flex justify-content-between align-items-start">
						<div style="flex: 1;">
						  <label>購入株価（USD）:
							<input type="number" step="0.1" value="150" class="form-control price" min="0.1" />
						  </label>
						  <label>為替レート（円/USD）:
							<input type="number" step="0.1" value="140" class="form-control fx" min="0.1" />
						  </label>
						  <label>株数:
							<input type="number" value="10" min="1" class="form-control qty" />
						  </label>
						</div>
						<button type="button" class="btn-close ms-2 mt-1" aria-label="削除"></button>
					  </div>
					`;

                    modalContainer.appendChild(div);

                    // 新しく追加された入力フィールドに検証を適用
                    setTimeout(() => {
                      const inputs = div.querySelectorAll(".form-control");
                      inputs.forEach((input) => {
                        validateModalInputField(input);
                      });
                    }, 50);

                    updatePurchaseModalIndices();

                    // グラフも更新
                    setTimeout(() => {
                      document.dispatchEvent(new CustomEvent("inputChanged"));
                    }, 50);
                  } catch (error) {
                    console.error("モーダル内購入フォーム追加エラー:", error);
                  }
                });

                // タッチイベントも追加（モバイル対応）
                newAddPurchaseModalBtn.addEventListener("touchstart", (e) => {
                  try {
                    e.preventDefault();
                    e.stopPropagation();

                    // 現在の購入履歴の数を取得して次の番号を計算
                    const currentEntries =
                      modalContainer.querySelectorAll(".purchase-entry");
                    const nextIndex = currentEntries.length + 1;

                    // 新しい購入エントリを作成
                    const div = document.createElement("div");
                    div.className = "purchase-entry";
                    div.innerHTML = `
					  <div class="purchase-index">購入情報${nextIndex}</div>
					  <div class="d-flex justify-content-between align-items-start">
						<div style="flex: 1;">
						  <label>購入株価（USD）:
							<input type="number" step="0.1" value="150" class="form-control price" min="0.1" />
						  </label>
						  <label>為替レート（円/USD）:
							<input type="number" step="0.1" value="140" class="form-control fx" min="0.1" />
						  </label>
						  <label>株数:
							<input type="number" value="10" min="1" class="form-control qty" />
						  </label>
						</div>
						<button type="button" class="btn-close ms-2 mt-1" aria-label="削除"></button>
					  </div>
					`;

                    modalContainer.appendChild(div);

                    // 新しく追加された入力フィールドに検証を適用
                    setTimeout(() => {
                      const inputs = div.querySelectorAll(".form-control");
                      inputs.forEach((input) => {
                        validateModalInputField(input);
                      });
                    }, 50);

                    updatePurchaseModalIndices();

                    // グラフも更新
                    setTimeout(() => {
                      document.dispatchEvent(new CustomEvent("inputChanged"));
                    }, 50);
                  } catch (error) {
                    console.error("モーダル内購入フォーム追加エラー:", error);
                  }
                });
              } else {
                console.error(
                  "新しいモーダル内購入履歴追加ボタンが見つかりません"
                );
              }
            } else {
              console.error("モーダル内購入履歴追加ボタンが見つかりません");
            }

            // モーダル内の入力フィールドにイベントを追加
            modalContainer.addEventListener("input", (event) => {
              try {
                // リアルタイム検証を実行
                if (event.target.classList.contains("form-control")) {
                  validateModalInputField(event.target);
                }

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
                console.error("モーダル内入力イベントエラー:", error);
              }
            });

            // モーダル内のフォーカスアウト時にも検証を実行
            modalContainer.addEventListener(
              "blur",
              (event) => {
                if (event.target.classList.contains("form-control")) {
                  validateModalInputField(event.target);
                }
              },
              true
            );
          }

          // モーダルが閉じられた時にメインコンテナを更新
          const modalElement = document.getElementById("mobileModal");
          modalElement.addEventListener("hidden.bs.modal", () => {
            try {
              const modalContainer = document.getElementById(
                "purchase-container-modal"
              );
              const mainContainer =
                document.getElementById("purchase-container");

              if (modalContainer && mainContainer) {
                // モーダル内の最新の入力値を取得してメインコンテナに反映
                const modalEntries =
                  modalContainer.querySelectorAll(".purchase-entry");
                const purchases = [];

                modalEntries.forEach((entry, index) => {
                  const priceInput = entry.querySelector(".price");
                  const fxInput = entry.querySelector(".fx");
                  const qtyInput = entry.querySelector(".qty");

                  if (priceInput && fxInput && qtyInput) {
                    const price = parseFloat(priceInput.value);
                    const fx = parseFloat(fxInput.value);
                    const qty = parseFloat(qtyInput.value);

                    if (
                      !isNaN(price) &&
                      !isNaN(fx) &&
                      !isNaN(qty) &&
                      price > 0 &&
                      fx > 0 &&
                      qty > 0
                    ) {
                      purchases.push({ price, fx, qty });
                    }
                  }
                });

                // 購入履歴を状態に保存
                if (purchases.length > 0) {
                  import("../model/calc.js").then(({ setPurchases }) => {
                    setPurchases(purchases);
                  });
                }

                // メインコンテナを最新の値で再構築
                mainContainer.innerHTML = "";
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

                  mainContainer.appendChild(div);
                });

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

                // メインコンテナの入力フィールドにイベントを追加
                mainContainer.addEventListener("input", () => {
                  try {
                    document.dispatchEvent(new CustomEvent("inputChanged"));
                  } catch (error) {
                    console.error("メインコンテナ入力イベントエラー:", error);
                  }
                });

                // 最終的な状態を強制的に更新
                setTimeout(() => {
                  document.dispatchEvent(new CustomEvent("inputChanged"));
                }, 100);
              }
            } catch (error) {
              console.error("モーダル閉じ時エラー:", error);
            }
          });

          modal.show();

          // モーダル表示後に追加ボタンのイベントリスナーを再設定
          setTimeout(() => {
            try {
              const modalContainer = document.getElementById(
                "purchase-container-modal"
              );
              const addPurchaseModalBtn =
                modalContainer?.querySelector("#addPurchaseModal");

              if (addPurchaseModalBtn) {
                // 既存のイベントリスナーを削除
                addPurchaseModalBtn.replaceWith(
                  addPurchaseModalBtn.cloneNode(true)
                );
                const newAddPurchaseModalBtn =
                  modalContainer.querySelector("#addPurchaseModal");

                newAddPurchaseModalBtn.addEventListener("click", (e) => {
                  try {
                    e.preventDefault();
                    e.stopPropagation();

                    // 新しい購入エントリを作成
                    const div = document.createElement("div");
                    div.className = "purchase-entry";
                    div.innerHTML = `
						<div class="d-flex justify-content-between align-items-start">
						  <div style="flex: 1;">
							<label>購入株価（USD）:
							  <input type="number" step="0.1" value="150" class="form-control price" min="0.1" />
							</label>
							<label>為替レート（円/USD）:
							  <input type="number" step="0.1" value="140" class="form-control fx" min="0.1" />
							</label>
							<label>株数:
							  <input type="number" value="10" min="1" class="form-control qty" />
							</label>
						  </div>
						  <button type="button" class="btn-close ms-2 mt-1" aria-label="削除"></button>
						</div>
					  `;

                    modalContainer.appendChild(div);

                    // 新しく追加された入力フィールドに検証を適用
                    setTimeout(() => {
                      const inputs = div.querySelectorAll(".form-control");
                      inputs.forEach((input) => {
                        validateModalInputField(input);
                      });
                    }, 50);

                    updatePurchaseModalIndices();

                    // グラフも更新
                    setTimeout(() => {
                      document.dispatchEvent(new CustomEvent("inputChanged"));
                    }, 50);
                  } catch (error) {
                    console.error(
                      "モーダル内購入フォーム追加エラー（遅延設定）:",
                      error
                    );
                  }
                });
              }
            } catch (error) {
              console.error("遅延イベントリスナー設定エラー:", error);
            }
          }, 100);
        } catch (error) {
          console.error("購入情報モーダルエラー:", error);
        }
      });

    // 範囲設定モーダル（超高速版）
    document
      .getElementById("btn-range-modal")
      ?.addEventListener("click", () => {
        try {
          // 現在のスライダー値を事前に取得
          const mainFxSlider = document.getElementById("fx-slider")?.noUiSlider;
          const mainPriceSlider =
            document.getElementById("price-slider")?.noUiSlider;

          let fxMin = 120,
            fxMax = 160,
            priceMin = 100,
            priceMax = 300;
          if (mainFxSlider && mainPriceSlider) {
            [fxMin, fxMax] = mainFxSlider.get().map(parseFloat);
            [priceMin, priceMax] = mainPriceSlider.get().map(parseFloat);
          }

          // 隠しモーダルの値を更新
          const fxMinInputModal = document.getElementById("fx-min-input-modal");
          const fxMaxInputModal = document.getElementById("fx-max-input-modal");
          const priceMinInputModal = document.getElementById(
            "price-min-input-modal"
          );
          const priceMaxInputModal = document.getElementById(
            "price-max-input-modal"
          );

          if (fxMinInputModal) fxMinInputModal.value = fxMin.toFixed(1);
          if (fxMaxInputModal) fxMaxInputModal.value = fxMax.toFixed(1);
          if (priceMinInputModal)
            priceMinInputModal.value = priceMin.toFixed(1);
          if (priceMaxInputModal)
            priceMaxInputModal.value = priceMax.toFixed(1);

          // 隠しモーダルを即座に表示
          const rangeModal = new bootstrap.Modal(
            document.getElementById("rangeModal")
          );
          rangeModal.show();

          // モーダル表示後にスライダーを初期化（完全非同期）
          setTimeout(() => {
            initModalRangeSliders();
          }, 50);
        } catch (error) {
          console.error("範囲設定モーダルエラー:", error);
        }
      });

    // ピン設定モーダル
    document.getElementById("btn-pin-modal")?.addEventListener("click", () => {
      try {
        modalTitle.textContent = "📍 ピン設定";
        modalBody.innerHTML = `
		  <div class="mb-3">
			<label class="form-label">為替レート（円/USD）</label>
			<input type="number" step="0.1" value="140" class="form-control" id="pin-fx-modal" min="0.1" />
		  </div>
		  <div class="mb-3">
			<label class="form-label">株価（USD）</label>
			<input type="number" step="0.1" value="150" class="form-control" id="pin-price-modal" min="0.1" />
		  </div>
		  <button type="button" class="btn btn-primary btn-sm mb-3" id="add-pin-modal">
			＋ピンを追加
		  </button>
		  <div id="pin-settings-modal"></div>
		`;

        // 既存のピン設定をコピー
        updateModalPinSettings();

        // モーダル内のピン追加ボタンにイベントを追加
        modalBody
          .querySelector("#add-pin-modal")
          ?.addEventListener("click", () => {
            try {
              const fx = parseFloat(
                modalBody.querySelector("#pin-fx-modal").value
              );
              const price = parseFloat(
                modalBody.querySelector("#pin-price-modal").value
              );

              // ピン入力値の検証
              if (isNaN(fx) || isNaN(price)) {
                showToast(
                  "ピンの為替レートと株価は数値で入力してください",
                  "warning"
                );
                return;
              }

              if (fx <= 0 || price <= 0) {
                showToast(
                  "ピンの為替レートと株価は0より大きい値で入力してください",
                  "warning"
                );
                return;
              }

              if (fx < 1 || fx > 1000) {
                showToast(
                  "ピンの為替レートは1〜1000の範囲で入力してください",
                  "warning"
                );
                return;
              }

              if (price < 0.01 || price > 1000000) {
                showToast(
                  "ピンの株価は0.01〜1,000,000の範囲で入力してください",
                  "warning"
                );
                return;
              }

              const success = addPin(fx, price);
              if (success) {
                updateGraph();
                // メイン画面のピン設定も更新
                import("../view/pinSettings.js").then(
                  ({ renderPinSettings }) => {
                    renderPinSettings();
                    // メイン画面更新後にモーダル内も更新
                    setTimeout(() => {
                      updateModalPinSettings();
                    }, 100);
                  }
                );
                showToast("📍 売却候補ポイントを追加しました", "success");
              }
            } catch (error) {
              console.error("モーダル内ピン追加エラー:", error);
              showToast("ピンの追加中にエラーが発生しました", "error");
            }
          });

        modal.show();
      } catch (error) {
        console.error("ピン設定モーダルエラー:", error);
      }
    });

    // 保存・復元モーダル
    document.getElementById("btn-save-modal")?.addEventListener("click", () => {
      try {
        modalTitle.textContent = "💾 設定の保存・復元";
        modalBody.innerHTML = `
		  <div class="mb-3">
			<label class="form-label">保存名</label>
			<input type="text" class="form-control" id="save-name-modal" placeholder="設定名を入力" />
		  </div>
		  <div class="mb-3">
			<button type="button" class="btn btn-primary btn-sm me-2" id="save-state-modal">
			  保存
			</button>
			<button type="button" class="btn btn-secondary btn-sm me-2" id="restore-state-modal">
			  復元
			</button>
			<button type="button" class="btn btn-danger btn-sm" id="delete-state-modal">
			  削除
			</button>
		  </div>
		  <div class="mb-3">
			<label class="form-label">保存済み一覧</label>
			<select class="form-select" id="saved-state-list-modal">
			  <option value="">選択してください</option>
			</select>
		  </div>
		`;

        // 保存済み一覧を更新
        setTimeout(() => {
          updateModalSavedStateList();
        }, 100);

        // モーダル内の保存ボタンにイベントを追加
        modalBody
          .querySelector("#save-state-modal")
          ?.addEventListener("click", () => {
            try {
              const saveName = modalBody
                .querySelector("#save-name-modal")
                .value.trim();
              if (!saveName) {
                showToast("保存名を入力してください", "warning");
                return;
              }

              if (saveName === "保存済み一覧") {
                showToast("「保存済み一覧」は使用できません", "warning");
                return;
              }

              // 現在の状態を構築して保存
              const state = buildCurrentAppState();
              if (!state) {
                showToast("保存するデータが無効です", "error");
                return;
              }

              const success = saveState(saveName, state);
              if (success) {
                // 保存名をクリア
                modalBody.querySelector("#save-name-modal").value = "";
                // 保存済み一覧を即座に更新
                setTimeout(() => {
                  updateModalSavedStateList();
                }, 100);
                showToast("✅ 保存しました！");
              } else {
                showToast("保存中にエラーが発生しました", "error");
              }
            } catch (error) {
              console.error("モーダル内保存エラー:", error);
              showToast("保存中にエラーが発生しました", "error");
            }
          });

        // モーダル内の復元ボタンにイベントを追加
        modalBody
          .querySelector("#restore-state-modal")
          ?.addEventListener("click", () => {
            try {
              const selectedName = modalBody.querySelector(
                "#saved-state-list-modal"
              ).value;
              if (!selectedName) {
                showToast("復元する設定を選択してください", "warning");
                return;
              }

              if (selectedName === "保存済み一覧") {
                showToast("「保存済み一覧」は復元できません", "warning");
                return;
              }

              // 状態を読み込み、UIへ適用
              const state = loadState(selectedName);
              if (!state) {
                showToast("選択された設定が見つかりません", "error");
                return;
              }

              applyAppStateToUI(state, selectedName);
              showToast("📥 復元しました！");
              // モーダルを閉じる
              modal.hide();
            } catch (error) {
              console.error("❌ モーダル内復元エラー:", error);
              showToast("復元中にエラーが発生しました", "error");
            }
          });

        // モーダル内の削除ボタンにイベントを追加
        modalBody
          .querySelector("#delete-state-modal")
          ?.addEventListener("click", () => {
            try {
              const selectedName = modalBody.querySelector(
                "#saved-state-list-modal"
              ).value;
              if (!selectedName) {
                showToast("削除する設定を選択してください", "warning");
                return;
              }

              if (selectedName === "保存済み一覧") {
                showToast("「保存済み一覧」は削除できません", "warning");
                return;
              }

              // 確認ダイアログ
              if (!confirm(`設定「${selectedName}」を削除しますか？`)) {
                return;
              }

              // deleteState関数を使用
              const success = deleteState(selectedName);
              if (success) {
                // 保存済み一覧を即座に更新
                setTimeout(() => {
                  updateModalSavedStateList();
                }, 100);
              }
            } catch (error) {
              console.error("モーダル内削除エラー:", error);
              showToast("削除中にエラーが発生しました", "error");
            }
          });

        modal.show();
      } catch (error) {
        console.error("保存・復元モーダルエラー:", error);
      }
    });
  } catch (error) {
    console.error("setupMobileModals エラー:", error);
  }
}

export function updateModalSavedStateList() {
  const select = document.getElementById("saved-state-list-modal");
  if (select) {
    select.innerHTML = '<option value="">選択してください</option>';

    getAllSavedStateNames().forEach((key) => {
      const name = key.replace("state::", "");
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    });
  }
}

// モーダル内のピン設定を更新する関数
function updateModalPinSettings() {
  const modalPinSettings = document.getElementById("pin-settings-modal");
  const existingPinSettings = document.getElementById("pin-settings");

  if (modalPinSettings && existingPinSettings) {
    modalPinSettings.innerHTML = existingPinSettings.innerHTML;

    // モーダル内のピン削除ボタンにイベントを追加
    modalPinSettings.querySelectorAll(".btn-delete-pin").forEach((btn) => {
      btn.addEventListener("click", () => {
        const index = parseInt(btn.dataset.index);
        const pins = getPins();
        pins.splice(index, 1);

        // メイン画面のピン設定も更新
        import("../view/pinSettings.js").then(({ renderPinSettings }) => {
          renderPinSettings();
          // メイン画面更新後にモーダル内も更新
          setTimeout(() => {
            updateModalPinSettings();
          }, 50);
        });
        updateGraph();
      });
    });

    // モーダル内のチェックボックスにイベントを追加
    modalPinSettings
      .querySelectorAll("input[type='checkbox']")
      .forEach((checkbox, index) => {
        checkbox.addEventListener("change", () => {
          const pins = getPins();
          if (pins[index]) {
            pins[index].showAnnotation = checkbox.checked;
            updateGraph();
          }
        });
      });

    // モーダル内のラベル（テキスト）にイベントを追加
    modalPinSettings
      .querySelectorAll("label.form-check-label")
      .forEach((label, index) => {
        // クリックイベント
        label.addEventListener("click", (e) => {
          e.preventDefault();
          const checkbox = label.previousElementSibling;
          if (checkbox && checkbox.type === "checkbox") {
            checkbox.checked = !checkbox.checked;
            const pins = getPins();
            if (pins[index]) {
              pins[index].showAnnotation = checkbox.checked;
              updateGraph();
            }
          }
        });
        // タッチイベント（モバイル対応）
        label.addEventListener("touchstart", (e) => {
          e.preventDefault();
          const checkbox = label.previousElementSibling;
          if (checkbox && checkbox.type === "checkbox") {
            checkbox.checked = !checkbox.checked;
            const pins = getPins();
            if (pins[index]) {
              pins[index].showAnnotation = checkbox.checked;
              updateGraph();
            }
          }
        });
      });
  }
}

// グローバル関数として購入フォーム追加関数を定義
window.addPurchaseToModal = function () {
  try {
    const modalContainer = document.getElementById("purchase-container-modal");
    if (!modalContainer) {
      console.error("モーダル内購入コンテナが見つかりません");
      return;
    }

    const currentEntries = modalContainer.querySelectorAll(".purchase-entry");
    const nextIndex = currentEntries.length + 1;

    const div = document.createElement("div");
    div.className = "purchase-entry";
    div.innerHTML = `
      <div class="purchase-index">購入情報${nextIndex}</div>
      <div class="d-flex justify-content-between align-items-start">
        <div style="flex: 1;">
          <label>購入株価（USD）:
            <input type="number" step="0.1" value="150" class="form-control price" min="0.1" />
          </label>
          <label>為替レート（円/USD）:
            <input type="number" step="0.1" value="140" class="form-control fx" min="0.1" />
          </label>
          <label>株数:
            <input type="number" value="10" min="1" class="form-control qty" />
          </label>
        </div>
        <button type="button" class="btn-close ms-2 mt-1" aria-label="削除"></button>
      </div>
    `;

    modalContainer.appendChild(div);

    // 新しく追加された入力フィールドに検証を適用
    setTimeout(() => {
      const inputs = div.querySelectorAll(".form-control");
      inputs.forEach((input) => {
        validateModalInputField(input);
      });
    }, 50);

    updatePurchaseModalIndices();

    setTimeout(() => {
      document.dispatchEvent(new CustomEvent("inputChanged"));
    }, 50);
  } catch (error) {
    console.error("モーダル内購入フォーム追加エラー（グローバル関数）:", error);
  }
};

function updatePurchaseModalIndices() {
  const container = document.getElementById("purchase-container-modal");
  const entries = container.querySelectorAll(".purchase-entry");
  entries.forEach((entry, index) => {
    const indexElem = entry.querySelector(".purchase-index");
    if (indexElem) {
      indexElem.textContent = `購入情報${index + 1}`;
    }
  });
}

/**
 * モーダル内入力フィールドのリアルタイム検証
 * @param {HTMLElement} inputElement - 検証する入力要素
 */
function validateModalInputField(inputElement) {
  try {
    const value = parseFloat(inputElement.value);
    const fieldType = getModalFieldTypeFromClass(inputElement);

    if (!fieldType) return;

    // 既存のエラーメッセージを削除
    removeModalErrorMessage(inputElement);

    // 空の値の場合はエラーを表示
    if (inputElement.value.trim() === "") {
      inputElement.classList.add("invalid");
      showModalErrorMessage(
        inputElement,
        `${getModalFieldLabel(fieldType)}を入力してください`
      );
      return;
    }

    // フィールドを検証
    const validation = validateModalField(value, fieldType);

    if (!validation.isValid) {
      // 無効な値の場合、スタイルを適用
      inputElement.classList.add("invalid");
      // エラーメッセージを表示
      showModalErrorMessage(inputElement, validation.errors[0]);
    } else {
      // 有効な値の場合、スタイルを削除
      inputElement.classList.remove("invalid");
    }

    // グラフの警告表示を更新
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent("inputChanged"));
    }, 100);
  } catch (error) {
    console.error("モーダル内入力フィールド検証エラー:", error);
  }
}

/**
 * モーダル内個別フィールドの検証（form.jsの関数を使用）
 * @param {number} value - 検証する値
 * @param {string} fieldType - フィールドタイプ ('price', 'fx', 'qty')
 * @returns {Object} 検証結果
 */
function validateModalField(value, fieldType) {
  // form.jsの関数を直接使用
  return validateField(value, fieldType);
}

/**
 * モーダル内フィールドラベルを取得（form.jsの関数を使用）
 * @param {string} fieldType - フィールドタイプ
 * @returns {string} フィールドラベル
 */
function getModalFieldLabel(fieldType) {
  return getFieldLabel(fieldType);
}

/**
 * モーダル内クラス名からフィールドタイプを取得（form.jsの関数を使用）
 * @param {HTMLElement} inputElement - 入力要素
 * @returns {string|null} フィールドタイプ
 */
function getModalFieldTypeFromClass(inputElement) {
  return getFieldTypeFromClass(inputElement);
}

/**
 * モーダル内エラーメッセージを表示
 * @param {HTMLElement} inputElement - 入力要素
 * @param {string} message - エラーメッセージ
 */
function showModalErrorMessage(inputElement, message) {
  // 既存のエラーメッセージを削除
  removeModalErrorMessage(inputElement);

  // 新しいエラーメッセージを作成
  const errorDiv = document.createElement("div");
  errorDiv.className = "error-message show";
  errorDiv.textContent = message;

  // 入力要素の後に挿入
  inputElement.parentNode.insertBefore(errorDiv, inputElement.nextSibling);
}

/**
 * モーダル内エラーメッセージを削除
 * @param {HTMLElement} inputElement - 入力要素
 */
function removeModalErrorMessage(inputElement) {
  const parent = inputElement.parentNode;
  const existingError = parent.querySelector(".error-message");
  if (existingError) {
    existingError.remove();
  }
}

function setupDeleteHandler(containerSelector, updateIndicesCallback) {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  container.addEventListener("click", (event) => {
    if (event.target.classList.contains("btn-close")) {
      const entry = event.target.closest(".purchase-entry");
      if (!entry) return;

      // 最初のエントリ（index=0）は削除不可
      const entries = container.querySelectorAll(".purchase-entry");
      if (entry === entries[0]) return;

      entry.remove();
      updateIndicesCallback();
      setTimeout(() => {
        document.dispatchEvent(new CustomEvent("inputChanged"));
      }, 50);
    }
  });
}
