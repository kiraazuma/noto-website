# スマホHEROの見切れ補正

旧MOB.RESTの上端-26／下端+8に短画面SQZが加算され、390×664ではNOTOが約67px、HITOTSUBASHIが約25px見切れていた。

文字の幅・フォントサイズは変更せず、実測inkの高さの1.8%だけ上下端を超える位置へ、SQZの符号付き移動量で合わせる。NOTOは `SQ.t = inkTop + .018 * inkHeight`、HITOTSUBASHIは `SQ.b = MH - inkBottom + .018 * inkHeight`。既存の上下アンカーとviewスケールを通すので端基準が保たれる。左右の幅は従来のまま、余剰幅を左右等分。タイトルと日付は各文字と同じ移動量を使い、既存のLiquid Objectソルバーで余白を再計算する。

オープニング中は従来の100svhとMOB.OPEN／openingBandsを使用。タイムライン終了後のスマホHEROだけstageの高さをvisualViewport.heightに合わせ、visualViewport.resize／ResizeObserverで再計算する。ズーム時はこの再配置を行わない。フォント読み込み後は既存のloadingdone処理が字形を再測定する。PCにはこの高さ変更を適用しない。

| 表示領域 | NOTO上端の見切れ | HITOTSUBASHI下端の見切れ |
|---|---:|---:|
|375×667|3.55px|1.80px|
|390×664|3.70px|1.87px|
|390×844|3.70px|1.87px|
|430×932|4.07px|2.06px|

実測は字形のink boxと現在のview/transformから算出。DPRはCSS座標に関与しない。

検証ページ: `/tools/mobile-hero-check.html?width=390&height=664&time=3.5`。time=1.9でオープニング終了直前、2.85でHERO遷移、3.5で静止。resizeを付けると高さを+180して戻す。barsを付けると初期100svhを表示領域より180px短くするモデル（実際のSafariではない）。旧版との4サイズのオープニング比較でバンド、文字座標、フォントが一致。静止時のフォントサイズも旧版と同じ。664→844→664のリサイズで最終配置が一致。Liquid Objectとオレンジ情報の目視確認、構文・diffチェックを実施。

環境はWindowsのアプリ内Chromium（DPR 1）。iPhone SafariのブラウザUI・セーフエリア・Retina実機での検証は未実施。
