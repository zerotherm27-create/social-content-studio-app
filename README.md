# Social Content Studio App

Phase 1 foundation for a multi-brand social content generator and scheduler.

## Current Scope

- Multi-brand workspaces with isolated briefs, selected platforms, drafts, and queues.
- AI generation endpoint for captions, hashtags, art card prompts, video scripts, and preview copy.
- Local deterministic fallback when `OPENAI_API_KEY` is not configured.
- Local persistence through `localStorage`.
- Service boundaries for generation, scheduling, storage, and future API replacement.

## AI Setup

Create `.env` from `.env.example`, then add an OpenAI API key:

```bash
cp .env.example .env
```

```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.4-mini
OPENAI_IMAGE_MODEL=gpt-image-2
```

Restart the dev server after changing `.env`.

## Future Integration Points

- Add Gemini / Nano Banana as a second image provider beside the current OpenAI image endpoint.
- Extend `vite.config.js` or a future backend API to generate rendered videos.
- Replace `src/services/storage.js` with database calls for users, brands, campaigns, posts, and publish logs.
- Add posting adapters under `src/services/platforms/` for Meta, LinkedIn, TikTok, YouTube, Threads, and Google Business.
- Move scheduled publishing into a backend job queue once the app has server/API infrastructure.

## Commands

```bash
npm install
npm run dev
npm run build
```

## Deploy

This app is configured for Vercel with `vercel.json`.

```bash
vercel
```

For production:

```bash
vercel --prod
```

Set these environment variables in Vercel before enabling live AI:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_IMAGE_MODEL`

## Publishing API Setup

The app now exposes:

- `GET /api/integrations-status`
- `POST /api/publish-post`
- `POST /api/publish-queue`

Add the matching credentials in `.env` locally or Vercel Project Settings:

- Meta / Instagram: `META_ACCESS_TOKEN`, `INSTAGRAM_USER_ID`, `FACEBOOK_PAGE_ID`, `FACEBOOK_PAGE_ACCESS_TOKEN`
- Threads: `THREADS_ACCESS_TOKEN`, `THREADS_USER_ID`
- LinkedIn: `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_ORGANIZATION_URN`
- Google Business: `GOOGLE_BUSINESS_ACCESS_TOKEN`, `GOOGLE_BUSINESS_ACCOUNT_ID`, `GOOGLE_BUSINESS_LOCATION_ID`
- TikTok / YouTube: `TIKTOK_ACCESS_TOKEN`, `TIKTOK_OPEN_ID`, `YOUTUBE_ACCESS_TOKEN`, `YOUTUBE_CHANNEL_ID`

Instagram, Threads, TikTok, and YouTube need public hosted media URLs for real media publishing. Generated data URLs work for preview, but the next production step is storing generated assets in Blob/S3-style storage before posting.
