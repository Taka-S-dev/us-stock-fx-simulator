// utils/format.js
// 表示用の整形はすべてここに集約する。model は数値だけを返し、単位や記号は付けない。

const jpy = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });
const usd = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const plain = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 });

const sign = (n) => (n > 0 ? "+" : n < 0 ? "-" : "±");

/** 1,234 */
export const formatYen = (n) => jpy.format(Math.trunc(n));

/** +1,234 / -1,234 / ±0 */
export const formatSignedYen = (n) =>
  `${sign(n)}${jpy.format(Math.abs(Math.trunc(n)))}`;

/** 1,234.56 */
export const formatUsd = (n) => usd.format(n);

/** +1,234.56 / -1,234.56 */
export const formatSignedUsd = (n) => `${sign(n)}${usd.format(Math.abs(n))}`;

/** +1.23% / -1.23% */
export const formatSignedPct = (n) => `${sign(n)}${plain.format(Math.abs(n))}%`;

/** 12,345 のような桁区切り（株数など） */
export const formatCount = (n) => jpy.format(n);

/** 小数付きの素の数値 */
export const formatNumber = (n, digits = 2) =>
  new Intl.NumberFormat("ja-JP", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);

/**
 * 損益の符号から Bootstrap のテキスト色クラスを返す
 * @param {number} n
 */
export const toneClass = (n) =>
  n > 0 ? "text-success" : n < 0 ? "text-danger" : "text-secondary";

/**
 * 「2026/07/26 19:05」形式
 * @param {number|null} epochMs
 */
export function formatTimestamp(epochMs) {
  if (!Number.isFinite(epochMs)) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(epochMs));
}
