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
});

// Types & Zod Schemas
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertHabitSchema = createInsertSchema(habits).omit({ id: true });
export const insertProfileSchema = createInsertSchema(profile).omit({ id: true, memberSince: true });

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Habit = typeof habits.$inferSelect;
export type InsertHabit = z.infer<typeof insertHabitSchema>;
export type Profile = typeof profile.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
