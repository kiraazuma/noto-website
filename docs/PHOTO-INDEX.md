# 写真追加・調整メモ

既定のkinetic INDEXの朝市・能登のみ、fine pointerのホバーで写真化します。
既存の円形オレンジが文字全体を満たした瞬間、ワンショットと写真へのクロスフェードを同時に開始します。
写真のクロスフェードは150ms。A/B/Cとも写真は最初のモーションと開始時刻を共有し、両文字が同時に切り替わります。
Cの文字ごとのモーション遅延は維持します。70%などの進行率による待機や固定setTimeoutによる切替はありません。
fillモードではワンショットがないため円形塗りの完了後に写真化します。
off、タッチ、キーボードフォーカス、prefers-reduced-motionでは写真化しません。
画像のデコードに失敗した場合やモーション終了までに画像が届かない場合は、既存のオレンジ表示を保ちます。遅れて終了後に写真化することはありません。

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

PC・スマホのkinetic詳細、classicの朝市、glassの能登も表示確認済み。
写真位置・余白は初期値です。次の調整では、INDEXで写真の主題がどの画線に出るか、詳細の写真幅と本文との間隔を優先すると比較しやすくなります。
