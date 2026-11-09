import { parseKanbun, layoutKanbun, renderKanbun, DOMTextMeasurer, copyKanbunSource, verifyRenderedGeometry, type KanbunLayout, type LayoutOptions } from '../../src/index';
import '../../src/html/styles.css';
import './styles.css';
const defaultSource = `感ジテハ[レ]時ニ花ニモ濺(そそ)ギ[レ]淚ヲ，恨ミデハ[レ]別レヲ鳥ニモ驚カス[レ]心ヲ。
使メバ[人]籍(せき)ヲシテ誠ニ不[乙]以テ[下]畜(やしな)ヒ[二]妻子ヲ[一]，憂フルヲ[中]饑(き)寒(かん)ヲ[上]亂サ[甲レ]心ヲ，有リテ[二]錢財[一]以(もつ)テ濟(な)サ[地]醫藥ヲ[天]…
子曰ク，盍ゾ|ル|[三]各〻言ハ[二]爾ノ志ヲ[一]。
孤之有ルハ[二]孔明[一]，猶ホ<ごと>|キ|[二]魚之有ルガ[一レ]水也。
此レ乃チ信(しん)之\`所―[三]以\`(ゆゑん)為ル[二]陛下ノ禽(とりこ)ト[一]也。`;
document.querySelector('#app')!.innerHTML = `
<main>
<div class="workspace"><section class="editor-panel"><div class="panel-heading"><h2>原文</h2><div class="preview-actions"><label>缩放 <select id="zoom" aria-label="预览缩放"><option value="0.75">75%</option><option value="1" selected>100%</option><option value="1.25">125%</option><option value="1.5">150%</option></select></label><button id="copy">复制原文</button></div></div><textarea id="source" spellcheck="false" aria-label="带标注的汉文原文"></textarea><div class="syntax"><span><b>(かな)</b> 振假名</span><span><b>{カナ}</b> 送假名</span><span><b>[レ]</b> 返点</span><span><b>&lt;かな&gt;</b> 再读振假名</span><span><b>|カナ|</b> 再读送假名</span><span><b>斜光(しやくわう)</b> 连续汉字整体注音</span><span><b>\`杳然\`(えうぜん)</b> 明确注音范围</span></div><div class="editor-footer"><span id="source-count"></span><span>编辑后自动排版</span></div><div class="diagnostic-heading">诊断 <span id="diagnostic-count">0</span></div><div id="diagnostics" role="status"></div></section>
<section class="preview-panel" aria-label="排版预览"><div class="preview-scroller" id="scroller"><div id="preview"></div></div></section></div>
<section class="settings"><div class="settings-heading"><h2>排版设置</h2><span class="muted">修改后自动生效</span></div>
<div id="spacing-definitions" class="spacing-definitions">
<p><strong>密排（ベタ組）</strong>：主字外框之间不预留基础字间（0 em）；读音、送假名或返点放不下时，局部增加必要间距。</p>
<p><strong>疏排（アキ組）</strong>：主字按设定的固定字间等距排列（如 0.25 em、0.5 em）；保持主字字距，先定位振假名并接续送假名，再按实际邻接关系避让；确实放不下时才采用所选长注音策略。</p>
<p class="spacing-note">这里的字间指纵排中上下相邻主字外框的间隔，不是字形墨迹的空白，也不是左右列距。密排可局部增距；疏排保持固定字间。1 em 等于主字字号。<a href="https://kanbun-req.mkpo.li/" target="_blank" rel="noreferrer">依据：訓点漢文組版要件 §3.1</a></p>
</div><div class="settings-grid">
<label>组版方式<select id="spacingMode" aria-describedby="spacing-definitions"><option value="beta">密排（ベタ組）</option><option value="aki" selected>疏排（アキ組）</option></select></label>
<label>主字字号 <output id="size-output">32 px</output><input id="kanjiFontSize" type="range" min="20" max="52" value="32"></label>
<label>注音比例<select id="annotationScale"><option value="0.4">0.4 em</option><option value="0.5" selected>0.5 em</option><option value="0.6">0.6 em</option></select></label>
<label>固定字间（仅疏排）<select id="baseSpacing"><option value="0.25">0.25 em</option><option value="0.5">0.5 em</option><option value="0.75">0.75 em</option><option value="1" selected>1.0 em</option></select></label>
<label>列高 <output id="height-output">480 px</output><input id="columnHeight" type="range" min="160" max="900" step="20" value="480"></label>
<label>列间距 <output id="gap-output">24 px</output><input id="columnGap" type="range" min="0" max="80" value="24"></label>
<label>主字字体<select id="kanjiFontFamily"><option value='"Hiragino Mincho ProN", "Yu Mincho", serif'>明朝体</option><option value='"Hiragino Sans", "Yu Gothic", sans-serif'>黑体</option><option value="serif">系统衬线体</option><option value="custom">自定义字体…</option></select><input id="kanjiFontFamilyCustom" type="text" aria-label="自定义主字字体名称" placeholder="字体名称，可用逗号分隔" title="可输入字体名或字体列表；空白时使用明朝体预设。字体需已安装或通过网页加载。" spellcheck="false" hidden></label>
<label>注音字体<select id="annotationFontFamily"><option value='"Hiragino Mincho ProN", "Yu Mincho", serif'>明朝体</option><option value='"Hiragino Sans", "Yu Gothic", sans-serif'>黑体</option><option value="custom">自定义字体…</option></select><input id="annotationFontFamilyCustom" type="text" aria-label="自定义注音字体名称" placeholder="字体名称，可用逗号分隔" title="可输入字体名或字体列表；空白时使用明朝体预设。字体需已安装或通过网页加载。" spellcheck="false" hidden></label>
<label id="dense-okurigana-policy">密排送假名下挂<select id="collisionPolicy"><option value="strict">不允许下挂</option><option value="traditional">允许少量下挂（0.75em 起点）</option></select></label>
<label>疏排读音定位<select id="akiReadingAlign"><option value="contextual">按送假名衔接定位</option><option value="configured">按单字对齐设置</option></select></label>
<label>单字振假名对齐<select id="furiganaAlign"><option value="shoulder">肩付き · 顶端对齐</option><option value="center">中付き · 居中对齐</option></select></label>
<label>多字联合注音对齐<select id="groupRubyAlign" title="沿文字行进方向对齐整个振假名，送假名接在其后；不改变母字间距"><option value="space-between">两端对齐并展开</option><option value="space-around">均匀分布（端空 : 字间 = 1 : 2）</option><option value="start">起端对齐（纵排顶端）</option><option value="center">居中对齐</option><option value="end">末端对齐（纵排底端）</option></select></label>
<label>仅送假名起点<select id="okuriganaOffset"><option value="0.5">0.5 em · 标准</option><option value="0.75">0.75 em · 传统变体</option></select></label>
<label title="期望保留的空白；空间紧张时可用交叠容差">期望注音间距<input id="annotationGap" type="number" min="0" max="2" step="0.05" value="0.25"></label>
<label title="普通注音框允许的边缘交叠量，以主字 em 计；0 为严格。主字之间及连接线仍严格检查">允许边缘交叠（em）<input id="collisionTolerance" type="number" min="0" max="0.5" step="0.01" value="0.05"></label>
<label>疏排长注音<select id="akiAnnotationOverflow"><option value="wrap">调整位置并折返</option><option value="report">单列注音，报告冲突</option></select></label>
<label title="振送假名超过到下一主字字头的可用长度时，送假名单独右移一行，末字底部对齐下一主字顶部"><span>超长送假名右移</span><input id="shiftOverflowOkurigana" type="checkbox" checked></label>
<label title="完整字位模式下，开括号占第一个正文格，首字从第二格开始；疏排保留设定字间">行首开括号<select id="lineStartBracket"><option value="hang">正文首字齐头（标点上悬）</option><option value="half">标点占半个字位</option><option value="full">标点占完整第一字位</option></select></label>
<label>返点字形<select id="kaeritenGlyphs"><option value="source">原字形 · 字体回退</option><option value="unicode">Unicode 漢文記号</option></select></label>
<label>自定义固定字间（em）<input id="customSpacing" type="number" min="0" max="4" step="0.05" value="1.0"></label>
</div><div class="debug-bar"><span>几何调试</span><label><input id="showBoxes" type="checkbox"> 文字与注音框</label><label><input id="showUnits" type="checkbox"> 单元边界 / 扩张量</label><label><input id="showCollisions" type="checkbox"> 碰撞区域</label><span class="debug-key">主字 <i class="key blue"></i> 注音 <i class="key amber"></i> 再读 <i class="key violet"></i></span></div></section>
</main>`;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const source = $<HTMLTextAreaElement>('source'), measurer = new DOMTextMeasurer();
let layout: KanbunLayout | undefined, generation = 0, timer: ReturnType<typeof setTimeout>;
const fontIds = ['kanjiFontFamily', 'annotationFontFamily'] as const;
const customFontIds = fontIds.map(id => `${id}Custom`);
const numeric = ['kanjiFontSize', 'annotationScale', 'baseSpacing', 'columnHeight', 'columnGap', 'okuriganaOffset', 'annotationGap', 'collisionTolerance'];
const optionIds = [...numeric, 'spacingMode', 'kanjiFontFamily', 'annotationFontFamily', 'collisionPolicy', 'furiganaAlign', 'kaeritenGlyphs', 'akiAnnotationOverflow', 'groupRubyAlign', 'akiReadingAlign', 'shiftOverflowOkurigana', 'lineStartBracket'];
function readOptions(): Partial<LayoutOptions> {
  const o: Record<string, string | number | boolean> = {};
  for (const id of optionIds) {
    o[id] = id === 'shiftOverflowOkurigana'
      ? $<HTMLInputElement>(id).checked
      : numeric.includes(id) ? Number($<HTMLInputElement>(id).value) : $<HTMLInputElement>(id).value;
  }
  for (const id of fontIds) {
    const preset = $<HTMLSelectElement>(id);
    if (preset.value === 'custom') o[id] = $<HTMLInputElement>(`${id}Custom`).value.trim() || preset.options[0]!.value;
  }
  return o as Partial<LayoutOptions>;
}
async function update() {
  const run = ++generation;
  $('size-output').textContent = `${$<HTMLInputElement>('kanjiFontSize').value} px`; $('height-output').textContent = `${$<HTMLInputElement>('columnHeight').value} px`; $('gap-output').textContent = `${$<HTMLInputElement>('columnGap').value} px`;
  for (const id of fontIds) $(`${id}Custom`).hidden = $<HTMLSelectElement>(id).value !== 'custom';
  const dense = $<HTMLSelectElement>('spacingMode').value === 'beta';
  $('dense-okurigana-policy').hidden = !dense;
  $<HTMLSelectElement>('collisionPolicy').disabled = !dense;
  for (const id of ['baseSpacing', 'customSpacing']) {
    const field = $<HTMLInputElement | HTMLSelectElement>(id); field.disabled = dense;
    field.title = dense ? '密排基础字间为 0；此设置仅在疏排生效' : '主字外框之间的固定间隔，以主字字号为单位';
  }
  try {
    const result = await layoutKanbun(parseKanbun(source.value), readOptions(), measurer);
    if (run !== generation) return;
    layout = result; const root = renderKanbun(result, $('preview'), { showBoxes: $<HTMLInputElement>('showBoxes').checked, showUnits: $<HTMLInputElement>('showUnits').checked, showCollisions: $<HTMLInputElement>('showCollisions').checked });
    const calibration = verifyRenderedGeometry(result, root);
    $('diagnostics').replaceChildren();
    for (const d of result.diagnostics) {
      const button = document.createElement('button'); button.className = `diagnostic ${d.severity}`;
      const line = source.value.slice(0, d.sourceRange.start).split('\n').length;
      button.textContent = `第 ${line} 行 · ${d.message}`; button.onclick = () => { source.focus(); source.setSelectionRange(d.sourceRange.start, d.sourceRange.end); }; $('diagnostics').append(button);
    }
    for (const error of calibration) { const el = document.createElement('p'); el.textContent = error; el.className = 'diagnostic error'; $('diagnostics').append(el); }
    const count = result.diagnostics.length + calibration.length;
    if (!count) $('diagnostics').textContent = '暂无诊断。所有单元通过几何检查。';
    $('diagnostic-count').textContent = String(count); $('source-count').textContent = `${result.units.length} 个排版单元`;
    $('preview').dataset.ready = String(run);
    // Exposed typed API is useful in browser integration tests and downstream demos.
    Object.assign(window, { kanbunLayout: result, kanbunGeometryErrors: calibration });
    if (run === 1) $('scroller').scrollLeft = $('scroller').scrollWidth;
  } catch (e) { if (run === generation) { $('diagnostics').textContent = String(e); } }
}
function schedule() { generation++; clearTimeout(timer); timer = setTimeout(update, 100); }
for (const id of [...optionIds, ...customFontIds, 'source', 'showBoxes', 'showUnits', 'showCollisions']) $(id).addEventListener('input', schedule);
$('baseSpacing').addEventListener('change', () => { $<HTMLInputElement>('customSpacing').value = $<HTMLInputElement>('baseSpacing').value; });
$('customSpacing').addEventListener('input', () => { const select = $<HTMLSelectElement>('baseSpacing'), value = $<HTMLInputElement>('customSpacing').value; if (![...select.options].some(o => o.value === value)) select.add(new Option(`${value} em`, value)); select.value = value; schedule(); });
$('zoom').addEventListener('change', () => { $('preview').style.zoom = $<HTMLSelectElement>('zoom').value; });
$('copy').addEventListener('click', async () => { if (!layout) return; try { await copyKanbunSource(layout); $('copy').textContent = '已复制 ✓'; } catch { source.focus(); source.select(); $('copy').textContent = '请按 ⌘C / Ctrl+C'; } setTimeout(() => { $('copy').textContent = '复制原文'; }, 1800); });
new ResizeObserver(() => { /* Geometry depends on columnHeight, not scroll viewport width. */ $('scroller').dataset.viewportWidth = String($('scroller').clientWidth); }).observe($('scroller'));
document.fonts.addEventListener('loadingdone', () => { measurer.clear(); schedule(); });
source.value = defaultSource; void update();
