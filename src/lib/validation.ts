import { z } from "zod";

const RESERVED_USERNAMES = new Set([
  "admin",
  "moderator",
  "support",
  "system",
  "qwindevs",
  "botmother",
  "api",
  "official",
  "owner",
  "root",
  "null",
  "undefined"
]);

export const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(24, "Username must be at most 24 characters")
  .regex(/^[a-zA-Z0-9_.-]+$/, "Only letters, numbers, underscores, dots and hyphens are allowed")
  .refine((v) => !RESERVED_USERNAMES.has(v.toLowerCase()), {
    message: "This username is reserved"
  })
  .transform((v) => v.toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters");

export const registerSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  username: usernameSchema,
  email: z.string().email().transform((v) => v.toLowerCase()),
  dateOfBirth: z.string().refine((v) => {
    const dob = new Date(v);
    const age = (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return age >= 13;
  }, "You must be at least 13 years old"),
  password: passwordSchema,
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

export function bioLimitForRole(role: string, premiumTier?: string): number {
  const roleLimit = (() => {
    switch (role) {
      case "SUPER_ADMIN":
        return 1000;
      case "PREMIUM":
      case "VERIFIED_DEVELOPER":
      case "MODERATOR":
        return 300;
      default:
        return 150;
    }
  })();

  const tierLimit = premiumTier === "PREMIUM_PLUS" ? 500 : premiumTier === "PREMIUM" ? 300 : 0;

  return Math.max(roleLimit, tierLimit);
}

export const projectSchema = z.object({
  name: z.string().min(2).max(80),
  tagline: z.string().max(120).optional().default(""),
  description: z.string().min(20).max(20000),
  category: z.string().min(2).max(50),
  tags: z.array(z.string().max(30)).max(10).default([]),
  repoUrl: z.string().url().optional().or(z.literal("")),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  version: z.string().min(1).max(20).default("1.0.0"),
  license: z.string().min(1).max(40).default("MIT"),
  fileUrl: z.string().url().optional(),
  fileName: z.string().max(200).optional(),
  fileSize: z.number().int().positive().optional()
});

export const postSchema = z.object({
  content: z.string().max(3000).default(""),
  imageUrl: z.string().url().optional().or(z.literal("")),
  mediaType: z.enum(["image", "video"]).optional()
}).refine((d) => d.content.trim().length > 0 || !!d.imageUrl, {
  message: "Post needs text or media."
});

export const ratingSchema = z.object({
  stars: z.number().int().min(1).max(5),
  review: z.string().max(3000).optional().default("")
});

export const sendQcSchema = z.object({
  receiverUsername: usernameSchema,
  amount: z.number().int().positive().max(1_000_000),
  message: z.string().max(200).optional().default("")
});

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  bio: z.string().max(1000).optional(),
  avatarUrl: z.string().url().optional().or(z.literal("")),
  bannerUrl: z.string().url().optional().or(z.literal("")),
  usernameHidden: z.boolean().optional()
});
