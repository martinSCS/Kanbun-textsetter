import { copyFile, mkdir } from 'node:fs/promises';
const output = new URL('../dist/lib/html/', import.meta.url);
await mkdir(output, { recursive: true });
await copyFile(new URL('../src/html/styles.css', import.meta.url), new URL('styles.css', output));
