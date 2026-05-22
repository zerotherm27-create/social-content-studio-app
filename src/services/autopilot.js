import { platforms } from "../data/models.js";

const defaultThemes = [
  "announce the offer",
  "educate the audience",
  "show a behind-the-scenes angle",
  "answer a common objection",
  "share a customer-friendly tip",
  "highlight urgency",
  "invite people to take action",
];

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function inferDays(command) {
  const lower = command.toLowerCase();
  const weekMatch = lower.match(/(\d+)\s*weeks?/);
  const dayMatch = lower.match(/(\d+)\s*days?/);
  if (weekMatch) return Math.min(Number(weekMatch[1]) * 7, 60);
  if (dayMatch) return Math.min(Number(dayMatch[1]), 60);
  if (lower.includes("month")) return 30;
  return 14;
}

function inferTopic(command, brand) {
  const profile = brand.businessProfile ?? {};
  const cleaned = command
    .replace(/generate|create|schedule|post|content|for|of|about|weeks?|days?|daily|every day|\d+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.length > 3 ? cleaned : profile.mainOffer || brand.message;
}

function platformCaption(platform, brand, topic, theme, dayNumber) {
  const profile = brand.businessProfile ?? {};
  const audience = profile.idealCustomer || brand.audience || "your audience";
  const serviceContext = profile.services ? ` Focus: ${profile.services.split(",")[0].trim()}.` : "";
  const proof = profile.proof ? ` ${profile.proof}.` : "";
  const cta = profile.bookingLink ? ` ${profile.bookingLink}` : "";
  const starters = {
    instagram: "A scroll-stopping reminder:",
    facebook: "For our community:",
    linkedin: "A useful note for decision-makers:",
    threads: "Quick thought:",
    googleBusiness: "Local update:",
    tiktok: "Hook for today:",
    youtube: "Shorts idea:",
  };
  const closers = {
    instagram: "Save this and check us out this week.",
    facebook: "Share this with someone who would appreciate it.",
    linkedin: "Comment if this should be on your checklist.",
    threads: "Reply with what you would try first.",
    googleBusiness: "Visit, call, or book when you are ready.",
    tiktok: "Follow for the next quick reveal.",
    youtube: "Subscribe for the next short update.",
  };

  return `${starters[platform.id]} Day ${dayNumber}: ${theme} for ${brand.name}. ${topic}.${serviceContext} Built for ${audience}.${proof} ${closers[platform.id]}${cta}`;
}

function hashtags(brand, topic) {
  const profile = brand.businessProfile ?? {};
  return [...new Set(["#campaign", "#socialcontent", ...`${brand.name} ${topic} ${profile.industry || ""}`.replace(/[^a-zA-Z0-9 ]/g, "").split(" ").filter(Boolean).slice(0, 5).map((word) => `#${word}`)])].slice(0, 6);
}

export function runAutopilotPlan(brand, command, options = {}) {
  const durationDays = inferDays(command);
  const topic = inferTopic(command, brand);
  const platformById = new Map(platforms.map((platform) => [platform.id, platform]));
  const activePlatforms = brand.selectedPlatformIds.map((platformId) => platformById.get(platformId)).filter(Boolean);
  const startDate = addDays(new Date(), options.startOffsetDays ?? 1);
  const times = ["9:00 AM", "11:30 AM", "2:00 PM", "5:30 PM", "7:30 PM", "8:45 PM", "10:00 AM"];
  const timestamp = Date.now();
  const posts = [];
  const profile = brand.businessProfile ?? {};
  const profileContext = [
    profile.industry ? `Industry: ${profile.industry}` : "",
    profile.location ? `Location: ${profile.location}` : "",
    profile.services ? `Services: ${profile.services}` : "",
    profile.mainOffer ? `Main offer: ${profile.mainOffer}` : "",
    profile.contentPillars ? `Content pillars: ${profile.contentPillars}` : "",
    profile.proof ? `Proof: ${profile.proof}` : "",
    profile.brandDos ? `Do: ${profile.brandDos}` : "",
    profile.brandDonts ? `Avoid: ${profile.brandDonts}` : "",
  ].filter(Boolean).join(". ");

  for (let dayIndex = 0; dayIndex < durationDays; dayIndex += 1) {
    const date = formatDate(addDays(startDate, dayIndex));
    const theme = defaultThemes[dayIndex % defaultThemes.length];

    activePlatforms.forEach((platform, platformIndex) => {
      const dayNumber = dayIndex + 1;
      posts.push({
        id: `${brand.id}-auto-${platform.id}-${timestamp}-${dayIndex}-${platformIndex}`,
        brandId: brand.id,
        brandName: brand.name,
        platformId: platform.id,
        platformName: platform.name,
        format: platform.format,
        media: platform.media,
        ratio: platform.ratio,
        width: platform.width,
        height: platform.height,
        caption: platformCaption(platform, brand, topic, theme, dayNumber),
        tags: hashtags(brand, topic),
        date,
        time: times[platformIndex % times.length],
        status: "scheduled",
        selected: true,
        generationSource: "autopilot",
        autopilotTheme: theme,
        visualPrompt: `Create a ${platform.width}x${platform.height} ${platform.name} ${platform.media.toLowerCase()} for ${brand.name}. Theme: ${theme}. Topic: ${topic}. ${profileContext}. Use logo ${brand.logoText}, colors ${brand.primaryColor}, ${brand.secondaryColor}, ${brand.accentColor}, and ${brand.fontStyle} typography.`,
        videoScript: platform.media === "Video" ? `Open with: ${topic}. Show ${theme}. Mention ${profile.mainOffer || brand.goal}. End with a direct call to action for ${brand.name}${profile.bookingLink ? `: ${profile.bookingLink}` : ""}.` : "",
      });
    });
  }

  return {
    command,
    durationDays,
    topic,
    posts,
    summary: `${durationDays} days planned across ${activePlatforms.length} channels`,
  };
}
