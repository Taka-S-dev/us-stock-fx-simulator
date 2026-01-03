/**
 * アプリケーションのテキストコンテンツを管理するモジュール
 */

export const APP_CONTENT = {
  // アプリ概要
  overview: {
    title: "ℹ️ アプリの概要・使い方",
    content: `
      <div class="alert alert-info">
        <h5>📊 米国株 × 為替 損益分岐シミュレーター</h5>
        <p class="mb-0">
          このアプリは複数回に分けて購入した米国株の損益を「株価 × 為替レート」の2軸でシミュレートするツールです。
        </p>
      </div>
      <div class="mt-3">
        <h6>🎯 主な機能</h6>
        <ul>
          <li>複数回の購入履歴を入力</li>
          <li>株価と為替レートの範囲を設定</li>
          <li>損益分岐グラフをリアルタイム表示</li>
          <li>ピン機能で特定のポイントをマーク</li>
          <li>設定の保存・復元</li>
        </ul>
      </div>
      <div class="mt-3">
        <h6>📱 使い方</h6>
        <ol>
          <li>「📥 購入情報」で購入履歴を入力</li>
          <li>「📈 表示範囲」でグラフの表示範囲を調整</li>
          <li>グラフ上で損益分岐を確認</li>
          <li>「📍 ピン追加」で重要なポイントをマーク</li>
      </div>
		<div class="mt-3">
			<h6>📞 お問い合わせ</h6>
			<p class="mb-0">
			使ってみてのご意見や改善要望など、ぜひお気軽にお寄せください！<br>
			<a
				href="https://forms.gle/Af6RSyhgZY35cPH2A"
				target="_blank"
				rel="noopener"
				>ご意見・ご要望（Googleフォーム）</a
			>
			</p>
		</div>
    `,
  },

  // 免責事項
  disclaimer: {
    title: "⚠️ 免責事項",
    content: `
      <div class="alert alert-warning">
        <h5>📋 重要なお知らせ</h5>
        <p class="mb-0">
          投資判断は自己責任でお願いします。本アプリは情報提供目的です。
        </p>
      </div>
      <div class="mt-3">
        <h6>🔍 免責事項</h6>
        <ul>
          <li>本アプリは投資助言ではありません</li>
          <li>為替レートは参考値であり、実際の取引価格とは異なる場合があります</li>
          <li>過去のデータは将来の結果を保証するものではありません</li>
          <li>投資に関する決定は、必ずご自身で判断してください</li>
          <li>本アプリの利用により生じた損害について、一切の責任を負いかねます</li>
          <li>表示される損益・損益率には、手数料・税金・為替スプレッド等のコストは含まれていません（必要に応じて平均取得価額〈円〉を手動入力して調整してください）</li>
        </ul>
      </div>
    `,
  },

  // 簡潔な概要（PC用アコーディオン）
  overviewSimple: {
    title: "ℹ️ アプリの概要・使い方",
    content: `
      このアプリは複数回に分けて購入した米国株の損益を「株価 × 為替レート」の2軸でシミュレートするツールです。
    `,
  },
};

/**
 * 指定されたコンテンツタイプのHTMLを取得
 * @param {string} type - コンテンツタイプ ('overview', 'disclaimer', 'overviewSimple')
 * @returns {Object} { title, content }
 */
export function getContent(type) {
  return APP_CONTENT[type] || { title: "", content: "" };
}
