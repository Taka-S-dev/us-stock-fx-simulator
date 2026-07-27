// view/toast.js
// 通知は必ずこのモジュール経由。alert / confirm は使わない
// （alert はページ全体をブロックし、モバイルでの体験を壊す）。

import { el, need } from "./dom.js";

/*
  色は面ではなく記号に置く。全面を塗ると、通知の緑と赤が
  損益を示す緑と赤と同じ強さで出てしまう。
  アイコンの色と、重い報せだけ枠線で区別する。
*/
/*
  記号のうしろの U+FE0E（VARIATION SELECTOR-15）は「絵文字ではなく文字として描け」の指定。
  付けないと ℹ と ⚠ が環境によってカラー絵文字になり、
  ここで指定した色を無視した青や黄色の四角が並ぶ。
*/
const TONE = {
  success: { icon: "✓", iconClass: "text-success", label: "完了" },
  info: { icon: "ℹ︎", iconClass: "text-body-secondary", label: "お知らせ" },
  warning: { icon: "⚠︎", iconClass: "text-warning", label: "注意" },
  error: {
    icon: "✕",
    iconClass: "text-danger",
    label: "エラー",
    border: "border-danger",
  },
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
        class: `toast align-items-center ${spec.border ?? ""}`,
        role: tone === "error" ? "alert" : "status",
        "aria-live": tone === "error" ? "assertive" : "polite",
        "aria-atomic": "true",
      },
      [
        el("div", { class: "d-flex" }, [
          el("div", { class: "toast-body" }, [
            el("span", {
              class: `me-2 ${spec.iconClass}`,
              "aria-hidden": "true",
              text: spec.icon,
            }),
            el("span", { class: "visually-hidden", text: `${spec.label}: ` }),
            message,
          ]),
          el("button", {
            type: "button",
            class: "btn-close me-2 m-auto",
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
