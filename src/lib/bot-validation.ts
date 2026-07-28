import { z } from "zod";

const RESERVED_BOT_USERNAMES = new Set(["admin", "system", "qwindevs", "official", "botmother"]);

export const createBotSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores are allowed")
    .refine((v) => !RESERVED_BOT_USERNAMES.has(v.toLowerCase()), "This bot username is reserved")
    .transform((v) => v.toLowerCase()),
  name: z.string().min(2).max(60),
  description: z.string().max(500).optional().default(""),
  category: z.string().min(2).max(40).optional().default("Utility"),
  visibility: z.enum(["EVERYONE", "FOLLOWERS", "PRIVATE"]).optional().default("EVERYONE"),
  welcomeMessage: z.string().max(500).optional()
});

export const createCommandSchema = z.object({
  trigger: z
    .string()
    .min(1)
    .max(32)
    .regex(/^\/[a-zA-Z0-9_-]+$/, "Commands must start with / and contain only letters, numbers, - and _"),
  description: z.string().max(200).optional().default(""),
  mode: z.enum(["STATIC", "SCRIPT"]).optional().default("STATIC"),
  response: z.string().max(4000).optional().default(""),
  handlerCode: z.string().max(8000).optional()
}).refine((d) => d.mode === "STATIC" ? d.response.length > 0 : !!d.handlerCode && d.handlerCode.length > 0, {
  message: "Static commands need response text; script commands need code."
});

export const invokeSchema = z.object({
  trigger: z.string().min(1).max(500)
});
