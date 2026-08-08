import app from './index-unified-financial-v4';
import { type Env } from './lib';

const VERSION = '8.2.0';
const ASSET = 'mobile-reference-dashboard-v8-2.js';

type WorkerLifecycleContext = { waitUntil(promise: Promise<unknown>): void };
type WorkerScheduledController = { scheduledTime: number; cron: string; noRetry?(): void };

function stripExisting(html: string) {
  const escaped = ASSET.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html.replace(new RegExp(`<script\\b[^>]*\\bsrc=["'][^"']*${escaped}(?:\\?[^"']*)?["'][^>]*>\\s*<\\/script>`, 'gi'), '');
}

async function inject(response: Response) {
  const type = response.headers.get('content-type') || '';
  if (!response.ok || !type.includes('text/html')) return response;
  let html = stripExisting(await response.text());
  const tag = `<script defer src="./${ASSET}?v=${VERSION}" data-salamat-mobile-reference-dashboard="${VERSION}"></script>`;
  html = html.includes('</body>') ? html.replace('</body>', `${tag}</body>`) : `${html}${tag}`;
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('x-salamat-mobile-reference-dashboard', VERSION);
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request: Request, env: Env, context: WorkerLifecycleContext): Promise<Response> {
    const response = await app.fetch(request, env, context);
    return new URL(request.url).pathname.startsWith('/api/') ? response : inject(response);
  },
  async scheduled(controller: WorkerScheduledController, env: Env, context: WorkerLifecycleContext) {
    return app.scheduled(controller, env, context);
  },
};
