export const customPins = [];

export function addPin(fx, price, color = "blue") {
  // 重複チェック
  const exists = customPins.some(
    (p) => Math.abs(p.fx - fx) < 0.01 && Math.abs(p.price - price) < 0.01
  );
  if (exists) {
    alert("同じ位置にピンがすでに存在します。");
    return false;
  }

  customPins.push({ fx, price, showAnnotation: true });
  return true;
}

export function removePin(fx, price) {
  const idx = customPins.findIndex(
    (p) => Math.abs(p.fx - fx) < 0.01 && Math.abs(p.price - price) < 0.1
  );
  if (idx !== -1) customPins.splice(idx, 1);
}

export function getPins() {
  return customPins;
}

export function setPins(newPins) {
  customPins.length = 0;

  newPins.forEach((p) => {
    if (typeof p.fx !== "number" || typeof p.price !== "number") {
      console.warn("無効なピンが復元されました", p);
      return;
    }

    customPins.push({
      fx: p.fx,
      price: p.price,
      showAnnotation: p.showAnnotation ?? true,
      ...(p.color ? { color: p.color } : {}),
    });
  });
}
