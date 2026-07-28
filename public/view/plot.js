// view/plot.js
// Plotly の図の組み立てと描画。損益の計算は一切行わず、calc.js が返した値を
// 座標と文字列に落とすだけ。画面表示と画像出力で同じ buildFigure を使うため、
// 「保存した画像だけ見た目が違う」という食い違いが起きない。

import { niceContourStep } from "../model/analysis.js";
import {
  formatNumber,
  formatSignedPct,
  formatSignedYen,
  formatUsd,
  formatYen,
} from "../utils/format.js";

/*
  配色の方針。

  色は等高線（データ）が持つ。赤↔青ですでに損益を表しているので、
  マーカーまで彩度の高い色を並べると、どれが主役か分からなくなる。

    事実を示す点（購入点・平均購入点・現在地・損益分岐ライン）
      … 無彩色＋縁取り（halo）。区別は色ではなく「形」で行う。
        重なっても読み分けられるよう、主役（現在地・損益分岐ライン）は ink、
        背景となる参照点（購入点・平均購入点）は一段弱い inkSoft
    操作する点（売却条件・ピン）
      … accent 1色だけ。画面上で一番目立ってよいのはここ

  線の描き分け:
    データの線（損益分岐 円建て／USD建て）… 実線。重要度は太さで表す
    カーソルの線（プローブの十字線）      … 点線。データと混同させない

  ダークモードでも等高線の中央（損益0）が背景に馴染むようにしている。
*/
const PALETTE = {
  light: {
    font: "#212529",
    grid: "rgba(0,0,0,.08)",
    surface: "rgba(255,255,255,.88)",
    border: "#adb5bd",
    breakEven: "#212529",
    breakEvenUsd: "#adb5bd",
    contourLine: "rgba(33,37,41,.25)",
    /* 事実を示す点は無彩色。等高線の赤↔青と competing しない */
    ink: "#212529",
    inkSoft: "#868e96",
    halo: "#ffffff",
    /* 操作する点だけに色を割り当てる */
    accent: "#5f3dc4",
    /* カーソルの補助線。データではないので、点線かつ控えめに */
    crosshair: "rgba(95,61,196,.45)",
    // 損益の符号を示す色。注釈の背景（surface）の上で読める明度にしている
    positive: "#0f7b47",
    negative: "#c92a2a",
    // ColorBrewer RdBu: 損失=赤 / 利益=青 / 中央（損益0）=白
    scale: [
      [0, "#b2182b"],
      [0.25, "#ef8a62"],
      [0.5, "#f7f7f7"],
      [0.75, "#67a9cf"],
      [1, "#2166ac"],
    ],
  },
  dark: {
    font: "#dee2e6",
    grid: "rgba(255,255,255,.12)",
    surface: "rgba(33,37,41,.9)",
    border: "#6c757d",
    breakEven: "#f8f9fa",
    breakEvenUsd: "#6c757d",
    contourLine: "rgba(248,249,250,.25)",
    ink: "#f8f9fa",
    inkSoft: "#adb5bd",
    halo: "#212529",
    accent: "#b197fc",
    crosshair: "rgba(177,151,252,.45)",
    positive: "#51cf66",
    negative: "#ff8787",
    scale: [
      [0, "#b2182b"],
      [0.25, "#d6604d"],
      [0.5, "#2b3035"],
      [0.75, "#4393c3"],
      [1, "#2166ac"],
    ],
  },
};

/*
  Plotly に渡すフォント。

  "inherit" を渡してはいけない。Plotly は枠（注釈の背景）の大きさを
  文字幅の計算結果から決めるが、"inherit" では実際に使われるフォントを
  解決できず、描画は既定スタック（Open Sans → Verdana）に落ちる。
  Verdana は想定より約2割広いため、文字だけが枠からはみ出す。
  ページで実際に使われている値を解決して渡し、計算と描画を一致させる。
*/
const resolveFontFamily = () => {
  if (typeof document === "undefined") return "system-ui, sans-serif";
  return getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
};

/** 損益の符号に応じた色。0 は中立のまま */
const toneColor = (value, palette) =>
  value > 0 ? palette.positive : value < 0 ? palette.negative : palette.font;

/** Plotly の注釈内で色を付ける（対応しているのは span/b などの限られたタグのみ） */
const colored = (text, color) => `<span style="color:${color}">${text}</span>`;

const inView = (point, view) =>
  point.fx >= view.fxMin &&
  point.fx <= view.fxMax &&
  point.price >= view.priceMin &&
  point.price <= view.priceMax;

const directionOf = (point, view) => {
  const x = point.fx < view.fxMin ? "左" : point.fx > view.fxMax ? "右" : "";
  const y =
    point.price < view.priceMin
      ? "下"
      : point.price > view.priceMax
        ? "上"
        : "";
  return `${x}${y}` || "範囲外";
};

const clampToView = (point, view) => ({
  x: Math.min(Math.max(point.fx, view.fxMin), view.fxMax),
  y: Math.min(Math.max(point.price, view.priceMin), view.priceMax),
});

/**
 * Plotly に渡す traces と layout を組み立てる。
 *
 * @param {ReturnType<typeof import("../model/calc.js").calculateGraphData>} graph
 * @param {{fxMin:number,fxMax:number,priceMin:number,priceMax:number}} view
 * @param {"light"|"dark"} themeName
 * @param {{
 *   forExport?: boolean,
 *   compact?: boolean,
 *     幅の狭い画面向け。凡例・カラーバー・数値ラベルを外してプロット領域に幅を回す
 *   currentPoint?: {fx:number, price:number}|null,
 *   probe?: {fx:number, price:number, profitYen?:number, rateYenPct?:number}|null,
 *     損益を渡すと、グラフ上のプローブに直接ラベルを付ける
 * }} [options]
 */
export function buildFigure(
  graph,
  view,
  themeName,
  { forExport = false, compact = false, currentPoint = null, probe = null } = {}
) {
  const c = PALETTE[themeName] ?? PALETTE.light;
  const scaleUp = forExport ? 1.3 : 1;
  const size = (n) => Math.round(n * scaleUp);

  const extent = Math.max(
    ...graph.profitYen.map((row) => Math.max(...row.map(Math.abs))),
    1000
  );

  // 等高線の間隔を切りのいい数字にして、色ではなく数値で読み取れるようにする。
  // 間隔の倍数で範囲を取ることで、損益0が必ず等高線として引かれる
  const step = niceContourStep(extent);
  const levels = Math.ceil(extent / step);

  const traces = [
    {
      type: "contour",
      name: "損益（円）",
      x: graph.fxVals,
      y: graph.priceVals,
      z: graph.profitYen,
      zmin: -extent,
      zmax: extent,
      colorscale: c.scale,
      contours: {
        coloring: "heatmap",
        showlines: true,
        showlabels: true,
        start: -levels * step,
        end: levels * step,
        size: step,
        labelfont: { size: size(10), color: c.font },
      },
      line: { width: 1, color: c.contourLine },
      /*
        ホバーの吹き出しは出さない。
        プローブのラベルが同じ内容を常時出しているうえ、Plotly のホバーは
        等高線の格子点に値を丸めるため、同じ場所を指しても数字が食い違ってしまう
        （株価で最大 0.8 ドル程度）。値の地形は等高線のラベルで読める。
      */
      hoverinfo: "skip",
      /*
        カラーバーは幅を 75px 使う（幅360pxの端末ではグラフ描画域の30%）。
        値そのものは等高線のラベル（0 / 100k / 200k …）が持っているので、
        狭い画面では帯をやめて、その幅をプロット領域に回す。
      */
      showscale: !compact,
      colorbar: {
        title: { text: "損益（円）", font: { size: size(11) } },
        tickformat: ",.3~s",
        tickfont: { size: size(10) },
        thickness: size(10),
        len: 0.6,
        outlinewidth: 0,
      },
    },
    {
      type: "scatter",
      mode: "lines",
      name: "損益分岐（円建て）",
      x: graph.breakEvenPoints.map((p) => p.fx),
      y: graph.breakEvenPoints.map((p) => p.price),
      line: { color: c.breakEven, width: size(3) },
      hoverinfo: "skip",
    },
  ];

  // USD建ての損益分岐（為替に依存しないので水平線になる）
  if (
    graph.breakEvenPriceUsd &&
    graph.breakEvenPriceUsd >= view.priceMin &&
    graph.breakEvenPriceUsd <= view.priceMax
  ) {
    traces.push({
      type: "scatter",
      mode: "lines",
      name: "損益分岐（USD建て）",
      x: [view.fxMin, view.fxMax],
      y: [graph.breakEvenPriceUsd, graph.breakEvenPriceUsd],
      // 破線はカーソル（プローブの十字線）専用にして、データの線は実線に統一する
      line: { color: c.breakEvenUsd, width: size(2) },
      hoverinfo: "skip",
    });
  }

  const purchasesInView = graph.purchases.filter((p) => inView(p, view));
  if (purchasesInView.length > 0) {
    traces.push({
      type: "scatter",
      mode: "markers",
      name: "購入点",
      x: purchasesInView.map((p) => p.fx),
      y: purchasesInView.map((p) => p.price),
      marker: {
        color: c.inkSoft,
        size: size(7),
        symbol: "circle",
        line: { color: c.halo, width: 1.5 },
      },
      hoverinfo: "skip",
    });
  }

  if (graph.averagePoint && inView(graph.averagePoint, view)) {
    traces.push({
      type: "scatter",
      mode: "markers",
      name: "平均購入点",
      x: [graph.averagePoint.fx],
      y: [graph.averagePoint.price],
      marker: {
        color: c.inkSoft,
        size: size(15),
        symbol: "star",
        line: { color: c.halo, width: 1.5 },
      },
      hoverinfo: "skip",
    });
  }

  if (currentPoint && inView(currentPoint, view)) {
    traces.push({
      type: "scatter",
      mode: "markers",
      name: "現在地",
      x: [currentPoint.fx],
      y: [currentPoint.price],
      marker: {
        color: "rgba(0,0,0,0)",
        size: size(17),
        symbol: "circle",
        line: { color: c.ink, width: 2.5 },
      },
      hoverinfo: "skip",
    });
  }

  /*
    売却条件（プローブ）。すべて trace として描く。

    以前は「掴む輪」を editable な shape にして Plotly にドラッグさせていたが、
    Plotly のシェイプ編集は移動とリサイズを分離できず、輪の縁を掴むと
    リサイズ扱いになって円が楕円に潰れてしまう（28px の輪はほぼ全体が縁）。
    ドラッグは自前で処理しているので、shape を持つ必要がない。
  */
  if (probe && inView(probe, view)) {
    traces.push(
      {
        type: "scatter",
        mode: "lines",
        x: [probe.fx, probe.fx],
        y: [view.priceMin, view.priceMax],
        line: { color: c.crosshair, width: 1, dash: "dot" },
        hoverinfo: "skip",
        showlegend: false,
      },
      {
        type: "scatter",
        mode: "lines",
        x: [view.fxMin, view.fxMax],
        y: [probe.price, probe.price],
        line: { color: c.crosshair, width: 1, dash: "dot" },
        hoverinfo: "skip",
        showlegend: false,
      },
      // 掴めることを示す輪。マーカーのサイズはピクセル指定なので、
      // 拡大率が変わっても大きさは一定に保たれる
      {
        type: "scatter",
        mode: "markers",
        x: [probe.fx],
        y: [probe.price],
        marker: {
          color: "rgba(0,0,0,0)",
          size: size(26),
          symbol: "circle",
          line: { color: c.accent, width: 2 },
        },
        hoverinfo: "skip",
        showlegend: false,
      },
      {
        type: "scatter",
        mode: "markers",
        name: "売却条件",
        x: [probe.fx],
        y: [probe.price],
        marker: { color: c.accent, size: size(9), symbol: "circle" },
        hoverinfo: "skip",
      }
    );
  }

  const pinsInView = graph.pins.filter((p) => inView(p, view));
  if (pinsInView.length > 0) {
    traces.push({
      type: "scatter",
      mode: "markers",
      name: "売却候補ピン",
      x: pinsInView.map((p) => p.fx),
      y: pinsInView.map((p) => p.price),
      marker: {
        color: c.halo,
        size: size(11),
        symbol: "diamond",
        line: { color: c.accent, width: 2 },
      },
      hoverinfo: "skip",
    });
  }

  /* ---- 注釈 ------------------------------------------------------------ */
  const annotations = [];
  const box = {
    xref: "x",
    yref: "y",
    align: "left",
    bgcolor: c.surface,
    bordercolor: c.border,
    borderwidth: 1,
    borderpad: 4,
    font: { size: size(10), color: c.font },
  };
  const midFx = (view.fxMin + view.fxMax) / 2;
  const midPrice = (view.priceMin + view.priceMax) / 2;

  /*
    プローブに損益を直付けする。
    ドラッグ中は Plotly のホバー（＝ツールチップ）が止まるため、これが無いと
    「いま動かしている点の数字」を見るのにグラフから目を離す必要が出てしまう。
  */
  // 狭い画面では出さない。181px の吹き出しは 101px の描画域から必ずはみ出すうえ、
  // 同じ数字はすぐ下の「売却条件」パネルに出ている
  if (
    !compact &&
    probe &&
    inView(probe, view) &&
    Number.isFinite(probe.profitYen)
  ) {
    annotations.push({
      ...box,
      x: probe.fx,
      y: probe.price,
      showarrow: true,
      arrowhead: 4,
      arrowcolor: c.accent,
      bordercolor: c.accent,
      borderwidth: 1.5,
      font: { size: size(11), color: c.font },
      // カーソルや指の下に隠れないよう、点から離れた側へ出す
      ax: probe.fx > midFx ? -64 : 64,
      ay: probe.price > midPrice ? 46 : -46,
      // 円建てとUSD建ての符号が食い違うことがあるので、両方出す
      text: [
        `<b>売却条件</b> ${formatNumber(probe.fx, 2)} 円/USD × $${formatUsd(probe.price)}`,
        colored(
          `<b>${formatSignedYen(probe.profitYen)} 円</b>（${formatSignedPct(probe.rateYenPct)}）`,
          toneColor(probe.profitYen, c)
        ),
        colored(
          `USD建て ${probe.profitUsd >= 0 ? "+" : "-"}$${formatUsd(Math.abs(probe.profitUsd ?? 0))}（${formatSignedPct(probe.rateUsdPct ?? 0)}）`,
          toneColor(probe.profitUsd ?? 0, c)
        ),
      ].join("<br>"),
    });
  }

  for (const pin of graph.pins) {
    if (!pin.visible) continue;
    const { x, y } = clampToView(pin, view);
    const visible = inView(pin, view);

    annotations.push({
      ...box,
      x,
      y,
      showarrow: true,
      arrowhead: 4,
      arrowcolor: c.border,
      ax: pin.fx > midFx ? -50 : 50,
      ay: pin.price > midPrice ? 40 : -40,
      text: visible
        ? compact
          ? `<b>売却候補</b> ${formatNumber(pin.fx, 2)} × $${formatUsd(pin.price)}`
          : [
              `<b>売却候補</b> ${formatNumber(pin.fx, 2)} 円/USD × $${formatUsd(pin.price)}`,
              `損益（円）: ${colored(
                `${formatSignedYen(pin.profitYen)} 円（${formatSignedPct(pin.rateYenPct)}）`,
                toneColor(pin.profitYen, c)
              )}`,
              `損益（USD）: ${colored(
                `${pin.profitUsd >= 0 ? "+" : "-"}$${formatUsd(Math.abs(pin.profitUsd))}（${formatSignedPct(pin.rateUsdPct)}）`,
                toneColor(pin.profitUsd, c)
              )}`,
            ].join("<br>")
        : `ピンは${directionOf(pin, view)}にあります`,
    });
  }

  graph.purchases.forEach((purchase, index) => {
    if (inView(purchase, view)) return;
    const { x, y } = clampToView(purchase, view);
    annotations.push({
      ...box,
      x,
      y,
      showarrow: true,
      arrowhead: 4,
      arrowcolor: c.border,
      ax: x > midFx ? -36 : 36,
      ay: y > midPrice ? 30 : -30,
      text: `購入情報 ${index + 1} は${directionOf(purchase, view)}にあります`,
    });
  });

  if (graph.averagePoint && !inView(graph.averagePoint, view)) {
    const { x, y } = clampToView(graph.averagePoint, view);
    annotations.push({
      ...box,
      x,
      y,
      showarrow: true,
      arrowhead: 6,
      arrowcolor: c.ink,
      bordercolor: c.border,
      ax: 0,
      ay: y > midPrice ? 40 : -40,
      text: `平均購入点は${directionOf(graph.averagePoint, view)}にあります`,
    });
  }

  /*
    現在地と売却条件も、範囲の外に出たら行き先を示す。
    購入点・平均購入点・ピンには出していたのに、この2つだけ黙って消えていた。
    どちらもグラフの読み方の基準になる点なので、消えたこと自体が伝わる必要がある。
  */
  if (currentPoint && !inView(currentPoint, view)) {
    const { x, y } = clampToView(currentPoint, view);
    annotations.push({
      ...box,
      x,
      y,
      showarrow: true,
      arrowhead: 6,
      arrowcolor: c.ink,
      bordercolor: c.border,
      ax: 0,
      ay: y > midPrice ? 40 : -40,
      text: `現在地は${directionOf(currentPoint, view)}にあります`,
    });
  }

  if (probe && !inView(probe, view)) {
    const { x, y } = clampToView(probe, view);
    annotations.push({
      ...box,
      x,
      y,
      showarrow: true,
      arrowhead: 6,
      arrowcolor: c.accent,
      bordercolor: c.accent,
      ax: 0,
      ay: y > midPrice ? 40 : -40,
      text: `売却条件は${directionOf(probe, view)}にあります`,
    });
  }

  // 画像として切り出すときは、グラフだけ見て内容が分かるように前提を焼き込む
  if (forExport) {
    const { aggregate } = graph;
    annotations.push({
      xref: "paper",
      yref: "paper",
      x: 0.99,
      y: 1.13,
      xanchor: "right",
      yanchor: "top",
      showarrow: false,
      align: "right",
      bgcolor: c.surface,
      bordercolor: c.border,
      borderwidth: 1,
      borderpad: 6,
      font: { size: 11, color: c.font },
      text: [
        `合計 ${aggregate.totalQty.toLocaleString("ja-JP")} 株`,
        `平均取得価額 ${formatNumber(aggregate.avgAcqYen, 2)} 円/株`,
        `取得総額 ${formatYen(aggregate.totalCostYen)} 円`,
        "※手数料・税は購入情報に入力した分のみ反映",
      ].join("<br>"),
    });
  }

  /* ---- レイアウト ------------------------------------------------------ */
  const axis = {
    showgrid: true,
    gridcolor: c.grid,
    zeroline: false,
    fixedrange: true,
    tickfont: { size: size(11) },
  };

  const layout = {
    autosize: !forExport,
    paper_bgcolor: forExport
      ? themeName === "dark"
        ? "#212529"
        : "#ffffff"
      : "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: c.font, family: resolveFontFamily() },
    /*
      狭い画面では上の余白（凡例の場所）を詰め、左右も切り詰める。
      幅360pxでは、この分岐が無いとプロット領域が 101px（画面の28%）しか残らない。
    */
    margin: forExport
      ? { l: 78, r: 20, t: 90, b: 68 }
      : compact
        ? { l: 48, r: 8, t: 10, b: 46 }
        : { l: 52, r: 12, t: 34, b: 52 },
    xaxis: {
      ...axis,
      title: { text: "為替レート（円/USD）", font: { size: size(12) } },
      range: [view.fxMin, view.fxMax],
    },
    yaxis: {
      ...axis,
      title: { text: "売却株価（USD）", font: { size: size(12) } },
      range: [view.priceMin, view.priceMax],
    },
    hovermode: false,
    dragmode: false,
    /*
      凡例は横並びにしてあるが、幅が足りないと Plotly が折り返して
      6行・高さ124px になる（プロット領域の高さの半分近い）。
      狭い画面では出さない。記号の対応は、操作パネル側の見出しに付けた
      同じ印（● 売却条件 / ○ 現在の株価・為替）で辿れる。
    */
    showlegend: !compact,
    legend: {
      orientation: "h",
      yanchor: "bottom",
      y: 1.01,
      x: 0,
      // 6項目あるので、収まらないと Plotly が1項目ずつ折り返して行数だけ増える。
      // 文字と項目間の余白を詰めて、実用的な幅で2行に収まるようにする
      font: { size: size(10) },
      itemsizing: "constant",
      itemwidth: 30,
      tracegroupgap: 0,
      bgcolor: "rgba(0,0,0,0)",
    },
    annotations,
  };

  return { traces, layout };
}

/**
 * @param {Object} options
 * @param {HTMLElement} options.node グラフを描く要素
 * @param {(point:{fx:number, price:number}) => void} options.onPick
 *   クリック・タップ・ドラッグで座標が選ばれたときに呼ばれる
 */
/** これより狭い描画域では、凡例・カラーバー・数値ラベルを外す */
const COMPACT_WIDTH = 420;

export function createPlot({ node, onPick }) {
  let bound = false;
  /** 直近に描いた内容。幅が変わって compact が切り替わったとき描き直すのに使う */
  let lastRender = null;
  let lastCompact = null;
  /** 直近に描いた表示範囲。ピクセル→データ変換に使う */
  let currentView = null;
  /** 直近に描いたプローブ位置。タッチで掴めるかの判定に使う */
  let currentProbe = null;

  /** グラフ座標をポインタ座標へ（toDataPoint の逆） */
  function toPixelPoint(point) {
    const rect = node.querySelector(".nsewdrag")?.getBoundingClientRect();
    if (!rect?.width || !rect?.height || !currentView) return null;

    const { fxMin, fxMax, priceMin, priceMax } = currentView;
    return {
      x: rect.left + ((point.fx - fxMin) / (fxMax - fxMin)) * rect.width,
      y:
        rect.top +
        ((priceMax - point.price) / (priceMax - priceMin)) * rect.height,
    };
  }

  /**
   * ポインタ／タッチ座標をグラフの座標へ変換する。
   *
   * プロット領域の矩形は Plotly が置く .nsewdrag（ドラッグ受け）から取る。
   * 余白を自前で計算していた旧実装と違い、実際の描画結果を読むので
   * レイアウト変更やレスポンシブでずれない。
   * 軸の範囲は fixedrange で固定しており、こちら（state）が持つ値と一致する。
   */
  function toDataPoint(event) {
    const rect = node.querySelector(".nsewdrag")?.getBoundingClientRect();
    if (!rect?.width || !rect?.height || !currentView) return null;

    const ratioX = (event.clientX - rect.left) / rect.width;
    const ratioY = (event.clientY - rect.top) / rect.height;
    if (ratioX < 0 || ratioX > 1 || ratioY < 0 || ratioY > 1) return null;

    const { fxMin, fxMax, priceMin, priceMax } = currentView;
    return {
      fx: fxMin + ratioX * (fxMax - fxMin),
      price: priceMax - ratioY * (priceMax - priceMin), // y は上が最大
    };
  }

  const config = {
    displayModeBar: false,
    responsive: true,
    scrollZoom: false,
    doubleClick: false,
    locale: "ja",
  };

  const api = {
    /**
     * @param {ReturnType<typeof import("../model/calc.js").calculateGraphData>} graph
     * @param {{fxMin:number,fxMax:number,priceMin:number,priceMax:number}} view
     * @param {"light"|"dark"} themeName
     * @param {{currentPoint?: {fx:number, price:number}|null}} [options]
     */
    async render(graph, view, themeName, options = {}) {
      currentView = view;
      currentProbe = options.probe ?? null;
      /*
        画面幅ではなく、実際に描く要素の幅で判定する。
        サイドバーの有無や拡大率でも描画域は変わるので、
        「この要素が狭いかどうか」だけを見るほうが破綻しない。
      */
      lastRender = { graph, view, themeName, options };
      const compact = node.clientWidth < COMPACT_WIDTH;
      lastCompact = compact;
      /*
        軸に沿わせた部品の配置も compact かどうかで変える必要がある。
        判定はプロット要素の幅なので、CSS のメディアクエリ（＝画面幅）では表せない。
        印だけ付けて、置き方は CSS 側に任せる。
      */
      node.closest(".graph-layout")?.classList.toggle("is-compact", compact);
      const { traces, layout } = buildFigure(graph, view, themeName, {
        ...options,
        compact,
      });

      // newPlot ではなく react。イベント購読を保ったまま差分更新される
      await Plotly.react(node, traces, layout, config);

      if (bound) return;
      bound = true;

      /*
        マウスは押した瞬間から離すまで自前で追う。
        Plotly 任せだとドラッグ中の位置が通知されず、数字が固まってしまう。
      */
      let dragging = false;

      node.addEventListener("pointerdown", (event) => {
        if (event.pointerType !== "mouse" || event.button !== 0) return;

        const point = toDataPoint(event);
        if (!point) return;
        dragging = true;
        onPick(point);
      });

      // ドラッグ中の移動は Plotly が body に被せる要素に飛ぶので document で受ける
      document.addEventListener("pointermove", (event) => {
        if (!dragging) return;
        const point = toDataPoint(event);
        if (point) onPick(point);
      });

      for (const type of ["pointerup", "pointercancel"]) {
        document.addEventListener(type, () => {
          dragging = false;
        });
      }

      /*
        タッチも自前で処理する。Plotly の click 判定はホバー判定に依存しており、
        吹き出しを止める（hovermode: false）と plotly_click ごと発火しなくなるため。

        - プローブの近くから始まった場合はドラッグ（指に追従）
        - ほとんど動かずに離した場合はタップ（その位置へ置く）
        - 大きく動いた場合はスワイプとみなし、ページのスクロールに任せる
      */
      const TOUCH_GRAB_PX = 32;
      const TAP_MOVE_PX = 12;
      /** @type {{x:number, y:number, dragging:boolean}|null} */
      let touchStart = null;

      node.addEventListener(
        "touchstart",
        (event) => {
          if (event.touches.length !== 1) {
            touchStart = null;
            return;
          }
          const touch = event.touches[0];
          const origin = currentProbe ? toPixelPoint(currentProbe) : null;
          const nearProbe =
            origin != null &&
            Math.hypot(touch.clientX - origin.x, touch.clientY - origin.y) <=
              TOUCH_GRAB_PX;
          touchStart = {
            x: touch.clientX,
            y: touch.clientY,
            dragging: nearProbe,
          };
        },
        { passive: true }
      );

      node.addEventListener(
        "touchmove",
        (event) => {
          if (!touchStart?.dragging || event.touches.length !== 1) return;
          // ドラッグ中はページを動かさない
          event.preventDefault();
          const point = toDataPoint(event.touches[0]);
          if (point) onPick(point);
        },
        { passive: false }
      );

      node.addEventListener("touchend", (event) => {
        const start = touchStart;
        touchStart = null;
        // ドラッグ済み、またはスワイプ（＝スクロール意図）なら何もしない
        if (!start || start.dragging) return;

        const touch = event.changedTouches[0];
        const moved = Math.hypot(
          touch.clientX - start.x,
          touch.clientY - start.y
        );
        if (moved > TAP_MOVE_PX) return;

        const point = toDataPoint(touch);
        if (point) onPick(point);
      });

      node.addEventListener("touchcancel", () => {
        touchStart = null;
      });
    },

    /**
     * 実際に描かれたプロット領域（軸ラベルの内側）を、グラフ要素からの相対位置で返す。
     * 軸に沿わせたスライダーの長さと位置を合わせるために使う。
     * @returns {{left:number, top:number, width:number, height:number}|null}
     */
    getPlotArea() {
      const area = node.querySelector(".nsewdrag")?.getBoundingClientRect();
      if (!area?.width || !area?.height) return null;
      const host = node.getBoundingClientRect();
      return {
        left: area.left - host.left,
        top: area.top - host.top,
        width: area.width,
        height: area.height,
      };
    },

    /** 描画サイズの変化を通知する（レスポンシブ時の再計測用） */
    onResize(listener) {
      const observer = new ResizeObserver(() => listener());
      observer.observe(node);
      return () => observer.disconnect();
    },

    /** グラフを破棄する（ページ遷移のない構成なので通常は使わない） */
    destroy() {
      Plotly.purge(node);
      bound = false;
    },
  };

  /*
    compact の判定は描画のたびに行うが、状態が変わらないまま幅だけ変わった場合
    （端末の回転、ウィンドウのリサイズ、開発者ツールの端末エミュレーション）は
    描画が走らない。そのままだと、狭い画面に凡例とカラーバーを載せたまま
    プロット領域だけが潰れた状態が残る。

    判定が切り替わったときだけ描き直す。Plotly 自身の再描画でもこの監視は
    発火するが、判定が同じなら何もしないので描画のループにはならない。
  */
  new ResizeObserver(() => {
    if (!lastRender) return;
    if (node.clientWidth < COMPACT_WIDTH === lastCompact) return;
    const { graph, view, themeName, options } = lastRender;
    api.render(graph, view, themeName, options);
  }).observe(node);

  return api;
}
