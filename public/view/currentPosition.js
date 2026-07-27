// view/currentPosition.js
// 画面の主役。「今いくらの含み損益か」を最初に見せ、そのすぐ下に
// 「あと何円動けば±0か」を出す。グラフを読まなくても結論が分かる状態にする。

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
            ]),
        ])
      );

      /*
        評価額・取得総額・USD建ての3つはここから外した。
        カードが答えるべき問いは「いま、いくらか」と「±0 まであとどれくらいか」の2つで、
        3つとも別の場所に同じものがあるか、その場で導ける:
          取得総額 … 「取得の内訳」に同じものが出ている
          評価額   … 取得総額 ＋ 上の損益。しかも株価が未入力なら仮の値なので、
                     注記から離して単独で置くと誤解のもとになる
          USD建て  … 初期状態では検討中の条件（＝現在地）のパネルに同じ数字が出る。
                     円建てと符号が食い違うときだけは意味を持つので、
                     その場合は下の1行（divergence）で言葉にして伝える
      */

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
          // 2つの数字は「どちらか片方でも」成り立てば ±0 になる条件。
          // 見出しがそれを言わないと、2つ揃って必要な条件に読める
          el("span", {
            class: "summary-stat-label d-block",
            text: breakEven.inProfit
              ? "株価か為替が ここまで下がると ±0"
              : "株価か為替が ここまで戻ると ±0",
          }),
          el("dl", { class: "breakeven-value stat-rows mb-0" }, [
            statRow(
              "株価",
              `$${formatUsd(breakEven.breakEvenPrice)}（${formatSignedPct(breakEven.pricePct)}）`
            ),
            statRow(
              "為替",
              `${formatNumber(breakEven.breakEvenFx, 2)} 円/USD（${formatSignedPct(breakEven.fxPct)}）`
            ),
          ]),
        ])
      );
    },
  };
}

/**
 * ラベルと値の1行。dl の2列グリッドに流し込む前提で、要素の配列を返す。
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
