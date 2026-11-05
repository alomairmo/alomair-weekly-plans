import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import {
  getSchedule,
  saveScheduleLessons,
  saveScheduleSubjects,
} from "./queries/schedule";

const lessonInput = z.object({
  id: z.string().uuid(),
  classId: z.string().min(1).max(16),
  subjectKey: z.string().min(1).max(100),
  teacherId: z.number().int().min(0).max(14),
  day: z.number().int().min(0).max(4),
  period: z.number().int().min(1).max(7),
  sortOrder: z.number().int().min(0),
});

const subjectInput = z.object({
  subjectKey: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(100),
  sortOrder: z.number().int().min(0),
});

export const scheduleRouter = createRouter({
  get: publicQuery.query(() => getSchedule()),

  saveLessons: publicQuery
    .input(z.array(lessonInput).min(1).max(400))
    .mutation(({ input }) => saveScheduleLessons(input)),

  saveSubjects: publicQuery
    .input(
      z.object({
        classId: z.string().min(1).max(16),
        subjects: z.array(subjectInput).min(1).max(30),
      }),
    )
    .mutation(({ input }) => {
      const names = new Set<string>();
      for (const subject of input.subjects) {
        if (names.has(subject.name)) {
          throw new Error(`Duplicate subject name "${subject.name}" in request`);
        }
        names.add(subject.name);
      }
      return saveScheduleSubjects(input.classId, input.subjects);
    }),
});
