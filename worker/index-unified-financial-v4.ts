import app from "./index-referral-rewards";
import { routeCaregiverFinancialProfileV4 } from "./caregiver-financial-profile-v4";
import { type Env } from "./lib";

type WorkerLifecycleContext = {
  waitUntil(promise: Promise<unknown>): void;
};

type WorkerScheduledController = {
  scheduledTime: number;
  cron: string;
  noRetry?(): void;
};

export default {
  async fetch(request: Request, env: Env, context: WorkerLifecycleContext): Promise<Response> {
    const financialProfile = await routeCaregiverFinancialProfileV4(request, env);
    if (financialProfile) return financialProfile;
    return app.fetch(request, env, context);
  },

  async scheduled(controller: WorkerScheduledController, env: Env, context: WorkerLifecycleContext) {
    return app.scheduled(controller, env, context);
  },
};
