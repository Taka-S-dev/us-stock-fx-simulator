// view/savedStates.js
// 保存済み設定の選択リスト。プレースホルダは value="" にしておき、
// 「"保存済み一覧" という文字列と比較する」ような判定をモデル側に持ち込まない。

import { clear, el, need } from "./dom.js";

export function createSavedStates() {
  const select = /** @type {HTMLSelectElement} */ (need("#saved-states"));
  const restoreButton = /** @type {HTMLButtonElement} */ (
    need("#btn-restore-state")
  );
  const deleteButton = /** @type {HTMLButtonElement} */ (
    need("#btn-delete-state")
  );

  const syncButtons = () => {
    const disabled = select.value === "";
    restoreButton.disabled = disabled;
    deleteButton.disabled = disabled;
  };
  select.addEventListener("change", syncButtons);

  return {
    /** 選択中の保存名（未選択なら null） */
    get selected() {
      return select.value === "" ? null : select.value;
    },

    /** @param {string[]} names */
    render(names) {
      const previous = select.value;
      clear(select);

      select.append(
        el("option", {
          value: "",
          text: names.length ? "保存データを選択" : "保存データはありません",
        })
      );
      for (const name of names) {
        select.append(el("option", { value: name, text: name }));
      }

      select.value = names.includes(previous) ? previous : "";
      select.disabled = names.length === 0;
      syncButtons();
    },
  };
}
