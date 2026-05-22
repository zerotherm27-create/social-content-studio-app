import { generatePostsForBrand, previewForBrand } from "../src/services/contentGenerator.js";

export function writeJson(res, status, payload) {
  res.status(status).json(payload);
}

export function extractResponseText(response) {
  if (response.output_text) return response.output_text;

  return (response.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text")
    .map((content) => content.text)
    .join("");
}

export function fallbackPayload(brand, reason = "OPENAI_API_KEY is not configured") {
  return {
    source: "fallback",
    reason,
    preview: previewForBrand(brand),
    posts: generatePostsForBrand(brand).map((post) => ({
      ...post,
      generationSource: "fallback",
    })),
  };
}

export function escapeSvgText(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function wrapWords(text, maxChars = 15, maxLines = 5) {
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

export function fallbackArtCard({ post, brand, reason = "OPENAI_API_KEY is not configured" }) {
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

export function contentSchema() {
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
            tags: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 8 },
            visualPrompt: { type: "string" },
            videoScript: { type: "string" },
          },
        },
      },
    },
  };
}
