# リンク一覧

外部ウェブリンクは新しいタブで開きます（`target="_blank" rel="noopener noreferrer"`）。
メールリンクは標準メールアプリで新規メールを開きます。

## お問い合わせ

| 場所 | 宛先 | 件名 |
|---|---|---|
| フッター「CONTACT ↗」 | hit.fornoto@gmail.com | 出張輪島朝市へのお問い合わせ |
| 04 応援「協賛に関するお問い合わせ ↗」 | hit.fornoto@gmail.com | 出張輪島朝市 協賛について |

## Official

| 名前 | URL | 状態 |
|---|---|---|
| 輪島朝市公式 | https://wajima-asaichi.info/ | 接続済み |
| 輪島朝市を応援する会 | https://s-wajima-asaichi.com/ | 接続済み |
| 公式オンラインストア | https://wajima2024.stores.jp/ | 接続済み |

## Social（表示：@hit_asaichi）

| 名前 | URL | 状態 |
|---|---|---|
| X | https://x.com/hit_asaichi | 接続済み（元サイトのリンクで確認） |
| Instagram | https://www.instagram.com/hit_asaichi | 接続済み（元サイトのリンクから共有用パラメータ `?stkn=…&utm_source=qr` を除いたもの） |

## Crowdfunding

| 名前 | URL | 状態 |
|---|---|---|
| CAMPFIRE 支援ページ | **URL 未確定** | 押せない文字表示（「URL未設定」と表示）。元サイトでもリンク先は `#` のままでした |

### CAMPFIRE の URL が決まったら（2か所）

1. **04 応援の中**（`index.html` で `cta-na` を検索）

   ```html
   <p class="cta-na">CAMPFIRE 支援ページ<small>URL未設定</small></p>
   ```
   を次に置き換え：
   ```html
   <a class="cta-link" href="https://camp-fire.jp/projects/（決まったURL）" target="_blank" rel="noopener noreferrer">CAMPFIRE 支援ページ<b aria-hidden="true">↗</b><span class="sr">（新しいタブで開きます）</span></a>
   ```
   見た目（オレンジの矢印・下線のホバー）は `styles/site.css` に `.cta-link` として用意済みです。

2. **フッターの SUPPORT 欄**（`URL未設定` を検索）

   ```html
   <li><span class="na">クラウドファンディング<small>URL未設定</small></span></li>
   ```
   を次に置き換え：
   ```html
   <li><a class="ext" href="（決まったURL）" target="_blank" rel="noopener noreferrer">クラウドファンディング<i class="ar" aria-hidden="true">↗</i><span class="sr">（新しいタブで開きます）</span></a></li>
   ```

## サイト内リンク（ページ内の移動）

| 場所 | 動作 |
|---|---|
| 概要画面 右下「INDEX ↓」 | INDEX の先頭へスクロール |
| INDEX 01〜05 の各行 | その行がその場で開く（もう一度押す／右上の CLOSE／Esc キーで閉じる。同時に開くのは1つだけ） |
| フッター SITE（朝市・催し・能登・応援・案内） | INDEX までスクロールして、該当の行を開く |
| フッター SUPPORT「企業・団体協賛」 | 04 応援を開く |
| フッター「TOP ↑」 | ページ先頭（概要画面）へ戻る。開いている行は閉じる |
| Hero 右上「↺」 | オープニングをもう一度再生 |

アドレスに `#asaichi` `#program` `#noto` `#support` `#info` を付けて開くと、オープニングを飛ばしてその行が開いた状態で表示されます（例：`https://kiraazuma.github.io/noto-website/#noto`。GitHub Pages を有効にした場合）。

## 参照元

- 文言と情報の出典：https://deluxe-peony-99b583.netlify.app/
- 元サイトにあった協賛問い合わせメール `noto.hitotsubashi@example.com` はダミーのため使用せず、上記のアドレスに統一しています。
