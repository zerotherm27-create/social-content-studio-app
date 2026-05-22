# Katmon Studio

AI marketing studio for generating, scheduling, storing, and publishing branded business content.

## Current Scope

- Multi-brand workspaces with isolated business profiles, briefs, selected platforms, drafts, and queues.
- AI generation endpoint for captions, hashtags, art card prompts, video scripts, and preview copy.
- Provider-based media generation for OpenAI image, Gemini / Nano Banana image, and Google Veo video jobs.
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

- Add a poll/download worker for completed Veo videos.
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
- `BLOB_READ_WRITE_TOKEN`

## Media Storage

Generated art cards are routed through `api/_media-storage.js`. The current provider is Vercel Blob. If `BLOB_READ_WRITE_TOKEN` is configured, art cards are uploaded to Blob and returned as public HTTPS URLs. If it is not configured, the app keeps using inline fallback media so local development still works.

This keeps the app upgradeable: Railway Buckets, Cloudflare R2, or S3 can later replace Vercel Blob by changing the storage adapter instead of the UI.

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

## Google Gemini / Nano Banana / Veo Setup

Katmon Studio can use Google media models beside OpenAI:

- Art cards: select `Gemini / Nano Banana` in the Brand Kit and set `GEMINI_API_KEY`.
- Videos: select `Google Veo` and set `GEMINI_API_KEY`.

Recommended environment variables:

```bash
GEMINI_API_KEY=your_google_ai_studio_key
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image-preview
GEMINI_VIDEO_MODEL=veo-3.1-generate-preview
MEDIA_ART_PROVIDER=openai
MEDIA_VIDEO_PROVIDER=gemini-veo
```

Veo generation is long-running, so the app starts the video job and stores the operation name on the post. A later production phase should add a poll/download worker that saves finished MP4 files to Blob or another media bucket.
