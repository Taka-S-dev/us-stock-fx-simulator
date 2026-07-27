import { beforeEach, describe, expect, it } from "vitest";
import {
  createPreferences,
  createStateRepository,
  fromSnapshot,
  migrateSnapshot,
  SNAPSHOT_VERSION,
  toSnapshot,
} from "../public/model/persistence.js";
import { createInitialState } from "../public/model/store.js";
import { createPurchase, RANGE_LIMITS } from "../public/model/purchase.js";

/** localStorage 互換の最小実装（Storage API に沿って length / key を持つ） */
function createFakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
}

const sampleState = () =>
  createInitialState({
    purchases: [createPurchase({ price: 100, fx: 150, qty: 2 })],
    extraCostYen: 1200,
    pins: [{ id: "pin-1", fx: 160, price: 120, visible: false }],
  });

describe("toSnapshot", () => {
  it("UI都合の値（行ID・エラー・pristine）を保存しない", () => {
    const snapshot = toSnapshot(sampleState(), 1_700_000_000_000);

    expect(snapshot.version).toBe(SNAPSHOT_VERSION);
    expect(snapshot.savedAt).toBe(1_700_000_000_000);
    expect(snapshot.purchases).toEqual([{ price: 100, fx: 150, qty: 2 }]);
    expect(Object.keys(snapshot.purchases[0])).toEqual(["price", "fx", "qty"]);
    expect(snapshot.pins).toEqual([{ fx: 160, price: 120, visible: false }]);
    expect(snapshot.extraCostYen).toBe(1200);
  });
});

describe("migrateSnapshot", () => {
  it("旧形式（範囲がトップレベル）を現行版へ移行する", () => {
    const migrated = migrateSnapshot({
      version: "1.0.0",
      timestamp: 123,
      fxMin: 130,
      fxMax: 150,
      priceMin: 100,
      priceMax: 300,
      purchases: [{ price: 100, fx: 150, qty: 2 }],
      pins: [],
    });

    expect(migrated.version).toBe(SNAPSHOT_VERSION);
    expect(migrated.view).toEqual({
      fxMin: 130,
      fxMax: 150,
      priceMin: 100,
      priceMax: 300,
    });
    expect(migrated.savedAt).toBe(123);
  });

  it("現行版はそのまま返す", () => {
    const snapshot = toSnapshot(sampleState());
    expect(migrateSnapshot(snapshot)).toBe(snapshot);
  });
});

describe("fromSnapshot", () => {
  it("旧形式の保存データを状態に復元できる", () => {
    const { patch, errors } = fromSnapshot({
      fxMin: 130,
      fxMax: 150,
      priceMin: 100,
      priceMax: 300,
      purchases: [{ price: 100, fx: 150, qty: 2 }],
      pins: [{ fx: 160, price: 120 }],
    });

    expect(errors).toEqual([]);
    expect(patch.purchases).toHaveLength(1);
    expect(patch.view).toMatchObject({ fxMin: 130, fxMax: 150 });
    expect(patch.pins[0]).toMatchObject({ fx: 160, price: 120, visible: true });
  });

  it("高価格帯の保存データもそのまま復元できる", () => {
    const { patch } = fromSnapshot({
      fxMin: 130,
      fxMax: 150,
      priceMin: 1000,
      priceMax: 3000,
      purchases: [{ price: 100, fx: 150, qty: 2 }],
    });
    expect(patch.view.priceMin).toBe(1000);
    expect(patch.view.priceMax).toBe(3000);
  });

  it("上限を超える表示範囲は許容値に丸める", () => {
    const { patch } = fromSnapshot({
      fxMin: 130,
      fxMax: 150,
      priceMin: 1,
      priceMax: 99_999,
      purchases: [{ price: 100, fx: 150, qty: 2 }],
    });
    expect(patch.view.priceMax).toBe(RANGE_LIMITS.price.max);
  });

  it("購入情報が全滅した保存データは復元しない", () => {
    const { patch, errors } = fromSnapshot({
      purchases: [{ price: -1, fx: 150, qty: 2 }],
    });
    expect(patch).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });

  it("壊れた入力でも例外にならない", () => {
    expect(fromSnapshot(null).patch).toBeNull();
  });
});

describe("createStateRepository", () => {
  let storage;
  let repository;

  beforeEach(() => {
    storage = createFakeStorage();
    repository = createStateRepository(storage);
  });

  it("保存・一覧・読み込み・削除ができる", () => {
    expect(repository.save("設定A", toSnapshot(sampleState())).ok).toBe(true);
    expect(repository.save("設定B", toSnapshot(sampleState())).ok).toBe(true);

    expect(repository.list()).toEqual(["設定A", "設定B"]);
    expect(repository.load("設定A").purchases).toHaveLength(1);

    repository.remove("設定A");
    expect(repository.list()).toEqual(["設定B"]);
  });

  it("アプリ以外のキーは一覧に含めない", () => {
    storage.setItem("unrelated", "1");
    repository.save("設定A", toSnapshot(sampleState()));
    expect(repository.list()).toEqual(["設定A"]);
  });

  it("空の保存名は拒否する", () => {
    expect(repository.save("   ", {}).ok).toBe(false);
    expect(repository.list()).toEqual([]);
  });

  it("保存できない環境では理由付きで失敗を返す", () => {
    const failing = createStateRepository({
      ...createFakeStorage(),
      setItem: () => {
        const error = new Error("exceeded the quota");
        error.name = "QuotaExceededError";
        throw error;
      },
    });
    const result = failing.save("設定A", {});
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("容量");
  });

  it("存在しない保存名は null を返す", () => {
    expect(repository.load("ない")).toBeNull();
  });
});

describe("createPreferences", () => {
  it("テーマを保存・復元する", () => {
    const preferences = createPreferences(createFakeStorage());
    expect(preferences.getTheme()).toBe("auto");
    preferences.setTheme("dark");
    expect(preferences.getTheme()).toBe("dark");
  });

  it("不正なテーマ値は auto に落とす", () => {
    const preferences = createPreferences(
      createFakeStorage({ "pref::theme": "rainbow" })
    );
    expect(preferences.getTheme()).toBe("auto");
  });

  it("為替キャッシュを保存・復元する", () => {
    const preferences = createPreferences(createFakeStorage());
    expect(preferences.getFxCache()).toBeNull();
    preferences.setFxCache(155.5, 1_700_000_000_000);
    expect(preferences.getFxCache()).toEqual({
      value: 155.5,
      fetchedAt: 1_700_000_000_000,
    });
  });

  it("壊れたキャッシュは無視する", () => {
    const preferences = createPreferences(
      createFakeStorage({ "cache::fxRate": "{壊れ" })
    );
    expect(preferences.getFxCache()).toBeNull();
  });
});
