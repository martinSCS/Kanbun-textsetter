# 漢文訓読排版

**简体中文** · [English](https://github.com/martinSCS/Kanbun-textsetter/blob/main/README.en.md) · [日本語](https://github.com/martinSCS/Kanbun-textsetter/blob/main/README.ja.md)

用 TypeScript 实现的漢文訓読排版工具，提供独立 HTML 渲染器和 React TSX 组件。支持振假名、送假名、再读文字、复合返点、标点、连接线及多字联合注音。浏览器实测字体尺寸后计算布局，正文保留为可选择、可复制的文字。

## 安装

```sh
npm install kanbun-typesetter
```

[npm：kanbun-typesetter](https://www.npmjs.com/package/kanbun-typesetter) · 当前版本 `0.1.2`。

## 项目目录

```text
src/
  html/          HTML 渲染器、Viewer 控制器、排版样式
  react/         React TSX 组件，复用 HTML 渲染器
  parser/        标记文本解析、AST、序列化
  layout/        字体测量、排版规则、避让与坐标计算
  index.ts       核心及 HTML API 的统一入口，不引入 React
examples/
  html/          独立 HTML 演示页面的代码和界面样式
index.html       演示页面入口
```

[HTML 目录说明](https://github.com/martinSCS/Kanbun-textsetter/blob/main/src/html/README.md) · [React 目录说明](https://github.com/martinSCS/Kanbun-textsetter/blob/main/src/react/README.md)

## 本地运行

建议使用 Node.js 22.12 或更新版本；项目在 Node.js 24 下验证。

```sh
npm ci
npm run dev -- --port 5188 --strictPort
```

打开 本地演示页面 `http://127.0.0.1:5188/`。演示界面目前为中文；本文档提供三种语言。

```sh
npm run build           # 类型检查、演示页构建、库与类型声明
```

## 默认排版

- 疏排：`spacingMode: 'aki'`。
- 固定字间 `1.0em`：`baseSpacing: 1`，指相邻正文外框之间的额外间隔。
- 超长送假名右移另列：`shiftOverflowOkurigana: true`，末字底部对齐下一正文字符的字头。
- 行首开括号：`lineStartBracket` 可设为 `hang`（默认，正文首字齐头）、`half`（标点占半字位）或 `full`（标点占完整第一字位，正文从第二格开始）。
- 注音边缘交叠容差：`collisionTolerance: 0.05`，以主字 em 计；设为 `0` 恢复严格检查。

疏排保持正文字距，通过标注移位、利用现有列间空隙及必要的折返处理冲突。密排（`beta`）不预留基础字间，按约束局部增加间距。右移送假名不增加正文列距，只有确实需要时才触发；空间仍不足时保留内容和字号并报告诊断。

## HTML 渲染器

```ts
import { KanbunViewer } from 'kanbun-typesetter/html';
import 'kanbun-typesetter/styles.css';

const viewer = new KanbunViewer(document.querySelector<HTMLElement>('#preview')!, {
  source: '濺(そそ)ギ[レ]淚ヲ',
});

viewer.setSource('天(てん)地');
viewer.setOptions({ kanjiFontSize: 40 });
// 页面销毁时调用：viewer.destroy();
```

也可以独立调用 `parseKanbun()`、`layoutKanbun()` 与 `renderKanbun()`，分别控制解析、布局及渲染。见 [HTML 目录](https://github.com/martinSCS/Kanbun-textsetter/blob/main/src/html/README.md)。

## React 组件

```tsx
import { Kanbun } from 'kanbun-typesetter/react';
import 'kanbun-typesetter/styles.css';

export function Reading({ text }: { text: string }) {
  return <Kanbun source={text} className="reading" />;
}
```

所有排版参数都可以直接作为 JSX 属性传入，例如 `baseSpacing={1}`、`kanjiFontSize={40}`。组件支持参数更新、自动列高、`onLayout` / `onError` 回调和卸载清理。React 是可选依赖，只有 React 入口需要它。见 [React 目录说明](https://github.com/martinSCS/Kanbun-textsetter/blob/main/src/react/README.md)。

## 输入语法

| 写法 | 含义 |
| --- | --- |
| `天(てん)` | 振假名 |
| `濺(そそ)ギ` 或 `濺(そそ){ギ}` | 送假名 |
| `天[レ]`、`天[甲レ]` | 返点、复合返点 |
| `未(いま)ダ<ず>\|ンバ\|` | 再读振假名及送假名 |
| `斜光(しやくわう)` | 连续未标注汉字的联合注音 |
| `` `杳然`(えうぜん) `` | 显式指定联合注音范围 |
| `胡-蝶`、`胡‐蝶`、`胡―蝶` | 相邻正文字符之间的连接线 |
| 空格 / 换行 | 一个完整空白字位 / 分列 |

## 库入口与文档

`npm run build` 生成 `dist/lib`。可使用 `kanbun-typesetter`、`kanbun-typesetter/html`、`kanbun-typesetter/react` 和 `kanbun-typesetter/styles.css`。可通过 npm 安装，也可在开发时使用本地引用或链接。

当前提供 HTML 和 React 渲染方式。Canvas 版本尚未实现。字体测量和排版需要浏览器；React 服务端渲染只输出宿主容器，在客户端完成实际排版。

## 许可证

本项目采用 [MIT 许可证](https://github.com/martinSCS/Kanbun-textsetter/blob/main/LICENSE)。第三方材料的权利及许可不因本项目的许可证而改变。

## 鸣谢

感谢绯索卡（Phesoca）开发并公开[漢文HTML](https://github.com/untunt/kanbunHTML)及其[在线演示](https://phesoca.com/kanbun-html/)，为本项目的排版行为研究和样例验证提供参考。本项目在浏览器中测量其公开演示的文字框与字素坐标，记录为布局对照数据，用于验证部分注音定位行为。
