import { getPurchases, setPurchases } from "../model/calc.js"; // ✅ setPurchases を追加

/**
 * 購入情報の入力値を取得・検証
 * @returns {Object} 購入情報とスライダー値
 */
export function getPurchaseInputs() {
  try {
    const purchases = [];
    const errors = [];

    // メインコンテナとモーダルコンテナの両方をチェック
    const mainEntries = document.querySelectorAll(
      "#purchase-container .purchase-entry"
    );
    const modalEntries = document.querySelectorAll(
      "#purchase-container-modal .purchase-entry"
    );

    // モーダルが開いている場合はモーダルの内容を優先
    const entries = modalEntries.length > 0 ? modalEntries : mainEntries;

    entries.forEach((entry, index) => {
      try {
        const priceInput = entry.querySelector(".price");
        const fxInput = entry.querySelector(".fx");
        const qtyInput = entry.querySelector(".qty");

        if (!priceInput || !fxInput || !qtyInput) {
          errors.push(`購入履歴${index + 1}: 入力フィールドが見つかりません`);
          return;
        }

        const price = parseFloat(priceInput.value);
        const fx = parseFloat(fxInput.value);
        const qty = parseFloat(qtyInput.value);

        // 空の入力フィールドをスキップ
        if (
          !priceInput.value.trim() ||
          !fxInput.value.trim() ||
          !qtyInput.value.trim()
        ) {
          return;
        }

        // 異常値でもデータとして追加（警告表示のため）
        if (
          price <= 0 ||
          fx <= 0 ||
          qty <= 0 ||
          isNaN(price) ||
          isNaN(fx) ||
          isNaN(qty)
        ) {
          // 異常値でも購入データとして追加（デフォルト値を使用）
          purchases.push({
            price: isNaN(price) || price <= 0 ? 150 : price,
            fx: isNaN(fx) || fx <= 0 ? 140 : fx,
            qty: isNaN(qty) || qty <= 0 ? 10 : qty,
          });
          return;
        }

        // 詳細な入力値検証
        const validation = validatePurchaseInput(price, fx, qty, index + 1);
        if (validation.isValid) {
          purchases.push({ price, fx, qty });
        } else {
          errors.push(...validation.errors);
        }
      } catch (error) {
        console.error(`購入履歴${index + 1}の処理エラー:`, error);
        errors.push(`購入履歴${index + 1}: データ処理エラー`);
      }
    });

    // 重複を除去（最後の1つを残す）
    const uniquePurchases = [];
    const seen = new Set();

    for (let i = purchases.length - 1; i >= 0; i--) {
      const purchase = purchases[i];
      const key = `${purchase.price}_${purchase.fx}_${purchase.qty}`;
      if (!seen.has(key)) {
        uniquePurchases.unshift(purchase);
        seen.add(key);
      }
    }

    // 購入履歴を状態に保存
    if (uniquePurchases.length > 0) {
      setPurchases(uniquePurchases);
    }

    const result = {
      purchases: uniquePurchases,
      fxMin: 100,
      fxMax: 200,
      priceMin: 1,
      priceMax: 1000,
    };

    return result;
  } catch (error) {
    console.error("❌ getPurchaseInputs エラー:", error);
    return {
      purchases: [],
      fxMin: 100,
      fxMax: 200,
      priceMin: 1,
      priceMax: 1000,
    };
  }
}

/**
 * 購入入力値の検証
 * @param {number} price - 株価
 * @param {number} fx - 為替レート
 * @param {number} qty - 株数
 * @param {number} index - 購入履歴のインデックス
 * @returns {Object} 検証結果
 */
function validatePurchaseInput(price, fx, qty, index) {
  const errors = [];

  // 株価の検証
  if (isNaN(price)) {
    errors.push(`購入履歴${index}: 株価が数値ではありません`);
  } else if (price <= 0) {
    errors.push(`購入履歴${index}: 株価は0より大きい値が必要です (${price})`);
  } else if (price > 1000000) {
    errors.push(`購入履歴${index}: 株価が異常に高い値です (${price})`);
  }

  // 為替レートの検証
  if (isNaN(fx)) {
    errors.push(`購入履歴${index}: 為替レートが数値ではありません`);
  } else if (fx <= 0) {
    errors.push(
      `購入履歴${index}: 為替レートは0より大きい値が必要です (${fx})`
    );
  } else if (fx < 1 || fx > 1000) {
    errors.push(`購入履歴${index}: 為替レートが異常な値です (${fx})`);
  }

  // 株数の検証
  if (isNaN(qty)) {
    errors.push(`購入履歴${index}: 株数が数値ではありません`);
  } else if (qty <= 0) {
    errors.push(`購入履歴${index}: 株数は0より大きい値が必要です (${qty})`);
  } else if (!Number.isInteger(qty)) {
    errors.push(`購入履歴${index}: 株数は整数である必要があります (${qty})`);
  } else if (qty > 1000000) {
    errors.push(`購入履歴${index}: 株数が異常に多い値です (${qty})`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 個別フィールドの検証
 * @param {number} value - 検証する値
 * @param {string} fieldType - フィールドタイプ ('price', 'fx', 'qty')
 * @returns {Object} 検証結果
 */
export function validateField(value, fieldType) {
  const errors = [];

  if (isNaN(value)) {
    errors.push(`${getFieldLabel(fieldType)}が数値ではありません`);
    return { isValid: false, errors };
  }

  if (value <= 0) {
    errors.push(`${getFieldLabel(fieldType)}は0より大きい値が必要です`);
    return { isValid: false, errors };
  }

  switch (fieldType) {
    case "price":
      if (value > 1000000) {
        errors.push(`${getFieldLabel(fieldType)}が異常に高い値です`);
      }
      break;
    case "fx":
      if (value < 1 || value > 1000) {
        errors.push(`${getFieldLabel(fieldType)}が異常な値です`);
      }
      break;
    case "qty":
      if (!Number.isInteger(value)) {
        errors.push(`${getFieldLabel(fieldType)}は整数である必要があります`);
      } else if (value > 1000000) {
        errors.push(`${getFieldLabel(fieldType)}が異常に多い値です`);
      }
      break;
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * フィールドラベルを取得
 * @param {string} fieldType - フィールドタイプ
 * @returns {string} フィールドラベル
 */
export function getFieldLabel(fieldType) {
  switch (fieldType) {
    case "price":
      return "株価";
    case "fx":
      return "為替レート";
    case "qty":
      return "株数";
    default:
      return "値";
  }
}

/**
 * スライダー値の検証
 * @param {number} fxMin - 為替レート最小値
 * @param {number} fxMax - 為替レート最大値
 * @param {number} priceMin - 株価最小値
 * @param {number} priceMax - 株価最大値
 * @returns {Object} 検証結果
 */
function validateSliderValues(fxMin, fxMax, priceMin, priceMax) {
  const errors = [];

  // 為替レート範囲の検証
  if (isNaN(fxMin) || isNaN(fxMax)) {
    errors.push("為替レート範囲が数値ではありません");
  } else if (fxMin <= 0 || fxMax <= 0) {
    errors.push("為替レート範囲は0より大きい値である必要があります");
  } else if (fxMin >= fxMax) {
    errors.push("為替レート最小値は最大値より小さい必要があります");
  } else if (fxMin < 1 || fxMax > 1000) {
    errors.push("為替レート範囲が異常な値です");
  }

  // 株価範囲の検証
  if (isNaN(priceMin) || isNaN(priceMax)) {
    errors.push("株価範囲が数値ではありません");
  } else if (priceMin <= 0 || priceMax <= 0) {
    errors.push("株価範囲は0より大きい値である必要があります");
  } else if (priceMin >= priceMax) {
    errors.push("株価最小値は最大値より小さい必要があります");
  } else if (priceMin < 0.01 || priceMax > 1000000) {
    errors.push("株価範囲が異常な値です");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 購入フォームを追加
 */
export function addPurchaseForm() {
  try {
    const container = document.getElementById("purchase-container");
    if (!container) {
      console.error("購入コンテナが見つかりません");
      return;
    }

    // 現在の購入履歴の数を取得して次の番号を計算
    const currentEntries = container.querySelectorAll(".purchase-entry");
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

    div.querySelector(".btn-close").addEventListener("click", () => {
      try {
        div.remove();
        // 削除後のイベント発火を少し遅延させる
        setTimeout(() => {
          const event = new Event("input", { bubbles: true });
          document.getElementById("purchase-body")?.dispatchEvent(event);
          document.dispatchEvent(new CustomEvent("inputChanged"));
        }, 50);
      } catch (error) {
        console.error("購入フォーム削除エラー:", error);
      }
    });

    container.appendChild(div);

    // 新しく追加された入力フィールドに検証を適用
    setTimeout(() => {
      const inputs = div.querySelectorAll(".form-control");
      inputs.forEach((input) => {
        validateInputField(input);
      });
    }, 50);

    const event = new Event("input", { bubbles: true });
    document.getElementById("purchase-body")?.dispatchEvent(event);

    // 購入履歴追加後にインデックスを再計算
    setTimeout(() => {
      const allEntries = container.querySelectorAll(".purchase-entry");
      allEntries.forEach((entry, index) => {
        const indexElement = entry.querySelector(".purchase-index");
        if (indexElement) {
          indexElement.textContent = `購入情報${index + 1}`;
        }
      });

      document.dispatchEvent(new CustomEvent("inputChanged"));
      // 状態をlocalStorageにも保存
      const currentState = JSON.parse(
        localStorage.getItem("state::default") || "{}"
      );
      const purchases = getPurchaseInputs().purchases;
      currentState.purchases = purchases;
      localStorage.setItem("state::default", JSON.stringify(currentState));
    }, 100);
  } catch (error) {
    console.error("購入フォーム追加エラー:", error);
  }
}

/**
 * 購入UIを更新
 */
export function updatePurchaseUI() {
  try {
    const container = document.getElementById("purchase-container");
    if (!container) {
      console.error("購入コンテナが見つかりません");
      return;
    }

    const purchases = getPurchases();

    // 購入履歴が空の場合は初期値を追加
    if (!purchases || purchases.length === 0) {
      const initialPurchase = { price: 150, fx: 140, qty: 10 };
      setPurchases([initialPurchase]);
      purchases = [initialPurchase];
    }

    container.innerHTML = "";

    purchases.forEach((p, index) => {
      try {
        // データの検証
        if (
          !p ||
          typeof p.price !== "number" ||
          typeof p.fx !== "number" ||
          typeof p.qty !== "number"
        ) {
          console.warn("無効な購入データ:", p);
          return;
        }

        const div = document.createElement("div");
        div.className = "purchase-entry";
        div.innerHTML = `
          <div class="purchase-index">購入情報${index + 1}</div>
          <div class="d-flex justify-content-between align-items-start">
            <div style="flex: 1;">
              <label>購入株価（USD）:
                <input type="number" step="0.1" value="${
                  p.price
                }" class="form-control price" min="0.1" />
              </label>
              <label>為替レート（円/USD）:
                <input type="number" step="0.1" value="${
                  p.fx
                }" class="form-control fx" min="0.1" />
              </label>
              <label>株数:
                <input type="number" value="${
                  p.qty
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

        container.appendChild(div);

        // 新しく追加された入力フィールドに検証を適用
        setTimeout(() => {
          const inputs = div.querySelectorAll(".form-control");
          inputs.forEach((input) => {
            validateInputField(input);
          });
        }, 50);

        container.appendChild(div);
      } catch (error) {
        console.error(`購入履歴${index + 1}のUI更新エラー:`, error);
      }
    });

    setTimeout(() => {
      document.dispatchEvent(new CustomEvent("inputChanged"));
    }, 50);
  } catch (error) {
    console.error("updatePurchaseUI エラー:", error);
  }
}

/**
 * 入力値の検証
 * @param {number} value - 検証する値
 * @param {string} fieldName - フィールド名
 * @returns {boolean} 有効かどうか
 */
function validateInput(value, fieldName) {
  if (isNaN(value) || value <= 0) {
    console.warn(`${fieldName}の値が無効です:`, value);
    return false;
  }
  return true;
}

function updatePurchaseFormIndices() {
  const container = document.getElementById("purchase-container");
  const entries = container.querySelectorAll(".purchase-entry");

  entries.forEach((entry, index) => {
    const indexElem = entry.querySelector(".purchase-index");
    if (indexElem) {
      indexElem.textContent = `購入情報${index + 1}`;
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  try {
    const container = document.getElementById("purchase-container");
    if (container) {
      // デバウンス処理で重複イベントを防ぐ
      let inputTimeout;
      container.addEventListener("input", (event) => {
        // リアルタイム検証を実行
        if (event.target.classList.contains("form-control")) {
          validateInputField(event.target);
        }

        clearTimeout(inputTimeout);
        inputTimeout = setTimeout(() => {
          document.dispatchEvent(new CustomEvent("inputChanged"));
        }, 100); // 100msのデバウンス
      });

      // フォーカスが外れた時にも検証を実行
      container.addEventListener(
        "blur",
        (event) => {
          if (event.target.classList.contains("form-control")) {
            validateInputField(event.target);
          }
        },
        true
      );
    }
  } catch (error) {
    console.error("DOMContentLoaded イベントエラー:", error);
  }
});

/**
 * 入力フィールドのリアルタイム検証
 * @param {HTMLElement} inputElement - 検証する入力要素
 */
function validateInputField(inputElement) {
  try {
    const value = parseFloat(inputElement.value);
    const fieldType = getFieldTypeFromClass(inputElement);

    if (!fieldType) return;

    // 既存のエラーメッセージを削除
    removeErrorMessage(inputElement);

    // 空の値の場合はエラーを表示
    if (inputElement.value.trim() === "") {
      inputElement.classList.add("invalid");
      showErrorMessage(
        inputElement,
        `${getFieldLabel(fieldType)}を入力してください`
      );
      return;
    }

    // フィールドを検証
    const validation = validateField(value, fieldType);

    if (!validation.isValid) {
      // 無効な値の場合、スタイルを適用
      inputElement.classList.add("invalid");

      // エラーメッセージを表示
      showErrorMessage(inputElement, validation.errors[0]);
    } else {
      // 有効な値の場合、スタイルを削除
      inputElement.classList.remove("invalid");
    }

    // グラフの警告表示を更新
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent("inputChanged"));
    }, 100);
  } catch (error) {
    console.error("入力フィールド検証エラー:", error);
  }
}

/**
 * クラス名からフィールドタイプを取得
 * @param {HTMLElement} inputElement - 入力要素
 * @returns {string|null} フィールドタイプ
 */
export function getFieldTypeFromClass(inputElement) {
  if (inputElement.classList.contains("price")) return "price";
  if (inputElement.classList.contains("fx")) return "fx";
  if (inputElement.classList.contains("qty")) return "qty";
  return null;
}

/**
 * エラーメッセージを表示
 * @param {HTMLElement} inputElement - 入力要素
 * @param {string} message - エラーメッセージ
 */
function showErrorMessage(inputElement, message) {
  // 既存のエラーメッセージを削除
  removeErrorMessage(inputElement);

  // 新しいエラーメッセージを作成
  const errorDiv = document.createElement("div");
  errorDiv.className = "error-message show";
  errorDiv.textContent = message;

  // 入力要素の後に挿入
  inputElement.parentNode.insertBefore(errorDiv, inputElement.nextSibling);
}

/**
 * エラーメッセージを削除
 * @param {HTMLElement} inputElement - 入力要素
 */
function removeErrorMessage(inputElement) {
  const parent = inputElement.parentNode;
  const existingError = parent.querySelector(".error-message");
  if (existingError) {
    existingError.remove();
  }
}

/**
 * 不正な購入情報があるかどうかをチェック
 * @returns {Object} 検証結果
 */
export function hasInvalidPurchaseData() {
  try {
    const container = document.getElementById("purchase-container");
    const modalContainer = document.getElementById("purchase-container-modal");

    // メインコンテナとモーダルコンテナの両方をチェック
    const mainEntries = container?.querySelectorAll(".purchase-entry") || [];
    const modalEntries =
      modalContainer?.querySelectorAll(".purchase-entry") || [];

    // モーダルが開いている場合はモーダルの内容を優先
    const entries = modalEntries.length > 0 ? modalEntries : mainEntries;

    let hasInvalidData = false;
    const invalidFields = [];

    entries.forEach((entry, index) => {
      const priceInput = entry.querySelector(".price");
      const fxInput = entry.querySelector(".fx");
      const qtyInput = entry.querySelector(".qty");

      if (priceInput && fxInput && qtyInput) {
        // 空文字チェック
        if (
          priceInput.value.trim() === "" ||
          fxInput.value.trim() === "" ||
          qtyInput.value.trim() === ""
        ) {
          hasInvalidData = true;
          invalidFields.push(
            `購入情報${index + 1}: 空の入力フィールドがあります`
          );
          return;
        }

        const price = parseFloat(priceInput.value);
        const fx = parseFloat(fxInput.value);
        const qty = parseFloat(qtyInput.value);

        // 数値チェック
        if (isNaN(price) || isNaN(fx) || isNaN(qty)) {
          hasInvalidData = true;
          invalidFields.push(
            `購入情報${index + 1}: 数値以外の値が入力されています`
          );
          return;
        }

        // 範囲チェック
        if (price <= 0 || price > 1000000) {
          hasInvalidData = true;
          invalidFields.push(`購入情報${index + 1}: 株価が無効です (${price})`);
        }

        if (fx <= 0 || fx < 1 || fx > 1000) {
          hasInvalidData = true;
          invalidFields.push(
            `購入情報${index + 1}: 為替レートが無効です (${fx})`
          );
        }

        if (qty <= 0 || !Number.isInteger(qty) || qty > 1000000) {
          hasInvalidData = true;
          invalidFields.push(`購入情報${index + 1}: 株数が無効です (${qty})`);
        }
      }
    });

    return {
      hasInvalid: hasInvalidData,
      errors: invalidFields,
    };
  } catch (error) {
    console.error("不正な購入情報チェックエラー:", error);
    return {
      hasInvalid: false,
      errors: [],
    };
  }
}

document.addEventListener("click", (event) => {
  if (event.target.classList.contains("btn-close")) {
    const entry = event.target.closest(".purchase-entry");
    if (!entry) return;

    // 最初のエントリなら削除不可
    const container = document.getElementById("purchase-container");
    const entries = container.querySelectorAll(".purchase-entry");
    if (entry === entries[0]) return;

    entry.remove();

    setTimeout(() => {
      // インデックス再計算
      const allEntries = container.querySelectorAll(".purchase-entry");
      allEntries.forEach((entry, index) => {
        const indexElement = entry.querySelector(".purchase-index");
        if (indexElement) {
          indexElement.textContent = `購入情報${index + 1}`;
        }
      });

      // イベント通知
      const event = new Event("input", { bubbles: true });
      document.getElementById("purchase-body")?.dispatchEvent(event);
      document.dispatchEvent(new CustomEvent("inputChanged"));
    }, 50);
  }
});

document.addEventListener("click", (event) => {
  if (event.target.classList.contains("btn-close")) {
    const entry = event.target.closest(".purchase-entry");
    if (!entry) return;

    const container = document.getElementById("purchase-container");
    const entries = container.querySelectorAll(".purchase-entry");
    if (entry === entries[0]) return;

    entry.remove();

    setTimeout(() => {
      updatePurchaseFormIndices();
      document.dispatchEvent(new CustomEvent("inputChanged"));
    }, 50);
  }
});

function setupDeleteHandler(containerSelector, updateIndicesFn) {
  document.addEventListener("click", (event) => {
    const closeBtn = event.target.closest(".btn-close");
    if (!closeBtn) return;

    const entry = closeBtn.closest(".purchase-entry");
    if (!entry) return;

    const container = document.querySelector(containerSelector);
    if (!container || !container.contains(entry)) return;

    const entries = container.querySelectorAll(".purchase-entry");
    if (entry === entries[0]) return;

    entry.remove();

    setTimeout(() => {
      updateIndicesFn();
      document.dispatchEvent(new CustomEvent("inputChanged"));
    }, 50);
  });
}
