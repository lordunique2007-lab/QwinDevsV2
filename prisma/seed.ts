import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateBotToken, hashBotToken, tokenPreview } from "../src/lib/bot-token";
import { formatNumericId } from "../src/lib/user-id";

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────
// EDIT THIS SECTION to change the "Meet the Team" page (/team) before you
// deploy. Add, remove, or rename anyone you want — this is the only place
// you need to touch. Re-running `npm run db:seed` after editing will add
// any new names and update existing ones; it won't duplicate people whose
// name+rank already exists. You can also manage this same roster from
// inside the app later at /admin (Team tab) without touching this file.
// ─────────────────────────────────────────────────────────────────────────
const TEAM_PAGE = {
  title: "Meet Team Developers of Abyss",
  subtitle: "Abyss Team Developers"
};

const TEAM_ROSTER: { rankLabel: string; name: string; linkedUsername?: string }[] = [
  { rankLabel: "Lead Expert Developer", name: "Dev Ꭺɪᴍʙᴏᴛ Unique『⌬ 𝐀𝐁𝐘𝐒𝐒 ⌬』", linkedUsername: "qwingrace" },

  { rankLabel: "Senior Abyss Developers", name: "Dev Mr Loner Terrific『⌬ 𝐀𝐁𝐘𝐒𝐒 ⌬』" },
  { rankLabel: "Senior Abyss Developers", name: "Dev Mr Python Code『⌬ 𝐀𝐁𝐘𝐒𝐒 ⌬』" },
  { rankLabel: "Senior Abyss Developers", name: "Dev Lord Satanus『⌬ 𝐀𝐁𝐘𝐒𝐒 ⌬』" },

  { rankLabel: "Abyss Members", name: "Dev Nex Tech『⌬ 𝐀𝐁𝐘𝐒𝐒 ⌬』" },
  { rankLabel: "Abyss Members", name: "Dev Barry Dee『⌬ 𝐀𝐁𝐘𝐒𝐒 ⌬』" },
  { rankLabel: "Abyss Members", name: "Dev Mr Luis『⌬ 𝐀𝐁𝐘𝐒𝐒 ⌬』" },
  { rankLabel: "Abyss Members", name: "Dev Rimuru 777『⌬ 𝐀𝐁𝐘𝐒𝐒 ⌬』" },
  { rankLabel: "Abyss Members", name: "Dev Retired Savage『⌬ 𝐀𝐁𝐘𝐒𝐒 ⌬』" },
  { rankLabel: "Abyss Members", name: "Dev NCT Dark Beloved『⌬ 𝐀𝐁𝐘𝐒𝐒 ⌬』" }
];
// ─────────────────────────────────────────────────────────────────────────

async function main() {
  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);

  const founder = await prisma.user.upsert({
    where: { username: "qwingrace" },
    update: {},
    create: {
      username: "qwingrace",
      displayName: "Qwingrace",
      email: "founder@qwindevs.com",
      passwordHash,
      bio: "Founder of Qwin Devs. Where Developers Build. Share. Connect. Grow.",
      role: "SUPER_ADMIN",
      isVerified: true,
      wallet: {
        create: {
          balance: 1_000_000,
          lifetimeIn: 1_000_000
        }
      }
    }
  });

  console.log("Seeded founder account:", founder.username, `(ID ${formatNumericId(founder.numericId)})`);
  console.log("Login with email founder@qwindevs.com / password ChangeMe123!");
  console.log("Change this password immediately after first deploy.");

  // The official Botmother bot — the platform's own verified assistant, shown
  // with the same animated blue check as any other verified account/bot.
  const existingBotmother = await prisma.bot.findUnique({ where: { username: "botmother" } });
  if (!existingBotmother) {
    const token = generateBotToken();
    const tokenHash = await hashBotToken(token);

    const botmother = await prisma.bot.create({
      data: {
        ownerId: founder.id,
        username: "botmother",
        name: "Botmother",
        description: "The official Qwin Devs bot platform assistant. Ask me for help building your own bot.",
        category: "Utility",
        visibility: "EVERYONE",
        isVerified: true,
        welcomeMessage: "👋 I'm Botmother. Type /help to see what I can do, or head to /bots/new to build your own bot.",
        tokenHash,
        tokenPreview: tokenPreview(token),
        commands: {
          create: [
            {
              trigger: "/help",
              description: "List what Botmother can do",
              response:
                "I can point you to bot creation (/bots/new), your bot dashboard, and Botmother's API docs in the README."
            },
            {
              trigger: "/docs",
              description: "Link to the Bot API docs",
              response: "See the Bot API section of the project README for how to call POST /api/bots/{username}/invoke."
            }
          ]
        }
      }
    });

    console.log("Seeded official verified bot: @botmother");
    console.log("Botmother bot token (save this now, it will not be shown again):", token);
  } else {
    console.log("@botmother bot already exists — skipped.");
  }

  // "Meet the Team" page settings + roster (see TEAM_PAGE / TEAM_ROSTER above).
  await prisma.teamSettings.upsert({
    where: { id: "singleton" },
    update: { pageTitle: TEAM_PAGE.title, subtitle: TEAM_PAGE.subtitle },
    create: { id: "singleton", pageTitle: TEAM_PAGE.title, subtitle: TEAM_PAGE.subtitle }
  });

  for (let i = 0; i < TEAM_ROSTER.length; i++) {
    const entry = TEAM_ROSTER[i];
    const existing = await prisma.teamMember.findFirst({
      where: { rankLabel: entry.rankLabel, name: entry.name }
    });
    if (existing) {
      await prisma.teamMember.update({
        where: { id: existing.id },
        data: { order: i, linkedUsername: entry.linkedUsername }
      });
    } else {
      await prisma.teamMember.create({
        data: { rankLabel: entry.rankLabel, name: entry.name, order: i, linkedUsername: entry.linkedUsername }
      });
    }
  }
  console.log(`Seeded team roster: ${TEAM_ROSTER.length} members across ${new Set(TEAM_ROSTER.map((m) => m.rankLabel)).size} ranks.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
