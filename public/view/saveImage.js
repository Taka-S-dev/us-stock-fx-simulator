// view/saveImage.js
// グラフのPNG書き出し。画面に出しているのと同じ buildFigure を使い、
// 一時要素へ描いて画像化したうえで確実に片付ける。

import { buildFigure } from "./plot.js";

const WIDTH = 1200;
const HEIGHT = 800;

/**
 * @param {ReturnType<typeof import("../model/calc.js").calculateGraphData>} graph
 * @param {{fxMin:number,fxMax:number,priceMin:number,priceMax:number}} view
 * @param {"light"|"dark"} themeName
 * @param {{ fileName?: string }} [options]
 */
export async function saveGraphImage(graph, view, themeName, options = {}) {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  Object.assign(host.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: `${WIDTH}px`,
    height: `${HEIGHT}px`,
    pointerEvents: "none",
  });
  document.body.append(host);

  try {
    const { traces, layout } = buildFigure(graph, view, themeName, {
      forExport: true,
    });

    await Plotly.newPlot(
      host,
      traces,
      { ...layout, width: WIDTH, height: HEIGHT },
      { displayModeBar: false, staticPlot: true, responsive: false }
    );

    const dataUrl = await Plotly.toImage(host, {
      format: "png",
      width: WIDTH,
      height: HEIGHT,
      scale: 2,
    });

    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = options.fileName ?? buildFileName();
    link.click();
  } finally {
    Plotly.purge(host);
    host.remove();
  }
}

function buildFileName() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
  ].join("");
  return `break-even-${stamp}.png`;
}
