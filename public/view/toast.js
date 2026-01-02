// view/toast.js

/**
 * トーストメッセージを表示
 * @param {string} message - 表示するメッセージ
 * @param {string} type - メッセージタイプ ('success', 'warning', 'error', 'info')
 */
export function showToast(message, type = "info") {
  try {
    const toastBody = document.getElementById("toast-body");
    const toastEl = document.getElementById("toast-message");

    if (!toastBody || !toastEl) {
      console.error("トースト要素が見つかりません");
      return;
    }

    // メッセージの検証
    if (!message || typeof message !== "string") {
      console.error("無効なトーストメッセージ:", message);
      return;
    }

    // メッセージタイプに応じたスタイル設定
    const toastContainer = toastEl.closest(".toast-container");
    if (toastContainer) {
      // 既存のクラスをクリア
      toastContainer.className =
        "toast-container position-fixed top-0 end-0 p-3";

      // モーダルが開いているかチェック
      const mobileModal = document.getElementById("mobileModal");
      const rangeModal = document.getElementById("rangeModal");
      const isModalOpen =
        (mobileModal && mobileModal.classList.contains("show")) ||
        (rangeModal && rangeModal.classList.contains("show"));

      // モーダルが開いている場合は位置を調整
      if (isModalOpen && window.innerWidth <= 768) {
        toastContainer.className =
          "toast-container position-fixed bottom-0 start-50 translate-middle-x p-3";
        toastContainer.style.zIndex = "1090";
      }

      // タイプに応じたクラスを追加
      switch (type) {
        case "success":
          toastContainer.classList.add("text-success");
          break;
        case "warning":
          toastContainer.classList.add("text-warning");
          break;
        case "error":
          toastContainer.classList.add("text-danger");
          break;
        case "info":
        default:
          toastContainer.classList.add("text-info");
          break;
      }
    }

    // メッセージを設定
    toastBody.textContent = message;

    // トーストを表示
    const toast = bootstrap.Toast.getOrCreateInstance(toastEl);
    toast.show();

    // デバッグログ
  } catch (error) {
    console.error("トースト表示エラー:", error);
    // フォールバック: alertで表示
    try {
      alert(`[${type.toUpperCase()}] ${message}`);
    } catch (fallbackError) {
      console.error("フォールバック表示も失敗:", fallbackError);
    }
  }
}

/**
 * 成功メッセージを表示
 * @param {string} message - 表示するメッセージ
 */
export function showSuccessToast(message) {
  showToast(message, "success");
}

/**
 * 警告メッセージを表示
 * @param {string} message - 表示するメッセージ
 */
export function showWarningToast(message) {
  showToast(message, "warning");
}

/**
 * エラーメッセージを表示
 * @param {string} message - 表示するメッセージ
 */
export function showErrorToast(message) {
  showToast(message, "error");
}

/**
 * 情報メッセージを表示
 * @param {string} message - 表示するメッセージ
 */
export function showInfoToast(message) {
  showToast(message, "info");
}
