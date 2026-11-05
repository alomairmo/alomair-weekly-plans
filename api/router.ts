import { createRouter, publicQuery } from "./middleware";
import { weeklyPlanRouter } from "./weeklyPlanRouter";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  weeklyPlan: weeklyPlanRouter,
});

export type AppRouter = typeof appRouter;
