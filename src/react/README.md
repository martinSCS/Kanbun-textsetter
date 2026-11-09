# React TSX

[简体中文](../../README.md) · [English](../../README.en.md) · [日本語](../../README.ja.md)

| 文件 / File / ファイル | 职责 / Purpose / 役割 |
| --- | --- |
| `index.ts` | 导出 `Kanbun`、`KanbunProps` / Public exports / 公開入口 |
| `Kanbun.tsx` | React 生命周期封装 / React lifecycle adapter / React ライフサイクルの管理 |

```tsx
import { Kanbun } from 'kanbun-typesetter/react';
import 'kanbun-typesetter/styles.css';

export function Reading({ text }: { text: string }) {
  return (
    <Kanbun
      source={text}
      spacingMode="aki"
      baseSpacing={1}
      shiftOverflowOkurigana
      style={{ height: 500, overflow: 'auto' }}
      autoColumnHeight
      onLayout={result => console.log(result.diagnostics)}
      onError={error => console.error(error)}
    />
  );
}
```

示例使用安装后的包入口。`source` 必填，全部 `LayoutOptions` 可直接作为 props；可传入容器属性和 `debug`。默认疏排、字间 1.0em、超长送假名右移。组件复用 `../html`，不接受 `children` 或 `dangerouslySetInnerHTML`。SSR 仅输出容器，客户端完成实际排版。卸载时自动清理。

Examples use the installed package entries. `source` is required; all `LayoutOptions` are accepted as direct props, alongside container attributes and `debug`. Defaults: aki layout, 1.0em base gap, overflow okurigana shifting enabled. The component uses `../html` and does not accept `children` or `dangerouslySetInnerHTML`. SSR outputs only the host; typesetting runs on the client. Cleanup is automatic on unmount.

サンプルはインストール済みパッケージの入口を使用します。`source` は必須で、すべての `LayoutOptions` を props として渡せます。コンテナー属性と `debug` にも対応します。既定値はアキ組・字間 1.0em・長い送り仮名の別行配置です。`../html` を利用し、`children` と `dangerouslySetInnerHTML` は受け付けません。SSR はコンテナーのみを出力し、組版はクライアント側で行います。アンマウント時に自動で後処理します。

React 18+ / 本次验证 React 19 / Tested with React 19 / React 19 で検証済み。

本地包入口 / Local package entry / ローカルパッケージの入口：`kanbun-typesetter/react`、`kanbun-typesetter/styles.css`。
