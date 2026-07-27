// main.js — エントリーポイント
import { startApp } from "./controller/app.js";
import { showToast } from "./view/toast.js";

try {
  startApp();
} catch (error) {
  console.error("アプリの初期化に失敗しました", error);
  showToast(
    "アプリの初期化に失敗しました。ページを再読み込みしてください",
    "error"
  );
}
