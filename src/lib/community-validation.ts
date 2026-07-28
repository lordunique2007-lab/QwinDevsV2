import { z } from "zod";

export const createCommunitySchema = z.object({
  type: z.enum(["GROUP", "CHANNEL"]),
  name: z.string().min(2).max(80),
  description: z.string().max(2000).optional().default(""),
  category: z.string().min(2).max(50).optional().default("General"),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).optional().default("PUBLIC")
});

export const communityMessageSchema = z.object({
  content: z.string().min(0).max(4000),
  type: z.enum(["TEXT", "STICKER", "VOICE", "IMAGE", "VIDEO"]).optional().default("TEXT"),
  mediaUrl: z.string().url().optional(),
  mediaDurationSec: z.number().int().positive().max(600).optional()
}).refine((d) => d.type !== "TEXT" || d.content.length > 0, { message: "Message cannot be empty." });

export const communityPostSchema = z.object({
  content: z.string().max(4000).default(""),
  mediaUrl: z.string().url().optional(),
  mediaType: z.enum(["image", "video"]).optional()
}).refine((d) => d.content.length > 0 || !!d.mediaUrl, { message: "Post needs text or media." });

export const memberActionSchema = z.object({
  username: z.string().min(1),
  action: z.enum(["promote_admin", "promote_moderator", "demote", "kick", "ban", "unban"])
});
