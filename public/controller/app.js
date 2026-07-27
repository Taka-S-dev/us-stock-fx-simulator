// controller/app.js
// 配線だけを担当する層。
//   状態が変わる → subscribe した render が呼ばれる → 各 View が state を描く
// という一方向の流れに閉じているので、View 同士が互いを起こすことはない。

import {
  createPreferences,
  createStateRepository,
} from "../model/persistence.js";
import { createInitialState, createStore } from "../model/store.js";
import { createPurchase } from "../model/purchase.js";
import {
  selectCurrentValuation,
  selectGraphData,
  selectInputErrors,
  selectProbeValuation,
  selectScenarios,
  selectSummary,
} from "../model/selectors.js";
import {
  formatNumber,
  formatSignedPct,
  formatTimestamp,
  formatUsd,
} from "../utils/format.js";

import {
  clear,
  el,
  enableStepButtons,
  enableStepKeys,
  need,
  preventWheelStepping,
  rafThrottle,
} from "../view/dom.js";
import { createPurchaseList } from "../view/purchaseList.js";
import { createRangeControls } from "../view/rangeControls.js";
import { createPinList } from "../view/pinList.js";
import { createSavedStates } from "../view/savedStates.js";
import { createSummary } from "../view/summary.js";
import { createProbePanel } from "../view/probe.js";
import { createCurrentPosition } from "../view/currentPosition.js";
import {
  createScenarioTable,
  createSensitivityPanel,
} from "../view/analysis.js";
import { createPlot } from "../view/plot.js";
import { createTheme } from "../view/theme.js";
import { saveGraphImage } from "../view/saveImage.js";
import { confirmDialog, showToast } from "../view/toast.js";

import { createActions } from "./actions.js";

const FX_STATUS_LABEL = {
  idle: "",
  loading: "取得中…",
  live: "最新",
  cache: "保存済みの値",
  fallback: "参考値",
};

export function startApp() {
  const preferences = createPreferences();
  const repository = createStateRepository();
  const theme = createTheme(preferences);
  theme.init();

  const store = createStore(
    createInitialState({
      purchases: [createPurchase()],
      savedNames: repository.list(),
    })
  );

  const actions = createActions({
    store,
    repository,
    preferences,
    notify: showToast,
  });

  /* ---- View の生成 ------------------------------------------------------ */

  const purchaseList = createPurchaseList({
    container: need("#purchase-container"),
    onChange: actions.updatePurchaseField,
    onRemove: actions.removePurchase,
    // 入力途中ではなく確定時にだけ表示範囲を見直す（打鍵ごとに動くと鬱陶しい）
    onCommit: () => {
      if (actions.autoFitIfOffscreen()) {
        showToast("平均購入点が入るよう表示範囲を調整しました", "info");
      }
    },
  });

  const rangeControls = createRangeControls({ onChange: actions.updateView });

  const pinList = createPinList({
    container: need("#pin-list"),
    onToggle: actions.togglePin,
    onRemove: actions.removePin,
  });

  const savedStates = createSavedStates();
  const summary = createSummary({ container: need("#summary") });

  const probePanel = createProbePanel({
    container: need("#probe-readout"),
    fxInput: need("#probe-fx-input"),
    priceInput: need("#probe-price-input"),
    resetButton: need("#btn-reset-probe"),
  });

  const currentPosition = createCurrentPosition({
    container: need("#current-position"),
    breakEvenContainer: need("#current-breakeven"),
    fxInput: need("#current-fx-input"),
    priceInput: need("#current-price-input"),
    autoNote: need("#current-auto-note"),
  });
  const sensitivityPanel = createSensitivityPanel({
    container: need("#sensitivity-panel"),
  });
  const scenarioTable = createScenarioTable({
    container: need("#scenario-table"),
  });

  const plot = createPlot({
    node: need("#plot"),
    onPick: actions.placeProbe,
  });

  /* ---- 描画 ------------------------------------------------------------- */

  const plotNode = need("#plot");
  const emptyNode = need("#plot-empty");
  const fxStatusNode = need("#fx-status");
  const refreshFxButton = /** @type {HTMLButtonElement} */ (
    need("#btn-refresh-fx")
  );
  const graphActions = need("#graph-actions");
  const graphLayout = need(".graph-layout");
  const probeSection = need("#probe-panel");
  const analysisCards = [need("#sensitivity-card"), need("#scenario-card")];

  /** 最後に描いたグラフデータ。画像保存と共有で使う */
  let lastGraph = null;

  const render = rafThrottle((state) => {
    purchaseList.render(state.purchases);
    savedStates.render(state.savedNames);
    renderFxStatus(state.fxRate);

    const graph = selectGraphData(state);
    lastGraph = graph;

    const current = graph ? selectCurrentValuation(state) : null;
    // 表示範囲の外に出た点が「どちらに、どれくらい」離れているかをトラック上に刻む
    rangeControls.render(state.view, {
      currentPoint: current?.point ?? null,
      averagePoint: graph?.averagePoint ?? null,
      pins: graph?.pins ?? [],
    });

    pinList.render(graph ? graph.pins : state.pins);

    const plottable = Boolean(graph);
    plotNode.hidden = !plottable;
    // グラフが無いときは軸スライダーも隠す
    graphLayout.hidden = !plottable;
    probeSection.hidden = !plottable;
    graphActions.hidden = !plottable;
    emptyNode.hidden = plottable;
    for (const card of analysisCards) card.hidden = !plottable;

    if (!plottable) {
      renderEmptyState(state);
      currentPosition.render(null);
      sensitivityPanel.render(null);
      scenarioTable.render(null);
      summary.render(null);
      probePanel.render(null);
      return;
    }

    const probe = selectProbeValuation(state);

    currentPosition.render(current);
    sensitivityPanel.render(current?.sensitivity ?? null);
    scenarioTable.render(selectScenarios(state));
    summary.render(selectSummary(state));
    probePanel.render(probe);

    plot
      .render(graph, state.view, theme.effective, {
        currentPoint: current?.point ?? null,
        // 損益も渡してグラフ上にラベルを出す（ドラッグ中に目を離さずに読めるように）
        probe: probe ? { ...probe.point, ...probe.valuation } : null,
      })
      .then(syncAxisSliders)
      .catch((error) => {
        console.error("グラフの描画に失敗しました", error);
        showToast("グラフの描画に失敗しました", "error");
      });
  });

  /**
   * 軸に沿わせたスライダーの位置と長さを、実際のプロット領域に合わせる。
   * Plotly は軸ラベル分だけ内側に描くため、実測しないと軸とずれる。
   */
  function syncAxisSliders() {
    const area = plot.getPlotArea();
    if (!area) return;
    graphLayout.style.setProperty("--plot-left", `${area.left}px`);
    graphLayout.style.setProperty("--plot-top", `${area.top}px`);
    graphLayout.style.setProperty("--plot-width", `${area.width}px`);
    graphLayout.style.setProperty("--plot-height", `${area.height}px`);
  }

  // 画面幅の変化で Plotly が描き直したときも追従させる
  plot.onResize(syncAxisSliders);

  function renderEmptyState(state) {
    const errors = selectInputErrors(state);
    clear(emptyNode);
    emptyNode.append(
      el("p", {
        class: "mb-2 fw-semibold",
        text: "購入情報を正しく入力するとグラフが表示されます。",
      }),
      errors.length > 0
        ? el(
            "ul",
            { class: "mb-0 small" },
            errors.map((message) => el("li", { text: message }))
          )
        : el("p", {
            class: "mb-0 small",
            text: "株価・為替レート・株数をすべて入力してください。",
          })
    );
  }

  function renderFxStatus(fxRate) {
    clear(fxStatusNode);
    refreshFxButton.disabled = fxRate.status === "loading";

    if (fxRate.status === "idle") return;

    const label = FX_STATUS_LABEL[fxRate.status];
    if (fxRate.status === "loading") {
      fxStatusNode.append(
        el("span", {
          class: "text-body-secondary",
          text: `為替レート ${label}`,
        })
      );
      return;
    }

    // レートの値は真上の入力欄に出ているので、ここは鮮度だけ。1行に収める
    fxStatusNode.append(
      el("span", {
        class: "text-body-secondary",
        text:
          fxRate.fetchedAt != null
            ? `レート ${label} ${formatTimestamp(fxRate.fetchedAt)}`
            : `レート ${label}`,
      })
    );
  }

  store.subscribe(render);
  theme.onChange(() => render(store.getState()));

  /* ---- イベント配線 ---------------------------------------------------- */

  need("#btn-add-purchase").addEventListener("click", () => {
    const id = actions.addPurchase();
    // 追加した行に入力を続けられるようにフォーカスを移す
    if (id) requestAnimationFrame(() => purchaseList.focus(id));
  });

  need("#extra-cost-input").addEventListener("change", (e) => {
    actions.setExtraCost(/** @type {HTMLInputElement} */ (e.target).value);
  });

  need("#btn-fit-view").addEventListener("click", actions.fitView);

  // 中心を保ったまま表示範囲を拡大・縮小する
  for (const button of document.querySelectorAll("[data-zoom-axis]")) {
    button.addEventListener("click", () => {
      actions.zoomView(
        button.dataset.zoomAxis,
        Number(button.dataset.zoomFactor)
      );
    });
  }

  for (const [field, selector] of [
    ["price", "#current-price-input"],
    ["fx", "#current-fx-input"],
  ]) {
    const input = need(selector);
    input.addEventListener("change", (e) => {
      actions.setCurrent(field, e.target.value);
    });
    // 空欄にして自動追従へ戻したときに、追従先の値を欄へ書き戻す
    // （編集中は syncValue が入力欄に触らないため、フォーカスが外れた時点で反映する）
    input.addEventListener("blur", () => render(store.getState()));
  }

  /* ---- 売却条件（プローブ） --------------------------------------- */

  for (const [field, selector] of [
    ["price", "#probe-price-input"],
    ["fx", "#probe-fx-input"],
  ]) {
    const input = need(selector);
    input.addEventListener("change", (e) => {
      actions.setProbeField(field, e.target.value);
    });
    input.addEventListener("blur", () => render(store.getState()));
  }

  need("#btn-reset-probe").addEventListener("click", actions.resetProbe);
  need("#btn-pin-probe").addEventListener("click", actions.pinProbe);

  // キーボードでの微調整。グラフをフォーカスして矢印キーで動かせる
  const ARROW = {
    ArrowLeft: { dx: -1 },
    ArrowRight: { dx: 1 },
    ArrowUp: { dy: 1 },
    ArrowDown: { dy: -1 },
  };
  plotNode.addEventListener("keydown", (e) => {
    const move = ARROW[e.key];
    if (!move) return;
    e.preventDefault(); // 矢印キーでのページスクロールを止める
    actions.nudgeProbe({ ...move, coarse: e.shiftKey });
  });

  need("#save-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = /** @type {HTMLInputElement} */ (need("#save-name"));
    if (actions.saveSnapshot(input.value)) input.value = "";
  });

  need("#btn-restore-state").addEventListener("click", () => {
    const name = savedStates.selected;
    if (name) actions.restoreSnapshot(name);
  });

  need("#btn-delete-state").addEventListener("click", async () => {
    const name = savedStates.selected;
    if (!name) return;
    const ok = await confirmDialog({
      title: "保存データの削除",
      body: `「${name}」を削除します。この操作は取り消せません。`,
      confirmLabel: "削除する",
    });
    if (ok) actions.deleteSnapshot(name);
  });

  need("#btn-reset").addEventListener("click", async () => {
    const ok = await confirmDialog({
      title: "入力内容のリセット",
      body: "購入情報・ピン・表示範囲を初期状態に戻します。保存データは削除されません。",
      confirmLabel: "リセットする",
      tone: "primary",
    });
    if (ok) actions.reset();
  });

  refreshFxButton.addEventListener("click", () => {
    actions.refreshFxRate({ force: true });
  });

  need("#theme-toggle").addEventListener("click", () => {
    theme.cycle();
    renderThemeToggle();
  });

  need("#btn-save-image").addEventListener("click", async (e) => {
    const button = /** @type {HTMLButtonElement} */ (e.currentTarget);
    if (!lastGraph) return;
    button.disabled = true;
    try {
      await saveGraphImage(lastGraph, store.getState().view, theme.effective);
      showToast("グラフを画像として保存しました", "success");
    } catch (error) {
      console.error("画像の保存に失敗しました", error);
      showToast("画像の保存に失敗しました", "error");
    } finally {
      button.disabled = false;
    }
  });

  need("#btn-share-x").addEventListener("click", () => {
    const current = selectCurrentValuation(store.getState());
    if (!current) return;

    /*
      金額は載せない。

      以前は含み損益の実額と平均取得価額を入れていたが、この2つと損益率から
      保有量まで逆算できる（取得総額 = 損益 ÷ 損益率、株数 = 取得総額 ÷ 平均取得価額）。
      押すと X の投稿画面が開くだけで即投稿ではないにせよ、
      そこまで書いた文面を既定で用意するかどうかはアプリ側の判断になる。

      率と分岐点なら、どんな銘柄をどれだけ持っているかは分からないまま、
      「為替がここまで動くと ±0」という話の中身は伝わる。
      リンク先がツールのトップであることとも辻褄が合う。
    */
    const lines = ["📈 米国株 × 為替 損益分岐シミュレーション"];
    if (current.breakEven) {
      lines.push(
        `為替 ${formatNumber(current.point.fx, 1)} 円なら $${formatUsd(current.breakEven.breakEvenPrice)} が損益分岐`
      );
    }
    lines.push(
      `現在の含み損益 ${formatSignedPct(current.valuation.rateYenPct)}`,
      "#米国株 #為替"
    );

    const url = new URL("https://twitter.com/intent/tweet");
    url.searchParams.set("text", lines.join("\n"));
    url.searchParams.set("url", location.href);
    window.open(url.toString(), "_blank", "noopener");
  });

  function renderThemeToggle() {
    const button = need("#theme-toggle");
    need("#theme-toggle-icon", button).textContent = theme.icon();
    need("#theme-toggle-label", button).textContent = theme.label();
    button.setAttribute(
      "aria-label",
      `表示テーマ: ${theme.label()}（切り替え）`
    );
  }

  /* ---- 起動 ------------------------------------------------------------ */

  // 数値入力の共通挙動（ホイールでの誤変更防止・矢印キー・増減ボタン）
  const mainEl = need("main");
  preventWheelStepping(mainEl);
  enableStepKeys(mainEl);
  enableStepButtons(mainEl);

  renderThemeToggle();
  render(store.getState());

  // 為替の取得はグラフ描画をブロックしない（取得できたら範囲と初期値を合わせる）
  actions.refreshFxRate({ applyToPurchases: true });
}
