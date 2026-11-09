# 漢文訓読組版

[简体中文](README.md) · [English](README.en.md) · **日本語**

TypeScript による漢文訓読組版ツールです。独立した HTML レンダラーと React TSX コンポーネントを提供します。振り仮名、送り仮名、再読文字の注記、複合返り点、句読点、つなぎ線、熟語単位のルビに対応します。ブラウザーで文字の寸法を測定して配置を計算し、選択・コピーできるテキストとして表示します。

## インストール

```sh
npm install kanbun-typesetter
```

[npm: kanbun-typesetter](https://www.npmjs.com/package/kanbun-typesetter) · 現在のバージョン：`0.1.1`。

## ディレクトリ構成

```text
src/
  html/          HTML レンダラー、Viewer、組版用 CSS
  react/         HTML レンダラーを利用する React TSX コンポーネント
  parser/        記法の解析、AST、シリアライズ
  layout/        フォント測定、組版規則、衝突回避、座標計算
  index.ts       コアと HTML API の入口。React は読み込まない
examples/
  html/          独立 HTML デモのコードと画面用 CSS
index.html       デモの入口
```

[HTML ディレクトリ](src/html/README.md) · [React ディレクトリ](src/react/README.md)

## ローカルで実行

Node.js 22.12 以降を使用してください。検証環境は Node.js 24 です。

```sh
npm ci
npm run dev -- --port 5188 --strictPort
```

[ローカルデモ](http://127.0.0.1:5188/)を開きます。現在のデモ画面は中国語です。README は 3 言語で用意しています。

```sh
npm run build           # 型検査、デモ、ライブラリーと型定義の生成
```

## 既定値と組み方

- アキ組：`spacingMode: 'aki'`。
- 親文字のボックス間のアキは `1.0em`：`baseSpacing: 1`。
- 長い送り仮名の別行配置を有効化：`shiftOverflowOkurigana: true`。必要な場合に送り仮名を右側の注記行へ移し、末尾の下端を次の親文字の上端に合わせます。
- 行頭の始め括弧：`lineStartBracket` は `hang`（既定・親文字の先頭をそろえる）、`half`（括弧が半角分を占める）、`full`（括弧を最初の全角字位に配置し、本文を次の字位から始める）を指定できます。
- 注記ボックスの端で許容する浅い重なり：`collisionTolerance: 0.05`。親文字の em 単位です。`0` で厳密な判定に戻ります。

アキ組では親文字の字間を固定し、注記の移動、既存の行間の利用、必要に応じた折り返しで衝突を回避します。ベタ組（`beta`）は基本字間を設けず、必要な箇所だけ間隔を広げます。送り仮名を別行に移しても本文の行送りは広げません。解消できない場合は文字と文字サイズを保持して診断を返します。

## HTML レンダラー

```ts
import { KanbunViewer } from 'kanbun-typesetter/html';
import 'kanbun-typesetter/styles.css';

const viewer = new KanbunViewer(document.querySelector<HTMLElement>('#preview')!, {
  source: '濺(そそ)ギ[レ]淚ヲ',
});
viewer.setSource('天(てん)地');
viewer.setOptions({ kanjiFontSize: 40 });
// ページなどを破棄するとき：viewer.destroy();
```

解析・配置・描画を個別に制御する場合は `parseKanbun()`、`layoutKanbun()`、`renderKanbun()` を使用します。[HTML ディレクトリ](src/html/README.md)を参照してください。

## React コンポーネント

```tsx
import { Kanbun } from 'kanbun-typesetter/react';
import 'kanbun-typesetter/styles.css';

export function Reading({ text }: { text: string }) {
  return <Kanbun source={text} className="reading" />;
}
```

組版設定は `baseSpacing={1}`、`kanjiFontSize={40}` のように JSX の props として渡します。内容・設定の更新、自動列高、`onLayout` / `onError`、アンマウント時の後処理に対応します。React は任意依存で、React 用の入口を使用する場合だけ必要です。[React ディレクトリ](src/react/README.md)を参照してください。

## 入力記法

| 記法 | 意味 |
| --- | --- |
| `天(てん)` | 振り仮名 |
| `濺(そそ)ギ` または `濺(そそ){ギ}` | 送り仮名 |
| `天[レ]`、`天[甲レ]` | 返り点、複合返り点 |
| `未(いま)ダ<ず>\|ンバ\|` | 再読時の振り仮名・送り仮名 |
| `斜光(しやくわう)` | 直前の連続した未注記漢字への熟語ルビ |
| `` `杳然`(えうぜん) `` | ルビの対象範囲を明示 |
| `胡-蝶`、`胡‐蝶`、`胡―蝶` | 隣り合う親文字間のつなぎ線 |
| 空白 / 改行 | 全角 1 字分の空白字位 / 列の区切り |

## パッケージの入口と資料

`npm run build` で `dist/lib` を生成します。`kanbun-typesetter`、`kanbun-typesetter/html`、`kanbun-typesetter/react`、`kanbun-typesetter/styles.css` を使用できます。npm からインストールでき、開発時はローカル参照やリンクでも利用できます。

HTML と React に対応しており、Canvas 版は未実装です。フォント測定と配置にはブラウザーが必要です。React の SSR はコンテナーのみを出力し、実際の組版はクライアント側で行います。

## ライセンス

本プロジェクトは [MIT ライセンス](LICENSE)で公開しています。第三者の資料に関する権利とライセンスは変更されません。

## 謝辞

[漢文HTML](https://github.com/untunt/kanbunHTML)と[オンラインデモ](https://phesoca.com/kanbun-html/)を開発・公開された Phesoca 氏に感謝いたします。公開された実装と用例は、本プロジェクトの組版動作の調査と用例の検証において参考となりました。公開デモの文字ボックスと書記素の座標をブラウザーで計測し、一部の注記位置を検証するための比較データとして記録しています。
