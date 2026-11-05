import {
  int,
  mysqlTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const weeklyPlanOverrides = mysqlTable(
  "weekly_plan_overrides",
  {
    id: serial("id").primaryKey(),
    classId: varchar("class_id", { length: 16 }).notNull(),
    subject: varchar("subject", { length: 100 }).notNull(),
    week: int("week").notNull(),
    lessonId: varchar("lesson_id", { length: 16 }).notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    classSubjectWeekIdx: uniqueIndex("weekly_plan_class_subject_week_idx").on(
      table.classId,
      table.subject,
      table.week,
    ),
  }),
);

export const weeklyHomeworkOverrides = mysqlTable(
  "weekly_homework_overrides",
  {
    id: serial("id").primaryKey(),
    classId: varchar("class_id", { length: 16 }).notNull(),
    subject: varchar("subject", { length: 100 }).notNull(),
    week: int("week").notNull(),
    lessonId: varchar("lesson_id", { length: 16 }).notNull(),
    homeworkText: text("homework_text").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    classSubjectWeekIdx: uniqueIndex("weekly_homework_class_subject_week_idx").on(
      table.classId,
      table.subject,
      table.week,
    ),
  }),
);

export const weeklyObjectiveOverrides = mysqlTable(
  "weekly_objective_overrides",
  {
    id: serial("id").primaryKey(),
    classId: varchar("class_id", { length: 16 }).notNull(),
    subject: varchar("subject", { length: 100 }).notNull(),
    week: int("week").notNull(),
    lessonId: varchar("lesson_id", { length: 16 }).notNull(),
    objectivesText: text("objectives_text").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    classSubjectWeekIdx: uniqueIndex("weekly_objectives_class_subject_week_idx").on(
      table.classId,
      table.subject,
      table.week,
    ),
  }),
);

export type WeeklyPlanOverride = typeof weeklyPlanOverrides.$inferSelect;
export type InsertWeeklyPlanOverride = typeof weeklyPlanOverrides.$inferInsert;
export type WeeklyHomeworkOverride = typeof weeklyHomeworkOverrides.$inferSelect;
export type WeeklyObjectiveOverride = typeof weeklyObjectiveOverrides.$inferSelect;
