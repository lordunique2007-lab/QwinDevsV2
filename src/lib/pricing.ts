export const PREMIUM_PRICING = {
  PREMIUM: { qcPerMonth: 300, bioLimit: 300, label: "Premium" },
  PREMIUM_PLUS: { qcPerMonth: 600, bioLimit: 500, label: "Premium Plus" }
} as const;

export type PremiumTierKey = keyof typeof PREMIUM_PRICING;

export const BOOST_PRICING: Record<string, number> = {
  "24h": 100,
  "3d": 250,
  "7d": 500,
  "14d": 900,
  "30d": 1600
};

export const BOOST_DURATIONS_MS: Record<string, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "3d": 3 * 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "14d": 14 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000
};
