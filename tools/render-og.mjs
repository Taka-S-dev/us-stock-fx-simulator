// tools/render-og.mjs
// tools/og-card.html を 1200×630 で描画して public/og.png を作り直す。
//
//   npm run og
//
// 依存は増やさない方針なので、Playwright 等は使わず、入っているブラウザを
// ヘッドレスで呼ぶだけにしている。見つからない場合は CHROME_PATH で渡す。

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "tools/og-card.html");
const output = resolve(root, "public/og.png");

/** 環境ごとの標準的な配置。先に見つかったものを使う */
const CANDIDATES = {
  win32: [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  ],
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ],
  linux: [
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ],
};

function findBrowser() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const found = (CANDIDATES[process.platform] ?? []).find((p) => existsSync(p));
  if (found) return found;

  throw new Error(
    "Chrome / Edge が見つかりませんでした。CHROME_PATH に実行ファイルを指定してください。"
  );
}

const browser = findBrowser();

/*
  --force-device-scale-factor=1 が無いと、端末の拡大率がそのまま画像の
  大きさに乗って 1200×630 にならない。
  --virtual-time-budget は、canvas を描く処理が終わるのを待つため。
*/
execFileSync(
  browser,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--window-size=1200,630",
    "--virtual-time-budget=10000",
    `--screenshot=${output}`,
    pathToFileURL(source).href,
  ],
  { stdio: "inherit" }
);

console.log(`public/og.png を書き出しました（${browser}）`);
