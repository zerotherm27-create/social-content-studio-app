import { fallbackArtCard } from "./_shared.js";
import { storeGeneratedArtCard, storeGeneratedVideo } from "./_media-storage.js";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

function preferredArtProvider(brand, env) {
  return brand?.mediaSettings?.artProvider || env.MEDIA_ART_PROVIDER || "openai";
}

function preferredVideoProvider(brand, env) {
  return brand?.mediaSettings?.videoProvider || env.MEDIA_VIDEO_PROVIDER || "gemini-veo";
}

function buildArtPrompt({ post, brand }) {
  return [
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
}

function buildVideoPrompt({ post, brand }) {
  const profile = brand.businessProfile ?? {};
  return [
    post.videoScript || post.caption,
    `Create a short vertical marketing video for ${brand.name}.`,
    `Business context: ${profile.industry || "business"} in ${profile.location || "its market"}.`,
    `Offer: ${profile.mainOffer || brand.message || brand.goal}.`,
    `Audience: ${profile.idealCustomer || brand.audience}.`,
    `Use brand colors ${brand.primaryColor}, ${brand.secondaryColor}, ${brand.accentColor}.`,
    `Logo/text mark: ${brand.logoText || brand.initials || brand.name}.`,
    `Typography direction: ${brand.fontStyle}.`,
    `Platform: ${post.platformName}; aspect ratio ${post.ratio}; final canvas ${post.width}x${post.height}.`,
    "Keep it brand-safe, polished, commercial, and clear. Avoid exaggerated claims.",
  ].join("\n");
}

function extractGeminiImageUrl(responseJson) {
  const parts = responseJson.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((part) => part.inlineData?.data || part.inline_data?.data);
  const inlineData = imagePart?.inlineData || imagePart?.inline_data;
  if (!inlineData?.data) return null;

  const mimeType = inlineData.mimeType || inlineData.mime_type || "image/png";
  return `data:${mimeType};base64,${inlineData.data}`;
}

async function generateArtWithOpenAI({ post, brand, env }) {
  if (!env.OPENAI_API_KEY) {
    return storeGeneratedArtCard({ brand, post, result: fallbackArtCard({ post, brand }), env });
  }

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_IMAGE_MODEL || "gpt-image-2",
      prompt: buildArtPrompt({ post, brand }),
      size: post.width > post.height ? "1536x1024" : "1024x1536",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return storeGeneratedArtCard({ brand, post, result: fallbackArtCard({ post, brand, reason: `OpenAI image API returned ${response.status}: ${errorText.slice(0, 160)}` }), env });
  }

  const imageJson = await response.json();
  const firstImage = imageJson.data?.[0];
  const imageUrl = firstImage?.url || (firstImage?.b64_json ? `data:image/png;base64,${firstImage.b64_json}` : null);
  const result = imageUrl
    ? { source: "openai", model: env.OPENAI_IMAGE_MODEL || "gpt-image-2", imageUrl }
    : fallbackArtCard({ post, brand, reason: "OpenAI image API returned no image" });

  return storeGeneratedArtCard({ brand, post, result, env });
}

async function generateArtWithGemini({ post, brand, env }) {
  if (!env.GEMINI_API_KEY && !env.GOOGLE_GENAI_API_KEY) {
    return storeGeneratedArtCard({
      brand,
      post,
      result: fallbackArtCard({ post, brand, reason: "GEMINI_API_KEY is not configured" }),
      env,
    });
  }

  const apiKey = env.GEMINI_API_KEY || env.GOOGLE_GENAI_API_KEY;
  const model = env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image-preview";
  const response = await fetch(`${GEMINI_API_BASE}/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: buildArtPrompt({ post, brand }) }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return storeGeneratedArtCard({
      brand,
      post,
      result: fallbackArtCard({ post, brand, reason: `Gemini image API returned ${response.status}: ${errorText.slice(0, 160)}` }),
      env,
    });
  }

  const responseJson = await response.json();
  const imageUrl = extractGeminiImageUrl(responseJson);
  const result = imageUrl ? { source: "gemini", model, imageUrl } : fallbackArtCard({ post, brand, reason: "Gemini image API returned no image" });
  return storeGeneratedArtCard({ brand, post, result, env });
}

export async function generateArtForProvider({ post, brand, env }) {
  const provider = preferredArtProvider(brand, env);
  if (provider === "gemini") return generateArtWithGemini({ post, brand, env });
  return generateArtWithOpenAI({ post, brand, env });
}

export async function generateVideoForProvider({ post, brand, env }) {
  const provider = preferredVideoProvider(brand, env);
  if (provider !== "gemini-veo") {
    return {
      source: "fallback",
      status: "not_configured",
      reason: "No supported video provider selected",
      prompt: buildVideoPrompt({ post, brand }),
    };
  }

  if (!env.GEMINI_API_KEY && !env.GOOGLE_GENAI_API_KEY) {
    return {
      source: "fallback",
      status: "not_configured",
      reason: "GEMINI_API_KEY is not configured",
      prompt: buildVideoPrompt({ post, brand }),
    };
  }

  const apiKey = env.GEMINI_API_KEY || env.GOOGLE_GENAI_API_KEY;
  const model = env.GEMINI_VIDEO_MODEL || "veo-3.1-generate-preview";
  const response = await fetch(`${GEMINI_API_BASE}/models/${model}:predictLongRunning`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      instances: [{ prompt: buildVideoPrompt({ post, brand }) }],
      parameters: {
        aspectRatio: post.ratio === "9:16" ? "9:16" : "16:9",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      source: "gemini-veo",
      model,
      status: "failed",
      reason: `Veo API returned ${response.status}: ${errorText.slice(0, 160)}`,
      prompt: buildVideoPrompt({ post, brand }),
    };
  }

  const operation = await response.json();
  return storeGeneratedVideo({
    brand,
    post,
    result: {
      source: "gemini-veo",
      model,
      status: "processing",
      operationName: operation.name,
      prompt: buildVideoPrompt({ post, brand }),
    },
    env,
  });
}
