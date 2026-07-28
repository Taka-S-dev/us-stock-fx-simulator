// view/purchaseList.js
// 購入履歴の入力行。アプリ内でこの行のマークアップを定義しているのはここだけで、
// PC 用・モーダル用・復元用に同じ HTML を複製しない。

import { LIMITS } from "../model/purchase.js";
import { el, clear, syncValue } from "./dom.js";

const FIELDS = /** @type {const} */ (["price", "fx", "qty"]);

/**
 * 増減ボタン。実際の増減は controller/app.js が委譲で拾うので、
 * 動的に作った行でもそのまま動く（data-step-target が対象の入力欄を指す）。
 */
const stepButton = (inputId, direction, label) =>
  el("button", {
    type: "button",
    class: "btn btn-outline-secondary",
    dataset: { stepTarget: inputId, stepDir: String(direction) },
    "aria-label": `${label}を${direction > 0 ? "増やす" : "減らす"}（Shiftで10）`,
    title: `${direction > 0 ? "増やす" : "減らす"}（Shiftで10 / 長押しで連続）`,
    text: direction > 0 ? "＋" : "−",
  });

/**
 * @param {Object} options
 * @param {HTMLElement} options.container
 * @param {(id:string, field:"price"|"fx"|"qty", value:string) => void} options.onChange
 *   入力のたびに呼ばれる
 * @param {(id:string) => void} options.onRemove
 * @param {() => void} [options.onCommit]
 *   入力が確定した（フォーカスが外れた／Enter）ときに呼ばれる
 */
export function createPurchaseList({
  container,
  onChange,
  onRemove,
  onCommit,
}) {
  /** @type {Map<string, {root:HTMLElement, inputs:Record<string,HTMLInputElement>, feedback:Record<string,HTMLElement>, legend:HTMLElement, removeButton:HTMLButtonElement}>} */
  const rows = new Map();

  function buildRow(purchase) {
    /** @type {Record<string, HTMLInputElement>} */
    const inputs = {};
    /** @type {Record<string, HTMLElement>} */
    const feedback = {};

    const fieldNodes = FIELDS.map((field) => {
      const spec = LIMITS[field];
      const inputId = `${purchase.id}-${field}`;
      const errorId = `${inputId}-error`;

      const input = el("input", {
        type: "number",
        id: inputId,
        class: `form-control ${field}`,
        inputmode: field === "qty" ? "numeric" : "decimal",
        min: spec.min,
        max: spec.max,
        step: spec.step,
        "aria-describedby": errorId,
        onInput: (e) => onChange(purchase.id, field, e.target.value),
        onChange: () => onCommit?.(),
      });

      const error = el("div", { class: "invalid-feedback", id: errorId });
      inputs[field] = input;
      feedback[field] = error;

      // ラベルの行数が違っても入力欄の高さが揃うよう、下端で揃える
      return el("div", { class: "d-flex flex-column justify-content-end" }, [
        el("label", { class: "form-label", for: inputId, text: spec.label }),
        el("div", { class: "input-group input-group-sm number-stepper" }, [
          stepButton(inputId, -1, spec.label),
          input,
          stepButton(inputId, 1, spec.label),
          error,
        ]),
      ]);
    });

    const legend = el("legend", { class: "purchase-legend" });
    const removeButton = el("button", {
      type: "button",
      class: "btn btn-sm btn-outline-secondary purchase-remove",
      onClick: () => onRemove(purchase.id),
    });
    removeButton.append(
      el("span", { "aria-hidden": "true", text: "×" }),
      el("span", { class: "visually-hidden", text: "この購入情報を削除" })
    );

    const root = el("fieldset", { class: "purchase-entry" }, [
      el(
        "div",
        { class: "d-flex justify-content-between align-items-center" },
        [legend, removeButton]
      ),
      el("div", { class: "field-grid" }, fieldNodes),
    ]);

    return { root, inputs, feedback, legend, removeButton };
  }

  return {
    /** @param {Array<{id:string, price:number|null, fx:number|null, qty:number|null, errors:Record<string,string>}>} purchases */
    render(purchases) {
      const ids = purchases.map((p) => p.id).join(",");
      const renderedIds = [...rows.keys()].join(",");

      // 行の増減があったときだけDOMを組み直す。値の変更は既存要素を更新するだけ
      if (ids !== renderedIds) {
        clear(container);
        rows.clear();
        for (const purchase of purchases) {
          const row = buildRow(purchase);
          rows.set(purchase.id, row);
          container.append(row.root);
        }
      }

      purchases.forEach((purchase, index) => {
        const row = rows.get(purchase.id);
        if (!row) return;

        row.legend.textContent = `購入情報 ${index + 1}`;
        // 1件目は削除させない（購入情報が0件になると計算対象が消える）
        row.removeButton.hidden = purchases.length <= 1;

        for (const field of FIELDS) {
          const input = row.inputs[field];
          const message = purchase.errors?.[field];

          if (purchase[field] != null) syncValue(input, purchase[field]);
          input.classList.toggle("is-invalid", Boolean(message));
          input.setAttribute("aria-invalid", message ? "true" : "false");
          row.feedback[field].textContent = message ?? "";
        }
      });
    },

    /** 追加直後の行にフォーカスを移す（キーボード操作で連続入力できるように） */
    focus(id) {
      rows.get(id)?.inputs.price.focus();
    },
  };
}
