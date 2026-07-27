// view/pinList.js
// 売却候補ピンの一覧。損益は selectors 経由で計算済みの値を受け取るだけ。

import {
  formatNumber,
  formatSignedPct,
  formatSignedYen,
  toneClass,
} from "../utils/format.js";
import { clear, el } from "./dom.js";

/**
 * @param {Object} options
 * @param {HTMLElement} options.container
 * @param {(id:string, visible:boolean) => void} options.onToggle
 * @param {(id:string) => void} options.onRemove
 */
export function createPinList({ container, onToggle, onRemove }) {
  return {
    /**
     * @param {Array<{id:string, fx:number, price:number, visible:boolean, profitYen?:number, rateYenPct?:number}>} pins
     */
    render(pins) {
      clear(container);

      if (pins.length === 0) {
        container.append(
          el("p", {
            class: "text-body-secondary small mb-0",
            text: "ピンはまだありません。気になる売却条件を追加すると、グラフ上に損益が表示されます。",
          })
        );
        return;
      }

      const list = el("ul", { class: "list-unstyled mb-0 pin-list" });

      pins.forEach((pin) => {
        const toggleId = `pin-visible-${pin.id}`;
        const hasValuation = Number.isFinite(pin.profitYen);

        list.append(
          el("li", { class: "pin-item" }, [
            el("div", { class: "form-check mb-0 flex-grow-1" }, [
              el("input", {
                class: "form-check-input",
                type: "checkbox",
                id: toggleId,
                checked: pin.visible,
                onChange: (e) => onToggle(pin.id, e.target.checked),
              }),
              el("label", { class: "form-check-label", for: toggleId }, [
                el("span", {
                  class: "d-block",
                  text: `${formatNumber(pin.fx, 1)} 円/USD × ${formatNumber(pin.price, 2)} USD`,
                }),
                hasValuation &&
                  el("span", {
                    class: `d-block small ${toneClass(pin.profitYen)}`,
                    text: `${formatSignedYen(pin.profitYen)} 円 (${formatSignedPct(pin.rateYenPct)})`,
                  }),
              ]),
            ]),
            el(
              "button",
              {
                type: "button",
                class: "btn btn-sm btn-outline-danger",
                onClick: () => onRemove(pin.id),
              },
              [
                el("span", { "aria-hidden": "true", text: "×" }),
                el("span", {
                  class: "visually-hidden",
                  text: `${formatNumber(pin.fx, 1)}円 × ${formatNumber(pin.price, 2)}USD のピンを削除`,
                }),
              ]
            ),
          ])
        );
      });

      container.append(list);
    },
  };
}
