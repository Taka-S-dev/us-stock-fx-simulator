// view/summary.js
// 取得の内訳と、グラフ上で指した1点の損益。
// どちらも補助的な情報なので、主役（現在の含み損益）より控えめに出す。

import {
  formatCount,
  formatNumber,
  formatUsd,
  formatYen,
} from "../utils/format.js";
import { clear, el } from "./dom.js";

/*
  列数は .stat-grid が実際の幅から決める。
  以前は col-lg-3 と画面幅で4列に固定していたため、カードが狭くなると
  「24,555.00 円/株」が数字の途中で改行していた。
*/
const stat = (label, value, unit) =>
  el("div", { class: "summary-stat" }, [
    el("dt", { class: "summary-stat-label", text: label }),
    el("dd", { class: "summary-stat-value mb-0" }, [
      el("span", { text: value }),
      unit && el("span", { class: "summary-stat-extra", text: unit }),
    ]),
  ]);

/**
 * @param {Object} options
 * @param {HTMLElement} options.container
 */
export function createSummary({ container }) {
  return {
    /** @param {ReturnType<typeof import("../model/selectors.js").selectSummary>} summary */
    render(summary) {
      clear(container);
      if (!summary) return;

      const { aggregate } = summary;

      container.append(
        el("dl", { class: "stat-grid mb-2" }, [
          stat("合計株数", formatCount(aggregate.totalQty), " 株"),
          stat("取得総額", formatYen(aggregate.totalCostYen), " 円"),
          stat("平均取得価額", formatNumber(aggregate.avgAcqYen, 2), " 円/株"),
          stat("平均購入為替", formatNumber(aggregate.avgFx, 2), " 円/USD"),
        ])
      );

      if (summary.breakEvenPriceUsd) {
        container.append(
          el("p", {
            class: "text-body-secondary small mb-0",
            text: `USD建てで見た損益分岐株価（平均取得価額）は $${formatUsd(summary.breakEvenPriceUsd)} です。為替の影響を除いた基準になります。`,
          })
        );
      }
    },
  };
}
