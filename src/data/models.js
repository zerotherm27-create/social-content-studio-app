export const platforms = [
  { id: "instagram", name: "Instagram", format: "Feed/Reel card", media: "Art card", ratio: "4:5", width: 1080, height: 1350 },
  { id: "facebook", name: "Facebook", format: "Page post", media: "Art card", ratio: "1.91:1", width: 1200, height: 630 },
  { id: "linkedin", name: "LinkedIn", format: "Company update", media: "Art card", ratio: "1.91:1", width: 1200, height: 627 },
  { id: "threads", name: "Threads", format: "Thread image", media: "Art card", ratio: "4:5", width: 1080, height: 1350 },
  { id: "googleBusiness", name: "Google Business", format: "Business update", media: "Art card", ratio: "4:3", width: 1200, height: 900 },
  { id: "tiktok", name: "TikTok", format: "Short video", media: "Video", ratio: "9:16", width: 1080, height: 1920 },
  { id: "youtube", name: "YouTube", format: "Shorts", media: "Video", ratio: "9:16", width: 1080, height: 1920 },
];

const defaultBusinessProfiles = {
  luna: {
    industry: "Specialty cafe",
    location: "Downtown neighborhood",
    services: "Cold brew flights, espresso drinks, pastries, private coffee catering",
    mainOffer: "Summer cold brew flight with three new flavors and a first-week discount",
    idealCustomer: "busy professionals, coffee lovers, remote workers, and weekend cafe visitors",
    bookingLink: "https://lunabrew.example/order",
    proof: "Known for fast service, seasonal drinks, and friendly local regulars",
    faqs: "Do you offer non-dairy milk? Yes. Can I order ahead? Yes. Do you cater small events? Yes.",
    contentPillars: "Seasonal drinks, cafe lifestyle, customer favorites, behind the scenes, local community",
    brandDos: "Warm, polished, local, sensory, clear call to action",
    brandDonts: "No exaggerated health claims, no generic cafe stock-photo language",
  },
  nova: {
    industry: "Fitness studio",
    location: "Local wellness community",
    services: "Movement assessments, starter class packs, small group training, mobility coaching",
    mainOffer: "Free movement assessment and seven-day starter class pack",
    idealCustomer: "wellness beginners, busy professionals, and people returning to exercise",
    bookingLink: "https://novafit.example/book",
    proof: "Beginner-friendly coaching, clear progress plans, and supportive small classes",
    faqs: "Do beginners fit in? Yes. Do I need equipment? No. Can I try one class first? Yes.",
    contentPillars: "Beginner confidence, movement education, member wins, coach tips, class reminders",
    brandDos: "Energetic, supportive, practical, confident",
    brandDonts: "No shame-based fitness language, no unrealistic body promises",
  },
  atlas: {
    industry: "Business law firm",
    location: "Startup and small business market",
    services: "Contracts, fundraising readiness, business formation, founder advisory",
    mainOffer: "Founder-friendly contract protection checklist before fundraising",
    idealCustomer: "startup founders, small business owners, and operators preparing for growth",
    bookingLink: "https://atlaslegal.example/consult",
    proof: "Practical legal guidance for founders who need clarity before big decisions",
    faqs: "When should I review contracts? Before signing. Do you help early-stage founders? Yes. Can I book a consultation? Yes.",
    contentPillars: "Founder education, contract tips, fundraising readiness, risk prevention, business basics",
    brandDos: "Clear, professional, calm, practical",
    brandDonts: "No fearmongering, no legal advice that replaces a consultation",
  },
};

export const defaultBrands = [
  {
    id: "luna",
    name: "Luna Brew Cafe",
    initials: "LB",
    tone: "Warm and premium",
    logoText: "LB",
    primaryColor: "#4f6f5c",
    secondaryColor: "#b7f3d3",
    accentColor: "#ff7d67",
    fontStyle: "Modern sans",
    audience: "busy professionals and coffee lovers",
    goal: "Launch a new product",
    message: "Announce a summer cold brew flight with three new flavors and a first-week discount.",
    businessProfile: defaultBusinessProfiles.luna,
    selectedPlatformIds: ["instagram", "facebook", "linkedin", "threads", "googleBusiness", "tiktok", "youtube"],
    dateOffset: 1,
    posts: [],
    queue: [],
  },
  {
    id: "nova",
    name: "NovaFit Studio",
    initials: "NF",
    tone: "Bold and playful",
    logoText: "NF",
    primaryColor: "#2f5bff",
    secondaryColor: "#b8ff6a",
    accentColor: "#ff6b8a",
    audience: "new gym members and wellness beginners",
    fontStyle: "Bold condensed",
    goal: "Drive appointments",
    message: "Promote a free movement assessment and a seven-day starter class pack.",
    businessProfile: defaultBusinessProfiles.nova,
    selectedPlatformIds: ["instagram", "facebook", "threads", "tiktok", "youtube"],
    dateOffset: 2,
    posts: [],
    queue: [],
  },
  {
    id: "atlas",
    name: "Atlas Legal Partners",
    initials: "AL",
    tone: "Professional",
    logoText: "AL",
    primaryColor: "#26384f",
    secondaryColor: "#e7d8bd",
    accentColor: "#7aa6ff",
    fontStyle: "Editorial serif",
    audience: "startup founders and small business owners",
    goal: "Grow followers",
    message: "Share a founder-friendly checklist for protecting contracts before fundraising.",
    businessProfile: defaultBusinessProfiles.atlas,
    selectedPlatformIds: ["linkedin", "facebook", "googleBusiness", "youtube", "threads"],
    dateOffset: 3,
    posts: [],
    queue: [],
  },
];

export const tones = ["Warm and premium", "Bold and playful", "Professional", "Educational"];

export const goals = ["Launch a new product", "Drive appointments", "Promote a limited offer", "Grow followers"];

export const fontStyles = ["Modern sans", "Bold condensed", "Editorial serif", "Friendly rounded", "Minimal mono"];

export function createBusinessProfile(brand) {
  return {
    industry: brand.businessProfile?.industry ?? brand.industry ?? "",
    location: brand.businessProfile?.location ?? "",
    services: brand.businessProfile?.services ?? "",
    mainOffer: brand.businessProfile?.mainOffer ?? brand.message ?? "",
    idealCustomer: brand.businessProfile?.idealCustomer ?? brand.audience ?? "",
    bookingLink: brand.businessProfile?.bookingLink ?? "",
    proof: brand.businessProfile?.proof ?? "",
    faqs: brand.businessProfile?.faqs ?? "",
    contentPillars: brand.businessProfile?.contentPillars ?? "",
    brandDos: brand.businessProfile?.brandDos ?? "",
    brandDonts: brand.businessProfile?.brandDonts ?? "",
  };
}

export function createDateFromOffset(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function createInitialWorkspace() {
  return {
    activeBrandId: defaultBrands[0].id,
    brands: defaultBrands.map(({ dateOffset, ...brand }) => ({
      ...brand,
      postDate: createDateFromOffset(dateOffset),
    })),
  };
}

export function normalizeBrand(brand) {
  const fallback = defaultBrands.find((item) => item.id === brand.id) ?? defaultBrands[0];
  const validPlatformIds = new Set(platforms.map((platform) => platform.id));
  const migratedPlatformIds = (brand.selectedPlatformIds ?? fallback.selectedPlatformIds)
    .map((platformId) => (platformId === "pinterest" ? "threads" : platformId))
    .filter((platformId) => validPlatformIds.has(platformId));
  const normalizePost = (post) => {
    const platformId = post.platformId === "pinterest" ? "threads" : post.platformId;
    const platform = platforms.find((item) => item.id === platformId);
    return platform
      ? {
          ...post,
          platformId,
          platformName: platform.name,
          format: platform.format,
          media: platform.media,
          ratio: platform.ratio,
          width: platform.width,
          height: platform.height,
        }
      : null;
  };

  return {
    ...fallback,
    ...brand,
    businessProfile: {
      ...createBusinessProfile(fallback),
      ...createBusinessProfile(brand),
    },
    logoText: brand.logoText ?? brand.initials ?? fallback.logoText,
    primaryColor: brand.primaryColor ?? fallback.primaryColor,
    secondaryColor: brand.secondaryColor ?? fallback.secondaryColor,
    accentColor: brand.accentColor ?? fallback.accentColor,
    fontStyle: brand.fontStyle ?? fallback.fontStyle,
    selectedPlatformIds: [...new Set(migratedPlatformIds)],
    posts: (brand.posts ?? []).map(normalizePost).filter(Boolean),
    queue: (brand.queue ?? []).map(normalizePost).filter(Boolean),
  };
}
