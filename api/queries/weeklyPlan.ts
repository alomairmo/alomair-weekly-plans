import { and, eq } from "drizzle-orm";
import { weeklyHomeworkOverrides, weeklyPlanOverrides } from "@db/schema";
import { getDb } from "./connection";

type PlanOverride = {
  classId: string;
  subject: string;
  week: number;
  lessonId: string;
  homeworkText: string | null;
};

function mergeOverrides(
  lessonRows: Omit<PlanOverride, "homeworkText">[],
  homeworkRows: PlanOverride[],
) {
  const merged = new Map<string, PlanOverride>();
  for (const row of lessonRows) {
    merged.set(`${row.classId}|${row.subject}|${row.week}`, { ...row, homeworkText: null });
  }
  for (const row of homeworkRows) {
    const key = `${row.classId}|${row.subject}|${row.week}`;
    const current = merged.get(key);
    merged.set(key, {
      ...row,
      lessonId: current?.lessonId ?? row.lessonId,
      homeworkText: row.homeworkText,
    });
  }
  return [...merged.values()];
}

export async function findWeeklyPlanOverrides(classId: string, week: number) {
  const lessonWhere = and(
    eq(weeklyPlanOverrides.classId, classId),
    eq(weeklyPlanOverrides.week, week),
  );
  const homeworkWhere = and(
    eq(weeklyHomeworkOverrides.classId, classId),
    eq(weeklyHomeworkOverrides.week, week),
  );
  const [lessonRows, homeworkRows] = await Promise.all([
    getDb()
      .select({
        classId: weeklyPlanOverrides.classId,
        subject: weeklyPlanOverrides.subject,
        week: weeklyPlanOverrides.week,
        lessonId: weeklyPlanOverrides.lessonId,
      })
      .from(weeklyPlanOverrides)
      .where(lessonWhere),
    getDb()
      .select({
        classId: weeklyHomeworkOverrides.classId,
        subject: weeklyHomeworkOverrides.subject,
        week: weeklyHomeworkOverrides.week,
        lessonId: weeklyHomeworkOverrides.lessonId,
        homeworkText: weeklyHomeworkOverrides.homeworkText,
      })
      .from(weeklyHomeworkOverrides)
      .where(homeworkWhere),
  ]);
  return mergeOverrides(lessonRows, homeworkRows);
}

export async function findWeeklyPlanWeekOverrides(week: number) {
  const [lessonRows, homeworkRows] = await Promise.all([
    getDb()
      .select({
        classId: weeklyPlanOverrides.classId,
        subject: weeklyPlanOverrides.subject,
        week: weeklyPlanOverrides.week,
        lessonId: weeklyPlanOverrides.lessonId,
      })
      .from(weeklyPlanOverrides)
      .where(eq(weeklyPlanOverrides.week, week)),
    getDb()
      .select({
        classId: weeklyHomeworkOverrides.classId,
        subject: weeklyHomeworkOverrides.subject,
        week: weeklyHomeworkOverrides.week,
        lessonId: weeklyHomeworkOverrides.lessonId,
        homeworkText: weeklyHomeworkOverrides.homeworkText,
      })
      .from(weeklyHomeworkOverrides)
      .where(eq(weeklyHomeworkOverrides.week, week)),
  ]);
  return mergeOverrides(lessonRows, homeworkRows);
}

export async function setWeeklyPlanLesson(data: {
  classId: string;
  subject: string;
  week: number;
  lessonId: string;
}) {
  await getDb().transaction(async (tx) => {
    await tx
      .insert(weeklyPlanOverrides)
      .values(data)
      .onDuplicateKeyUpdate({
        set: { lessonId: data.lessonId },
      });
    await tx
      .delete(weeklyHomeworkOverrides)
      .where(
        and(
          eq(weeklyHomeworkOverrides.classId, data.classId),
          eq(weeklyHomeworkOverrides.subject, data.subject),
          eq(weeklyHomeworkOverrides.week, data.week),
        ),
      );
  });
  return { ...data, homeworkText: null };
}

export async function setWeeklyPlanHomework(data: {
  classId: string;
  subject: string;
  week: number;
  lessonId: string;
  homeworkText: string;
}) {
  await getDb()
    .insert(weeklyHomeworkOverrides)
    .values(data)
    .onDuplicateKeyUpdate({
      set: { lessonId: data.lessonId, homeworkText: data.homeworkText },
    });
  return data;
}
