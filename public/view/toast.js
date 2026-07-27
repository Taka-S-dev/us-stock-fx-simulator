// view/toast.js
// 通知は必ずこのモジュール経由。alert / confirm は使わない
// （alert はページ全体をブロックし、モバイルでの体験を壊す）。

import { el, need } from "./dom.js";

const TONE = {
  success: { class: "text-bg-success", icon: "✓", label: "完了" },
  info: { class: "text-bg-primary", icon: "ℹ", label: "お知らせ" },
  warning: { class: "text-bg-warning", icon: "⚠", label: "注意" },
  error: { class: "text-bg-danger", icon: "✕", label: "エラー" },
};

/**
 * @param {string} message
 * @param {"success"|"info"|"warning"|"error"} [tone]
 */
export function showToast(message, tone = "info") {
  const spec = TONE[tone] ?? TONE.info;

  try {
    const container = need("#toast-container");
    const toast = el(
      "div",
      {
        class: `toast align-items-center border-0 ${spec.class}`,
        role: tone === "error" ? "alert" : "status",
        "aria-live": tone === "error" ? "assertive" : "polite",
        "aria-atomic": "true",
      },
      [
        el("div", { class: "d-flex" }, [
          el("div", { class: "toast-body" }, [
            el("span", {
              class: "me-2",
              "aria-hidden": "true",
              text: spec.icon,
            }),
            el("span", { class: "visually-hidden", text: `${spec.label}: ` }),
            message,
          ]),
          el("button", {
            type: "button",
            class: "btn-close btn-close-white me-2 m-auto",
            "data-bs-dismiss": "toast",
            "aria-label": "閉じる",
          }),
        ]),
      ]
    );

    container.append(toast);
    toast.addEventListener("hidden.bs.toast", () => toast.remove());
    bootstrap.Toast.getOrCreateInstance(toast, { delay: 4000 }).show();
  } catch (e) {
    // トーストが出せない状況でも処理は続行させる（通知は補助的な機能）
    console.error(`[${tone}] ${message}`, e);
  }
}

/**
 * 破壊的操作の確認。Bootstrap のモーダルで確認を取り、Promise<boolean> を返す。
 * @param {{title:string, body:string, confirmLabel?:string, tone?:"danger"|"primary"}} options
 * @returns {Promise<boolean>}
 */
export function confirmDialog({
  title,
  body,
  confirmLabel = "実行する",
  tone = "danger",
}) {
  const modalEl = need("#confirm-modal");
  need("#confirm-modal-title", modalEl).textContent = title;
  need("#confirm-modal-body", modalEl).textContent = body;

  const okButton = /** @type {HTMLButtonElement} */ (
    need("#confirm-modal-ok", modalEl)
  );
  okButton.textContent = confirmLabel;
  okButton.className = `btn btn-${tone}`;

  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

  return new Promise((resolve) => {
    let accepted = false;
    const onOk = () => {
      accepted = true;
      modal.hide();
    };
    const onHidden = () => {
      okButton.removeEventListener("click", onOk);
      modalEl.removeEventListener("hidden.bs.modal", onHidden);
      resolve(accepted);
    };
    okButton.addEventListener("click", onOk);
    modalEl.addEventListener("hidden.bs.modal", onHidden);
    modal.show();
  });
}
