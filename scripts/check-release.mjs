import { readFile, access } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const pending = [];
if (pkg.private) pending.push('package.json 仍为 private: true；发布准备完成后再移除这一限制。');
if (!pkg.license || pkg.license === 'UNLICENSED') pending.push('需确认许可证并设置 package.json 的 license。');
try { await access(new URL('LICENSE', root)); } catch { pending.push('需补齐与所选许可证对应的 LICENSE 文件。'); }
if (pending.length) {
  console.error('发布前待确认：\n' + pending.map(item => `- ${item}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Release metadata ready: ${pkg.name}@${pkg.version}. Confirm registry name availability before publishing.`);
}
