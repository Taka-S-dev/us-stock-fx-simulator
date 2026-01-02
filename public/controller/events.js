import { initRangeSliders } from "../view/rangeSlider.js";

import { getPurchases, setPurchases } from "../model/calc.js";
import { addPin, getPins } from "../model/pins.js";

import { addPurchaseForm } from "../view/form.js";
import { showToast } from "../view/toast.js";
import { saveGraphImage } from "../view/saveImage.js";

import { updateSavedStateList } from "../utils/stateUtils.js";

import { setupMobileModals } from "./modalEvents.js";
import { setupStateEventHandlers } from "./stateController.js";
import { updateGraph } from "./graphController.js";

export function setupController() {
  try {
    initRangeSliders(); // ✅ 新しいスライダー初期化

    document.addEventListener("inputChanged", updateGraph);

    // スクロールコントロールの設定
    setupScrollControls();

    const addPurchaseBtn = document.getElementById("addPurchase");
    if (addPurchaseBtn) {
      addPurchaseBtn.addEventListener("click", () => {
        try {
          addPurchaseForm();
          updateGraph();
        } catch (error) {
          console.error("❌ 購入フォーム追加エラー:", error);
          showToast("購入フォームの追加中にエラーが発生しました", "error");
        }
      });
    } else {
      console.error("❌ メイン購入履歴追加ボタンが見つかりません");
    }

    document.getElementById("add-pin").addEventListener("click", () => {
      try {
        const fxInput = document.getElementById("pin-fx");
        const priceInput = document.getElementById("pin-price");

        if (!fxInput || !priceInput) {
          console.error("❌ ピン入力フィールドが見つかりません");
          showToast("ピン入力フィールドが見つかりません", "error");
          return;
        }

        const fx = parseFloat(fxInput.value);
        const price = parseFloat(priceInput.value);

        // ピン入力値の検証
        if (isNaN(fx) || isNaN(price)) {
          showToast(
            "ピンの為替レートと株価は数値で入力してください",
            "warning"
          );
          return;
        }

        if (fx <= 0 || price <= 0) {
          showToast(
            "ピンの為替レートと株価は0より大きい値で入力してください",
            "warning"
          );
          return;
        }

        if (fx < 1 || fx > 1000) {
          showToast(
            "ピンの為替レートは1〜1000の範囲で入力してください",
            "warning"
          );
          return;
        }

        if (price < 0.01 || price > 1000000) {
          showToast(
            "ピンの株価は0.01〜1,000,000の範囲で入力してください",
            "warning"
          );
          return;
        }

        const success = addPin(fx, price);
        if (success) {
          updateGraph();
          // ピン設定UIを更新
          import("../view/pinSettings.js").then(({ renderPinSettings }) => {
            renderPinSettings();
          });
          showToast("📍 売却候補ポイントを追加しました", "success");
        }
      } catch (error) {
        console.error("❌ ピン追加エラー:", error);
        showToast("ピンの追加中にエラーが発生しました", "error");
      }
    });

    setupMobileModals();
    setupStateEventHandlers();
  } catch (error) {
    console.error("❌ setupController エラー:", error);
    showToast("アプリの初期化中にエラーが発生しました", "error");
  }
}

/**
 * アプリケーションの初期化
 * API取得後にアプリケーションを初期化
 */
export async function initializeApp() {
  // 為替レートの取得と初期化
  await setInitialFxRange();

  // 購入履歴の初期化（空の場合は初期値を追加）
  const purchases = getPurchases();
  if (!purchases || purchases.length === 0) {
    const initialPurchase = { price: 150, fx: 140, qty: 10 };
    setPurchases([initialPurchase]);
  }

  // 保存済み一覧を更新
  updateSavedStateList();

  // アコーディオンの初期化
  initializeAccordions();
}

/**
 * アコーディオンの初期化
 */
function initializeAccordions() {
  const accordions = document.querySelectorAll(".accordion-card");

  accordions.forEach((card) => {
    const header = card.querySelector(".accordion-header");
    const body = card.querySelector(".accordion-body");

    header.addEventListener("click", () => {
      const willOpen = !card.classList.contains("open");

      card.classList.toggle("open");

      if (willOpen) {
        body.classList.add("fade-in");
        setTimeout(() => body.classList.add("show"), 10);
      } else {
        body.classList.remove("show");
        setTimeout(() => body.classList.remove("fade-in"), 400);
      }
    });
  });
}

export function updatePinUI() {
  const pinList = document.getElementById("pin-list");
  pinList.innerHTML = "";

  getPins().forEach((p, index) => {
    const id = `pin-${index}`;
    const div = document.createElement("div");
    div.className = "pin-entry";
    div.innerHTML = `
      <div class="form-check">
        <input class="form-check-input" type="checkbox" id="${id}" ${
      p.showAnnotation ? "checked" : ""
    }>
        <label class="form-check-label small" for="${id}">
          📍 ${p.fx.toFixed(1)}円/USD × ${p.price.toFixed(1)}USD
        </label>
      </div>
    `;
    pinList.appendChild(div);
  });
}

document
  .getElementById("btn-save-image")
  .addEventListener("click", async () => {
    try {
      // 現在のグラフデータを取得
      const graphData = window.currentGraphData;
      const hoverInfo = window.currentHoverInfo;

      if (!graphData) {
        alert("グラフデータが見つかりません");
        return;
      }

      // 独立したモジュールで画像保存
      // オーバーレイが表示されている場合のみホバー情報を含める
      const mobileHoverInfo = document.getElementById("mobile-hover-info");
      const isOverlayVisible =
        mobileHoverInfo && mobileHoverInfo.style.display !== "none";

      await saveGraphImage(graphData, {
        hoverInfo: isOverlayVisible ? hoverInfo : null,
      });
    } catch (error) {
      console.error("画像保存エラー:", error);
      alert("画像保存中にエラーが発生しました");
    }
  });

document.getElementById("btn-post-x").addEventListener("click", () => {
  const avgInfo = document.getElementById("average-info").textContent;

  // avgInfoの改行を整理（連続する改行を1つに）
  const cleanAvgInfo = avgInfo
    .replace(/\n+/g, "\n")
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .map((line) => {
      // 長い行を短縮
      if (line.includes("購入時の平均株価:")) {
        return line.replace("購入時の平均株価:", "購入平均株価:");
      }
      if (line.includes("購入時の平均為替（円/USD）:")) {
        return line.replace("購入時の平均為替（円/USD）:", "購入平均為替:");
      }
      return line;
    })
    .join("\n");

  // より魅力的なツイート文を作成
  const tweetText = encodeURIComponent(
    `📈 米国株投資シミュレーション結果\n` +
      `${cleanAvgInfo}\n` +
      `💡 為替×株価の2軸で損益を可視化\n` +
      `🎯 損益分岐ラインで投資判断をサポート\n` +
      `#米国株 #投資 #為替 #損益シミュレーション`
  );

  const tweetUrl = `https://twitter.com/intent/tweet?text=${tweetText}`;
  window.open(tweetUrl, "_blank");
});

// DOMContentLoadedイベントを削除（initializeAppで処理）

async function setInitialFxRange() {
  const FX_SPREAD = 12;

  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    const data = await res.json();
    const currentFx = data?.rates?.JPY;
    if (!currentFx) throw new Error("為替情報が取得できません");

    const fxMin = parseFloat((currentFx - FX_SPREAD).toFixed(1));
    const fxMax = parseFloat((currentFx + FX_SPREAD).toFixed(1));
    const fxMid = parseFloat(currentFx.toFixed(1));

    document.getElementById("fx-min-input").value = fxMin;
    document.getElementById("fx-max-input").value = fxMax;

    const fxSlider = document.getElementById("fx-slider");
    if (fxSlider && fxSlider.noUiSlider) {
      fxSlider.noUiSlider.set([fxMin, fxMax]);
    }

    // 購入情報の為替入力欄すべてに反映
    document.querySelectorAll(".fx").forEach((input) => {
      input.value = fxMid;
    });

    document.dispatchEvent(new Event("inputChanged"));
  } catch (e) {
    console.warn("為替取得に失敗しました", e);

    const fxMin = 130;
    const fxMax = 150;
    const fxMid = 140;

    document.getElementById("fx-min-input").value = fxMin;
    document.getElementById("fx-max-input").value = fxMax;

    const fxSlider = document.getElementById("fx-slider");
    if (fxSlider && fxSlider.noUiSlider) {
      fxSlider.noUiSlider.set([fxMin, fxMax]);
    }

    // デフォルト値として全てに140をセット
    document.querySelectorAll(".fx").forEach((input) => {
      input.value = fxMid;
    });

    document.dispatchEvent(new Event("inputChanged"));
  }
}

// スクロールコントロールの機能
function setupScrollControls() {
  const scrollUp = document.getElementById("scroll-up");
  const scrollDown = document.getElementById("scroll-down");

  if (scrollUp && scrollDown) {
    // 上スクロールボタン
    scrollUp.addEventListener("click", () => {
      window.scrollBy({
        top: -300,
        behavior: "smooth",
      });
    });

    // 下スクロールボタン
    scrollDown.addEventListener("click", () => {
      window.scrollBy({
        top: 300,
        behavior: "smooth",
      });
    });

    // タッチイベント（モバイル用）
    scrollUp.addEventListener("touchstart", (e) => {
      e.preventDefault();
      window.scrollBy({
        top: -300,
        behavior: "smooth",
      });
    });

    scrollDown.addEventListener("touchstart", (e) => {
      e.preventDefault();
      window.scrollBy({
        top: 300,
        behavior: "smooth",
      });
    });
  }

  // スクロール位置に応じてボタンの透明度を調整
  window.addEventListener("scroll", () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight =
      document.documentElement.scrollHeight - window.innerHeight;

    if (scrollUp) {
      // 上端に近い場合は上ボタンを薄く
      if (scrollTop < 100) {
        scrollUp.style.opacity = "0.3";
      } else {
        scrollUp.style.opacity = "0.8";
      }
    }

    if (scrollDown) {
      // 下端に近い場合は下ボタンを薄く
      if (scrollTop > scrollHeight - 100) {
        scrollDown.style.opacity = "0.3";
      } else {
        scrollDown.style.opacity = "0.8";
      }
    }
  });
}
