export const BOT_LIMITS: Record<string, number> = {
  USER: 10,
  PREMIUM: 20,
  VERIFIED_DEVELOPER: 50,
  BUSINESS: 50,
  MODERATOR: 75,
  SUPER_ADMIN: Infinity
};

export function botLimitForRole(role: string): number {
  return BOT_LIMITS[role] ?? BOT_LIMITS.USER;
}
