const META_GRAPH_VERSION = "v25.0";

export const platformRequirements = {
  instagram: {
    label: "Instagram",
    required: ["META_ACCESS_TOKEN", "INSTAGRAM_USER_ID"],
    notes: "Requires a Meta app with Instagram content publishing access. Image/video media must be available by public URL.",
  },
  facebook: {
    label: "Facebook",
    required: ["FACEBOOK_PAGE_ID", "FACEBOOK_PAGE_ACCESS_TOKEN"],
    notes: "Publishes to a Facebook Page, not a personal profile.",
  },
  linkedin: {
    label: "LinkedIn",
    required: ["LINKEDIN_ACCESS_TOKEN", "LINKEDIN_ORGANIZATION_URN"],
    notes: "Publishes text company updates. Image upload needs a LinkedIn asset upload step.",
  },
  threads: {
    label: "Threads",
    required: ["THREADS_ACCESS_TOKEN", "THREADS_USER_ID"],
    notes: "Uses Threads' container-and-publish flow. Media must be a public URL.",
  },
  googleBusiness: {
    label: "Google Business",
    required: ["GOOGLE_BUSINESS_ACCESS_TOKEN", "GOOGLE_BUSINESS_ACCOUNT_ID", "GOOGLE_BUSINESS_LOCATION_ID"],
    notes: "Creates Google Business Profile local posts for the configured location.",
  },
  tiktok: {
    label: "TikTok",
    required: ["TIKTOK_ACCESS_TOKEN", "TIKTOK_OPEN_ID"],
    notes: "Direct posting requires Content Posting API approval and hosted video assets.",
  },
  youtube: {
    label: "YouTube",
    required: ["YOUTUBE_ACCESS_TOKEN", "YOUTUBE_CHANNEL_ID"],
    notes: "YouTube Shorts upload requires resumable video upload, not just a caption.",
  },
};

function envValue(env, key) {
  return env[key] || "";
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(value || "");
}

function graphVersion(env) {
  return env.META_GRAPH_VERSION || META_GRAPH_VERSION;
}

function jsonResult(platformId, status, message, extra = {}) {
  return {
    platformId,
    status,
    message,
    at: new Date().toISOString(),
    ...extra,
  };
}

function publicMediaUrl(post) {
  return isHttpUrl(post.artImageUrl) ? post.artImageUrl : "";
}

async function postForm(url, values) {
  const body = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") body.set(key, value);
  });

  const response = await fetch(url, { method: "POST", body });
  const payload = await response.json().catch(async () => ({ raw: await response.text() }));

  if (!response.ok) {
    throw new Error(payload.error?.message || payload.message || `Request failed with ${response.status}`);
  }

  return payload;
}

async function postJson(url, token, payload, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(async () => ({ raw: await response.text() }));

  if (!response.ok) {
    throw new Error(result.error?.message || result.message || `Request failed with ${response.status}`);
  }

  return result;
}

export function getIntegrationStatus(env) {
  return Object.entries(platformRequirements).map(([platformId, config]) => {
    const missing = config.required.filter((key) => !envValue(env, key));
    return {
      platformId,
      label: config.label,
      status: missing.length === 0 ? "ready" : "missing",
      missing,
      notes: config.notes,
    };
  });
}

export async function publishPostToPlatform({ brand, post, env, dryRun = false }) {
  const config = platformRequirements[post.platformId];
  if (!config) {
    return jsonResult(post.platformId, "unsupported", "No adapter exists for this platform yet.", { postId: post.id });
  }

  const missing = config.required.filter((key) => !envValue(env, key));
  if (missing.length > 0) {
    return jsonResult(post.platformId, "missing_credentials", `Missing credentials: ${missing.join(", ")}`, { missing, postId: post.id });
  }

  if (dryRun) {
    return jsonResult(post.platformId, "dry_run", "Credentials are present. Dry run skipped external publishing.", { postId: post.id });
  }

  try {
    switch (post.platformId) {
      case "facebook":
        return publishFacebook({ post, env });
      case "instagram":
        return publishInstagram({ post, env });
      case "linkedin":
        return publishLinkedIn({ brand, post, env });
      case "threads":
        return publishThreads({ post, env });
      case "googleBusiness":
        return publishGoogleBusiness({ post, env });
      case "tiktok":
      case "youtube":
        return jsonResult(post.platformId, "needs_video_upload", "Credentials are present, but this post needs a hosted video upload pipeline before automatic publishing.", { postId: post.id });
      default:
        return jsonResult(post.platformId, "unsupported", "No adapter exists for this platform yet.", { postId: post.id });
    }
  } catch (error) {
    return jsonResult(post.platformId, "failed", error instanceof Error ? error.message : "Publishing failed", { postId: post.id });
  }
}

async function publishFacebook({ post, env }) {
  const base = `https://graph.facebook.com/${graphVersion(env)}/${env.FACEBOOK_PAGE_ID}`;
  const imageUrl = publicMediaUrl(post);
  const payload = imageUrl
    ? await postForm(`${base}/photos`, {
        url: imageUrl,
        caption: post.caption,
        access_token: env.FACEBOOK_PAGE_ACCESS_TOKEN,
      })
    : await postForm(`${base}/feed`, {
        message: post.caption,
        access_token: env.FACEBOOK_PAGE_ACCESS_TOKEN,
      });

  return jsonResult("facebook", "published", "Published to Facebook Page.", { postId: post.id, providerResponse: payload });
}

async function publishInstagram({ post, env }) {
  const imageUrl = publicMediaUrl(post);
  if (!imageUrl) {
    return jsonResult("instagram", "needs_public_media", "Instagram publishing needs the generated art/video hosted at a public HTTPS URL.", { postId: post.id });
  }

  const base = `https://graph.facebook.com/${graphVersion(env)}/${env.INSTAGRAM_USER_ID}`;
  const container = await postForm(`${base}/media`, {
    image_url: imageUrl,
    caption: post.caption,
    access_token: env.META_ACCESS_TOKEN,
  });
  const published = await postForm(`${base}/media_publish`, {
    creation_id: container.id,
    access_token: env.META_ACCESS_TOKEN,
  });

  return jsonResult("instagram", "published", "Published to Instagram.", { postId: post.id, providerResponse: published });
}

async function publishLinkedIn({ brand, post, env }) {
  const payload = {
    author: env.LINKEDIN_ORGANIZATION_URN,
    commentary: post.caption,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  const result = await postJson("https://api.linkedin.com/rest/posts", env.LINKEDIN_ACCESS_TOKEN, payload, {
    "LinkedIn-Version": env.LINKEDIN_VERSION || "202506",
    "X-Restli-Protocol-Version": "2.0.0",
  });

  return jsonResult("linkedin", "published", `Published ${brand.name} update to LinkedIn.`, { postId: post.id, providerResponse: result });
}

async function publishThreads({ post, env }) {
  const imageUrl = publicMediaUrl(post);
  const base = `https://graph.threads.net/${graphVersion(env)}/${env.THREADS_USER_ID}`;
  const container = await postForm(`${base}/threads`, {
    media_type: imageUrl ? "IMAGE" : "TEXT",
    image_url: imageUrl,
    text: post.caption.slice(0, 500),
    access_token: env.THREADS_ACCESS_TOKEN,
  });
  const published = await postForm(`${base}/threads_publish`, {
    creation_id: container.id,
    access_token: env.THREADS_ACCESS_TOKEN,
  });

  return jsonResult("threads", "published", "Published to Threads.", { postId: post.id, providerResponse: published });
}

async function publishGoogleBusiness({ post, env }) {
  const accountId = env.GOOGLE_BUSINESS_ACCOUNT_ID;
  const locationId = env.GOOGLE_BUSINESS_LOCATION_ID;
  const url = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/localPosts`;
  const imageUrl = publicMediaUrl(post);
  const payload = {
    languageCode: env.GOOGLE_BUSINESS_LANGUAGE || "en-US",
    summary: post.caption.slice(0, 1500),
    topicType: "STANDARD",
    media: imageUrl
      ? [
          {
            mediaFormat: "PHOTO",
            sourceUrl: imageUrl,
          },
        ]
      : undefined,
  };

  const result = await postJson(url, env.GOOGLE_BUSINESS_ACCESS_TOKEN, payload);
  return jsonResult("googleBusiness", "published", "Published to Google Business Profile.", { postId: post.id, providerResponse: result });
}

export async function publishQueue({ brand, posts, env, dryRun = false }) {
  const results = [];
  for (const post of posts) {
    results.push(await publishPostToPlatform({ brand, post, env, dryRun }));
  }

  return {
    source: dryRun ? "dry_run" : "platform_apis",
    results,
    published: results.filter((result) => result.status === "published").length,
    blocked: results.filter((result) => result.status !== "published").length,
  };
}
