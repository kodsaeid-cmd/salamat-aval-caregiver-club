import { mkdir, writeFile } from 'node:fs/promises';

const sources = [
  'https://images.pexels.com/photos/16364305/pexels-photo-16364305/free-photo-of-woman-taking-care-of-old-people.jpeg?auto=compress&cs=tinysrgb&w=2200&h=1800&fit=crop&dpr=1',
  'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&fm=jpg&q=90&w=2200',
];

await mkdir('preview', { recursive: true });
let lastError;
for (const source of sources) {
  try {
    const response = await fetch(source, {
      headers: { 'user-agent': 'Salamat-Aval-Caregiver-Club/1.6' },
      redirect: 'follow',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) throw new Error(`Unexpected content type: ${contentType}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength < 50_000) throw new Error('Downloaded hero image is unexpectedly small.');
    await writeFile('preview/caregiver-hero.jpg', bytes);
    console.log(`Caregiver hero downloaded locally: ${bytes.byteLength} bytes`);
    process.exit(0);
  } catch (error) {
    lastError = error;
    console.warn(`Hero source failed: ${source}`, error instanceof Error ? error.message : error);
  }
}
throw new Error(`Could not prepare local caregiver hero: ${lastError instanceof Error ? lastError.message : lastError}`);
