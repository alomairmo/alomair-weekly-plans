import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import {
  findWeeklyPlanOverrides,
  findWeeklyPlanWeekOverrides,
  setWeeklyPlanHomework,
  setWeeklyPlanLesson,
} from "./queries/weeklyPlan";

const planSelector = z.object({
  classId: z.string().min(1).max(16),
  week: z.number().int().min(1).max(16),
});

export const weeklyPlanRouter = createRouter({
  list: publicQuery
    .input(planSelector)
    .query(({ input }) => findWeeklyPlanOverrides(input.classId, input.week)),

  listWeek: publicQuery
    .input(z.object({ week: z.number().int().min(1).max(16) }))
    .query(({ input }) => findWeeklyPlanWeekOverrides(input.week)),

  setLesson: publicQuery
    .input(
      planSelector.extend({
        subject: z.string().min(1).max(100),
        lessonId: z.string().regex(/^(?:[1-9]|1[0-6])$/),
      }),
    )
    .mutation(({ input }) => setWeeklyPlanLesson(input)),

  setHomework: publicQuery
    .input(
      planSelector.extend({
        subject: z.string().min(1).max(100),
        lessonId: z.string().regex(/^(?:[1-9]|1[0-6])$/),
        homeworkText: z.string().trim().min(1).max(2000),
      }),
    )
    .mutation(({ input }) => setWeeklyPlanHomework(input)),
});
