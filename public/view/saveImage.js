// saveImage.js
// グラフ画像保存専用モジュール
// 必要なデータだけを受け取り、Plotlyで一時的にグラフを生成し画像化する
// DOMや既存のグラフには一切影響を与えない

/**
 * 指定座標での損益を計算する関数
 */
function calculateProfitAtPoint(fx, price, purchases, totalQty, costDollar) {
  const totalCost = purchases.reduce(
    (acc, p) => acc + p.price * p.fx * p.qty,
    0
  );
  const totalRevenue = price * fx * totalQty;
  return totalRevenue - totalCost;
}

/**
 * グラフ画像を保存する
 * @param {Object} graphData - グラフ描画用データ
 * @param {Object} options - 追加情報（hoverInfo, avgInfo, pins など）
 * @returns {Promise<void>}
 */
export async function saveGraphImage(graphData, options = {}) {
  try {
    // 1. 一時的なdivを作成
    const tempDiv = document.createElement("div");
    tempDiv.style.position = "fixed";
    tempDiv.style.left = "-9999px";
    tempDiv.style.top = "-9999px";
    tempDiv.style.width = "800px";
    tempDiv.style.height = "600px";
    tempDiv.style.zIndex = "-9999";
    tempDiv.style.pointerEvents = "none";
    tempDiv.style.userSelect = "none";
    document.body.appendChild(tempDiv);

    // 2. データを展開
    const {
      fxVals,
      priceVals,
      profitYen,
      breakEvenPoints,
      purchases,
      averagePoint,
      enrichedPins,
      totalQty,
      costDollar,
    } = graphData;

    // 3. グラフデータを構築
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
        labelfont: { size: 12, color: "black" },
      },
      line: { width: 0.3, smoothing: 0 },
      opacity: 0.9,
      hoverinfo: "skip",
      colorbar: {
        title: "損益（円）",
        titlefont: { size: 12 },
        tickfont: { size: 10 },
        tickformat: ",",
        len: 0.25,
        thickness: 6,
        x: 0.98,
        xanchor: "right",
      },
    };

    const purchaseDots = {
      type: "scatter",
      mode: "markers",
      x: purchases.map((p) => p.fx),
      y: purchases.map((p) => p.price),
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

    // 4. アノテーションを構築
    const annotations = [];
    const xMin = fxVals[0];
    const xMax = fxVals[fxVals.length - 1];
    const yMin = priceVals[0];
    const yMax = priceVals[priceVals.length - 1];

    // 平均購入情報のアノテーション
    if (averagePoint) {
      const avgPrice = averagePoint.price.toFixed(2);
      const avgFx = averagePoint.fx.toFixed(2);

      annotations.push({
        x: 0.99,
        y: 1.18,
        xref: "paper",
        yref: "paper",
        text:
          `購入時の平均為替（円/USD）: ¥ ${avgFx}<br>` +
          `購入時の平均株価: $ ${avgPrice}<br>` +
          `合計株数: ${totalQty} 株`,
        showarrow: false,
        bgcolor: "rgba(255,255,255,0.95)",
        bordercolor: "#6c757d",
        borderwidth: 1,
        font: { size: 10, color: "black" },
        align: "right",
        width: 0.35,
        height: 0.12,
      });
    }

    // ピンのアノテーション
    enrichedPins.forEach((p) => {
      if (!p.showAnnotation) return;

      const inRange =
        p.fx >= xMin && p.fx <= xMax && p.price >= yMin && p.price <= yMax;
      if (!inRange) return;

      const fxDelta = p.fx - averagePoint.fx;
      const priceDelta = p.price - averagePoint.price;
      const profitUsd = p.price * totalQty - costDollar;

      const fxDeltaStr = (fxDelta >= 0 ? "+" : "") + fxDelta.toFixed(2);
      const priceDeltaStr =
        (priceDelta >= 0 ? "+" : "") + priceDelta.toFixed(2);
      const profitYenStr =
        (p.profitYen >= 0 ? "+" : "") + p.profitYen.toLocaleString();
      const profitUsdStr = (profitUsd >= 0 ? "+" : "") + profitUsd.toFixed(2);

      // 為替と株価の差分の色設定
      const fxColor = fxDelta >= 0 ? "#28a745" : "#dc3545";
      const priceColor = priceDelta >= 0 ? "#28a745" : "#dc3545";
      const yenColor =
        p.profitYen > 0 ? "#28a745" : p.profitYen < 0 ? "#dc3545" : "#6c757d";
      const usdColor =
        profitUsd > 0 ? "#28a745" : profitUsd < 0 ? "#dc3545" : "#6c757d";

      const annotation = {
        x: p.fx,
        y: p.price,
        xref: "x",
        yref: "y",
        showarrow: true,
        arrowhead: 4,
        ax: 40,
        ay: -40,
        bgcolor: "rgba(255, 255, 255, 0.9)",
        bordercolor: p.color || "#006400",
        font: { size: 8, color: "black" },
        align: "left",
        text:
          `💰 <b>売却候補情報</b><br>` +
          `為替: ${p.fx.toFixed(
            2
          )} 円/USD <span style="color:${fxColor}">（${fxDeltaStr}）</span><br>` +
          `株価: ${p.price.toFixed(
            2
          )} USD <span style="color:${priceColor}">（${priceDeltaStr}）</span><br>` +
          `<span style="color:${yenColor}">損益（円）: ${profitYenStr} 円（${p.rateYen}）</span><br>` +
          `<span style="color:${usdColor}">損益（USD）: ${profitUsdStr} USD（${p.rateUsd}）</span>`,
      };

      annotations.push(annotation);
    });

    // ホバー情報のアノテーション
    if (
      options.hoverInfo &&
      options.hoverInfo.text &&
      options.hoverInfo.x &&
      options.hoverInfo.y
    ) {
      const hoverText = options.hoverInfo.text;
      const lines = hoverText.split("\n");

      // 為替と株価の差分を計算
      const avgFx =
        purchases.reduce((sum, p) => sum + p.fx * p.qty, 0) / totalQty;
      const avgPrice =
        purchases.reduce((sum, p) => sum + p.price * p.qty, 0) / totalQty;
      const fxDelta = options.hoverInfo.x - avgFx;
      const priceDelta = options.hoverInfo.y - avgPrice;

      // 損益行の色付け（為替と株価の差分も含む）
      const coloredLines = lines.map((line) => {
        if (line.startsWith("為替:")) {
          return line.replace(/\(([+-]?\d+\.?\d*)\)/, (m, delta) => {
            const color = delta.startsWith("-") ? "#dc3545" : "#28a745";
            return `<span style="color:${color}">(${delta})</span>`;
          });
        } else if (line.startsWith("株価:")) {
          return line.replace(/\(([+-]?\d+\.?\d*)\)/, (m, delta) => {
            const color = delta.startsWith("-") ? "#dc3545" : "#28a745";
            return `<span style="color:${color}">(${delta})</span>`;
          });
        } else if (line.startsWith("損益（円）:")) {
          return line.replace(
            /([+-]?\d[\d,]*) 円 \(([-+]?\d+\.?\d*)%\)/,
            (m, yen, rate) => {
              const color = yen.startsWith("-") ? "#dc3545" : "#28a745";
              return `<span style=\"color:${color}\">${yen} 円 (${rate}%)</span>`;
            }
          );
        } else if (line.startsWith("損益（USD）:")) {
          return line.replace(
            /([+-]?\d+\.?\d*) USD \(([-+]?\d+\.?\d*)%\)/,
            (m, usd, rate) => {
              const color = usd.startsWith("-") ? "#dc3545" : "#28a745";
              return `<span style=\"color:${color}\">${usd} USD (${rate}%)</span>`;
            }
          );
        }
        return line;
      });
      const plainText = `🎯 選択位置の売却情報<br><br>${coloredLines.join(
        "<br>"
      )}`;

      annotations.push({
        x: 0.95,
        y: 0.95,
        xref: "paper",
        yref: "paper",
        text: plainText,
        showarrow: false,
        bgcolor: "rgba(255,255,255,0.95)",
        bordercolor: "#dc3545",
        borderwidth: 2,
        font: { size: 10, color: "black" },
        align: "left",
        width: 0.3,
        height: 0.25,
      });

      annotations.push({
        x: options.hoverInfo.x,
        y: options.hoverInfo.y,
        xref: "x",
        yref: "y",
        text: "🎯",
        showarrow: false,
        font: { size: 20 },
      });
    }

    // 5. データ配列を構築
    const data = [breakEvenLine, contour, purchaseDots];
    if (averageDot) {
      data.push(averageDot);
    }

    // 6. レイアウトを構築
    const layout = {
      title: "為替 × 株価 における損益分岐グラフ",
      titlefont: { size: 18 },
      xaxis: {
        title: "為替レート（円/USD）",
        titlefont: { size: 14 },
        tickfont: { size: 12 },
        range: [xMin, xMax],
        fixedrange: true,
      },
      yaxis: {
        title: "売却株価（USD）",
        titlefont: { size: 14 },
        tickfont: { size: 12 },
        range: [yMin, yMax],
        fixedrange: true,
      },
      height: 600,
      width: 800,
      hovermode: false,
      annotations,
      legend: {
        x: 0,
        y: 1,
        xanchor: "left",
        yanchor: "top",
        font: { size: 10 },
        itemsizing: "constant",
        bgcolor: "rgba(255,255,255,0.6)",
        bordercolor: "rgba(204,204,204,0.5)",
        borderwidth: 0.5,
        traceorder: "normal",
        orientation: "h",
      },
      dragmode: "none",
      margin: { l: 80, r: 20, t: 80, b: 80 },
    };

    const config = {
      displayModeBar: false,
      scrollZoom: false,
      doubleClick: false,
      responsive: false,
      staticPlot: true,
    };

    // 7. Plotlyでグラフを描画
    await Plotly.newPlot(tempDiv, data, layout, config);

    // 8. 画像化
    const imgDataUrl = await Plotly.toImage(tempDiv, {
      format: "png",
      height: 600,
      width: 800,
      scale: 2,
    });

    // 9. ダウンロード
    const a = document.createElement("a");
    a.href = imgDataUrl;
    a.download = "graph_with_info.png";
    a.click();

    // 10. 一時divを削除
    tempDiv.remove();
  } catch (error) {
    console.error("画像保存エラー:", error);
    throw error;
  }
}
