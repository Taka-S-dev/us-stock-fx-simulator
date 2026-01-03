// plot.js 責務はグラフ描画のみ。
import { computeYenValuationTruncTowardZero } from "../controller/modelFacade.js";

// 指定座標での損益を計算する関数
function calculateProfitAtPoint(fx, price, purchases, totalQty, costDollar) {
  const totalCost = purchases.reduce(
    (acc, p) => acc + p.price * p.fx * p.qty,
    0
  );
  const totalRevenue = price * fx * totalQty;
  return totalRevenue - totalCost;
}

export function renderGraph(graphData, purchases) {
  const {
    fxVals,
    priceVals,
    profitYen,
    profitRateYen,
    profitRateUsd,
    averagePoint,
    breakEvenPoints,
    enrichedPins,
    totalQty,
    costDollar,
    totalCostYen,
  } = graphData;

  // 不正な購入情報のチェック
  let invalidDataWarning = null;
  try {
    // 直接DOMをチェックして不正なデータを検出
    const container = document.getElementById("purchase-container");
    const modalContainer = document.getElementById("purchase-container-modal");

    const mainEntries = container?.querySelectorAll(".purchase-entry") || [];
    const modalEntries =
      modalContainer?.querySelectorAll(".purchase-entry") || [];
    const entries = modalEntries.length > 0 ? modalEntries : mainEntries;

    let hasInvalidData = false;

    entries.forEach((entry, index) => {
      const priceInput = entry.querySelector(".price");
      const fxInput = entry.querySelector(".fx");
      const qtyInput = entry.querySelector(".qty");

      if (priceInput && fxInput && qtyInput) {
        const priceValue = priceInput.value.trim();
        const fxValue = fxInput.value.trim();
        const qtyValue = qtyInput.value.trim();

        // より詳細な検証ロジック
        let priceInvalid = false;
        let fxInvalid = false;
        let qtyInvalid = false;

        // 空文字チェック
        if (priceValue === "") {
          priceInvalid = true;
        } else {
          const price = parseFloat(priceValue);
          if (isNaN(price) || price <= 0 || price > 1000000) {
            priceInvalid = true;
          }
        }

        if (fxValue === "") {
          fxInvalid = true;
        } else {
          const fx = parseFloat(fxValue);
          if (isNaN(fx) || fx <= 0 || fx < 1 || fx > 1000) {
            fxInvalid = true;
          }
        }

        if (qtyValue === "") {
          qtyInvalid = true;
        } else {
          const qty = parseFloat(qtyValue);
          if (
            isNaN(qty) ||
            qty <= 0 ||
            !Number.isInteger(qty) ||
            qty > 1000000
          ) {
            qtyInvalid = true;
          }
        }

        // クラス名によるチェックも追加
        if (priceInput.classList.contains("invalid")) priceInvalid = true;
        if (fxInput.classList.contains("invalid")) fxInvalid = true;
        if (qtyInput.classList.contains("invalid")) qtyInvalid = true;

        // 空文字または無効な値のチェック
        if (priceInvalid || fxInvalid || qtyInvalid) {
          hasInvalidData = true;
        }
      }
    });

    if (hasInvalidData) {
      // テキストマーカーは作成せず、アノテーションのみ使用
      invalidDataWarning = true;
    }
  } catch (error) {
    console.error("不正な購入情報チェックエラー:", error);
  }

  // 現在のグラフデータを外部から取得できるように保存
  window.currentGraphData = {
    ...graphData,
    purchases,
    totalQty,
    costDollar,
  };

  const flat = profitYen.flat();
  const minZ = Math.min(...flat);
  const maxZ = Math.max(...flat);
  const margin = Math.max(Math.abs(minZ), Math.abs(maxZ), 1000);

  const contour = {
    type: "contour",
    x: fxVals,
    y: priceVals,
    z: profitYen,
    zmin: -margin,
    zmax: margin,
    colorscale: ["RdBu"],
    contours: {
      coloring: "heatmap",
      showlines: true,
      showlabels: true,
      labelfont: {
        size: 6,
        color: "black",
      },
    },
    line: {
      width: 0.3,
      smoothing: 0,
    },
    opacity: 0.9,
    hoverinfo: "skip",
    colorbar: {
      title: "損益（円）",
      titlefont: { size: 6 },
      tickfont: { size: 5 },
      tickformat: ",",
      len: 0.25,
      thickness: 6,
      x: 0.98,
      xanchor: "right",
    },
  };

  // 表示範囲（スライダー由来）
  const xMin = fxVals[0];
  const xMax = fxVals[fxVals.length - 1];
  const yMin = priceVals[0];
  const yMax = priceVals[priceVals.length - 1];

  // 範囲内の購入点のみプロット（範囲外は注釈で表現）
  const inRangePurchases = purchases.filter(
    (p) => p.fx >= xMin && p.fx <= xMax && p.price >= yMin && p.price <= yMax
  );

  const purchaseDots = {
    type: "scatter",
    mode: "markers",
    x: inRangePurchases.map((p) => p.fx),
    y: inRangePurchases.map((p) => p.price),
    marker: { color: "black", size: 7, symbol: "circle" },
    name: "購入点",
    hoverinfo: "skip",
  };

  const averageDot = averagePoint
    ? {
        type: "scatter",
        mode: "markers+text",
        x: [averagePoint.fx],
        y: [averagePoint.price],
        marker: { color: "red", size: 12, symbol: "star" },
        text: ["平均購入点"],
        textposition: "bottom center",
        textfont: { size: 9, color: "gray" },
        name: "平均購入点",
        hoverinfo: "skip",
      }
    : null;

  const breakEvenLine = {
    type: "scatter",
    mode: "lines",
    x: breakEvenPoints.map((p) => p.x),
    y: breakEvenPoints.map((p) => p.y),
    line: {
      color: "rgba(128, 0, 0, 0.6)",
      width: 2.0,
      dash: "dot",
    },
    name: "損益分岐ライン",
    hoverinfo: "skip",
  };
  const annotations = [];

  if (breakEvenPoints.length >= 2) {
    const midIdx = Math.floor(breakEvenPoints.length / 2);
    const midPoint = breakEvenPoints[midIdx];

    annotations.push(
      {
        x: midPoint.x,
        y: midPoint.y + (yMax - yMin) * 0.1,
        xref: "x",
        yref: "y",
        showarrow: false,
        text: "▲ 📈 損益＋",
        font: {
          size: 12,
          color: "rgba(0,128,0,0.4)",
        },
        bgcolor: "rgba(255,255,255,0.4)",
        align: "center",
      },
      {
        x: midPoint.x,
        y: midPoint.y - (yMax - yMin) * 0.1,
        xref: "x",
        yref: "y",
        showarrow: false,
        text: "▼ 📉 損益−",
        font: {
          size: 12,
          color: "rgba(255,0,0,0.4)",
        },
        bgcolor: "rgba(255,255,255,0.4)",
        align: "center",
      }
    );
  }

  const inRangePins = enrichedPins.filter(
    (p) => p.fx >= xMin && p.fx <= xMax && p.price >= yMin && p.price <= yMax
  );

  const pinMarkers = {
    type: "scatter",
    mode: "markers+text",
    x: inRangePins.map((p) => p.fx),
    y: inRangePins.map((p) => p.price),
    marker: {
      color: "green",
      size: 7,
      symbol: "x",
      opacity: 0.4,
    },
    text: inRangePins.map(() => `📍`),
    textposition: "top center",
    name: "注目ポイント",
    hoverinfo: "skip",
    showlegend: false,
  };

  const data = [breakEvenLine, contour, purchaseDots];
  if (
    averageDot &&
    averagePoint.fx >= xMin &&
    averagePoint.fx <= xMax &&
    averagePoint.price >= yMin &&
    averagePoint.price <= yMax
  ) {
    data.push(averageDot);
  }

  if (inRangePins.length > 0) data.push(pinMarkers);

  // 不正なデータの警告を追加
  if (invalidDataWarning) {
    // テキストマーカーは削除し、アノテーションのみ使用

    // 警告アノテーションを追加
    const warningAnnotation = {
      x: (fxVals[0] + fxVals[fxVals.length - 1]) / 2,
      y: (priceVals[0] + priceVals[priceVals.length - 1]) / 2,
      xref: "x",
      yref: "y",
      showarrow: false,
      text: "⚠️ 「購入情報」の入力内容に問題があります。<br>もう一度ご確認ください。",
      font: {
        size: 14,
        color: "#dc3545",
      },
      bgcolor: "rgba(255, 255, 255, 0.95)",
      bordercolor: "#dc3545",
      borderwidth: 3,
      align: "center",
    };
    annotations.push(warningAnnotation);
  }

  // ピンの注釈（範囲外含む）
  enrichedPins.forEach((p) => {
    if (!p.showAnnotation) return;

    const inRange =
      p.fx >= xMin && p.fx <= xMax && p.price >= yMin && p.price <= yMax;
    const isRight = p.fx > (xMin + xMax) / 2;
    const isUpper = p.price > (yMin + yMax) / 2;

    // 差分と損益（USD）計算
    const fxDelta = p.fx - averagePoint.fx;
    const priceDelta = p.price - averagePoint.price;
    const profitUsd = p.price * totalQty - costDollar;

    const fxDeltaStr = (fxDelta >= 0 ? "+" : "") + fxDelta.toFixed(2);
    const priceDeltaStr = (priceDelta >= 0 ? "+" : "") + priceDelta.toFixed(2);
    const profitYenStr =
      (p.profitYen >= 0 ? "+" : "") + p.profitYen.toLocaleString();
    const profitUsdStr = (profitUsd >= 0 ? "+" : "") + profitUsd.toFixed(2);

    // 色判定（数値ベースに変更）
    const usdColor = profitUsd > 0 ? "green" : profitUsd < 0 ? "red" : "black";
    const yenColor =
      p.profitYen > 0 ? "green" : p.profitYen < 0 ? "red" : "black";

    const annotation = {
      x: Math.min(Math.max(p.fx, xMin), xMax),
      y: Math.min(Math.max(p.price, yMin), yMax),
      xref: "x",
      yref: "y",
      showarrow: true,
      arrowhead: 4,
      ax: isRight ? -40 : 40,
      ay: isUpper ? 40 : -40,
      bgcolor: inRange
        ? "rgba(255, 255, 255, 0.7)"
        : "rgba(255, 255, 255, 0.7)",
      bordercolor: inRange ? p.color || "#006400" : "black",
      font: { size: 8, color: "black" },
      align: "left",
      text: inRange
        ? `💰 <b>売却候補情報</b><br>` +
          `為替: ${p.fx.toFixed(2)} 円/USD（${fxDeltaStr}）<br>` +
          `株価: ${p.price.toFixed(2)} USD（${priceDeltaStr}）<br>` +
          `<b>損益（円）: <span style="color:${yenColor}">${profitYenStr} 円（${p.rateYen}）</span></b><br>` +
          `<b>損益（USD）: <span style="color:${usdColor}">${profitUsdStr} USD（${p.rateUsd}）</span></b>`
        : `📍 ピンは${p.fx < xMin ? "左" : p.fx > xMax ? "右" : ""}${
            p.price < yMin ? "下" : p.price > yMax ? "上" : ""
          }にあります`,
    };

    annotations.push(annotation);
  });

  // 範囲外の購入点を注釈で表示（境界にクランプして方向を付与）
  purchases.forEach((p, idx) => {
    const inRange =
      p.fx >= xMin && p.fx <= xMax && p.price >= yMin && p.price <= yMax;
    if (inRange) return;

    const clampedX = Math.min(Math.max(p.fx, xMin), xMax);
    const clampedY = Math.min(Math.max(p.price, yMin), yMax);
    const isRight = clampedX > (xMin + xMax) / 2;
    const isUpper = clampedY > (yMin + yMax) / 2;

    const dirX = p.fx < xMin ? "左" : p.fx > xMax ? "右" : "";
    const dirY = p.price < yMin ? "下" : p.price > yMax ? "上" : "";
    const dir = `${dirX}${dirY}` || "外";

    annotations.push({
      x: clampedX,
      y: clampedY,
      xref: "x",
      yref: "y",
      showarrow: true,
      arrowhead: 4,
      ax: isRight ? -30 : 30,
      ay: isUpper ? 30 : -30,
      bgcolor: "rgba(255, 255, 255, 0.7)",
      bordercolor: "black",
      font: { size: 8, color: "black" },
      align: "left",
      text: `● 購入情報${idx + 1} は${dir}にあります`,
    });
  });

  // 平均点の注釈（範囲外のみ）
  if (
    averagePoint &&
    (averagePoint.fx < xMin ||
      averagePoint.fx > xMax ||
      averagePoint.price < yMin ||
      averagePoint.price > yMax)
  ) {
    const dir = `${
      averagePoint.fx < xMin ? "左" : averagePoint.fx > xMax ? "右" : ""
    }${
      averagePoint.price < yMin ? "下" : averagePoint.price > yMax ? "上" : ""
    }`;
    annotations.push({
      x: Math.min(Math.max(averagePoint.fx, xMin), xMax),
      y: Math.min(Math.max(averagePoint.price, yMin), yMax),
      xref: "x",
      yref: "y",
      showarrow: true,
      arrowhead: 6,
      ax: 0,
      ay: -60,
      font: { size: 10, color: "red" },
      bgcolor: "#fff0f0",
      bordercolor: "red",
      text: `⭐ 平均点は${dir}にあります`,
    });
  }

  // レスポンシブ対応のレイアウト設定
  const layout = {
    title: "為替 × 株価 における損益分岐グラフ",
    titlefont: { size: 14 },
    xaxis: {
      title: "為替レート（円/USD）",
      titlefont: { size: 12 },
      tickfont: { size: 10 },
      autorange: false,
      range: [xMin, xMax],
      fixedrange: true,
    },
    yaxis: {
      title: "売却株価（USD）",
      titlefont: { size: 12 },
      tickfont: { size: 10 },
      autorange: false,
      range: [yMin, yMax],
      fixedrange: true,
    },
    height: window.innerWidth < 768 ? 450 : 700,
    hovermode: false,
    hoverlabel: {
      bgcolor: "transparent",
      bordercolor: "transparent",
      font: { color: "transparent", size: 0 },
      align: "left",
    },
    // スマホでのホバー表示最適化
    hoverdistance: window.innerWidth < 768 ? 50 : 20,
    annotations,
    legend: {
      x: 0,
      y: 1,
      xanchor: "left",
      yanchor: "top",
      font: { size: 12 },
      itemsizing: "constant",
      bgcolor: "rgba(255,255,255,0.6)",
      bordercolor: "rgba(204,204,204,0.5)",
      borderwidth: 0.5,
      traceorder: "normal",
      orientation: "h",
    },
    dragmode: "none",
    margin: {
      l: 50,
      r: 15,
      t: 50,
      b: 50,
    },
  };

  const config = {
    displayModeBar: true,
    scrollZoom: false,
    doubleClick: false,
    modeBarButtonsToRemove: [
      "zoom2d",
      "zoomIn2d",
      "zoomOut2d",
      "autoScale2d",
      "select2d",
      "lasso2d",
      "resetScale2d",
      "pan2d",
    ],
    responsive: true,
    // スマホでのタッチ操作最適化
    displayModeBar: window.innerWidth >= 768,
  };

  // パフォーマンス最適化のための変数
  let lastHoverTime = 0;
  let hoverThrottle = 50;
  let currentHoverAnnotation = null;
  let isMobile = window.innerWidth < 768;
  let touchTimeout = null;
  let mouseMoveTimeout = null;
  let hoverAnnotationIndex = -1;

  Plotly.newPlot("plot", data, layout, config).then(() => {
    // ホバーイベントでアノテーションマーカーを更新
    const plotDiv = document.getElementById("plot");

    // 超高速なホバー情報表示関数（SVG直接操作）
    function showHoverInfo(graphX, graphY, purchases, totalQty, costDollar) {
      const mobileHoverInfo = document.getElementById("mobile-hover-info");
      const hoverDetails = document.getElementById("hover-details");

      // SVG要素を直接操作して高速化
      let hoverElement = document.getElementById("hover-marker");
      if (!hoverElement) {
        // ホバー要素が存在しない場合は作成
        const svg = plotDiv.querySelector("svg");
        if (svg) {
          // 外側の円（ターゲット風）
          const outerCircle = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "circle"
          );
          outerCircle.setAttribute("id", "hover-marker-outer");
          outerCircle.setAttribute("r", "12");
          outerCircle.setAttribute("fill", "rgba(255, 255, 255, 0.95)");
          outerCircle.setAttribute("stroke", "#dc3545");
          outerCircle.setAttribute("stroke-width", "2");
          svg.appendChild(outerCircle);

          // 中間の円（リング状）
          const middleCircle = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "circle"
          );
          middleCircle.setAttribute("id", "hover-marker-middle");
          middleCircle.setAttribute("r", "8");
          middleCircle.setAttribute("fill", "none");
          middleCircle.setAttribute("stroke", "#dc3545");
          middleCircle.setAttribute("stroke-width", "2");
          svg.appendChild(middleCircle);

          // 内側の円（中心）
          const innerCircle = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "circle"
          );
          innerCircle.setAttribute("id", "hover-marker-inner");
          innerCircle.setAttribute("r", "4");
          innerCircle.setAttribute("fill", "#dc3545");
          svg.appendChild(innerCircle);

          // 中央の点
          const centerDot = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "circle"
          );
          centerDot.setAttribute("id", "hover-marker");
          centerDot.setAttribute("r", "1.5");
          centerDot.setAttribute("fill", "white");
          svg.appendChild(centerDot);
        }
      }

      if (hoverElement) {
        // 座標変換（Plotlyの座標系からSVG座標系へ）
        const layout = plotDiv.layout;
        const xRange = layout.xaxis.range;
        const yRange = layout.yaxis.range;
        const margin = layout.margin;

        const svgWidth = plotDiv.clientWidth - margin.l - margin.r;
        const svgHeight = plotDiv.clientHeight - margin.t - margin.b;

        const xRatio = (graphX - xRange[0]) / (xRange[1] - xRange[0]);
        const yRatio = (graphY - yRange[0]) / (yRange[1] - yRange[0]);

        const svgX = margin.l + xRatio * svgWidth;
        const svgY = margin.t + (1 - yRatio) * svgHeight;

        // 複数の要素を同時に更新
        const outerCircle = document.getElementById("hover-marker-outer");
        const middleCircle = document.getElementById("hover-marker-middle");
        const innerCircle = document.getElementById("hover-marker-inner");

        if (outerCircle) {
          outerCircle.setAttribute("cx", svgX.toString());
          outerCircle.setAttribute("cy", svgY.toString());
          outerCircle.style.display = "block";
        }

        if (middleCircle) {
          middleCircle.setAttribute("cx", svgX.toString());
          middleCircle.setAttribute("cy", svgY.toString());
          middleCircle.style.display = "block";
        }

        if (innerCircle) {
          innerCircle.setAttribute("cx", svgX.toString());
          innerCircle.setAttribute("cy", svgY.toString());
          innerCircle.style.display = "block";
        }

        hoverElement.setAttribute("cx", svgX.toString());
        hoverElement.setAttribute("cy", svgY.toString());
        hoverElement.style.display = "block";
      }

      // 損益計算（某証券寄せの円評価ロジックで表示値を算出）
      const currentValueYen = Math.trunc(graphX * graphY * totalQty);
      const avgAcqYen = totalQty > 0 ? (totalCostYen || 0) / totalQty : 0;
      const { profitLossYen: profitYen, profitLossRatePct: rateYen } =
        computeYenValuationTruncTowardZero(
          avgAcqYen,
          totalQty,
          currentValueYen
        );
      const profitUsd = graphY * totalQty - costDollar;

      // 安全な割り算関数
      const safeDiv = (a, b) => (b && !isNaN(b) ? a / b : 0);

      const avgFx = safeDiv(
        purchases.reduce((sum, p) => sum + p.fx * p.qty, 0),
        totalQty
      );
      const avgPrice = safeDiv(
        purchases.reduce((sum, p) => sum + p.price * p.qty, 0),
        totalQty
      );

      const fxDelta = graphX - avgFx;
      const priceDelta = graphY - avgPrice;

      // 損益率計算（NaNを防ぐ）
      const baseYen = avgPrice * avgFx * totalQty;
      const baseUsd = avgPrice * totalQty;
      // rateYen は computeYenValuationTruncTowardZero の結果（小数2桁切り捨て）を使用
      const rateUsd = baseUsd ? ((profitUsd / baseUsd) * 100).toFixed(2) : "-";

      // 4行テキストを生成
      const hoverText =
        `為替: ${graphX.toFixed(2)} 円/USD (${
          fxDelta >= 0 ? "+" : ""
        }${fxDelta.toFixed(2)})\n` +
        `株価: ${graphY.toFixed(2)} USD (${
          priceDelta >= 0 ? "+" : ""
        }${priceDelta.toFixed(2)})\n` +
        `損益（円）: ${profitYen >= 0 ? "+" : ""}${Math.round(
          profitYen
        ).toLocaleString()} 円 (${rateYen}%)\n` +
        `損益（USD）: ${profitUsd >= 0 ? "+" : ""}${profitUsd.toFixed(
          2
        )} USD (${rateUsd}%)`;

      // 現在のホバー情報を保存
      window.currentHoverInfo = {
        x: graphX,
        y: graphY,
        text: hoverText,
        purchases: purchases,
        totalQty: totalQty,
        costDollar: costDollar,
      };

      // DOM操作を最小限に
      if (hoverDetails) {
        hoverDetails.innerHTML = `
          <div class="mb-1">
            <strong>為替:</strong> ${graphX.toFixed(
              2
            )} 円/USD <span style="color: ${
          fxDelta >= 0 ? "#28a745" : "#dc3545"
        }">(${fxDelta >= 0 ? "+" : ""}${fxDelta.toFixed(2)})</span><br>
            <strong>株価:</strong> ${graphY.toFixed(
              2
            )} USD <span style="color: ${
          priceDelta >= 0 ? "#28a745" : "#dc3545"
        }">(${priceDelta >= 0 ? "+" : ""}${priceDelta.toFixed(2)})</span>
          </div>
          <div class="mb-1">
            <strong>損益（円）:</strong><br>
            <span style="color: ${profitYen >= 0 ? "#28a745" : "#dc3545"}">
              ${profitYen >= 0 ? "+" : ""}${Math.round(
          profitYen
        ).toLocaleString()} 円 (${rateYen}%)
            </span>
          </div>
          <div>
            <strong>損益（USD）:</strong><br>
            <span style="color: ${profitUsd >= 0 ? "#28a745" : "#dc3545"}">
              ${profitUsd >= 0 ? "+" : ""}${profitUsd.toFixed(
          2
        )} USD (${rateUsd}%)
            </span>
          </div>
        `;
      }

      if (mobileHoverInfo) {
        mobileHoverInfo.style.display = "block";
      }
    }

    // ホバー情報をクリアする関数（SVG直接操作）
    function clearHoverInfo() {
      // SVG要素を直接操作して高速化
      const hoverElement = document.getElementById("hover-marker");
      const outerCircle = document.getElementById("hover-marker-outer");
      const middleCircle = document.getElementById("hover-marker-middle");
      const innerCircle = document.getElementById("hover-marker-inner");

      if (hoverElement) {
        hoverElement.style.display = "none";
      }
      if (outerCircle) {
        outerCircle.style.display = "none";
      }
      if (middleCircle) {
        middleCircle.style.display = "none";
      }
      if (innerCircle) {
        innerCircle.style.display = "none";
      }

      const mobileHoverInfo = document.getElementById("mobile-hover-info");
      if (mobileHoverInfo) {
        mobileHoverInfo.style.display = "none";
      }
    }

    // スマホ用のタッチイベント処理
    if (isMobile) {
      const mobileHoverInfo = document.getElementById("mobile-hover-info");
      const hoverDetails = document.getElementById("hover-details");

      // タッチ開始イベント（デバウンス処理）
      plotDiv.addEventListener(
        "touchstart",
        (e) => {
          // グラフ内のタッチのみ処理
          const touch = e.touches[0];
          const rect = plotDiv.getBoundingClientRect();
          const x = touch.clientX - rect.left;
          const y = touch.clientY - rect.top;

          // タッチ位置をグラフ座標に変換
          const layout = plotDiv.layout;

          // 簡易的な座標変換
          const xRange = layout.xaxis.range;
          const yRange = layout.yaxis.range;
          const xRatio =
            (x - layout.margin.l) /
            (rect.width - layout.margin.l - layout.margin.r);
          const yRatio =
            (y - layout.margin.t) /
            (rect.height - layout.margin.t - layout.margin.b);

          const graphX = xRange[0] + (xRange[1] - xRange[0]) * xRatio;
          const graphY = yRange[1] - (yRange[1] - yRange[0]) * yRatio;

          // グラフ範囲内かチェック
          if (
            graphX >= xRange[0] &&
            graphX <= xRange[1] &&
            graphY >= yRange[0] &&
            graphY <= yRange[1]
          ) {
            // グラフ内のタッチのみ処理（イベントは停止しない）

            // 現在のホバー情報を保存
            window.currentHoverInfo = {
              graphX: graphX,
              graphY: graphY,
              purchases: purchases,
              totalQty: totalQty,
              costDollar: costDollar,
            };

            // 最適化されたホバー情報表示
            showHoverInfo(graphX, graphY, purchases, totalQty, costDollar);

            // 既存のタイマーをクリア（自動削除を無効化）
            if (touchTimeout) clearTimeout(touchTimeout);
          } else {
            // 範囲外の場合はホバー情報をクリア
            clearHoverInfo();
          }
        },
        { passive: true }
      );

      // タッチエンドイベント（タッチが終わっても情報を保持）
      plotDiv.addEventListener(
        "touchend",
        (e) => {
          // タッチが終わっても情報を保持する（自動消去はタイマーに任せる）
        },
        { passive: true }
      );

      // タッチキャンセルイベント（タッチがキャンセルされても情報を保持）
      plotDiv.addEventListener(
        "touchcancel",
        (e) => {
          // タッチがキャンセルされても情報を保持する
        },
        { passive: true }
      );
    } else {
      // PC用のマウスホバー処理（超高速版）
      plotDiv.addEventListener("mousemove", (e) => {
        const rect = plotDiv.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // マウス位置をグラフ座標に変換
        const layout = plotDiv.layout;
        const xRange = layout.xaxis.range;
        const yRange = layout.yaxis.range;
        const xRatio =
          (x - layout.margin.l) /
          (rect.width - layout.margin.l - layout.margin.r);
        const yRatio =
          (y - layout.margin.t) /
          (rect.height - layout.margin.t - layout.margin.b);

        const graphX = xRange[0] + (xRange[1] - xRange[0]) * xRatio;
        const graphY = yRange[1] - (yRange[1] - yRange[0]) * yRatio;

        // グラフ範囲内かチェック
        if (
          graphX >= xRange[0] &&
          graphX <= xRange[1] &&
          graphY >= yRange[0] &&
          graphY <= yRange[1]
        ) {
          // ホバー情報表示
          showHoverInfo(graphX, graphY, purchases, totalQty, costDollar);
        } else {
          // 範囲外の場合はホバー情報をクリア
          clearHoverInfo();
        }
      });

      // マウスがグラフから離れた時の処理
      plotDiv.addEventListener("mouseleave", () => {
        clearHoverInfo();
      });
    }

    // 閉じるボタンのイベント
    const closeButton = document.getElementById("close-hover-info");
    if (closeButton) {
      closeButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        clearHoverInfo();
      });
    }
  });

  const avgPrice =
    purchases.reduce((sum, p) => sum + p.price * p.qty, 0) / totalQty;
  const avgFx = purchases.reduce((sum, p) => sum + p.fx * p.qty, 0) / totalQty;

  const avgInfo = document.getElementById("average-info");
  avgInfo.innerHTML = `
    <div style="text-align: left;">

      <div>購入時の平均為替（円/USD）: <span class="text-success">¥ ${avgFx.toFixed(
        2
      )}</span></div>
      <div>購入時の平均株価: <span class="text-primary">$ ${avgPrice.toFixed(
        2
      )}</span></div>
      <div>合計株数: <span class="text-dark">${totalQty}</span> 株</div>
      <div class="text-muted small mt-2">注）表示される損益・損益率には手数料・税は含まれていません</div>
    </div>
  `;
}
