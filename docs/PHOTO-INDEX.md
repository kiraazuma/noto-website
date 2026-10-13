# 写真追加・調整メモ

既定のkinetic INDEXの朝市・能登のみ、fine pointerのホバーで写真化します。
既存の円形オレンジが文字全体を満たした瞬間、ワンショットと写真へのクロスフェードを同時に開始します。
写真のクロスフェードは150ms。A/B/Cとも写真は最初のモーションと開始時刻を共有し、両文字が同時に切り替わります。
Cの文字ごとのモーション遅延は維持します。70%などの進行率による待機や固定setTimeoutによる切替はありません。
fillモードではワンショットがないため円形塗りの完了後に写真化します。
off、タッチ、キーボードフォーカス、prefers-reduced-motionでは写真化しません。
画像はkinetic INDEXの登場開始時に非同期で事前デコードし、成功した結果を再利用します。
復帰中・画像準備中に円形塗りが満ちてもホバーを保持し、INDEX静止通知と画像準備完了の両方が揃うとワンショット＋150msの写真切替を開始します。
デコード失敗は永続キャッシュせず、次回ホバーで再試行します。離脱・クリック・別項目オープンで保留処理を解除します。

## クリッピング対策

line-height:1と詰めた字間では、実際の字形が文字ボックス右端を超えます（1440幅の検証時、登の字形右端414.7pxに対し旧ボックス約396.5px）。
.kx-chに描画用paddingを設け、同量の負marginで配置寸法を維持しています。写真は文字本体のbackground-clip:textで描画し、padding-box全域にcoverで敷くことで字形の端まで覆います。
INDEX・詳細の字形全体が描画ボックスに収まること、5語の配置・寸法が変更前と一致することを検証します。

| 文字 / 詳細内の順序 | 元画像 | アセット |
|---|---|---|
| 朝 / 朝市1枚目 | S__42852400.jpg | assets/photos/asaichi-stone.jpg |
| 市 / 朝市2枚目 | S__42852401.jpg | assets/photos/asaichi-indoor.jpg |
| 能 / 能登1枚目（珠洲市宝立町） | S__42852412.jpg | assets/photos/suzu-horyu.jpg |
| 登 / 能登2枚目（輪島市門前町黒島） | S__42852413.jpg | assets/photos/wajima-kuroshima.jpg |

元JPEGを加工せずコピーしています。詳細内はwidth:100% / height:autoでトリミングしません。

## 調整箇所

- 文字内の位置: styles/site.css末尾の各文字の `--kx-photo-position`。
- 写真クロスフェードの長さ: scripts/cursor.jsの `CUR.photo.duration`（既定0.15秒）。
- 文字内の写真: index.htmlの `.kx-ch[data-photo]`。cursor.jsがこのURLを読み込みます。
- 詳細の幅・写真間隔・本文からの距離: `.documentary-photos` の `--photo-width / --photo-gap / --photo-top`。
- セクション別の調整: `.documentary-photos--asaichi / --noto` に上記変数を設定。
- キャプション: index.htmlのfigure内figcaption、CSSの `.documentary-photo figcaption`。
- 写真表示順序: 各詳細の `.documentary-photos` 内figureの順序。

## 確認

`npm.cmd run dev` 後、`http://localhost:5173/tools/photo-hover-check.html` を開く。
実ブラウザのImage.decode / Web Animationsと既存のmanualクロックで、合成したpointer/clickイベントを検証します。
画像待機中の離脱、途中離脱、クリック前解除、開閉後の再ホバー、touch/keyboard/blur、対象外3語を含みます。
`?mask=noto` で検証後の写真マスクプレビューを能登へ切り替えられます。
実マウス入力の連続操作とSafari実機はこのチェックの対象外です。
`/tools/photo-hover-live.html?auto=1` は実時間のrAF・Web Animations・コンポジットを動かす追加チェックです。合成イベントと実マウスのイベント数を区別します。

PC・スマホのkinetic詳細、classicの朝市、glassの能登も表示確認済み。
写真位置・余白は初期値です。次の調整では、INDEXで写真の主題がどの画線に出るか、詳細の写真幅と本文との間隔を優先すると比較しやすくなります。

## 今回のバグ修正の検証記録

合成イベントによる回帰チェック392項目、JavaScript構文チェック、git diff --checkは通過。A/B/C/random、画像待機・デコード失敗後の再試行、復帰中のホバー保持とキャンセル、150msクロスフェード、詳細とINDEXの字形描画領域、リサイズを検証。5語の位置・サイズは変更前と一致。

実マウス入力および実時間描画の追加検証では、検証用のアプリ内ブラウザがクラッシュして完了できていない。実機・外部ブラウザでの最終確認は、ユーザーの指示によりプッシュ後に行う。ライブ検証用ページも残している。

## 写真マスクの輪郭修正

疑似要素のcontent:attr(data-glyph)による複製字形を廃止しました。元の.kx-ch自身に写真とオレンジの2背景を合成し、登録済みCSS数値プロパティ--kx-photo-mixをWAAPIで0→1へ150msで動かします。写真用背景と色用背景が同じ1個の字形にクリップされるため、別の行ボックス・ベースライン・リサイズ補正はありません。写真の切り抜き位置は従来の--kx-photo-positionで調整できます。配置寸法・フォント・描画padding・A/B/Cのtransformは変更していません。

検証: 更新した回帰チェック392項目が通過。/tools/photo-mask-alignment.htmlでwidth=1024/1280/1440/1920、mask=asaichi/notoを比較できます。paint=solidは写真を比較用のオレンジ単色に置換し、photo=offと同じ輪郭になることを確認するモードです。stage=shot/return/resize/open、motion=a/b/cも指定できます。

静止時の1280/1440/1920pxはオレンジ文字と単色写真マスクの撮影画像が完全一致。1024pxはJPEG圧縮の色差が最大9/255で、位置ずれなし。回転時の画像差は輪郭1px以内のラスター描画差。開く途中の別々の撮影にはフレーム・圧縮差があるため画像の完全一致は保証せず、両語について静止・C回転・復帰・リサイズ・開く途中の全要素の座標、寸法、font、letter-spacing、padding、margin、transformを照合し一致を確認しました。復帰後・リサイズ後の撮影画像も完全一致。

今回の検証環境はアプリ内Chromium、DPR 1です。接続されたChrome/Safariはなく、SafariとRetina実機の確認は未実施です。