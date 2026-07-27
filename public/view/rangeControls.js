// view/rangeControls.js
// 表示範囲のスライダー。それぞれグラフの軸に沿って置かれている。
//
// 現在の範囲は軸の目盛りが示すので、ここでは数値の読み上げ用の要素を持たない。
// 状態 → UI は render() の一方向、UI → 状態は onChange の一方向。
// noUiSlider の 'slide' / 'change' はユーザー操作のときだけ発火し、プログラムからの
// set() では発火しないので、旧実装の isUpdating フラグや setTimeout が不要になる。

import { RANGE_LIMITS } from "../model/purchase.js";
import { need } from "./dom.js";

/** 末尾の余分な 0 を落とす（"150.0" ではなく "150" と出す） */
const trim = (value, digits) => String(Number(Number(value).toFixed(digits)));

/**
 * @param {HTMLElement} node
 * @param {Object} options
 * @param {Record<string, unknown>} options.range noUiSlider の range 定義
 * @param {number} [options.step] 一定刻みの場合の刻み幅（range 側で指定するなら省略）
 * @param {number} options.digits 表示桁数
 * @param {number[]} [options.pips] 目盛りに出す値
 * @param {string[]} options.labels ハンドルの読み上げ名
 * @param {(values:number[]) => void} onUserChange
 */
function createSlider(
  node,
  { range, step, digits, pips, labels, vertical = false },
  onUserChange
) {
  noUiSlider.create(node, {
    start: [range.min?.[0] ?? range.min, range.max],
    connect: true,
    range,
    ...(step ? { step } : {}),
    // 縦向きは下端が最小値になるように（rtl が「開始＝下」の指定）
    ...(vertical ? { orientation: "vertical", direction: "rtl" } : {}),
    handleAttributes: labels.map((label) => ({ "aria-label": label })),
    format: {
      to: (value) => trim(value, digits),
      from: (value) => Number(value),
    },
    ...(pips
      ? {
          pips: {
            mode: "values",
            values: pips,
            density: -1, // 目盛り線は出さず、ラベルだけを置く
            // 縦に並べるので桁を詰める（1000 -> 1k）
            format: {
              to: (value) =>
                value >= 1000 ? `${trim(value / 1000, 1)}k` : trim(value, 0),
            },
          },
        }
      : {}),
  });

  // 目盛りは絶対配置で描かれるため、下方向の余白は自前で確保する
  if (pips) node.classList.add("slider-has-pips");

  const emit = (values) => onUserChange(values.map(Number));
  node.noUiSlider.on("slide", emit);
  node.noUiSlider.on("change", emit);
  return node.noUiSlider;
}

/**
 * @param {Object} options
 * @param {(patch: Partial<{fxMin:number,fxMax:number,priceMin:number,priceMax:number}>) => void} options.onChange
 */
export function createRangeControls({ onChange }) {
  const fxSlider = createSlider(
    need("#fx-slider"),
    {
      range: { min: RANGE_LIMITS.fx.min, max: RANGE_LIMITS.fx.max },
      step: RANGE_LIMITS.fx.step,
      digits: 1,
      labels: ["為替レートの下限", "為替レートの上限"],
    },
    ([min, max]) => onChange({ fxMin: min, fxMax: max })
  );

  const priceSlider = createSlider(
    need("#price-slider"),
    {
      // 非線形スケール。低価格帯の分解能を確保しつつ $5,000 まで届く
      range: RANGE_LIMITS.price.scale,
      digits: 1,
      pips: RANGE_LIMITS.price.pips,
      labels: ["売却株価の下限", "売却株価の上限"],
      // グラフの縦軸に沿わせるため縦向き
      vertical: true,
    },
    ([min, max]) => onChange({ priceMin: min, priceMax: max })
  );

  const setIfChanged = (slider, [min, max]) => {
    const [currentMin, currentMax] = slider.get().map(Number);
    if (
      Math.abs(currentMin - min) > 1e-9 ||
      Math.abs(currentMax - max) > 1e-9
    ) {
      slider.set([min, max]);
    }
  };

  return {
    /** @param {{fxMin:number,fxMax:number,priceMin:number,priceMax:number}} view */
    render(view) {
      setIfChanged(fxSlider, [view.fxMin, view.fxMax]);
      setIfChanged(priceSlider, [view.priceMin, view.priceMax]);
    },
  };
}
