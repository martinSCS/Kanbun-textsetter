# Kanbun typesetter

[简体中文](https://github.com/martinSCS/Kanbun-textsetter/blob/main/README.md) · **English** · [日本語](https://github.com/martinSCS/Kanbun-textsetter/blob/main/README.ja.md)

A TypeScript typesetter for annotated kanbun, with a standalone HTML renderer and a React TSX component. It handles furigana, okurigana, rereading annotations, compound return marks, punctuation, connecting strokes, and grouped ruby. Layout uses browser-measured text dimensions. The output remains selectable and copyable text.

## Install

```sh
npm install kanbun-typesetter
```

[npm: kanbun-typesetter](https://www.npmjs.com/package/kanbun-typesetter) · Current version: `0.1.2`.

## Directory layout

```text
src/
  html/          HTML renderer, viewer controller, and rendering CSS
  react/         React TSX adapter using the HTML renderer
  parser/        Markup parser, AST, and serialization
  layout/        Font measurement, layout rules, collision handling, coordinates
  index.ts       Core and HTML API entry; does not import React
examples/
  html/          Standalone demo code and interface CSS
index.html       Demo entry page
```

[HTML directory](https://github.com/martinSCS/Kanbun-textsetter/blob/main/src/html/README.md) · [React directory](https://github.com/martinSCS/Kanbun-textsetter/blob/main/src/react/README.md)

## Run locally

Use Node.js 22.12 or newer; the project was validated with Node.js 24.

```sh
npm ci
npm run dev -- --port 5188 --strictPort
```

Open the local demo at `http://127.0.0.1:5188/`. The demo interface is currently in Chinese; the README is available in three languages.

```sh
npm run build           # Type checking, demo build, library and declarations
```

## Defaults and spacing

- Fixed-spacing layout: `spacingMode: 'aki'`.
- A `1.0em` gap between adjacent main-character boxes: `baseSpacing: 1`.
- Overflowing okurigana may move to a separate annotation track: `shiftOverflowOkurigana: true`. Its bottom aligns with the next main character's top.
- Opening brackets at column heads: `lineStartBracket` accepts `hang` (default; align the first main character), `half` (half-character advance), or `full` (a complete first grid slot; main text starts in the second slot).
- Shallow annotation-frame overlap tolerance: `collisionTolerance: 0.05`, in main-font em. Set it to `0` for strict checking.

Aki preserves main-character spacing and resolves conflicts by repositioning annotations, using existing inter-column space, and wrapping when necessary. Compact layout (`beta`) starts with no base gap and adds local spacing as required. Moving okurigana does not widen the main column pitch and is attempted only when necessary. Unresolved constraints produce diagnostics while retaining the text and font size.

## HTML renderer

```ts
import { KanbunViewer } from 'kanbun-typesetter/html';
import 'kanbun-typesetter/styles.css';

const viewer = new KanbunViewer(document.querySelector<HTMLElement>('#preview')!, {
  source: '濺(そそ)ギ[レ]淚ヲ',
});
viewer.setSource('天(てん)地');
viewer.setOptions({ kanjiFontSize: 40 });
// When the page/component is disposed: viewer.destroy();
```

For lower-level control, use `parseKanbun()`, `layoutKanbun()`, and `renderKanbun()` separately. See the [HTML directory](https://github.com/martinSCS/Kanbun-textsetter/blob/main/src/html/README.md).

## React component

```tsx
import { Kanbun } from 'kanbun-typesetter/react';
import 'kanbun-typesetter/styles.css';

export function Reading({ text }: { text: string }) {
  return <Kanbun source={text} className="reading" />;
}
```

Pass layout options directly as JSX props, such as `baseSpacing={1}` or `kanjiFontSize={40}`. The component handles updates, automatic column height, `onLayout` / `onError` callbacks, and unmount cleanup. React is optional and only required for the React entry. See the [React directory](https://github.com/martinSCS/Kanbun-textsetter/blob/main/src/react/README.md).

## Markup

| Input | Meaning |
| --- | --- |
| `天(てん)` | Furigana |
| `濺(そそ)ギ` or `濺(そそ){ギ}` | Okurigana |
| `天[レ]`, `天[甲レ]` | Return marks, including compound marks |
| `未(いま)ダ<ず>\|ンバ\|` | Rereading furigana and okurigana |
| `斜光(しやくわう)` | Ruby over contiguous, previously unannotated Han characters |
| `` `杳然`(えうぜん) `` | Explicit grouped-ruby scope |
| `胡-蝶`, `胡‐蝶`, `胡―蝶` | Connecting stroke between adjacent main characters |
| Space / newline | One full blank character slot / a new column |

## Package entries and documentation

`npm run build` writes the library to `dist/lib`. Use `kanbun-typesetter`, `kanbun-typesetter/html`, `kanbun-typesetter/react`, and `kanbun-typesetter/styles.css`. The package is available on npm and can also be used through local references or links during development.

HTML and React are implemented; Canvas is not yet implemented. Font measurement and layout require a browser. React SSR outputs a host container, with actual typesetting performed on the client.

## License

This project is licensed under the [MIT License](https://github.com/martinSCS/Kanbun-textsetter/blob/main/LICENSE). Third-party materials retain their respective rights and licenses.

## Acknowledgments

Thanks to Phesoca for creating and sharing [kanbunHTML](https://github.com/untunt/kanbunHTML) and its [online demo](https://phesoca.com/kanbun-html/). The implementation and examples informed this project's study of typesetting behavior. We measured text boxes and grapheme coordinates in the public demo using browsers and recorded these observations as comparison data for validating selected annotation positions.
