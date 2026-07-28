// view/rangeControls.js
// 表示範囲のスライダー。それぞれグラフの軸に沿って置かれている。
//
// 現在の範囲は軸の目盛りが示すので、ここでは数値の読み上げ用の要素を持たない。
// 状態 → UI は render() の一方向、UI → 状態は onChange の一方向。
// noUiSlider の 'slide' / 'change' はユーザー操作のときだけ発火し、プログラムからの
// set() では発火しないので、再入を防ぐフラグや setTimeout を挟む必要がない。

import { RANGE_LIMITS, scalePercent } from "../model/purchase.js";
import { clear, el, need } from "./dom.js";

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

/*
  トラック上に基準点の位置を刻む。

  グラフの外に出た点には「上にあります」と方向を出しているが、それだけでは
  どれくらい離れているのかが分からない。ここはミニマップを別に置くより、
  範囲を直す道具そのもの（スライダー）に位置を乗せたほうが、
  見る場所と操作する場所が一致して分かりやすい。
  スケールが非線形でもスライダー自身の座標系で描くので、位置は必ず軸と一致する。
*/
function createMarks(node, { range, vertical }) {
  const layer = el("div", { class: "slider-marks", "aria-hidden": "true" });
  node.append(layer);

  /** @param {Array<{value:number, kind:string, label:string}>} marks */
  return (marks) => {
    clear(layer);
    for (const mark of marks) {
      const percent = scalePercent(range, mark.value);
      if (percent === null) continue;
      layer.append(
        el("span", {
          class: `slider-mark slider-mark-${mark.kind}`,
          // 位置は % で置く。トラックの実寸が変わっても付いてくる
          style: vertical ? { bottom: `${percent}%` } : { left: `${percent}%` },
          title: mark.label,
        })
      );
    }
  };
}

/**
 * @param {Object} options
 * @param {(patch: Partial<{fxMin:number,fxMax:number,priceMin:number,priceMax:number}>) => void} options.onChange
 */
export function createRangeControls({ onChange }) {
  const fxRange = { min: RANGE_LIMITS.fx.min, max: RANGE_LIMITS.fx.max };
  const fxNode = need("#fx-slider");
  const priceNode = need("#price-slider");

  const fxSlider = createSlider(
    fxNode,
    {
      range: fxRange,
      step: RANGE_LIMITS.fx.step,
      digits: 1,
      labels: ["為替レートの下限", "為替レートの上限"],
    },
    ([min, max]) => onChange({ fxMin: min, fxMax: max })
  );

  const priceSlider = createSlider(
    priceNode,
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

  const renderFxMarks = createMarks(fxNode, {
    range: fxRange,
    vertical: false,
  });
  const renderPriceMarks = createMarks(priceNode, {
    range: RANGE_LIMITS.price.scale,
    vertical: true,
  });

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
    /**
     * @param {{fxMin:number,fxMax:number,priceMin:number,priceMax:number}} view
     * @param {{currentPoint?:{fx:number,price:number}|null,
     *          averagePoint?:{fx:number,price:number}|null,
     *          pins?:Array<{fx:number,price:number}>}} [landmarks]
     */
    render(view, landmarks = {}) {
      setIfChanged(fxSlider, [view.fxMin, view.fxMax]);
      setIfChanged(priceSlider, [view.priceMin, view.priceMax]);

      const { currentPoint, averagePoint, pins = [] } = landmarks;
      const points = [
        averagePoint && {
          point: averagePoint,
          kind: "average",
          label: "平均購入点",
        },
        currentPoint && {
          point: currentPoint,
          kind: "current",
          label: "現在地",
        },
        ...pins.map((pin, index) => ({
          point: pin,
          kind: "pin",
          label: `売却候補ピン ${index + 1}`,
        })),
      ].filter(Boolean);

      const marksFor = (axis) =>
        points
          .filter(({ point }) => Number.isFinite(point?.[axis]))
          .map(({ point, kind, label }) => ({
            value: point[axis],
            kind,
            label,
          }));

      renderFxMarks(marksFor("fx"));
      renderPriceMarks(marksFor("price"));
    },
  };
}
