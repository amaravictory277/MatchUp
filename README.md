# MatchUp

**MatchUp is the home of eFootball tournaments**: players create, discover, join, manage and compete in tournament rooms. Community is deliberately secondary to the tournament journey.

## Current foundation

This initial, Vercel-ready Next.js foundation provides a premium mobile-first tournament discovery experience, installable PWA metadata, offline shell caching, and a Supabase schema for the phased product. The UI demonstrates the priority order: tournament CTA, discovery, direct tournament-ID entry, and then community content.

## Recommended architecture

- **Next.js App Router + TypeScript + Tailwind** for server-rendered routes, responsive UI, and typed feature modules.
- **Supabase Auth** handles email sign-up, verification, login, logout and recovery; a `profiles` trigger creates a player record after registration.
- **Postgres + RLS** stores the domain model. Server Actions/Route Handlers must use the authenticated Supabase server client and enforce organizer/admin checks before mutations.
- **Supabase Storage** keeps avatars, tournament banners, post media and result evidence in separate private/public buckets according to access needs. Use signed URLs for match evidence.
- **Background/edge work**: a trusted server-side result-confirmation transaction advances fixtures; Paystack webhooks verify promotion payments before creating activation records.
- **PWA**: `manifest.webmanifest` and a deliberately small cache-first offline app shell. Extend it with versioned caching and browser push subscriptions when notification delivery is introduced.

## MVP and phases

### Phase 1 — tournament MVP (build next)
1. Configure Supabase environment variables and Auth pages; complete profile onboarding with unique username/player ID.
2. Build authenticated tournament creation, public discovery, ID search, deep links, join/leave policies and tournament rooms.
3. Add knockout fixture generation, score/evidence submissions, dual-player confirmation, disputes and organizer review. Progression runs only after confirmed results.

### Phase 2 — tournament-supporting social
Posts, media, comments, reactions, following/friends, activity and in-app notifications.

### Phase 3 — paid discovery
Admin-configured product pricing, Paystack checkout and verified webhooks. Promotions are activated **only** by a successful server-side verification, never client redirect state. Tournament fees/prizes are explicitly outside MatchUp payments.

### Phase 4 — trust and scale
Moderation workflows, statistics, discovery ranking, optional human-assisted suspicious-evidence flags, and a future pin-battle layer. No claim is made that screenshot editing can be perfectly detected.

## Local development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill in the Supabase values before adding authenticated features. Apply `supabase/schema.sql` in the Supabase SQL editor or with the Supabase CLI.

## Deployment

Deploy to Vercel and configure the same environment variables. Add the deployed origin to Supabase Auth redirect URLs. Keep Paystack secret/webhook verification exclusively in server-side routes.
