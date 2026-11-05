CREATE TABLE `weekly_objective_overrides` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`class_id` varchar(16) NOT NULL,
	`subject` varchar(100) NOT NULL,
	`week` int NOT NULL,
	`lesson_id` varchar(16) NOT NULL,
	`objectives_text` text NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `weekly_objective_overrides_id` PRIMARY KEY(`id`),
	CONSTRAINT `weekly_objectives_class_subject_week_idx` UNIQUE(`class_id`,`subject`,`week`)
);
