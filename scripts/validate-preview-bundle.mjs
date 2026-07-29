import { readFile } from 'node:fs/promises';

const parts = await Promise.all([
  'preview/cp2-00.txt',
  'preview/cp2-01.txt',
  'preview/cp2-02.txt',
].map((path) => readFile(path, 'utf8')));

const source = parts.join('');
new Function(source);
console.log('Caregiver panel v2 bundle syntax is valid.');
