import { chromium, webkit } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const referenceUrl = 'https://phesoca.com/kanbun-html/';
const results = [];
for (const engine of ['chromium', 'webkit']) {
const browser = await (engine === 'chromium' ? chromium.launch({ channel: 'chrome', headless: true }) : webkit.launch({ headless: true }));
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
await page.goto(referenceUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.locator('#kanbun-text').waitFor();
await page.locator('input[type="number"]').first().fill('32');
await page.locator('input[type="number"]').first().dispatchEvent('change');
await page.locator('input[type="number"]').nth(1).fill('12');
await page.locator('input[type="number"]').nth(1).dispatchEvent('change');
// Isolate font differences; do not alter the reference's positioning rules.
await page.addStyleTag({ content: '#sample, #sample * { font-family: "Hiragino Mincho ProN", serif !important; font-weight: 400 !important; }' });
const samples = [
  { id: 'group-short', source: '‘桃花’(とうくわ)' },
  { id: 'group-okurigana', source: '‘杳然’(えうぜん)トシテ' },
  { id: 'bare-word', source: '桃花(とうくわ)' },
  { id: 'single-short', source: '天(て)地(ち)' },
  { id: 'single-long', source: '伴(ともな)ヒ[レ]雲(くも)ヲ' },
  { id: 'okurigana-only', source: '天ヲ地ニ人ト' },
  { id: 'furigana-okurigana', source: '臥(ふ)シテ伴(ともな)ヒ' },
  { id: 'reread', source: '未(いま)ダ‹ず›«ンバ»[レ]知(し)ラ' },
];
for (const mode of ['aki','beta']) {
  await page.locator('input[name="betagumi"]').nth(mode === 'aki' ? 0 : 1).check();
  for (const sample of samples) {
    await page.locator('#kanbun-text').fill(sample.source);
    await page.locator('button[onclick="convert()"]').click();
    await page.evaluate(() => document.fonts.ready);
    const data = await page.locator('#sample').evaluate(root => {
      const origin = root.getBoundingClientRect();
      const elements = [...root.querySelectorAll('.unit')];
      const baseTop = root.querySelector('.kanji')?.getBoundingClientRect().top ?? origin.top;
      const records = [...root.querySelectorAll('.kanji, .furigana, .okurigana, .saidoku, .kaeriten, .punctuation')].map(el => {
        const r = el.getBoundingClientRect(), s = getComputedStyle(el);
        const glyphs = [];
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          for (const seg of new Intl.Segmenter('ja', { granularity: 'grapheme' }).segment(node.textContent)) {
            if (!seg.segment.trim()) continue;
            const range = document.createRange(); range.setStart(node, seg.index); range.setEnd(node, seg.index + seg.segment.length);
            const box = range.getBoundingClientRect();
            glyphs.push({ text: seg.segment, x: box.x - origin.x, y: box.y - baseTop, width: box.width, height: box.height });
          }
        }
        return { glyphs, class: el.className, text: el.textContent, x: r.x - origin.x, y: r.y - baseTop, width: r.width, height: r.height, fontSize: s.fontSize, display: s.display, textAlign: s.textAlign, justifySelf: s.justifySelf, letterSpacing: s.letterSpacing };
      });
      return { records, width: origin.width, height: origin.height };
    });
    results.push({ browser: engine, mode, ...sample, ...data });
    if (mode === 'aki' && ['group-short','group-okurigana','furigana-okurigana'].includes(sample.id)) await page.locator('#sample').screenshot({ path: `docs/reference/${sample.id}-${mode}-${engine}.png` });
  }
}
await browser.close();
}
await writeFile('docs/reference/observations.json', JSON.stringify({ url: referenceUrl, font: 'Hiragino Mincho ProN', fontSize: 32, results }, null, 2));
console.log(`Recorded ${results.length} cases in Chrome and WebKit, normalized to 32px Hiragino Mincho ProN, weight 400.`);
