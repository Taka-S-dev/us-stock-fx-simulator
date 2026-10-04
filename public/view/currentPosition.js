// view/currentPosition.js
// 画面の主役。「今いくらの含み損益か」を最初に見せ、そのすぐ下に
// 「あと何円動けば±0か」を出す。グラフを読まなくても結論が分かる状態にする。

import { divergenceMessage } from "../model/analysis.js";
import {
  formatNumber,
  formatSignedPct,
  formatSignedYen,
  formatUsd,
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
 * @param {() => void} options.onRequestPrice 株価の入力欄へ案内する
 */
export function createCurrentPosition({
  container,
  breakEvenContainer,
  fxInput,
  priceInput,
  autoNote,
  onRequestPrice,
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
          /*
            一番大きい数字が仮の値から出ていることは、数字のそばで断らないと伝わらない。
            ただし塗りつぶしの枠で囲むと、初期状態（株価が未入力）で必ず出る注記が
            エラー表示に見える。色と位置だけで足りるので、囲みは持たせない。
          */
          point.priceAuto &&
            el("p", { class: "current-placeholder mb-0" }, [
              "株価が未入力のため、",
              el("strong", { text: "為替の影響だけ" }),
              "を表しています",
              /*
                入れる場所への行き方も持たせる。
                幅の狭い画面では入力欄が引き出しの中にあり、
                「未入力です」とだけ言われても、どこで直すのか分からない。
              */
              el("button", {
                type: "button",
                class: "btn btn-link btn-sm align-baseline p-0 ms-2",
                text: "株価を入力",
                onClick: onRequestPrice,
              }),
            ]),
        ])
      );

      if (divergence) {
        container.append(
          el("p", {
            class: "probe-divergence mb-0",
            text: divergenceMessage(divergence),
          })
        );
      }

      if (!breakEven) return;

      // 書式は売却条件パネルと揃える。同じ種類の情報を2つの書式で出すと、
      // 見比べるときに読み替えが要る
      breakEvenContainer.append(
        el("div", { class: "breakeven-callout" }, [
          /*
            2つの水準は「もう一方は動かない」ことが前提。
            それを行のラベル自身に入れておかないと、別々の目標として読める。
            向き（上か下か）は括弧内の符号が持つので言葉にはしない。
          */
          el("span", {
            class: "summary-stat-label d-block",
            text: "±0 になる水準",
          }),
          el("dl", { class: "breakeven-value stat-rows mb-0" }, [
            statRow(
              "株価だけが動くなら",
              `$${formatUsd(breakEven.breakEvenPrice)}（${formatSignedPct(breakEven.pricePct)}）`
            ),
            statRow(
              "為替だけが動くなら",
              `${formatNumber(breakEven.breakEvenFx, 2)} 円/USD（${formatSignedPct(breakEven.fxPct)}）`
            ),
          ]),
        ])
      );
    },
  };
}

/**
 * ラベルと値の1行。dl の2列グリッドに並べる前提で、要素の配列を返す。
 * @param {string} label
 * @param {string} value
 */
function statRow(label, value) {
  return [el("dt", { text: label }), el("dd", { text: value })];
}

/** 入力欄に入れる値。末尾の余分な 0 を落として編集しやすくする */
function formatInputValue(value, digits) {
  return String(Number(value.toFixed(digits)));
}
