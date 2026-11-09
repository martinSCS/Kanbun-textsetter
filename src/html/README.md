# HTML renderer / HTML 渲染器 / HTML レンダラー

[简体中文](../../README.md) · [English](../../README.en.md) · [日本語](../../README.ja.md)

| 文件 / File / ファイル | 职责 / Purpose / 役割 |
| --- | --- |
| `index.ts` | 对外导出 / Public entry / 公開入口 |
| `renderer.ts` | DOM 渲染、复制、几何校验 / DOM rendering, copying, geometry checks / DOM 描画・コピー・配置検証 |
| `viewer.ts` | 自动更新、字体及尺寸监听、销毁 / Updates, font and size listeners, disposal / 更新・フォントとサイズの監視・破棄 |
| `styles.css` | 必需的排版样式 / Required rendering styles / 組版に必要な CSS |

```ts
import { KanbunViewer } from 'kanbun-typesetter/html';
import 'kanbun-typesetter/styles.css';

const viewer = new KanbunViewer(document.querySelector<HTMLElement>('#preview')!, {
  source: '濺(そそ)ギ[レ]淚ヲ',
});
viewer.setSource('天(てん)地');
viewer.setOptions({ kanjiFontSize: 40 });
// viewer.destroy();
```

低层 API / Lower-level API / 個別の API：

```ts
import { parseKanbun, layoutKanbun } from 'kanbun-typesetter';
import { renderKanbun } from 'kanbun-typesetter/html';

const document = parseKanbun('天(てん)地');
const layout = await layoutKanbun(document);
renderKanbun(layout, container);
```

示例使用安装后的包入口。页面销毁时调用 `viewer.destroy()`。HTML 入口不依赖 React，演示代码在 `examples/html`。

Examples use the installed package entries. Call `viewer.destroy()` when disposing the host. This entry does not depend on React. Demo code lives in `examples/html`.

サンプルはインストール済みパッケージの入口を使用します。使用終了時に `viewer.destroy()` を呼び出してください。React には依存しません。デモは `examples/html` にあります。

本地包入口 / Local package entry / ローカルパッケージの入口：`kanbun-typesetter/html`、`kanbun-typesetter/styles.css`。
