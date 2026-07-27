// view/probe.js
// 売却条件（プローブ）の読み取り値。
//
// グラフ上の点は「ホバーで一瞬見える値」ではなく、動かして残せる入力にしてある。
// 操作の手段は3つ（ドラッグ／矢印キー／数値入力）だが、どれも同じ状態を更新する。

import { divergenceMessage } from "../model/analysis.js";
import {
  formatNumber,
  formatSignedPct,
  formatSignedUsd,
  formatSignedYen,
  toneClass,
} from "../utils/format.js";
import { clear, el, syncValue } from "./dom.js";

const signed = (n, digits) =>
  `${n >= 0 ? "+" : "-"}${formatNumber(Math.abs(n), digits)}`;

/**
 * @param {Object} options
 * @param {HTMLElement} options.container 読み取り値の表示先
 * @param {HTMLInputElement} options.fxInput
 * @param {HTMLInputElement} options.priceInput
 * @param {HTMLButtonElement} options.resetButton
 */
export function createProbePanel({
  container,
  fxInput,
  priceInput,
  resetButton,
}) {
  return {
    /** @param {ReturnType<typeof import("../model/selectors.js").selectProbeValuation>} data */
    render(data) {
      clear(container);
      if (!data) return;

      const { point, valuation, delta, divergence } = data;

      syncValue(fxInput, formatNumber(point.fx, 2).replace(/,/g, ""));
      syncValue(priceInput, formatNumber(point.price, 2).replace(/,/g, ""));
      /*
        「現在地に戻す」は現在地から動かしたときだけ出す。
        初期状態は売却条件＝現在地なので、無効化して置くと
        押せないボタンが常に見えていることになる。
        並びは右詰めなので、現れても隣のボタンの位置は動かない。
      */
      resetButton.classList.toggle("d-none", point.followsCurrent);
      resetButton.disabled = point.followsCurrent;

      const tone = toneClass(valuation.profitYen);

      container.append(
        el("div", { class: "probe-readout" }, [
          el("div", { class: "probe-figure" }, [
            el("span", {
              class: "summary-stat-label d-block",
              text: "この条件で売ったときの損益",
            }),
            el("span", { class: `probe-profit ${tone}` }, [
              `${formatSignedYen(valuation.profitYen)} 円`,
              el("span", {
                class: "probe-rate",
                text: formatSignedPct(valuation.rateYenPct),
              }),
            ]),
            el(
              "span",
              { class: `probe-usd d-block ${toneClass(valuation.profitUsd)}` },
              [
                `USD建て ${formatSignedUsd(valuation.profitUsd)} USD（${formatSignedPct(valuation.rateUsdPct)}）`,
              ]
            ),
            delta.profitYen !== 0 &&
              el("span", {
                class: "probe-delta d-block",
                text: `現在地より ${formatSignedYen(delta.profitYen)} 円（為替 ${signed(delta.fx, 2)} 円 / 株価 ${signed(delta.price, 2)} USD）`,
              }),
          ]),

          // このパネルが答えるのは「この条件で売ったらいくらか」の1つだけ。
          // ±0 の水準は「現在の含み損益」と、グラフ上の損益分岐ラインが持つ。
        ])
      );

      // 符号が食い違っている状態そのものを言葉にする。
      // 「株価では勝っているのに円では負けている」がこのアプリの主題
      if (divergence) {
        container.append(
          el("p", {
            class: "probe-divergence mb-0",
            text: divergenceMessage(divergence),
          })
        );
      }
    },
  };
}
