// model/store.js
// アプリ状態の単一の置き場所。DOM を「状態の保管先」として使わないための土台。
//
//   状態を変える  → store.update(...)
//   画面を変える  → store.subscribe(render)
//
// という一方向の流れだけを許すことで、「どこかの setTimeout の後で DOM を直接
// 書き換える」という同期待ちが不要になる。

/**
 * @template S
 * @param {S} initialState
 */
export function createStore(initialState) {
  let state = initialState;
  /** @type {Set<(s:S)=>void>} */
  const listeners = new Set();
  let notifying = false;

  const notify = () => {
    if (notifying) return; // update() の中から update() された場合の多重通知を防ぐ
    notifying = true;
    try {
      for (const listener of listeners) listener(state);
    } finally {
      notifying = false;
    }
  };

  return {
    getState: () => state,

    /**
     * @param {Partial<S>|((s:S)=>Partial<S>|null)} patch
     *   関数を渡すと現在の状態を受け取れる。null を返すと通知しない。
     */
    update(patch) {
      const partial = typeof patch === "function" ? patch(state) : patch;
      if (!partial) return state;
      state = { ...state, ...partial };
      notify();
      return state;
    },

    /** @param {(s:S)=>void} listener @returns {() => void} 解除関数 */
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * 初期状態。UI の初期値はここが唯一の出どころ（HTML に value をハードコードしない）。
 */
export function createInitialState(overrides = {}) {
  return {
    /** @type {Array<ReturnType<typeof import("./purchase.js").createPurchase>>} */
    purchases: [],
    /** 手数料・諸経費（円）。取得総額に加算する */
    extraCostYen: 0,
    view: {
      fxMin: 130,
      fxMax: 150,
      priceMin: 100,
      priceMax: 300,
    },
    /**
     * 現在地（今の為替と株価）。
     * null のあいだは取得した為替レート／平均購入株価に自動追従する。
     * ユーザーが入力した時点で値が入り、追従を止める。
     * @type {{fx:number|null, price:number|null}}
     */
    current: { fx: null, price: null },
    /**
     * 売却条件（プローブ）。グラフ上をクリック／ドラッグ／矢印キーで動かす点。
     * null のあいだは現在地に追従する。
     * @type {{fx:number|null, price:number|null}}
     */
    probe: { fx: null, price: null },
    /** @type {Array<{id:string, fx:number, price:number, visible:boolean}>} */
    pins: [],
    /** 為替レート取得の状況 */
    fxRate: {
      /** @type {number|null} */
      value: null,
      /** @type {number|null} epoch ms */
      fetchedAt: null,
      /** @type {"idle"|"loading"|"live"|"cache"|"fallback"} */
      status: "idle",
    },
    /** 保存済みスナップショット名 */
    savedNames: [],
    ...overrides,
  };
}
