import { mkdir, readFile, writeFile } from 'node:fs/promises';

const assetParts = [
  'assets/caregiver-hero/hero.part.00.b64',
  'assets/caregiver-hero/hero.part.01.b64',
  'assets/caregiver-hero/hero.part.02.b64',
];

const base64 = (await Promise.all(assetParts.map((path) => readFile(path, 'utf8'))))
  .join('')
  .replace(/\s+/g, '');
const bytes = Buffer.from(base64, 'base64');

if (
  bytes.byteLength < 10_000 ||
  bytes.subarray(0, 4).toString('ascii') !== 'RIFF' ||
  bytes.subarray(8, 12).toString('ascii') !== 'WEBP'
) {
  throw new Error('Bundled caregiver hero asset is invalid.');
}

await mkdir('preview', { recursive: true });
await writeFile('preview/caregiver-hero.webp', bytes);
console.log(`Bundled caregiver hero prepared: ${bytes.byteLength} bytes`);
