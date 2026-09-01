import app from "./index-desktop-react-v1";
import { withDatabaseBackend } from "./database-backend-v1";

type WorkerLifecycleContext = { waitUntil(promise: Promise<unknown>): void };
type WorkerScheduledController = { scheduledTime: number; cron: string; noRetry?(): void };

function runtimeEnv(env: any) {
  return withDatabaseBackend(env);
}

export default {
  fetch(request: Request, env: any, ctx: WorkerLifecycleContext) {
    return app.fetch(request, runtimeEnv(env), ctx);
  },
  scheduled(controller: WorkerScheduledController, env: any, ctx: WorkerLifecycleContext) {
    const scheduled = (app as any).scheduled;
    if (typeof scheduled === "function") return scheduled.call(app, controller, runtimeEnv(env), ctx);
  },
  queue(batch: any, env: any, ctx: WorkerLifecycleContext) {
    const queue = (app as any).queue;
    if (typeof queue === "function") return queue.call(app, batch, runtimeEnv(env), ctx);
  },
};
