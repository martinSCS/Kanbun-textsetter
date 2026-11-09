import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink, copyFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium, webkit } from '@playwright/test';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const temporary = await realpath(await mkdtemp(join(tmpdir(), 'kanbun-package-')));
const artifactDir = join(root, 'artifacts/npm');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const run = (command, args, cwd = temporary) => execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
let server;
try {
  await mkdir(artifactDir, { recursive: true });
  console.log('Build and pack the actual npm tarball…');
  const packOutput = run(npm, ['pack', '--json', '--pack-destination', temporary, '--cache', join(temporary, 'cache')], root);
  // Lifecycle hooks may print build logs before npm's JSON array.
  const jsonStart = packOutput.search(/^\[\s*\{/m);
  assert.ok(jsonStart >= 0, 'npm pack did not return a JSON manifest');
  const [manifest] = JSON.parse(packOutput.slice(jsonStart));
  const names = new Set(manifest.files.map(f => f.path));
  for (const path of ['dist/lib/index.js', 'dist/lib/index.d.ts', 'dist/lib/html/index.js', 'dist/lib/react/index.js', 'dist/lib/html/styles.css', 'README.md', 'README.en.md', 'README.ja.md', 'LICENSE']) assert.ok(names.has(path), `Missing package file: ${path}`);
  for (const path of names) assert.ok(!/^(docs|tests|examples|scripts|node_modules)\//.test(path), `Unexpected development file: ${path}`);
  for (const path of names) assert.ok(/^(dist\/lib\/.*\.(js|ts|css)|README(?:\.(en|ja))?\.md|src\/(html|react)\/README\.md|LICENSE|package\.json)$/.test(path), `Unexpected public package file: ${path}`);
  for (const target of Object.values(pkg.exports)) for (const path of typeof target === 'string' ? [target] : Object.values(target)) assert.ok(names.has(path.replace(/^\.\//, '')), `Missing export: ${path}`);
  assert.equal(pkg.peerDependenciesMeta?.react?.optional, true);
  const tarball = join(temporary, manifest.filename);
  const consumer = join(temporary, 'consumer');
  await mkdir(consumer);
  await writeFile(join(consumer, 'package.json'), JSON.stringify({ name: 'kanbun-package-consumer', private: true, type: 'module' }));
  run(npm, ['install', tarball, '--offline', '--omit=optional', '--no-audit', '--no-fund', '--package-lock=false', '--cache', join(temporary, 'cache')], consumer);
  const installed = join(consumer, 'node_modules', ...pkg.name.split('/'));
  assert.equal(JSON.parse(await readFile(join(installed, 'package.json'), 'utf8')).license, 'MIT');
  assert.equal(await readFile(join(installed, 'LICENSE'), 'utf8'), await readFile(join(root, 'LICENSE'), 'utf8'));
  assert.ok((await readFile(join(installed, 'dist/lib/html/styles.css'), 'utf8')).includes('.kanbun-link'));
  // This import must work before React is added to the consumer.
  const esm = `import assert from 'node:assert/strict';
import {parseKanbun,serializeKanbun} from ${JSON.stringify(pkg.name)};
import {KanbunViewer} from ${JSON.stringify(pkg.name + '/html')};
const source='未(いま)ダ<ず>|ンバ|[レ]知\\n\`所-[三]以\`(ゆゑん)';
assert.equal(serializeKanbun(parseKanbun(source)),source);
assert.equal(typeof KanbunViewer,'function');
assert.throws(()=>import.meta.resolve('react'));`;
  run(process.execPath, ['--input-type=module', '--eval', esm], consumer);
  const compiler = join(root, 'node_modules/typescript/bin/tsc');
  await writeFile(join(consumer, 'core.ts'), `import {parseKanbun, type LayoutOptions} from '${pkg.name}';\nimport {KanbunViewer} from '${pkg.name}/html';\nconst options: Partial<LayoutOptions>={akiReadingAlign:'contextual',lineStartBracket:'full'};\nconst doc=parseKanbun('胡-蝶');\nvoid [options,doc,KanbunViewer];`);
  const tscArgs = ['--noEmit', '--strict', '--skipLibCheck', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext'];
  run(process.execPath, [compiler, ...tscArgs, 'core.ts'], consumer);
  console.log('Core/HTML: offline tarball install, native Node ESM imports and declarations passed without React.');

  // Test tools come from the workspace; the library itself stays installed from the tarball.
  for (const dependency of ['react', 'react-dom', '@types/react', '@types/react-dom', 'csstype']) {
    const destination = join(consumer, 'node_modules', dependency);
    await mkdir(dirname(destination), { recursive: true });
    await symlink(dirname(require.resolve(dependency + '/package.json')), destination, 'junction');
  }
  const ssr = `import assert from 'node:assert/strict'; import {createElement} from 'react'; import {renderToString} from 'react-dom/server'; import {Kanbun} from ${JSON.stringify(pkg.name + '/react')}; assert.equal(renderToString(createElement(Kanbun,{source:'胡-蝶',className:'reading'})),'<div class="reading"></div>');`;
  run(process.execPath, ['--input-type=module', '--eval', ssr], consumer);
  await writeFile(join(consumer, 'react.tsx'), `import {Kanbun,type KanbunProps} from '${pkg.name}/react';\nconst props:KanbunProps={source:'胡-蝶',spacingMode:'aki'};\nexport const content=<Kanbun {...props}/>;`);
  run(process.execPath, [compiler, ...tscArgs, '--jsx', 'react-jsx', 'react.tsx'], consumer);
  console.log('React: native Node SSR and TSX declarations passed.');

  await writeFile(join(consumer, 'index.html'), '<!doctype html><html lang="ja"><meta charset="utf-8"><title>Package check</title><div id="html"></div><div id="react"></div><script type="module" src="/main.js"></script></html>');
  await writeFile(join(consumer, 'main.js'), `import {createElement,StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {KanbunViewer,verifyRenderedGeometry} from '${pkg.name}/html';
import {Kanbun} from '${pkg.name}/react';
import '${pkg.name}/styles.css';
const source='「胡-蝶」\\n未(いま)ダ<ず>|ンバ|知';
window.results={};
function finish(kind,layout){const host=document.getElementById(kind); window.results[kind]={source:layout.document.source,collisions:layout.collisions.length,firstMainOrigin:layout.units.flatMap(u=>u.parts).find(p=>p.kind==='base')?.rect.i,geometry:verifyRenderedGeometry(layout,host.querySelector('.kanbun-page')),link:host.querySelector('.kanbun-link .kanbun-text')?.textContent};}
const viewer=new KanbunViewer(document.getElementById('html'),{source,onLayout:l=>finish('html',l),onError:e=>window.results.error=String(e)});
const root=createRoot(document.getElementById('react'));
root.render(createElement(StrictMode,null,createElement(Kanbun,{source,onLayout:l=>finish('react',l),onError:e=>window.results.error=String(e)})));
window.cleanup=()=>{viewer.destroy();root.unmount();};`);
  run(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'build', consumer], consumer);
  const webRoot = join(consumer, 'dist');
  const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
  server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const path = resolve(webRoot, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
      if (!path.startsWith(webRoot + '/')) { res.writeHead(403); res.end(); return; }
      const data = await readFile(path);
      res.writeHead(200, { 'Content-Type': mime[extname(path)] ?? 'application/octet-stream' }); res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  for (const [name, engine, options] of [['Chrome', chromium, { channel: 'chrome' }], ['WebKit', webkit, {}]]) {
    const browser = await engine.launch({ ...options, headless: true });
    try {
      const page = await browser.newPage();
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${port}`);
      await page.waitForFunction(() => (window.results.html && window.results.react) || window.results.error);
      const results = await page.evaluate(() => window.results);
      assert.equal(results.error, undefined);
      for (const kind of ['html', 'react']) {
        assert.equal(results[kind].collisions, 0, `${name} ${kind} collisions`);
        assert.deepEqual(results[kind].geometry, [], `${name} ${kind} geometry`);
        assert.equal(results[kind].link, '-');
        assert.equal(results[kind].firstMainOrigin, 0);
        assert.ok(results[kind].source.includes('<ず>|ンバ|'));
      }
      assert.deepEqual(errors, []);
      await page.evaluate(() => window.cleanup());
      console.log(`${name}: installed-package HTML and React rendering passed.`);
    } finally { await browser.close(); }
  }
  const destination = join(artifactDir, manifest.filename);
  await copyFile(tarball, destination);
  await writeFile(join(artifactDir, 'report.json'), JSON.stringify({ name: pkg.name, version: pkg.version, filename: manifest.filename, integrity: manifest.integrity, size: manifest.size, files: [...names].sort(), checks: ['tarball contents', 'offline installation without React', 'Node ESM', 'NodeNext declarations', 'React SSR', 'TSX declarations', 'Vite consumer build', 'Chrome HTML/React', 'WebKit HTML/React'] }, null, 2) + '\n');
  console.log(`Package validated: ${destination}\nIntegrity: ${manifest.integrity}`);
} catch (error) {
  console.error(error.stderr?.toString() || error);
  process.exitCode = 1;
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
