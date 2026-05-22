import { platforms } from "../data/models.js";

const postingTimes = ["9:30 AM", "11:45 AM", "2:15 PM", "5:40 PM", "7:20 PM", "8:10 PM"];

const hooks = {
  instagram: "Your next scroll-stopper is ready.",
  facebook: "Here is something worth sharing with the community.",
  linkedin: "A polished update for the people watching your next move.",
  tiktok: "Make this the three-second hook before the reveal.",
  youtube: "Open with motion, close with a clear invitation.",
  threads: "Start a conversation your audience can jump into.",
  googleBusiness: "Give nearby customers a clear reason to visit.",
};

const callsToAction = {
  instagram: "Tap save and visit us this week.",
  facebook: "Send this to someone who needs a small upgrade today.",
  linkedin: "Comment if this belongs in your weekly routine.",
  tiktok: "Follow for the full reveal.",
  youtube: "Subscribe for the next drop.",
  threads: "Reply with the first thing you would try.",
  googleBusiness: "Call, book, or visit us today.",
};

function sentenceCase(text) {
  const cleaned = String(text || "").trim().replace(/\s+/g, " ");
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function slugWords(text) {
  return String(text || "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 4)
    .map((word) => `#${word}`);
}

function buildCaption(platformId, brand) {
  const profile = brand.businessProfile ?? {};
  const message = brand.message || profile.mainOffer || brand.goal || `fresh ideas from ${brand.name}`;
  const audience = profile.idealCustomer || brand.audience || "your audience";
  const link = profile.bookingLink ? ` ${profile.bookingLink}` : "";
  return `${hooks[platformId]} ${sentenceCase(message)} Built for ${audience}. ${callsToAction[platformId]}${link}`;
}

export function generatePostsForBrand(brand) {
  const platformById = new Map(platforms.map((platform) => [platform.id, platform]));
  const selectedPlatformIds = brand.selectedPlatformIds || brand.channels || [];
  const profile = brand.businessProfile ?? {};
  const message = brand.message || profile.mainOffer || brand.goal || `new ${profile.industry || brand.industry || "brand"} campaign`;
  const brandId = brand.id || slugWords(brand.name).join("").replaceAll("#", "").toLowerCase() || "brand";
  const tags = [...new Set(["#campaign", "#socialcontent", ...slugWords(brand.name), ...slugWords(message)])].slice(0, 5);
  const timestamp = Date.now();

  return selectedPlatformIds.flatMap((platformId, index) => {
    const platform = platformById.get(platformId);
    if (!platform) return [];

    return {
      id: `${brandId}-${platform.id}-${timestamp}-${index}`,
      brandId,
      brandName: brand.name,
      platformId: platform.id,
      platformName: platform.name,
      format: platform.format,
      media: platform.media,
      ratio: platform.ratio,
      width: platform.width,
      height: platform.height,
      caption: buildCaption(platform.id, brand),
      tags,
      date: brand.postDate || new Date().toISOString().slice(0, 10),
      time: postingTimes[index % postingTimes.length],
      status: "draft",
      selected: true,
      generationSource: "fallback",
      visualPrompt: `Create a polished branded ${platform.media.toLowerCase()} for ${brand.name}: ${message}. Business context: ${profile.industry || "business"} in ${profile.location || "its market"} offering ${profile.services || "its services"}. Use proof points: ${profile.proof || "trusted customer experience"}. Use brand colors ${brand.primaryColor}, ${brand.secondaryColor}, and ${brand.accentColor}; logo text ${brand.logoText || brand.initials || brand.name}; font style ${brand.fontStyle || "modern sans"}; platform size ${platform.width}x${platform.height} (${platform.ratio}).`,
      videoScript: platform.media === "Video" ? `${buildCaption(platform.id, brand)} Show the offer, the proof, then a clear call to action.` : "",
    };
  });
}

export function previewForBrand(brand) {
  if (brand.aiPreview) {
    return {
      brandName: brand.name,
      ...brand.aiPreview,
    };
  }

  return {
    brandName: brand.name,
    headline: (brand.message || brand.goal || brand.name).split(" ").slice(0, 5).join(" "),
    cta: String(brand.goal || "").includes("offer") ? "Limited offer" : "Schedule now",
    subtitle: (brand.message || "New campaign ready to publish.").split(".")[0],
  };
}

export async function generatePostsForBrandWithAI(brand) {
  const response = await fetch("/api/generate-content", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ brand, platforms }),
  });

  if (!response.ok) {
    throw new Error(`AI generation failed with ${response.status}`);
  }

  return response.json();
}

export async function generateArtCardForPost(brand, post) {
  const response = await fetch("/api/generate-art-card", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ brand, post }),
  });

  if (!response.ok) {
    throw new Error(`Art card generation failed with ${response.status}`);
  }

  return response.json();
}

export async function generateVideoForPost(brand, post) {
  const response = await fetch("/api/generate-video", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ brand, post }),
  });

  if (!response.ok) {
    throw new Error(`Video generation failed with ${response.status}`);
  }

  return response.json();
}
