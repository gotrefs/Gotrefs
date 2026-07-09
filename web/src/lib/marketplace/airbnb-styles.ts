import { sportEmoji } from "@/lib/sport-emoji";

const SPORT_GRADIENTS: Record<string, string> = {
  basketball: "from-orange-500 via-rose-500 to-red-600",
  football: "from-emerald-700 via-green-600 to-lime-600",
  soccer: "from-green-600 via-emerald-500 to-teal-500",
  baseball: "from-sky-600 via-blue-500 to-indigo-500",
  softball: "from-amber-500 via-yellow-500 to-orange-400",
  volleyball: "from-violet-500 via-purple-500 to-fuchsia-500",
  hockey: "from-slate-600 via-slate-500 to-cyan-600",
  default: "from-[#1e3a5f] via-[#2563eb] to-[#0ea5e9]",
};

export function sportListingGradient(sport: string): string {
  const key = sport.toLowerCase();
  for (const [name, gradient] of Object.entries(SPORT_GRADIENTS)) {
    if (name !== "default" && key.includes(name)) return gradient;
  }
  return SPORT_GRADIENTS.default;
}

export function sportListingVisual(sport: string) {
  return {
    emoji: sportEmoji(sport),
    gradient: sportListingGradient(sport),
    photos: sportListingPhotos(sport),
  };
}

/** Curated Unsplash venue photos per sport (stable URLs). */
const SPORT_PHOTO_SETS: Record<string, string[]> = {
  basketball: [
    "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1574623452334-1e0ac2bdddff?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1504450758481-733eedeba991?auto=format&fit=crop&w=1200&q=80",
  ],
  football: [
    "https://images.unsplash.com/photo-1560272564-c83b66b1ad12?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1459865264687-595d652de67e?auto=format&fit=crop&w=1200&q=80",
  ],
  soccer: [
    "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1200&q=80",
  ],
  baseball: [
    "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1508098682722-e4c0a5a99d2c?auto=format&fit=crop&w=1200&q=80",
  ],
  volleyball: [
    "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1200&q=80",
  ],
  hockey: [
    "https://images.unsplash.com/photo-1547036967-23d11aacaee0?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1515703407324-5f753afd8be8?auto=format&fit=crop&w=1200&q=80",
  ],
};

const REF_OFFICIAL_PHOTOS = [
  "https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=1200&q=80",
];

export function sportListingPhotos(sport: string): string[] {
  const key = sport.toLowerCase();
  for (const [name, photos] of Object.entries(SPORT_PHOTO_SETS)) {
    if (name !== "default" && key.includes(name)) return photos;
  }
  return [
    "https://images.unsplash.com/photo-1461896836934-ff607608d972?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1577223625816-7546f13df25d?auto=format&fit=crop&w=1200&q=80",
  ];
}

export function refListingPhotos(sport: string): string[] {
  return [...REF_OFFICIAL_PHOTOS, ...sportListingPhotos(sport).slice(0, 1)];
}

/** Airbnb-style elevated shadow for search pill and cards */
export const marketplaceShadow =
  "shadow-[0_6px_16px_rgba(0,0,0,0.12)] hover:shadow-[0_8px_28px_rgba(0,0,0,0.16)]";

export const marketplaceCardShadow =
  "shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.12)]";
