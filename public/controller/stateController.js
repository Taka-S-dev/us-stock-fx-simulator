import { getCurrentAppState, applyAppState } from "../model/state.js";

import { showToast } from "../view/toast.js";

import { updateSavedStateList } from "../utils/stateUtils.js";

export function setupStateEventHandlers() {
  document.getElementById("btn-save-state").addEventListener("click", () => {
    const name = document.getElementById("save-name").value.trim();
    if (!name) return alert("保存名を入力してください");

    const state = getCurrentAppState();

    localStorage.setItem("state::" + name, JSON.stringify(state));
    updateSavedStateList();
    showToast("✅ 保存しました！");

    // 保存名をクリア
    document.getElementById("save-name").value = "";
  });

  document.getElementById("btn-restore-state").addEventListener("click", () => {
    const select = document.getElementById("saved-states");
    const name = select.value;
    if (!name || name === "保存済み一覧")
      return alert("保存名を選択してください");

    const key = "state::" + name;
    const raw = localStorage.getItem(key);
    if (!raw) return alert("保存が見つかりません");

    try {
      const state = JSON.parse(raw);
      applyAppState(state, key);
      showToast("📥 復元しました！");
    } catch (error) {
      console.error("復元エラー:", error);
      showToast("復元中にエラーが発生しました", "error");
    }
  });

  document.getElementById("btn-delete-state").addEventListener("click", () => {
    const select = document.getElementById("saved-states");
    const name = select.value;
    if (!name || name === "保存済み一覧")
      return alert("保存名を選択してください");

    if (confirm(`"${name}" を削除しますか？`)) {
      localStorage.removeItem("state::" + name);
      updateSavedStateList();
    }
  });
}
