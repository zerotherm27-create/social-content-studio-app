import { fallbackArtCard, writeJson } from "./_shared.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    writeJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const { brand, post } = req.body;

  if (!process.env.OPENAI_API_KEY) {
    writeJson(res, 200, fallbackArtCard({ post, brand }));
    return;
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
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
      prompt,
      size: post.width > post.height ? "1536x1024" : "1024x1536",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    writeJson(res, 200, fallbackArtCard({ post, brand, reason: `OpenAI image API returned ${response.status}: ${errorText.slice(0, 160)}` }));
    return;
  }

  const imageJson = await response.json();
  const firstImage = imageJson.data?.[0];
  const imageUrl = firstImage?.url || (firstImage?.b64_json ? `data:image/png;base64,${firstImage.b64_json}` : null);
  writeJson(res, 200, imageUrl ? { source: "openai", model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2", imageUrl } : fallbackArtCard({ post, brand, reason: "OpenAI image API returned no image" }));
}
