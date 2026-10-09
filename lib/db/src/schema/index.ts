import { pgTable, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sessionsTable = pgTable("kin_sessions", {
  id: text("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  status: text("status").notNull().default("completed"),
  language: text("language").notNull().default("auto"),
  riskScore: integer("risk_score").notNull().default(0),
  toolsTriggered: integer("tools_triggered").notNull().default(0),
});

export const alertsTable = pgTable("kin_alerts", {
  id: text("id").primaryKey(),
  sessionId: text("session_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  severity: text("severity").notNull().default("high"),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  evidence: text("evidence").notNull(),
  recommendedAction: text("recommended_action").notNull(),
  screenshotUrl: text("screenshot_url"),
  telegramNotified: boolean("telegram_notified").notNull().default(false),
});

export const insertSessionSchema = createInsertSchema(sessionsTable);
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessionsTable.$inferSelect;

export const insertAlertSchema = createInsertSchema(alertsTable);
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alertsTable.$inferSelect;