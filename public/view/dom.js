// view/dom.js
// 要素生成の小さなヘルパ。innerHTML を使わずに組み立てることで、
// 入力値や保存名がそのままHTMLとして解釈される余地をなくしている。

/**
 * @param {string} tag
 * @param {Record<string, any>} [props]
 *   class / text / dataset / on<Event> / それ以外はプロパティか属性に設定
 * @param {Array<Node|string|null|undefined|false>} [children]
 * @returns {HTMLElement}
 */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;

    if (key === "class") {
      node.className = value;
    } else if (key === "text") {
      node.textContent = String(value);
    } else if (key === "dataset") {
      Object.assign(node.dataset, value);
    } else if (key === "style" && typeof value === "object") {
      Object.assign(node.style, value);
    } else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key in node) {
      node[key] = value;
    } else {
      node.setAttribute(key, value === true ? "" : String(value));
    }
  }

  append(node, children);
  return node;
}

/** @param {Node} parent @param {Array<Node|string|null|undefined|false>} children */
export function append(parent, children) {
  for (const child of [children].flat(Infinity)) {
    if (child == null || child === false) continue;
    parent.append(child);
  }
  return parent;
}

/** 中身を空にする */
export function clear(node) {
  node.replaceChildren();
  return node;
}

/**
 * @template {Element} T
 * @param {string} selector
 * @param {ParentNode} [root]
 * @returns {T}
 */
export function need(selector, root = document) {
  const node = root.querySelector(selector);
  if (!node) throw new Error(`要素が見つかりません: ${selector}`);
  return /** @type {T} */ (node);
}

/**
 * 入力欄の値を更新する。ユーザーが編集中の欄は書き換えない
 * （キャレット位置が飛ぶのを防ぐ）。
 * @param {HTMLInputElement} input
 * @param {string|number} value
 */
export function syncValue(input, value) {
  if (!input || input === document.activeElement) return;
  const next = String(value);
  if (input.value !== next) input.value = next;
}

/**
 * フォーカス中の数値入力の上でホイールを回すと、ブラウザ既定の挙動で値が
 * 書き換わってしまう（しかもページはスクロールしない）。
 * スクロールしたいだけなのに入力値が壊れるのは事故なので、
 * ホイールが来たらフォーカスを外して、スクロールはブラウザに任せる。
 *
 * @param {HTMLElement} root
 */
export function preventWheelStepping(root) {
  root.addEventListener(
    "wheel",
    (event) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement &&
        target.type === "number" &&
        target === document.activeElement
      ) {
        target.blur();
      }
    },
    { passive: true }
  );
}

/**
 * 数値入力を1段階動かす。
 *
 * ブラウザ既定では step 属性（＝値の精度）がそのまま増減幅になるため、
 * step="0.01" の欄では 150 から 200 まで5000回操作が必要になる。
 * 精度と操作単位は別物なので、ここで分離する。
 *
 *   通常   : 1（data-step-normal で上書き可）
 *   coarse : 10倍
 *   fine   : step 属性の刻み（精密調整）
 *
 * キーボードとボタンの両方がこの関数を使うので、挙動が食い違わない。
 *
 * @param {HTMLInputElement} input
 * @param {1|-1} direction
 * @param {{coarse?:boolean, fine?:boolean}} [modifier]
 * @returns {boolean} 実際に動かせたか
 */
export function stepNumberInput(input, direction, { coarse, fine } = {}) {
  if (!(input instanceof HTMLInputElement) || input.type !== "number") {
    return false;
  }

  const precision = Number(input.step) || 0.01; // step="any" は NaN になる
  const normal = Number(input.dataset.stepNormal ?? 1);
  const amount = fine ? precision : normal * (coarse ? 10 : 1);

  const current = Number(input.value);
  if (!Number.isFinite(current)) return false;

  const digits = String(precision).split(".")[1]?.length ?? 0;
  let next = Number((current + direction * amount).toFixed(digits));

  // 属性が無い場合 Number("") が 0 になるので、空を明示的に除く
  const limitOf = (name) => {
    const raw = input.getAttribute(name);
    if (raw === null || raw.trim() === "") return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  };
  const min = limitOf("min");
  const max = limitOf("max");
  if (min !== null) next = Math.max(next, min);
  if (max !== null) next = Math.min(next, max);

  // 上限・下限に達していたら「動かせなかった」と返す。
  // 押しっぱなしの連続増減は、これを停止条件に使う
  if (next === current) return false;

  input.value = String(next);
  // 入力途中の反映と確定処理の両方を動かす
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

/**
 * 矢印キーでの増減。↑↓ / Shift+↑↓（粗く） / Alt+↑↓（精密）
 * @param {HTMLElement} root
 */
export function enableStepKeys(root) {
  root.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== "number") return;

    // ブラウザ既定の増減（step 属性の刻み）とページスクロールを止める
    event.preventDefault();
    stepNumberInput(input, event.key === "ArrowUp" ? 1 : -1, {
      coarse: event.shiftKey,
      fine: event.altKey,
    });
  });
}

/**
 * ボタンでの増減。data-step-target で対象の入力欄を指す。
 *
 * ネイティブのスピナーは当たり判定が 10×9px しかなく刻みも step 属性そのままだったが、
 * ここでは十分な大きさのボタンに、矢印キーと同じ操作単位を割り当てる。
 * Shift 押しながらで10倍。
 *
 * 押しっぱなしでは連続して増減する（オートリピート）。
 * 単発のクリックで暴走しないよう最初だけ間を置き、しばらく押し続けると加速する。
 * 上限・下限に達したところで自動的に止まる。
 *
 * @param {HTMLElement} root
 */
export function enableStepButtons(root) {
  /** 単発クリックを連続とみなさないための待ち時間 */
  const REPEAT_DELAY_MS = 450;
  const REPEAT_INTERVAL_MS = 90;
  const REPEAT_FAST_MS = 40;
  const ACCELERATE_AFTER = 8;

  let timer = null;
  let repeats = 0;

  const stop = () => {
    clearTimeout(timer);
    timer = null;
    repeats = 0;
  };

  const stepFrom = (button, coarse) => {
    const input = document.getElementById(button.dataset.stepTarget);
    if (!input) return false;
    const direction = Number(button.dataset.stepDir) === -1 ? -1 : 1;
    return stepNumberInput(input, direction, { coarse });
  };

  root.addEventListener("pointerdown", (event) => {
    const button = event.target.closest?.("[data-step-target]");
    if (!button || button.disabled) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const coarse = event.shiftKey;
    stepFrom(button, coarse);

    const tick = () => {
      repeats += 1;
      // 端に着いたら（動かなくなったら）そこで止める
      if (!stepFrom(button, coarse)) return stop();
      timer = setTimeout(
        tick,
        repeats >= ACCELERATE_AFTER ? REPEAT_FAST_MS : REPEAT_INTERVAL_MS
      );
    };
    timer = setTimeout(tick, REPEAT_DELAY_MS);
  });

  /*
    指やカーソルが離れたら必ず止める。bubble しないイベントもあるので capture で拾う。

    ここに blur を入れてはいけない。ボタンを押すと
      pointerdown → 直前の入力欄の blur → ボタンの focus
    の順で発火するため、開始した直後のタイマーを自分で消してしまう
    （マウスだけリピートしない、という症状になる）。
  */
  for (const type of ["pointerup", "pointercancel", "pointerleave"]) {
    root.addEventListener(type, stop, true);
  }
  // タブ切り替えなどで押しっぱなしのまま離れた場合の保険
  window.addEventListener("blur", stop);

  /*
    キーボードでの実行（Enter / Space）は click として届く。
    ポインタ由来の click は pointerdown で処理済みなので二重に動かさない。
    キーボード由来かどうかは detail === 0 で見分ける。
  */
  root.addEventListener("click", (event) => {
    if (event.detail !== 0) return;
    const button = event.target.closest?.("[data-step-target]");
    if (button && !button.disabled) stepFrom(button, event.shiftKey);
  });
}

/** 連続呼び出しをまとめる。トレイリングのみ */
export function debounce(fn, wait) {
  let timer = null;
  const debounced = (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, wait);
  };
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return debounced;
}

/**
 * 次の描画フレームまで処理をまとめる。1フレームに何度状態が変わっても再描画は1回。
 */
export function rafThrottle(fn) {
  let handle = null;
  let lastArgs = null;
  return (...args) => {
    lastArgs = args;
    if (handle !== null) return;
    handle = requestAnimationFrame(() => {
      handle = null;
      fn(...lastArgs);
    });
  };
}
