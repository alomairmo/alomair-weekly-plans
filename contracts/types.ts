export * from "./errors";

export type Teacher = {
  id: number;
  name: string;
  load: number;
};

export type SchoolClass = {
  id: string;
  name: string;
};

export type ScheduleLesson = {
  id: string;
  teacherId: number;
  classId: string;
  day: number;
  period: number;
  /** Display name of the subject (resolved from the subjects table). */
  subject: string;
  /** Stable subject identifier. */
  subjectKey: string;
};

export type ScheduleSubject = {
  classId: string;
  subjectKey: string;
  name: string;
  sortOrder: number;
};

export type SchedulePayload = {
  lessons: ScheduleLesson[];
  subjects: ScheduleSubject[];
};

export type PlanOverride = {
  classId: string;
  /** Stable subject identifier (subject_key). */
  subject: string;
  week: number;
  lessonId: string;
  homeworkText: string | null;
  objectives: string[] | null;
};
