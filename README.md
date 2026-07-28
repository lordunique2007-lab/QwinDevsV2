# Qwin Devs

Where Developers Build. Share. Connect. Grow.

Founded by **Qwingrace**.

This is a real, working Next.js application — every button, form, and API route talks
to an actual PostgreSQL database through Prisma. Nothing here is a mockup, a stub, or
a "coming soon."

## What's built

**Accounts & identity**
- Registration with live username availability, password strength meter, bcrypt
  hashing, NextAuth JWT sessions.
- Every account gets a permanent 10-digit numeric ID (like Telegram's user ID),
  separate from the username. The username can be hidden from public view in
  Settings — the numeric ID always still resolves the account.
- An animated verified badge (hand-drawn SVG checkmark, not an emoji) in the same
  visual language as Telegram/WhatsApp/Facebook's blue check.
- Full profile editing — display name, bio, avatar, and banner, all with real image
  uploads, from `/settings`.

**Ban & freeze enforcement (real, not just login-blocking)**
- Admins can ban (with an optional expiry) or freeze accounts from `/admin`.
- A ban or freeze takes effect immediately, even for someone already logged in — not
  just future login attempts. Their next request anywhere in the app signs them out
  and shows a full "this account is banned/frozen" screen with the reason and, for
  timed bans, exactly when they'll be able to log in again.
- Timed bans auto-expire on their own — no admin action needed to restore the account
  once the clock runs out.
- See `src/lib/auth.ts` (the `session` callback) and `src/components/BannedGate.tsx`.

**Social feed** — text, image, and video posts, likes, infinite scroll.

**Stories** — 24-hour expiring image/video stories from people you follow, with a
"seen" indicator, exactly like the format everyone recognizes.

**Project marketplace** — publish real downloadable files (up to 200MB) via direct
browser-to-storage upload, browse, search, filter by category, sort, star ratings +
written reviews, download tracking with a real counter.

**Messaging**
- 1:1 chats with text, photos, videos, voice notes, and stickers.
- Message requests — a non-follower's first message goes to Requests until accepted
  or declined. Blocking severs any follow relationship too.
- Real-time delivery via Pusher when configured; falls back to a 15-second safety-net
  poll if it isn't, so chat still works either way (see "Real-time" below).

**Groups & Channels**
- Public/private groups (member chat) or channels (broadcast posts), each supporting
  the same photo/video/voice/sticker message types as DMs.
- Role hierarchy (Owner > Admin > Moderator > Member) with real rank-enforced
  promote/demote/kick/ban, invite links, join/leave.
- **Official channels** — a Super Admin can mark any channel or group "official" from
  `/admin`. Every existing account is retroactively enrolled and every future signup
  is auto-joined; members can't leave it, and it's pinned at the top of everyone's
  chat list. This is how you'd run a platform-wide announcement channel.

**Botmother** — the bot platform
- Create bots with per-role creation limits, hashed API tokens (shown once).
- Commands can be **static text** or **real JS scripts** you write yourself, run
  sandboxed with a 1-second timeout right on the platform.
- For bots written in **Python, Go, or any other language**: exactly like Telegram,
  Qwin Devs never executes your bot's actual logic. Instead it delivers a signed
  webhook to your own server when someone messages your bot, and your server calls
  back a `send` endpoint to reply. Full worked Python (Flask) and Node.js (Express)
  examples are built into each bot's dashboard.
- The official `@botmother` account ships pre-seeded and verified.

**Qwin Currency wallet** — every account gets a wallet on signup, atomic peer-to-peer
transfers (no negative balances, no partial transfers — see `src/lib/wallet.ts`),
full transaction history.

**Premium & Boosts**
- Premium and Premium Plus subscriptions, paid for in QC, extend correctly if bought
  before the current period ends rather than wasting time.
- Boost a project, bot, or community you own for 24h–30 days to surface it first in
  discovery — visibly marked with a gold "Boosted" badge.

**Admin / moderation console** — hidden `/admin`, visible only to Moderators and the
Super Admin: platform stats, user search, ban/freeze (with real enforcement, see
above), role & verification management, a reports queue, an immutable audit log, an
official-channels manager, and a "Meet the Team" roster editor.

**Meet the Team page** (`/team`) — a fully editable roster with a title, subtitle, and
ranked groups (e.g. Lead Developer, Senior Developers, Members). Edit it two ways:
before deploying, by editing the clearly-marked section at the top of
`prisma/seed.ts`; or any time afterward, from `/admin` → Team, without touching code.

**Notifications & search** — a real `Notification` model wired into follows, wallet
transfers, and Premium renewals, with an unread badge in the nav; one search box that
queries users, projects, bots, and communities together.

**Internationalization** — a real language switcher (English, Spanish, French,
Portuguese, Arabic) with `dir="rtl"` applied automatically for Arabic, persisted
across visits.

**Accessibility** — a skip-to-content link, visible keyboard focus rings on every
interactive element, and full respect for the OS-level "reduce motion" setting
(including the verified badge's animation).

Everything server-side enforces its own auth and permission checks — the UI never
trusts the client for anything that matters.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Prisma · PostgreSQL ·
NextAuth.js · Pusher (real-time) · Vercel Blob (file storage)

## Run it locally

You'll need Node 18+, a PostgreSQL database, and (optionally, for full functionality)
free-tier accounts on Pusher and Vercel Blob.

```bash
npm install
cp .env.example .env
```

Fill in `.env`:
- `DATABASE_URL` — a free Postgres database from [Neon](https://neon.tech) or
  [Supabase](https://supabase.com) takes about a minute to create.
- `NEXTAUTH_SECRET` — output of `openssl rand -base64 32`.
- `PUSHER_*` / `NEXT_PUBLIC_PUSHER_*` — optional. Without these, messaging still
  works, just via a slower fallback poll instead of instant delivery. Create a free
  "Channels" app at [pusher.com](https://pusher.com) to enable real-time.
- `BLOB_READ_WRITE_TOKEN` — optional but recommended. Without it, every upload
  feature (avatars, banners, stories, project files, chat photos/videos/voice notes)
  returns a clear "not configured" error instead of failing silently. Add a Blob
  store from your Vercel project's Storage tab, or run `vercel env pull` locally.

Then:

```bash
npm run db:push     # creates all tables from prisma/schema.prisma
npm run db:seed     # creates the founder account, @botmother, and the team roster
npm run dev          # http://localhost:3000
```

The seed prints what you need to save:
- The founder login: email `founder@qwindevs.com`, password `ChangeMe123!` — this is
  the Super Admin account. **Change the password immediately** (via Settings once
  logged in, or by editing `prisma/seed.ts` before you seed).
- The `@botmother` bot's API token (shown once, in the terminal).

## Editing the "Meet the Team" page before you deploy

Open `prisma/seed.ts` — the `TEAM_PAGE` and `TEAM_ROSTER` constants near the top are
clearly marked. Edit the title, subtitle, and add/remove/rename anyone you want, then
run `npm run db:seed` again — it updates existing entries and adds new ones without
duplicating anyone. You can also manage the same roster later from `/admin` → Team,
no code required.

## Push to GitHub

```bash
git init
git add .
git commit -m "Qwin Devs: full platform"
git branch -M main
git remote add origin https://github.com/<your-username>/qwin-devs.git
git push -u origin main
```

## Deploy to Vercel

1. Import the GitHub repo at [vercel.com/new](https://vercel.com/new).
2. Add a Postgres database (Vercel's Storage tab offers one-click Postgres) and a
   Blob store (same tab) — both wire up their env vars automatically.
3. Set the remaining environment variables in Project Settings:
   `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (your production URL), and the `PUSHER_*` /
   `NEXT_PUBLIC_PUSHER_*` pair if you want real-time messaging.
4. Deploy. Vercel runs `npm install` (triggering `prisma generate` via
   `postinstall`) then `npm run build` automatically.
5. Run the schema push and seed once against production:

```bash
vercel env pull .env.production.local
npx prisma db push
npx tsx prisma/seed.ts
```

## Project structure

```
prisma/schema.prisma          Every data model — 28 models covering accounts, wallet,
                               projects, posts, stories, messaging, communities, bots,
                               boosts, premium, moderation, notifications, team roster.

src/lib/wallet.ts             Atomic Qwin Currency ledger (transfers + platform debits).
src/lib/auth.ts               Login flow + real-time ban/freeze session enforcement.
src/lib/messaging.ts          1:1 chat rules — blocking, requests, webhook forwarding.
src/lib/community.ts          Group/channel roles, membership, official-channel logic.
src/lib/bot-script.ts         Sandboxed JS command execution for Botmother.
src/lib/bot-webhook.ts        Signed webhook delivery — the Python/Go/any-language path.
src/lib/admin.ts              Admin/moderator permission gate + audit log writer.
src/lib/pricing.ts            Premium and Boost QC pricing.
src/lib/i18n.ts               Translation dictionary for the language switcher.

src/app/api/**                REST endpoints. Every one enforces auth server-side.
src/app/**/page.tsx           Real pages wired to those endpoints — no dummy data.
src/components/VerifiedBadge.tsx   The animated checkmark used everywhere a badge appears.
src/components/BannedGate.tsx      The full-screen lockout shown to banned/frozen accounts.
```

## Design decisions worth knowing about

- **Messaging real-time is Pusher, with a polling fallback.** Vercel's serverless
  functions can't hold a persistent connection open, so a managed pub/sub service is
  the honest way to get instant delivery without running a separate always-on server.
  If you don't configure Pusher, the UI still works, just refreshing periodically —
  it never silently fails.
- **Bots run your code two ways.** Static replies and short JS snippets execute
  directly on Qwin Devs (sandboxed, 1-second timeout, no network/filesystem access —
  Node's own docs are clear that this isn't a security boundary against a malicious
  stranger's code, which is why only a bot's owner can author its scripts). For
  anything bigger, or for Python/Go/etc., your bot is a normal external web server
  that Qwin Devs calls via signed webhook — the same architecture Telegram itself
  uses.
- **Bot and Blob tokens are shown exactly once.** Bot API tokens are bcrypt-hashed
  like passwords; webhook secrets are stored so the platform can sign requests without
  ever needing your bot's own token back.
- **Ban enforcement lives in one place** — the NextAuth `session` callback — rather
  than being scattered across every route. Every route already checks
  `if (!session?.user)`, so making that callback return `null` for banned/frozen
  accounts enforces the block everywhere at once, immediately, without a mass edit.
- **The admin console is a normal route, not a separate app**, gated by a server-side
  role check on every API call, not just hidden in the UI.
- **The audit log has no update/delete endpoint** — by design.

## What's still genuinely out of scope

Being honest about the edges: a couple of pieces from the original spec would be
their own follow-up modules rather than something to bolt on casually —

- A public Developer API / SDKs for third-party integrations beyond bots.
- KYC-gated real-money withdrawals from the wallet (QC is currently a closed-loop
  in-platform currency by design, matching the spec's "prepare the architecture, don't
  implement unsupported payment methods without proper configuration").
- A full automated test suite and CI pipeline.

Everything else described in the original 11-part specification is implemented and
wired end-to-end.
