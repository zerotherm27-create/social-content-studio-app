import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { getIntegrationStatus, publishPostToPlatform, publishQueue } from "./api/_platforms.js";
import { generatePostsForBrand, previewForBrand } from "./src/services/contentGenerator.js";

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function writeJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function extractResponseText(response) {
  if (response.output_text) return response.output_text;

  return (response.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text")
    .map((content) => content.text)
    .join("");
}

function fallbackPayload(brand, reason = "OPENAI_API_KEY is not configured") {
  const message = brand.message || brand.goal || `new ${brand.industry || "brand"} campaign`;
  return {
    source: "fallback",
    reason,
    preview: previewForBrand(brand),
    posts: generatePostsForBrand(brand).map((post) => ({
      ...post,
      generationSource: "fallback",
      visualPrompt: `Create a polished branded ${post.media.toLowerCase()} for ${brand.name}: ${message}`,
      videoScript: post.media === "Video" ? `${post.caption} Show the offer, the proof, then a clear call to action.` : "",
    })),
  };
}

function escapeSvgText(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapWords(text, maxChars = 15, maxLines = 5) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];

  for (const word of words) {
    const current = lines[lines.length - 1] ?? "";
    if (!current || `${current} ${word}`.length > maxChars) {
      if (lines.length < maxLines) lines.push(word);
    } else {
      lines[lines.length - 1] = `${current} ${word}`;
    }
  }

  return lines;
}

function fallbackArtCard({ post, brand, reason = "OPENAI_API_KEY is not configured" }) {
  const titleLines = wrapWords(post.visualPrompt?.replace(/^Create a polished branded .*?:\s*/i, "") || brand.message, 15, 5);
  const width = post.width || 1080;
  const height = post.height || 1350;
  const platformName = post.platformName || post.platform || post.platformId || "Platform";
  const ratio = post.ratio || `${width}:${height}`;
  const logoSize = Math.max(72, Math.round(width * 0.09));
  const lineStart = Math.round(height * 0.32);
  const lineGap = Math.max(54, Math.round(height * 0.056));
  const fontSize = Math.max(44, Math.round(width * 0.06));
  const left = Math.round(width * 0.08);
  const lineMarkup = titleLines
    .map((line, index) => `<text x="${left}" y="${lineStart + index * lineGap}" font-size="${fontSize}" font-weight="900" fill="#ffffff">${escapeSvgText(line)}</text>`)
    .join("");
  const logoMarkup = brand.logoImageUrl
    ? `<image x="${left}" y="${Math.round(height * 0.12)}" width="${logoSize}" height="${logoSize}" href="${escapeSvgText(brand.logoImageUrl)}" preserveAspectRatio="xMidYMid meet"/>`
    : `<rect x="${left}" y="${Math.round(height * 0.12)}" width="${logoSize}" height="${logoSize}" rx="18" fill="#ffffff" opacity=".92"/>
    <text x="${left + Math.round(logoSize * 0.2)}" y="${Math.round(height * 0.12) + Math.round(logoSize * 0.62)}" font-size="${Math.round(logoSize * 0.34)}" font-weight="900" fill="${escapeSvgText(brand.primaryColor || "#142019")}">${escapeSvgText(brand.logoText || brand.initials || "BR")}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="${escapeSvgText(brand.primaryColor || "#6d3d30")}"/>
      <stop offset="0.55" stop-color="${escapeSvgText(brand.secondaryColor || "#527462")}"/>
      <stop offset="1" stop-color="${escapeSvgText(brand.accentColor || "#253952")}"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="#17201c" flood-opacity=".28"/>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" rx="38" fill="url(#bg)"/>
  <circle cx="${Math.round(width * 0.72)}" cy="${Math.round(height * 0.4)}" r="${Math.round(Math.min(width, height) * 0.38)}" fill="none" stroke="#ffffff" stroke-opacity=".35" stroke-width="5"/>
  <circle cx="${Math.round(width * 0.8)}" cy="${Math.round(height * 0.08)}" r="${Math.round(Math.min(width, height) * 0.18)}" fill="${escapeSvgText(brand.secondaryColor || "#b7f3d3")}" opacity=".16"/>
  <g filter="url(#shadow)">
    ${logoMarkup}
    <text x="${left}" y="${Math.round(height * 0.25)}" font-size="${Math.max(24, Math.round(width * 0.03))}" font-weight="900" letter-spacing="3" fill="#ffffff">${escapeSvgText(brand.name.toUpperCase())}</text>
    ${lineMarkup}
    <rect x="${left}" y="${Math.round(height * 0.78)}" width="${Math.round(width * 0.36)}" height="${Math.round(height * 0.07)}" rx="${Math.round(height * 0.035)}" fill="${escapeSvgText(brand.secondaryColor || "#b7f3d3")}"/>
    <text x="${left + Math.round(width * 0.035)}" y="${Math.round(height * 0.825)}" font-size="${Math.max(22, Math.round(width * 0.027))}" font-weight="900" fill="#142019">${escapeSvgText(platformName)} ready</text>
    <text x="${left}" y="${Math.round(height * 0.94)}" font-size="${Math.max(18, Math.round(width * 0.022))}" font-weight="800" fill="#ffffff" opacity=".82">${escapeSvgText(width)}x${escapeSvgText(height)} · ${escapeSvgText(ratio)}</text>
  </g>
</svg>`;

  return {
    source: "fallback",
    reason,
    imageUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
  };
}

async function generateArtWithOpenAI({ post, brand, env }) {
  if (!env.OPENAI_API_KEY) {
    return fallbackArtCard({ post, brand });
  }

  const prompt = [
    post.visualPrompt,
    `Brand: ${brand.name}`,
    `Logo text/mark: ${brand.logoText || brand.initials}`,
    `Uploaded logo present: ${brand.logoImageUrl ? "yes, preserve the exact uploaded logo when the image pipeline supports references" : "no"}`,
    `Brand colors: primary ${brand.primaryColor}, secondary ${brand.secondaryColor}, accent ${brand.accentColor}`,
    `Typography direction: ${brand.fontStyle}`,
    `Platform: ${post.platformName}`,
    `Required platform canvas: ${post.width}x${post.height}, aspect ratio ${post.ratio}. Compose specifically for this final crop.`,
    "Create a finished social media art card, premium editorial design, crisp typography areas, no fake logos beyond the provided logo text, no tiny unreadable text, brand-safe commercial style.",
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_IMAGE_MODEL || "gpt-image-2",
      prompt,
      size: post.width > post.height ? "1536x1024" : "1024x1536",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return fallbackArtCard({ post, brand, reason: `OpenAI image API returned ${response.status}: ${errorText.slice(0, 160)}` });
  }

  const imageJson = await response.json();
  const firstImage = imageJson.data?.[0];
  const imageUrl = firstImage?.url || (firstImage?.b64_json ? `data:image/png;base64,${firstImage.b64_json}` : null);

  if (!imageUrl) {
    return fallbackArtCard({ post, brand, reason: "OpenAI image API returned no image" });
  }

  return {
    source: "openai",
    model: env.OPENAI_IMAGE_MODEL || "gpt-image-2",
    imageUrl,
  };
}

function contentSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["preview", "posts"],
    properties: {
      preview: {
        type: "object",
        additionalProperties: false,
        required: ["headline", "cta", "subtitle"],
        properties: {
          headline: { type: "string" },
          cta: { type: "string" },
          subtitle: { type: "string" },
        },
      },
      posts: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["platformId", "caption", "tags", "visualPrompt", "videoScript"],
          properties: {
            platformId: { type: "string" },
            caption: { type: "string" },
            tags: {
              type: "array",
              items: { type: "string" },
              minItems: 3,
              maxItems: 8,
            },
            visualPrompt: { type: "string" },
            videoScript: { type: "string" },
          },
        },
      },
    },
  };
}

async function generateWithOpenAI({ brand, platforms, env }) {
  if (!env.OPENAI_API_KEY) {
    return fallbackPayload(brand);
  }

  const platformMap = new Map(platforms.map((platform) => [platform.id, platform]));
  const selectedPlatformIds = brand.selectedPlatformIds || brand.channels || [];
  const requestedPlatforms = selectedPlatformIds.map((platformId) => platformMap.get(platformId)).filter(Boolean);
  const fallback = generatePostsForBrand(brand);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-5.4-mini",
      reasoning: { effort: "low" },
      instructions:
        "You are a senior social media strategist and creative director. Generate platform-native content for each requested channel. Keep captions specific, polished, non-generic, and ready for scheduling. Return only JSON matching the schema.",
      input: JSON.stringify({
        brand: {
          name: brand.name,
          tone: brand.tone,
          logoText: brand.logoText,
          primaryColor: brand.primaryColor,
          secondaryColor: brand.secondaryColor,
          accentColor: brand.accentColor,
          fontStyle: brand.fontStyle,
          audience: brand.audience,
          goal: brand.goal,
          message: brand.message,
          postDate: brand.postDate,
          businessProfile: brand.businessProfile,
        },
        platforms: requestedPlatforms,
        requirements: [
          "Use the businessProfile as persistent business memory: services, offer, ideal customer, location, proof, FAQs, content pillars, and brand dos/don'ts.",
          "Write one caption for every requested platform.",
          "Include hashtags as separate strings beginning with #.",
          "Write a visual prompt for the art card or video style.",
          "The visual prompt must preserve brand colors, logo text, font style, and the platform canvas size.",
          "For video platforms, write a concise short-form video script. For non-video platforms, return an empty string.",
          "Avoid fake claims, unverifiable metrics, and copyrighted lyrics.",
        ],
      }),
      text: {
        format: {
          type: "json_schema",
          name: "social_content_set",
          strict: true,
          schema: contentSchema(),
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return fallbackPayload(brand, `OpenAI API returned ${response.status}: ${errorText.slice(0, 160)}`);
  }

  const responseJson = await response.json();
  const parsed = JSON.parse(extractResponseText(responseJson));
  const aiPostsByPlatform = new Map(parsed.posts.map((post) => [post.platformId, post]));

  return {
    source: "openai",
    model: env.OPENAI_MODEL || "gpt-5.4-mini",
    preview: {
      brandName: brand.name,
      ...parsed.preview,
    },
    posts: fallback.map((post) => {
      const aiPost = aiPostsByPlatform.get(post.platformId);
      return aiPost
        ? {
            ...post,
            caption: aiPost.caption,
            tags: aiPost.tags,
            visualPrompt: aiPost.visualPrompt,
            videoScript: aiPost.videoScript,
            generationSource: "openai",
          }
        : { ...post, generationSource: "fallback" };
    }),
  };
}

function apiPlugin(env) {
  return {
    name: "social-content-api",
    configureServer(server) {
      server.middlewares.use("/api/generate-content", async (req, res) => {
        if (req.method !== "POST") {
          writeJson(res, 405, { error: "Method not allowed" });
          return;
        }

        try {
          const payload = await readRequestBody(req);
          const result = await generateWithOpenAI({ brand: payload.brand, platforms: payload.platforms, env });
          writeJson(res, 200, result);
        } catch (error) {
          writeJson(res, 500, { error: error instanceof Error ? error.message : "Unknown generation error" });
        }
      });

      server.middlewares.use("/api/generate-art-card", async (req, res) => {
        if (req.method !== "POST") {
          writeJson(res, 405, { error: "Method not allowed" });
          return;
        }

        try {
          const payload = await readRequestBody(req);
          const result = await generateArtWithOpenAI({ post: payload.post, brand: payload.brand, env });
          writeJson(res, 200, result);
        } catch (error) {
          writeJson(res, 500, { error: error instanceof Error ? error.message : "Unknown art generation error" });
        }
      });

      server.middlewares.use("/api/integrations-status", async (req, res) => {
        if (req.method !== "GET") {
          writeJson(res, 405, { error: "Method not allowed" });
          return;
        }

        writeJson(res, 200, { integrations: getIntegrationStatus(env) });
      });

      server.middlewares.use("/api/publish-post", async (req, res) => {
        if (req.method !== "POST") {
          writeJson(res, 405, { error: "Method not allowed" });
          return;
        }

        try {
          const payload = await readRequestBody(req);
          const result = await publishPostToPlatform({ brand: payload.brand, post: payload.post, env, dryRun: payload.dryRun ?? false });
          writeJson(res, 200, result);
        } catch (error) {
          writeJson(res, 500, { error: error instanceof Error ? error.message : "Unknown publishing error" });
        }
      });

      server.middlewares.use("/api/publish-queue", async (req, res) => {
        if (req.method !== "POST") {
          writeJson(res, 405, { error: "Method not allowed" });
          return;
        }

        try {
          const payload = await readRequestBody(req);
          const result = await publishQueue({ brand: payload.brand, posts: payload.posts ?? payload.brand?.queue ?? [], env, dryRun: payload.dryRun ?? false });
          writeJson(res, 200, result);
        } catch (error) {
          writeJson(res, 500, { error: error instanceof Error ? error.message : "Unknown queue publishing error" });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), "") };

  return {
    plugins: [react(), apiPlugin(env)],
  };
});
