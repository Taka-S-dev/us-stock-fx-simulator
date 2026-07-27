// view/currentPosition.js
// 画面の主役。「今いくらの含み損益か」を最初に見せ、そのすぐ下に
// 「あと何円動けば±0か」を出す。グラフを読まなくても結論が分かる状態にする。

import {
  formatNumber,
  formatSignedPct,
  formatSignedUsd,
  formatSignedYen,
  formatUsd,
  formatYen,
  toneClass,
} from "../utils/format.js";
import { clear, el, syncValue } from "./dom.js";

/**
 * @param {Object} options
 * @param {HTMLElement} options.container 含み損益の表示先
 * @param {HTMLElement} options.breakEvenContainer 損益分岐までの距離の表示先
 * @param {HTMLInputElement} options.fxInput
 * @param {HTMLInputElement} options.priceInput
 * @param {HTMLElement} options.autoNote 自動追従中の補足表示
 */
export function createCurrentPosition({
  container,
  breakEvenContainer,
  fxInput,
  priceInput,
  autoNote,
}) {
  return {
    /** @param {ReturnType<typeof import("../model/selectors.js").selectCurrentValuation>} data */
    render(data) {
      clear(container);
      clear(breakEvenContainer);
      clear(autoNote);
      if (!data) return;

      const { point, valuation, breakEven, divergence } = data;

      syncValue(fxInput, formatInputValue(point.fx, 2));
      syncValue(priceInput, formatInputValue(point.price, 2));

      // 補足は1行に収める。常設の説明文が増えるほど画面が読みにくくなる
      const autoLabels = [
        point.fxAuto && "為替",
        point.priceAuto && "株価",
      ].filter(Boolean);
      if (autoLabels.length > 0) {
        autoNote.append(
          el("span", { text: `${autoLabels.join("・")}は自動（上書き可）` })
        );
      }

      const tone = toneClass(valuation.profitYen);

      container.append(
        el("div", { class: "current-headline" }, [
          el("div", { class: "current-headline-main" }, [
            el("span", {
              class: `current-profit ${tone}`,
              text: `${formatSignedYen(valuation.profitYen)} 円`,
            }),
            el("span", {
              class: `current-rate ${tone}`,
              text: formatSignedPct(valuation.rateYenPct),
            }),
          ]),
          // 項目ごとに span に分ける。1つの文にすると途中で折り返して読みにくい
          // 一番大きい数字が仮の値から出ていることは、数字のそばで断らないと伝わらない
          point.priceAuto &&
            el("p", { class: "current-placeholder mb-0" }, [
              "現在の株価が未入力です。平均取得価額で計算しているので、",
              el("strong", { text: "為替の影響だけ" }),
              "を表しています。",
            ]),

          el("p", { class: "current-sub mb-0" }, [
            el("span", { text: `評価額 ${formatYen(valuation.valueYen)} 円` }),
            el("span", {
              text: `取得総額 ${formatYen(data.aggregate.totalCostYen)} 円`,
            }),
            el("span", {
              text: `USD建て ${formatSignedUsd(valuation.profitUsd)} USD（${formatSignedPct(valuation.rateUsdPct)}）`,
            }),
          ]),
        ])
      );

      if (divergence) {
        container.append(
          el("p", { class: "probe-divergence mb-0" }, [
            divergence === "usdOnly"
              ? "株価では利益ですが、円高に食われて円換算では損失です。"
              : "株価では損失ですが、円安に助けられて円換算では利益です。",
          ])
        );
      }

      if (!breakEven) return;

      // 表記はプローブ側の「ここから ±0 になる水準」と揃える。
      // 同じ種類の情報を2つの書式で出すと、見比べるときに読み替えが要る
      breakEvenContainer.append(
        el("div", { class: "breakeven-callout" }, [
          el("span", {
            class: "summary-stat-label d-block",
            text: breakEven.inProfit
              ? "ここまで下がると ±0"
              : "ここまで戻ると ±0",
          }),
          el("span", { class: "breakeven-value" }, [
            `株価 $${formatUsd(breakEven.breakEvenPrice)}（${formatSignedPct(breakEven.pricePct)}）`,
            el("span", {
              class: "d-block",
              text: `為替 ${formatNumber(breakEven.breakEvenFx, 2)} 円/USD（${formatSignedPct(breakEven.fxPct)}）`,
            }),
          ]),
        ])
      );
    },
  };
}

/** 入力欄に入れる値。末尾の余分な 0 を落として編集しやすくする */
function formatInputValue(value, digits) {
  return String(Number(value.toFixed(digits)));
}
