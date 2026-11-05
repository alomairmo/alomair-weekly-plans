import { getSupabase } from "./supabase";

type BaseOverride = {
  classId: string;
  /** Stable subject identifier (subject_key). */
  subject: string;
  week: number;
  lessonId: string;
};

type PlanOverride = BaseOverride & {
  homeworkText: string | null;
  objectives: string[] | null;
};

type OverrideRow = {
  class_id: string;
  subject_key: string;
  week: number;
  lesson_id: string;
  homework_text: string | null;
  objectives: unknown;
};

const TABLE = "alomair_weekly_plan_overrides";

function parseObjectives(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const objectives = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
  return objectives.length > 0 ? objectives : null;
}

function normalizeObjectives(value: unknown): string[] {
  const objectives = parseObjectives(value);
  if (!objectives) {
    throw new Error("Objectives must be an array of 1..3 non-empty strings");
  }
  return objectives;
}

function toPlanOverride(row: OverrideRow): PlanOverride {
  return {
    classId: row.class_id,
    subject: row.subject_key,
    week: row.week,
    lessonId: row.lesson_id,
    homeworkText: row.homework_text,
    objectives: parseObjectives(row.objectives),
  };
}

export async function findWeeklyPlanOverrides(classId: string, week: number) {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("class_id,subject_key,week,lesson_id,homework_text,objectives")
    .eq("class_id", classId)
    .eq("week", week);
  if (error) {
    throw new Error(`Failed to load weekly plan overrides: ${error.message}`);
  }
  return ((data ?? []) as OverrideRow[]).map(toPlanOverride);
}

export async function findWeeklyPlanWeekOverrides(week: number) {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("class_id,subject_key,week,lesson_id,homework_text,objectives")
    .eq("week", week);
  if (error) {
    throw new Error(`Failed to load weekly plan overrides for week ${week}: ${error.message}`);
  }
  return ((data ?? []) as OverrideRow[]).map(toPlanOverride);
}

export async function setWeeklyPlanLesson(data: BaseOverride) {
  const { error } = await getSupabase()
    .from(TABLE)
    .upsert(
      {
        class_id: data.classId,
        subject_key: data.subject,
        week: data.week,
        lesson_id: data.lessonId,
        homework_text: null,
        objectives: null,
      },
      { onConflict: "class_id,subject_key,week" },
    );
  if (error) {
    throw new Error(`Failed to save weekly plan lesson: ${error.message}`);
  }
  return { ...data, homeworkText: null, objectives: null };
}

export async function setWeeklyPlanHomework(data: BaseOverride & { homeworkText: string }) {
  const supabase = getSupabase();
  const updated = await supabase
    .from(TABLE)
    .update({ lesson_id: data.lessonId, homework_text: data.homeworkText })
    .eq("class_id", data.classId)
    .eq("subject_key", data.subject)
    .eq("week", data.week)
    .select("class_id,subject_key,week,lesson_id,homework_text,objectives");
  if (updated.error) {
    throw new Error(`Failed to save weekly plan homework: ${updated.error.message}`);
  }
  const rows = (updated.data ?? []) as OverrideRow[];
  if (rows.length > 0) {
    return toPlanOverride(rows[0]);
  }
  const inserted = await supabase
    .from(TABLE)
    .insert({
      class_id: data.classId,
      subject_key: data.subject,
      week: data.week,
      lesson_id: data.lessonId,
      homework_text: data.homeworkText,
      objectives: null,
    })
    .select("class_id,subject_key,week,lesson_id,homework_text,objectives");
  if (inserted.error) {
    throw new Error(`Failed to insert weekly plan homework: ${inserted.error.message}`);
  }
  return toPlanOverride((inserted.data as OverrideRow[])[0]);
}

export async function setWeeklyPlanObjectives(data: BaseOverride & { objectives: string[] }) {
  const objectives = normalizeObjectives(data.objectives);
  const supabase = getSupabase();
  const updated = await supabase
    .from(TABLE)
    .update({ lesson_id: data.lessonId, objectives })
    .eq("class_id", data.classId)
    .eq("subject_key", data.subject)
    .eq("week", data.week)
    .select("class_id,subject_key,week,lesson_id,homework_text,objectives");
  if (updated.error) {
    throw new Error(`Failed to save weekly plan objectives: ${updated.error.message}`);
  }
  const rows = (updated.data ?? []) as OverrideRow[];
  if (rows.length > 0) {
    return toPlanOverride(rows[0]);
  }
  const inserted = await supabase
    .from(TABLE)
    .insert({
      class_id: data.classId,
      subject_key: data.subject,
      week: data.week,
      lesson_id: data.lessonId,
      homework_text: null,
      objectives,
    })
    .select("class_id,subject_key,week,lesson_id,homework_text,objectives");
  if (inserted.error) {
    throw new Error(`Failed to insert weekly plan objectives: ${inserted.error.message}`);
  }
  return toPlanOverride((inserted.data as OverrideRow[])[0]);
}
