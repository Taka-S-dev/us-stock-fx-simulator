// model/purchase.js
// 入力値の検証と正規化。文字列を受け取り、数値とエラーメッセージに変換する純粋関数群。
// 「不正値をこっそりデフォルト値に差し替える」ことはしない。不正なら不正として返し、
// 計算対象から除外したうえでUIにエラーを出すのが呼び出し側の責務。

/** 入力欄ごとの許容範囲。UI（min/max/step 属性）と検証で同じ定義を使う */
export const LIMITS = {
  price: {
    label: "購入株価（USD）",
    min: 0.01,
    max: 1_000_000,
    step: 0.01,
    unit: "USD",
  },
  fx: {
    label: "為替レート（円/USD）",
    min: 1,
    max: 1_000,
    // USD/JPY は銭単位で提示されるため小数2桁で扱う。
    // 入力欄の step 属性もここから引くので、表示する値と常に一致する
    step: 0.01,
    unit: "円/USD",
  },
  qty: {
    label: "株数",
    min: 1,
    max: 1_000_000,
    step: 1,
    integer: true,
    unit: "株",
  },
};

/**
 * 表示範囲スライダーの定義。
 * gap は「最小値と最大値の最小間隔」で、0幅の範囲でグラフが破綻するのを防ぐ。
 */
export const RANGE_LIMITS = {
  fx: { min: 100, max: 250, gap: 2, step: 0.5 },

  price: {
    min: 1,
    max: 5_000,
    gap: 2,
    /** 数値入力欄の刻み */
    step: 1,
    /**
     * スライダーのスケール。トラック上の位置と値の対応を区分線形で定義する。
     * 実際の株価が集まる低価格帯にトラックを厚く割り当てることで、
     * $1〜$5,000 を1本のスライダーで扱える（上限切り替えスイッチが不要になる）。
     *
     *   トラック  0%      25%      50%      75%     100%
     *   値       $1  →  $50  →  $200  →  $1,000 → $5,000
     *
     * 各区間の第2要素はその区間での刻み幅。
     */
    scale: {
      min: [1, 0.5],
      "25%": [50, 1],
      "50%": [200, 5],
      "75%": [1_000, 25],
      max: 5_000,
    },
    /** 目盛りに表示する値。非線形であることを読み取れるようにする */
    pips: [1, 50, 200, 1_000, 5_000],
  },
};

/**
 * スライダーのトラック上で、その値が何％の位置にあたるかを返す。
 *
 * 株価のスケールは区分線形（$1→$50→$200→$1,000→$5,000 を等分割）なので、
 * 値と位置の対応を線形に計算すると大きくずれる。noUiSlider は内部で同じ変換を
 * 持っているが外へ公開していないため、同じ range 定義からここで求め直す。
 *
 * 範囲の外に出た値は 0 / 100 に丸める（「端にある」ことは示せる）。
 *
 * @param {Record<string, number|number[]>} range noUiSlider の range 定義
 * @param {number} value
 * @returns {number|null} 0〜100。求められないときは null
 */
export function scalePercent(range, value) {
  if (!Number.isFinite(value)) return null;

  const points = Object.entries(range)
    .map(([key, entry]) => ({
      // "25%" のような中間キーはそのまま位置になる
      percent: key === "min" ? 0 : key === "max" ? 100 : Number.parseFloat(key),
      // 各要素は [値, 刻み] か、値そのもの
      value: Array.isArray(entry) ? entry[0] : entry,
    }))
    .filter((p) => Number.isFinite(p.percent) && Number.isFinite(p.value))
    .sort((a, b) => a.percent - b.percent);

  if (points.length < 2) return null;
  if (value <= points[0].value) return 0;

  for (let i = 1; i < points.length; i += 1) {
    const from = points[i - 1];
    const to = points[i];
    if (value > to.value) continue;
    // 同じ値が続く区間は分母が 0 になるので、手前の位置を返す
    if (to.value === from.value) return from.percent;
    const ratio = (value - from.value) / (to.value - from.value);
    return from.percent + ratio * (to.percent - from.percent);
  }
  return 100;
}

const decimals = (step) => {
  const s = String(step);
  const i = s.indexOf(".");
  return i === -1 ? 0 : s.length - i - 1;
};

/**
 * 単一フィールドの検証
 * @param {keyof typeof LIMITS} field
 * @param {string|number} raw
 * @returns {{ value: number|null, error: string|null }}
 */
export function validateField(field, raw) {
  const spec = LIMITS[field];
  if (!spec) return { value: null, error: null };

  const text = typeof raw === "string" ? raw.trim() : String(raw ?? "");
  if (text === "") {
    return { value: null, error: `${spec.label}を入力してください` };
  }

  const value = Number(text);
  if (!Number.isFinite(value)) {
    return { value: null, error: `${spec.label}は数値で入力してください` };
  }
  if (spec.integer && !Number.isInteger(value)) {
    return { value: null, error: `${spec.label}は整数で入力してください` };
  }
  if (value < spec.min || value > spec.max) {
    const fmt = (n) => n.toLocaleString("ja-JP");
    return {
      value: null,
      error: `${spec.label}は ${fmt(spec.min)}〜${fmt(spec.max)} の範囲で入力してください`,
    };
  }

  // 表示上の桁に丸めて、浮動小数のゴミが状態に入らないようにする
  const d = decimals(spec.step);
  return { value: Number(value.toFixed(d)), error: null };
}

let seq = 0;
/** 衝突しない行ID。永続化はしない（保存データはインデックス順に依存する） */
export function nextId(prefix = "row") {
  seq += 1;
  return `${prefix}-${seq}`;
}

/**
 * 既定の購入履歴1件。
 * pristine は「ユーザーがまだ触っていない初期値」の印。為替レートを取得できたときに
 * 初期値だけを上書きし、入力済みの値は書き換えないために使う。
 */
export function createPurchase(seed = {}) {
  return {
    id: nextId("purchase"),
    price: seed.price ?? 150,
    fx: seed.fx ?? 140,
    qty: seed.qty ?? 10,
    pristine: true,
    errors: {},
  };
}

/**
 * 購入履歴1件を検証し、値とエラーを載せた新しいオブジェクトを返す
 * @param {{id:string}} purchase
 * @param {{price?:string|number, fx?:string|number, qty?:string|number}} raw
 */
export function validatePurchase(purchase, raw) {
  const next = { ...purchase, pristine: false, errors: {} };
  for (const field of /** @type {const} */ (["price", "fx", "qty"])) {
    if (!(field in raw)) continue;
    const { value, error } = validateField(field, raw[field]);
    next[field] = value;
    if (error) next.errors[field] = error;
  }
  return next;
}

/** 計算に使える（全フィールドが有効な）購入履歴かどうか */
export function isPurchaseValid(p) {
  return (
    Number.isFinite(p.price) &&
    Number.isFinite(p.fx) &&
    Number.isFinite(p.qty) &&
    Object.keys(p.errors ?? {}).length === 0
  );
}

/**
 * 保存データなど、外部由来の購入履歴配列を正規化する。
 * 不正な要素は落とし、理由を errors に積む。
 * @param {unknown} rawList
 * @returns {{ purchases: Array<ReturnType<typeof createPurchase>>, errors: string[] }}
 */
export function normalizePurchases(rawList) {
  const errors = [];
  if (!Array.isArray(rawList)) return { purchases: [], errors };

  const purchases = [];
  rawList.forEach((raw, i) => {
    if (!raw || typeof raw !== "object") {
      errors.push(`購入情報${i + 1}: 形式が不正です`);
      return;
    }
    const candidate = validatePurchase(createPurchase(), {
      price: raw.price,
      fx: raw.fx,
      qty: raw.qty,
    });
    if (!isPurchaseValid(candidate)) {
      errors.push(`購入情報${i + 1}: ${Object.values(candidate.errors)[0]}`);
      return;
    }
    purchases.push({ ...candidate, pristine: false, errors: {} });
  });

  return { purchases, errors };
}

/**
 * ピンの検証
 * @param {string|number} rawFx
 * @param {string|number} rawPrice
 * @returns {{ pin: {fx:number, price:number}|null, error: string|null }}
 */
export function validatePin(rawFx, rawPrice) {
  const fx = validateField("fx", rawFx);
  if (fx.error) return { pin: null, error: fx.error };
  const price = validateField("price", rawPrice);
  if (price.error) return { pin: null, error: price.error };
  return { pin: { fx: fx.value, price: price.value }, error: null };
}

/**
 * 表示範囲を中心を動かさずに拡大・縮小する。
 *
 * スライダーで両端を内側へ動かすやり方では、中心を保ったまま狭めるのが難しい。
 * 「今見ている位置のまま倍率だけ変えたい」という操作は別に用意する必要がある。
 *
 * 許容範囲の端に当たった場合は、中心をずらすのではなく拡大量を抑える
 * （中心が動かないことを優先する）。
 *
 * @param {{min:number, max:number}} range
 * @param {number} factor 1未満で狭める / 1より大きいと広げる
 * @param {{min:number, max:number, gap:number}} spec
 * @returns {{min:number, max:number}}
 */
export function scaleRange({ min, max }, factor, spec) {
  const center = (min + max) / 2;
  const desiredHalf = ((max - min) / 2) * factor;

  // 中心を保ったまま取れる最大の半幅
  const limitHalf = Math.min(center - spec.min, spec.max - center);
  const minHalf = spec.gap / 2;

  let half = Math.max(desiredHalf, minHalf);
  // 端に当たるときは拡大を抑える。ただし最小幅は必ず確保する
  if (limitHalf >= minHalf) half = Math.min(half, limitHalf);

  /*
    丸めるのは「半幅」だけにする。
    min と max をそれぞれ丸めると、両方が同じ向きに丸まったときに中心が動く
    （縮小と拡大を繰り返すと中心がずれていく）。
  */
  const roundedHalf = Number(half.toFixed(2));
  return { min: center - roundedHalf, max: center + roundedHalf };
}

/**
 * 表示範囲を許容値に収める。min/max の逆転と最小幅（gap）を保証する。
 * @param {{min:number, max:number}} next 変更後の希望値
 * @param {{min:number, max:number, gap:number}} spec
 * @param {"min"|"max"} anchor 動かさない側
 * @returns {{min:number, max:number}}
 */
export function clampRange(next, spec, anchor = "min") {
  let min = Number.isFinite(next.min) ? next.min : spec.min;
  let max = Number.isFinite(next.max) ? next.max : spec.max;

  min = Math.min(Math.max(min, spec.min), spec.max);
  max = Math.min(Math.max(max, spec.min), spec.max);

  if (max - min < spec.gap) {
    if (anchor === "min") {
      max = min + spec.gap;
      if (max > spec.max) {
        max = spec.max;
        min = Math.max(spec.min, max - spec.gap);
      }
    } else {
      min = max - spec.gap;
      if (min < spec.min) {
        min = spec.min;
        max = Math.min(spec.max, min + spec.gap);
      }
    }
  }
  return { min, max };
}
