import type {
  ScheduleLesson,
  SchedulePayload,
  ScheduleSubject,
} from "@contracts/types";
import { getSupabase } from "./supabase";

type SubjectRow = {
  class_id: string;
  subject_key: string;
  name: string;
  sort_order: number;
};

type LessonRow = {
  id: string;
  class_id: string;
  subject_key: string;
  teacher_id: number;
  day_of_week: number;
  period: number;
  sort_order: number;
};

export type SaveLessonInput = {
  id: string;
  classId: string;
  subjectKey: string;
  /** 0-based teacher id; stored 1-based in Supabase. */
  teacherId: number;
  day: number;
  period: number;
  sortOrder: number;
};

export type SaveSubjectInput = {
  subjectKey: string;
  name: string;
  sortOrder: number;
};

function subjectNameKey(classId: string, subjectKey: string) {
  return `${classId}|${subjectKey}`;
}

export async function getSchedule(): Promise<SchedulePayload> {
  const supabase = getSupabase();
  const [subjectsResult, lessonsResult] = await Promise.all([
    supabase
      .from("alomair_subjects")
      .select("class_id,subject_key,name,sort_order")
      .order("class_id", { ascending: true })
      .order("sort_order", { ascending: true }),
    supabase
      .from("alomair_schedule_lessons")
      .select("id,class_id,subject_key,teacher_id,day_of_week,period,sort_order")
      .order("sort_order", { ascending: true }),
  ]);
  if (subjectsResult.error) {
    throw new Error(`Failed to load subjects: ${subjectsResult.error.message}`);
  }
  if (lessonsResult.error) {
    throw new Error(`Failed to load schedule lessons: ${lessonsResult.error.message}`);
  }

  const subjectRows = (subjectsResult.data ?? []) as SubjectRow[];
  const lessonRows = (lessonsResult.data ?? []) as LessonRow[];

  const subjects: ScheduleSubject[] = subjectRows.map((row) => ({
    classId: row.class_id,
    subjectKey: row.subject_key,
    name: row.name,
    sortOrder: row.sort_order,
  }));

  const nameByKey = new Map<string, string>();
  for (const row of subjectRows) {
    nameByKey.set(subjectNameKey(row.class_id, row.subject_key), row.name);
  }

  const lessons: ScheduleLesson[] = lessonRows.map((row) => ({
    id: row.id,
    teacherId: row.teacher_id - 1,
    classId: row.class_id,
    day: row.day_of_week,
    period: row.period,
    subject: nameByKey.get(subjectNameKey(row.class_id, row.subject_key)) ?? row.subject_key,
    subjectKey: row.subject_key,
  }));

  return { lessons, subjects };
}

export async function saveScheduleLessons(entries: SaveLessonInput[]) {
  const rows = entries.map((entry) => ({
    id: entry.id,
    class_id: entry.classId,
    subject_key: entry.subjectKey,
    teacher_id: entry.teacherId + 1,
    day_of_week: entry.day,
    period: entry.period,
    sort_order: entry.sortOrder,
  }));
  const { error } = await getSupabase().rpc("alomair_save_schedule_lessons", {
    entries: rows,
  });
  if (error) {
    throw new Error(`Failed to save schedule lessons: ${error.message}`);
  }
  return { ok: true as const };
}

export async function saveScheduleSubjects(classId: string, subjects: SaveSubjectInput[]) {
  const rows = subjects.map((subject) => ({
    class_id: classId,
    subject_key: subject.subjectKey,
    name: subject.name,
    sort_order: subject.sortOrder,
  }));
  const { error } = await getSupabase()
    .from("alomair_subjects")
    .upsert(rows, { onConflict: "class_id,subject_key" });
  if (error) {
    throw new Error(`Failed to save subjects for class ${classId}: ${error.message}`);
  }
  return { ok: true as const };
}
