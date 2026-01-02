import { setupController, initializeApp } from "./controller/events.js";
import { updateGraph } from "./controller/graphController.js";
import { addPurchaseForm } from "./view/form.js";
import { showToast } from "./view/toast.js";

// アプリケーションの初期化
async function startApp() {
  // ローディング表示
  const loadingContainer = document.getElementById("loading-container");
  const graphContainer = document.getElementById("graph-container");

  if (loadingContainer && graphContainer) {
    loadingContainer.style.display = "block";
    graphContainer.style.display = "none";
  }

  try {
    // コントローラーとフォームの初期化
    setupController();
    addPurchaseForm();

    // API取得とアプリケーション初期化
    await initializeApp();

    // 初期化完了後、ローディングを非表示にしてグラフを表示
    if (loadingContainer && graphContainer) {
      loadingContainer.style.display = "none";
      graphContainer.style.display = "block";
    }

    // 初回グラフ描画
    updateGraph();
  } catch (error) {
    console.error("Application initialization error:", error);

    // エラー時もグラフを表示
    if (loadingContainer && graphContainer) {
      loadingContainer.style.display = "none";
      graphContainer.style.display = "block";
    }

    // デフォルト値でグラフ描画
    updateGraph();

    // エラーをユーザーに通知
    showToast("アプリケーションの初期化中にエラーが発生しました", "error");
  }
}

// アプリケーション開始
startApp();
