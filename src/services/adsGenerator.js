import { adPlatforms } from "../data/models.js";

const objectiveCopy = {
  Leads: {
    hook: "Ready for an easier way to get started?",
    cta: "Send an inquiry today",
  },
  Bookings: {
    hook: "Your next appointment can be simple.",
    cta: "Book your slot",
  },
  "Website visits": {
    hook: "See what is available this week.",
    cta: "Visit the page",
  },
  Messages: {
    hook: "Have a question before you decide?",
    cta: "Message us",
  },
  Sales: {
    hook: "A better choice is ready when you are.",
    cta: "Shop the offer",
  },
  Awareness: {
    hook: "Meet a local brand built around your needs.",
    cta: "Learn more",
  },
};

function compact(text) {
  return String(text || "").trim().replace(/\s+/g, " ");
}

function words(text, count) {
  return compact(text).split(" ").filter(Boolean).slice(0, count).join(" ");
}

function platformStyle(platformId) {
  return {
    meta: "benefit-first, friendly, direct response",
    google: "high-intent, concise, keyword-friendly",
    tiktokAds: "fast hook, native, creator-style",
    linkedinAds: "credible, practical, business-focused",
  }[platformId] || "clear and conversion-focused";
}

function buildVariation(brand, adBrief, platform, index) {
  const profile = brand.businessProfile ?? {};
  const objective = objectiveCopy[adBrief.objective] ?? objectiveCopy.Bookings;
  const offer = compact(adBrief.offer || profile.mainOffer || brand.message);
  const audience = compact(adBrief.audience || profile.idealCustomer || brand.audience);
  const proof = compact(profile.proof || "trusted by local customers");
  const service = words(profile.services || offer, 7);
  const location = compact(adBrief.location || profile.location);
  const landingPage = compact(adBrief.landingPage || profile.bookingLink);
  const angle = [
    "Offer-led",
    "Proof-led",
    "Problem-solution",
    "Local trust",
  ][index % 4];

  const headlineBase = platform.id === "google" ? words(offer, 5) : `${objective.hook} ${words(offer, 6)}`;

  return {
    id: `${brand.id}-${platform.id}-ad-${Date.now()}-${index}`,
    platformId: platform.id,
    platformName: platform.name,
    placements: platform.placements,
    objective: adBrief.objective,
    angle,
    headline: headlineBase,
    primaryText: `${objective.hook} ${brand.name} helps ${audience} with ${service}. ${proof}. ${location ? `Available in ${location}. ` : ""}${objective.cta}${landingPage ? `: ${landingPage}` : "."}`,
    description: `${words(offer, 12)}. ${adBrief.duration} campaign with ${adBrief.budget} test budget.`,
    callToAction: objective.cta,
    audience,
    budget: adBrief.budget,
    duration: adBrief.duration,
    creativePrompt: `Create a ${platform.creative.toLowerCase()} ad for ${brand.name}. Objective: ${adBrief.objective}. Angle: ${angle}. Offer: ${offer}. Audience: ${audience}. Use brand colors ${brand.primaryColor}, ${brand.secondaryColor}, ${brand.accentColor}; logo ${brand.logoText}; ${brand.fontStyle} typography. Style: ${platformStyle(platform.id)}. Avoid: ${profile.brandDonts || "exaggerated claims"}.`,
    complianceNote: profile.brandDonts || "Avoid exaggerated claims, misleading urgency, and unverifiable results.",
  };
}

export function generateAdVariations(brand) {
  const adBrief = brand.adBrief ?? {};
  const selected = new Set(adBrief.platformIds ?? ["meta", "google"]);
  const platforms = adPlatforms.filter((platform) => selected.has(platform.id));

  return platforms.flatMap((platform, platformIndex) =>
    [0, 1].map((variantIndex) => buildVariation(brand, adBrief, platform, platformIndex * 2 + variantIndex)),
  );
}
