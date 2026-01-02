import { customPins, removePin } from "../model/pins.js";

export function renderPinSettings() {
  const container = document.getElementById("pin-settings");
  if (!container) {
    return;
  }
  container.innerHTML = "";

  customPins.forEach((p, index) => {
    const id = `pin-toggle-${index}`;
    const div = document.createElement("div");
    div.className = "d-flex align-items-center justify-content-between mb-1";

    div.innerHTML = `
      <div class="form-check">
        <input class="form-check-input" type="checkbox" id="${id}" ${
      p.showAnnotation ? "checked" : ""
    }>
        <label class="form-check-label small" for="${id}">
          📍 ${p.fx.toFixed(1)}円/USD × ${p.price.toFixed(1)}USD
        </label>
      </div>
      <button class="btn btn-sm btn-outline-danger btn-delete-pin" data-index="${index}" title="削除">
        🗑
      </button>
    `;

    div.querySelector("input").addEventListener("change", (e) => {
      p.showAnnotation = e.target.checked;
      document.dispatchEvent(new CustomEvent("inputChanged"));
    });

    div.querySelector(".btn-delete-pin").addEventListener("click", () => {
      removePin(p.fx, p.price);
      document.dispatchEvent(new CustomEvent("inputChanged"));
      // メイン画面のピン設定UIを更新
      renderPinSettings();
      // モーダル内のピン設定UIも更新
      import("../controller/modalEvents.js").then(
        ({ updateModalPinSettings }) => {
          setTimeout(() => {
            updateModalPinSettings();
          }, 50);
        }
      );
    });

    container.appendChild(div);
  });
}
