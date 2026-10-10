import { z } from "zod";
import { insertMessageSchema, insertHabitSchema, insertProfileSchema, messages, habits, profile } from "./schema";

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
};

export const api = {
  messages: {
    list: {
      method: "GET" as const,
      path: "/api/messages",
      input: z.object({ characterId: z.string().optional() }).optional(),
      responses: {
        200: z.array(z.custom<typeof messages.$inferSelect>()),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/messages",
      input: insertMessageSchema,
      responses: {
        201: z.custom<typeof messages.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  habits: {
    list: {
      method: "GET" as const,
      path: "/api/habits",
      responses: {
        200: z.array(z.custom<typeof habits.$inferSelect>()),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/habits",
      input: insertHabitSchema,
      responses: {
        201: z.custom<typeof habits.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: "PUT" as const,
      path: "/api/habits/:id",
      input: insertHabitSchema.partial(),
      responses: {
        200: z.custom<typeof habits.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/habits/:id",
      responses: {
        204: z.null(),
        404: errorSchemas.notFound,
      },
    },
  },
  profile: {
    get: {
      method: "GET" as const,
      path: "/api/profile",
      responses: {
        200: z.custom<typeof profile.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: "PUT" as const,
      path: "/api/profile",
      input: insertProfileSchema.partial(),
      responses: {
        200: z.custom<typeof profile.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type MessageResponse = z.infer<typeof api.messages.create.responses[201]>;
export type HabitResponse = z.infer<typeof api.habits.create.responses[201]>;
export type ProfileResponse = z.infer<typeof api.profile.get.responses[200]>;
export type { InsertMessage, InsertHabit, InsertProfile } from "./schema";
