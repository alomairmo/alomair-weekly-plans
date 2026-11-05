import { and, eq } from "drizzle-orm";
import {
  weeklyHomeworkOverrides,
  weeklyObjectiveOverrides,
  weeklyPlanOverrides,
} from "@db/schema";
import { getDb } from "./connection";

type BaseOverride = {
  classId: string;
  subject: string;
  week: number;
  lessonId: string;
};

type PlanOverride = BaseOverride & {
  homeworkText: string | null;
  objectives: string[] | null;
};

type HomeworkRow = BaseOverride & { homeworkText: string };
type ObjectiveRow = BaseOverride & { objectivesText: string };

function parseObjectives(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    const objectives = parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 3);
    return objectives.length > 0 ? objectives : null;
  } catch {
    return null;
  }
}

function mergeOverrides(
  lessonRows: BaseOverride[],
  homeworkRows: HomeworkRow[],
  objectiveRows: ObjectiveRow[],
): PlanOverride[] {
  const merged = new Map<string, PlanOverride>();
  for (const row of lessonRows) {
    merged.set(`${row.classId}|${row.subject}|${row.week}`, {
      ...row,
      homeworkText: null,
      objectives: null,
    });
  }
  for (const row of homeworkRows) {
    const key = `${row.classId}|${row.subject}|${row.week}`;
    const current = merged.get(key);
    merged.set(key, {
      ...row,
      lessonId: current?.lessonId ?? row.lessonId,
      homeworkText: row.homeworkText,
      objectives: current?.objectives ?? null,
    });
  }
  for (const row of objectiveRows) {
    const key = `${row.classId}|${row.subject}|${row.week}`;
    const current = merged.get(key);
    const { objectivesText, ...base } = row;
    merged.set(key, {
      ...base,
      lessonId: current?.lessonId ?? row.lessonId,
      homeworkText: current?.homeworkText ?? null,
      objectives: parseObjectives(objectivesText),
    });
  }
  return [...merged.values()];
}

export async function findWeeklyPlanOverrides(classId: string, week: number) {
  const [lessonRows, homeworkRows, objectiveRows] = await Promise.all([
    getDb()
      .select({
        classId: weeklyPlanOverrides.classId,
        subject: weeklyPlanOverrides.subject,
        week: weeklyPlanOverrides.week,
        lessonId: weeklyPlanOverrides.lessonId,
      })
      .from(weeklyPlanOverrides)
      .where(and(eq(weeklyPlanOverrides.classId, classId), eq(weeklyPlanOverrides.week, week))),
    getDb()
      .select({
        classId: weeklyHomeworkOverrides.classId,
        subject: weeklyHomeworkOverrides.subject,
        week: weeklyHomeworkOverrides.week,
        lessonId: weeklyHomeworkOverrides.lessonId,
        homeworkText: weeklyHomeworkOverrides.homeworkText,
      })
      .from(weeklyHomeworkOverrides)
      .where(and(eq(weeklyHomeworkOverrides.classId, classId), eq(weeklyHomeworkOverrides.week, week))),
    getDb()
      .select({
        classId: weeklyObjectiveOverrides.classId,
        subject: weeklyObjectiveOverrides.subject,
        week: weeklyObjectiveOverrides.week,
        lessonId: weeklyObjectiveOverrides.lessonId,
        objectivesText: weeklyObjectiveOverrides.objectivesText,
      })
      .from(weeklyObjectiveOverrides)
      .where(and(eq(weeklyObjectiveOverrides.classId, classId), eq(weeklyObjectiveOverrides.week, week))),
  ]);
  return mergeOverrides(lessonRows, homeworkRows, objectiveRows);
}

export async function findWeeklyPlanWeekOverrides(week: number) {
  const [lessonRows, homeworkRows, objectiveRows] = await Promise.all([
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
    getDb()
      .select({
        classId: weeklyObjectiveOverrides.classId,
        subject: weeklyObjectiveOverrides.subject,
        week: weeklyObjectiveOverrides.week,
        lessonId: weeklyObjectiveOverrides.lessonId,
        objectivesText: weeklyObjectiveOverrides.objectivesText,
      })
      .from(weeklyObjectiveOverrides)
      .where(eq(weeklyObjectiveOverrides.week, week)),
  ]);
  return mergeOverrides(lessonRows, homeworkRows, objectiveRows);
}

export async function setWeeklyPlanLesson(data: BaseOverride) {
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
    await tx
      .delete(weeklyObjectiveOverrides)
      .where(
        and(
          eq(weeklyObjectiveOverrides.classId, data.classId),
          eq(weeklyObjectiveOverrides.subject, data.subject),
          eq(weeklyObjectiveOverrides.week, data.week),
        ),
      );
  });
  return { ...data, homeworkText: null, objectives: null };
}

export async function setWeeklyPlanHomework(data: BaseOverride & { homeworkText: string }) {
  await getDb()
    .insert(weeklyHomeworkOverrides)
    .values(data)
    .onDuplicateKeyUpdate({
      set: { lessonId: data.lessonId, homeworkText: data.homeworkText },
    });
  return data;
}

export async function setWeeklyPlanObjectives(data: BaseOverride & { objectives: string[] }) {
  const objectivesText = JSON.stringify(data.objectives);
  await getDb()
    .insert(weeklyObjectiveOverrides)
    .values({ ...data, objectivesText })
    .onDuplicateKeyUpdate({
      set: { lessonId: data.lessonId, objectivesText },
    });
  return data;
}
