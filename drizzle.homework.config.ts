import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "mysql",
  schema: "./db/homeworkSchema.ts",
  out: "./db/homework-migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
