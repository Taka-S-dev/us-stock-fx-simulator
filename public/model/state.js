// model/state.js
// 状態データの保存・取得・検証のみを担当（DOM/View/Controllerへの依存なし）

const STATE_PREFIX = "state::";

/**
 * 状態データの検証
 * @param {Object} state - 検証する状態データ
 * @returns {boolean} 有効かどうか
 */
export function validateState(state) {
  if (!state || typeof state !== "object") {
    console.warn("状態データが無効です");
    return false;
  }

  const basicFields = ["fxMin", "fxMax", "priceMin", "priceMax"];
  for (const field of basicFields) {
    if (field in state) {
      const value = state[field];
      if (typeof value !== "number" || isNaN(value)) {
        console.warn(`無効な数値フィールド: ${field} = ${value}`);
        return false;
      }
    }
  }

  if ("purchases" in state && !Array.isArray(state.purchases)) {
    console.warn("purchasesが配列ではありません");
    return false;
  }

  if ("pins" in state && !Array.isArray(state.pins)) {
    console.warn("pinsが配列ではありません");
    return false;
  }

  return true;
}

/**
 * 状態を保存
 * @param {string} name - 保存名（"state::" なし）
 * @param {Object} state - 保存する状態
 * @returns {boolean} 成功したかどうか
 */
export function saveState(name, state) {
  try {
    if (!name || name.trim() === "") return false;
    if (!validateState(state)) return false;
    const key = STATE_PREFIX + name;
    localStorage.setItem(key, JSON.stringify(state));
    return true;
  } catch (e) {
    console.error("状態保存エラー:", e);
    return false;
  }
}

/**
 * 状態を読み込み
 * @param {string} name - 保存名（"state::" なし）
 * @returns {Object|null} 復元した状態
 */
export function loadState(name) {
  try {
    if (!name || name.trim() === "") return null;
    const raw = localStorage.getItem(STATE_PREFIX + name);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!validateState(parsed)) return null;
    return parsed;
  } catch (e) {
    console.error("状態読込エラー:", e);
    return null;
  }
}

/**
 * 保存済み状態の一覧を取得
 * @returns {Array<string>} 保存済み状態名の配列
 */
export function getSavedStateNames() {
  try {
    return Object.keys(localStorage)
      .filter((key) => key.startsWith(STATE_PREFIX))
      .map((key) => key.replace(STATE_PREFIX, ""))
      .filter((name) => name !== "保存済み一覧");
  } catch (e) {
    console.error("保存済み状態一覧取得エラー:", e);
    return [];
  }
}

/**
 * 状態を削除
 * @param {string} name - 保存名（"state::" なし）
 * @returns {boolean} 成功したかどうか
 */
export function deleteState(name) {
  try {
    if (!name || name.trim() === "") return false;
    if (name === "保存済み一覧") return false;
    localStorage.removeItem(STATE_PREFIX + name);
    return true;
  } catch (e) {
    console.error("状態削除エラー:", e);
    return false;
  }
}

/**
 * すべての保存状態をクリア（このアプリが保存したもののみ）
 */
export function clearStateStorage() {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(STATE_PREFIX))
      .forEach((key) => localStorage.removeItem(key));
  } catch (e) {
    console.error("状態クリアエラー:", e);
  }
}
