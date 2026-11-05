import { createRouter, publicQuery } from "./middleware";
import { scheduleRouter } from "./scheduleRouter";
import { weeklyPlanRouter } from "./weeklyPlanRouter";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  weeklyPlan: weeklyPlanRouter,
  schedule: scheduleRouter,
});

export type AppRouter = typeof appRouter;
