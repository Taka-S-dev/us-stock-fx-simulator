/**
 * 状態管理に関する共通ユーティリティ関数
 */

/**
 * 保存済み状態の名前一覧を取得
 * @returns {Array} 保存済み状態の名前配列
 */
export function getAllSavedStateNames() {
  return Object.keys(localStorage).filter((k) => k.startsWith("state::"));
}

/**
 * 保存済み状態一覧を更新
 */
export function updateSavedStateList() {
  const select = document.getElementById("saved-states");
  if (!select) return;

  select.innerHTML = "<option disabled selected>保存済み一覧</option>";

  getAllSavedStateNames().forEach((key) => {
    const name = key.replace("state::", "");
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });
}
