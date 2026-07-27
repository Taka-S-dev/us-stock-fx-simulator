// view/analysis.js
// 感応度とシナリオ比較表。どちらも calc / analysis が返した数値を並べるだけ。

import { DEFAULT_SCENARIOS } from "../model/analysis.js";
import {
  formatNumber,
  formatSignedPct,
  formatSignedYen,
  formatUsd,
  toneClass,
} from "../utils/format.js";
import { clear, el } from "./dom.js";

const DOMINANT_NOTE = {
  price: "1単位あたりでは株価の影響が大きい状態です。",
  fx: "1単位あたりでは為替の影響が大きい状態です。",
  even: "1単位あたりの影響は為替と株価で拮抗しています。",
};

/**
 * 感応度パネル
 * @param {Object} options
 * @param {HTMLElement} options.container
 */
export function createSensitivityPanel({ container }) {
  const item = (label, value, note) =>
    el("div", { class: "col-12 col-sm-4" }, [
      el("div", { class: "summary-stat h-100" }, [
        el("dt", { class: "summary-stat-label", text: label }),
        el("dd", { class: "summary-stat-value mb-0", text: value }),
        note && el("p", { class: "sensitivity-note mb-0", text: note }),
      ]),
    ]);

  return {
    /** @param {ReturnType<typeof import("../model/analysis.js").sensitivityAt>} sensitivity */
    render(sensitivity) {
      clear(container);
      if (!sensitivity) return;

      container.append(
        el("dl", { class: "row g-2 mb-2" }, [
          item(
            "為替が 1 円動くと",
            `${formatSignedYen(sensitivity.perYen)} 円`,
            "円安方向に動いた場合"
          ),
          item(
            "株価が $1 動くと",
            `${formatSignedYen(sensitivity.perDollar)} 円`,
            "株価が上がった場合"
          ),
          item(
            "どちらかが 1% 動くと",
            `${formatSignedYen(sensitivity.perPercent)} 円`,
            "率で見ると影響は同じ"
          ),
        ]),
        el("p", {
          class: "text-body-secondary small mb-0",
          text: DOMINANT_NOTE[sensitivity.dominant],
        })
      );
    },
  };
}

/**
 * シナリオ比較表
 * @param {Object} options
 * @param {HTMLElement} options.container
 */
export function createScenarioTable({ container }) {
  const fxLabel = (delta) =>
    delta === 0
      ? "現状"
      : delta > 0
        ? `円安 +${formatNumber(delta, 0)}円`
        : `円高 ${formatNumber(delta, 0)}円`;

  const priceLabel = (ratio) =>
    ratio === 0 ? "現状" : `株価 ${formatSignedPct(ratio * 100)}`;

  return {
    /** @param {ReturnType<typeof import("../model/analysis.js").scenarioMatrix>} matrix */
    render(matrix) {
      clear(container);
      if (!matrix) return;

      const head = el("tr", {}, [
        el("th", { scope: "col", class: "text-body-secondary", text: "" }),
        ...matrix.columns.map((column) =>
          el("th", { scope: "col", class: "text-end" }, [
            el("span", { class: "d-block", text: fxLabel(column.fxDelta) }),
            el("span", {
              class: "fw-normal text-body-secondary small",
              text: `${formatNumber(column.fx, 1)} 円/USD`,
            }),
          ])
        ),
      ]);

      const body = matrix.rows.map((row) =>
        el("tr", {}, [
          el("th", { scope: "row" }, [
            el("span", { class: "d-block", text: priceLabel(row.priceRatio) }),
            el("span", {
              class: "fw-normal text-body-secondary small",
              text: `$${formatUsd(row.price)}`,
            }),
          ]),
          ...row.cells.map((cell) =>
            el(
              "td",
              {
                class: `text-end scenario-cell ${toneClass(cell.profitYen)}`,
              },
              [
                el("span", {
                  class: "d-block fw-semibold",
                  text: `${formatSignedYen(cell.profitYen)} 円`,
                }),
                el("span", {
                  class: "small",
                  text: formatSignedPct(cell.rateYenPct),
                }),
              ]
            )
          ),
        ])
      );

      container.append(
        el("div", { class: "table-responsive" }, [
          el(
            "table",
            { class: "table table-sm align-middle scenario-table mb-0" },
            [el("thead", {}, [head]), el("tbody", {}, body)]
          ),
        ]),
        el("p", {
          class: "text-body-secondary small mb-0 mt-2",
          text: `現在地を基準に、為替 ±${Math.max(...DEFAULT_SCENARIOS.fxDeltas)}円・株価 ±${Math.max(...DEFAULT_SCENARIOS.priceRatios) * 100}% の範囲で売却した場合の損益です。`,
        })
      );
    },
  };
}
