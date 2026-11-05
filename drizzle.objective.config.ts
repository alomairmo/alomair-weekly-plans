import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "mysql",
  schema: "./db/objectiveSchema.ts",
  out: "./db/objective-migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
