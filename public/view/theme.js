// view/theme.js
// ライト / ダーク / OS追従の切り替え。Bootstrap 5.3 の data-bs-theme に委ねる。

const ORDER = /** @type {const} */ (["auto", "light", "dark"]);
const LABEL = { auto: "OSに合わせる", light: "ライト", dark: "ダーク" };
const ICON = { auto: "◐", light: "☀", dark: "☾" };

/**
 * @param {{ getTheme: () => "auto"|"light"|"dark", setTheme: (t:string) => void }} preferences
 */
export function createTheme(preferences) {
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  /** @type {Set<(effective:"light"|"dark") => void>} */
  const listeners = new Set();
  let mode = preferences.getTheme();

  const effective = () =>
    mode === "auto" ? (query.matches ? "dark" : "light") : mode;

  const apply = () => {
    const value = effective();
    document.documentElement.dataset.bsTheme = value;
    for (const listener of listeners) listener(value);
  };

  query.addEventListener("change", () => {
    if (mode === "auto") apply();
  });

  return {
    /** 現在の設定（auto を含む） */
    get mode() {
      return mode;
    },
    /** 実際に適用されている外観 */
    get effective() {
      return effective();
    },
    label: () => LABEL[mode],
    icon: () => ICON[mode],

    /** auto → light → dark → auto と巡回する */
    cycle() {
      mode = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
      preferences.setTheme(mode);
      apply();
      return mode;
    },

    init() {
      apply();
    },

    /** 外観が変わったときの通知（Plotly の再描画に使う） */
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
