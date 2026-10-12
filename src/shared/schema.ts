import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Chat Messages
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  sender: text("sender").notNull(), // 'user' or one of the characters
  characterId: text("character_id").notNull(), // 'Larry', 'Sensei', 'Dr Neo', 'Hassan'
  createdAt: timestamp("created_at").defaultNow(),
});

// Habits
export const habits = pgTable("habits", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  completed: boolean("completed").default(false),
  streak: integer("streak").default(0),
  dueAt: timestamp("due_at", { mode: "string", withTimezone: true }),
  kind: text("kind").default("habit"), // 'habit' (daily, resets each local day) or 'task' (one-off)
  linkedCharacter: text("linked_character"), // specialist whose in-app activity completes this task
  pointsAwarded: boolean("points_awarded").default(false),
  completedAt: timestamp("completed_at", { mode: "string", withTimezone: true }),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).defaultNow(),
});

// Profile / Progress
export const profile = pgTable("profile", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  level: integer("level").default(1),
  xp: integer("xp").default(0),
  focusSessions: integer("focus_sessions").default(0),
  phoneTime: integer("phone_time").default(0),
  memberSince: timestamp("member_since").defaultNow(),
  preferredName: text("preferred_name"),
  primaryGoal: text("primary_goal"),
  biggestChallenge: text("biggest_challenge"),
  phoneUsage: text("phone_usage"),
  currentSituation: text("current_situation"),
  onboardingStep: integer("onboarding_step").default(0),
  onboardingCompleted: boolean("onboarding_completed").default(false),
});

// Types & Zod Schemas
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertHabitSchema = createInsertSchema(habits).omit({ id: true, pointsAwarded: true, completedAt: true, createdAt: true });
export const insertProfileSchema = createInsertSchema(profile).omit({ id: true, memberSince: true });

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Habit = typeof habits.$inferSelect;
export type InsertHabit = z.infer<typeof insertHabitSchema>;
export type Profile = typeof profile.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
