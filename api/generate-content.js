import { generatePostsForBrand } from "../src/services/contentGenerator.js";
import { contentSchema, extractResponseText, fallbackPayload, writeJson } from "./_shared.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    writeJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const { brand, platforms = [] } = req.body;

  if (!process.env.OPENAI_API_KEY) {
    writeJson(res, 200, fallbackPayload(brand));
    return;
  }

  const platformMap = new Map(platforms.map((platform) => [platform.id, platform]));
  const selectedPlatformIds = brand.selectedPlatformIds || brand.channels || [];
  const requestedPlatforms = selectedPlatformIds.map((platformId) => platformMap.get(platformId)).filter(Boolean);
  const fallback = generatePostsForBrand(brand);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
      reasoning: { effort: "low" },
      instructions:
        "You are a senior social media strategist and creative director. Generate platform-native content for each requested channel. Use the brand businessProfile as persistent business memory. Keep captions specific, polished, non-generic, and ready for scheduling. Return only JSON matching the schema.",
      input: JSON.stringify({ brand, platforms: requestedPlatforms }),
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
    writeJson(res, 200, fallbackPayload(brand, `OpenAI API returned ${response.status}: ${errorText.slice(0, 160)}`));
    return;
  }

  const parsed = JSON.parse(extractResponseText(await response.json()));
  const aiPostsByPlatform = new Map(parsed.posts.map((post) => [post.platformId, post]));
  writeJson(res, 200, {
    source: "openai",
    model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
    preview: { brandName: brand.name, ...parsed.preview },
    posts: fallback.map((post) => {
      const aiPost = aiPostsByPlatform.get(post.platformId);
      return aiPost ? { ...post, ...aiPost, generationSource: "openai" } : { ...post, generationSource: "fallback" };
    }),
  });
}
