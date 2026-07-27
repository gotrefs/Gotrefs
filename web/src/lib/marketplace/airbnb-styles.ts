import { sportEmoji } from "@/lib/sport-emoji";

const SPORT_GRADIENTS: Record<string, string> = {
  basketball: "from-orange-500 via-rose-500 to-red-600",
  football: "from-emerald-700 via-green-600 to-lime-600",
  soccer: "from-green-600 via-emerald-500 to-teal-500",
  baseball: "from-sky-600 via-blue-500 to-indigo-500",
  softball: "from-amber-500 via-yellow-500 to-orange-400",
  volleyball: "from-violet-500 via-purple-500 to-fuchsia-500",
  hockey: "from-slate-600 via-slate-500 to-cyan-600",
  lacrosse: "from-blue-700 via-indigo-600 to-sky-500",
  tennis: "from-lime-600 via-green-500 to-emerald-400",
  wrestling: "from-red-800 via-rose-700 to-orange-600",
  swimming: "from-cyan-600 via-sky-500 to-blue-600",
  default: "from-[#1e3a5f] via-[#2563eb] to-[#0ea5e9]",
};

export function sportListingGradient(sport: string): string {
  const key = sport.toLowerCase();
  const ordered = Object.entries(SPORT_GRADIENTS)
    .filter(([name]) => name !== "default")
    .sort((a, b) => b[0].length - a[0].length);
  for (const [name, gradient] of ordered) {
    if (key.includes(name)) return gradient;
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

function u(id: string) {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=80`;
}

/** Curated Unsplash venue / action photos per sport (stable URLs). */
const SPORT_PHOTO_SETS: Record<string, string[]> = {
  basketball: [
    u("photo-1546519638-68e109498ffc"),
    u("photo-1574623452334-1e0ac2bdddff"),
    u("photo-1504450758481-733eedeba991"),
  ],
  "american football": [
    u("photo-1560272564-c83b66b1ad12"),
    u("photo-1459865264687-595d652de67e"),
    u("photo-1508098682722-e4c0a5a99d2c"),
  ],
  "tackle football": [
    u("photo-1560272564-c83b66b1ad12"),
    u("photo-1459865264687-595d652de67e"),
    u("photo-1508098682722-e4c0a5a99d2c"),
  ],
  "flag football": [
    u("photo-1560272564-c83b66b1ad12"),
    u("photo-1459865264687-595d652de67e"),
    u("photo-1508098682722-e4c0a5a99d2c"),
  ],
  "7v7 football": [
    u("photo-1560272564-c83b66b1ad12"),
    u("photo-1459865264687-595d652de67e"),
    u("photo-1508098682722-e4c0a5a99d2c"),
  ],
  football: [
    u("photo-1560272564-c83b66b1ad12"),
    u("photo-1459865264687-595d652de67e"),
    u("photo-1508098682722-e4c0a5a99d2c"),
  ],
  "australian rules football": [
    u("photo-1517466787929-bc90951d0974"),
    u("photo-1431324155629-1a6deb1dec8d"),
    u("photo-1574629810360-7efbbe195018"),
  ],
  soccer: [
    u("photo-1574629810360-7efbbe195018"),
    u("photo-1431324155629-1a6deb1dec8d"),
    u("photo-1522778119026-d647f0596c20"),
  ],
  baseball: [
    u("photo-1566577739112-5180d4bf9390"),
    u("photo-1508098682722-e4c0a5a99d2c"),
    u("photo-1529768167801-9173d6944115"),
  ],
  softball: [
    u("photo-1566577739112-5180d4bf9390"),
    u("photo-1593766782140-adecad0a95fd"),
    u("photo-1529768167801-9173d6944115"),
  ],
  volleyball: [
    u("photo-1612872087720-bb876e2e67d1"),
    u("photo-1554068865-24cecd4e34b8"),
    u("photo-1592659762303-90081d34b277"),
  ],
  "ice hockey": [
    u("photo-1547036967-23d11aacaee0"),
    u("photo-1515703407324-5f753afd8be8"),
    u("photo-1580748141549-71748dbe0bdc"),
  ],
  hockey: [
    u("photo-1547036967-23d11aacaee0"),
    u("photo-1515703407324-5f753afd8be8"),
    u("photo-1580748141549-71748dbe0bdc"),
  ],
  "field hockey": [
    u("photo-1574629810360-7efbbe195018"),
    u("photo-1461896836934-ff607608d972"),
    u("photo-1431324155629-1a6deb1dec8d"),
  ],
  lacrosse: [
    u("photo-1560117423-303f96c341ee"),
    u("photo-1623156884380-a080a56ddc93"),
    u("photo-1461896836934-ff607608d972"),
  ],
  tennis: [
    u("photo-1595435934249-5df7ca71e7e9"),
    u("photo-1622279457486-62dcc4a431d6"),
    u("photo-1554068865-24cecd4e34b8"),
  ],
  pickleball: [
    u("photo-1761644658016-324918bc373c"),
    u("photo-1747027694225-cbf12dd20826"),
    u("photo-1779209219762-681ff11296d6"),
  ],
  badminton: [
    u("photo-1595435934249-5df7ca71e7e9"),
    u("photo-1612872087720-bb876e2e67d1"),
    u("photo-1554068865-24cecd4e34b8"),
  ],
  wrestling: [
    u("photo-1555597673-b21d5c935865"),
    u("photo-1571019613454-1cb2f99b2d8b"),
    u("photo-1518611012118-696072aa579a"),
  ],
  boxing: [
    u("photo-1549719386-74dfcbf7dbed"),
    u("photo-1552072092-7f9b1d441330"),
    u("photo-1599058917212-d750089bc07e"),
  ],
  "mixed martial arts (mma)": [
    u("photo-1555597673-b21d5c935865"),
    u("photo-1549719386-74dfcbf7dbed"),
    u("photo-1599058917212-d750089bc07e"),
  ],
  mma: [
    u("photo-1555597673-b21d5c935865"),
    u("photo-1549719386-74dfcbf7dbed"),
    u("photo-1599058917212-d750089bc07e"),
  ],
  judo: [
    u("photo-1555597673-b21d5c935865"),
    u("photo-1518611012118-696072aa579a"),
    u("photo-1571019613454-1cb2f99b2d8b"),
  ],
  taekwondo: [
    u("photo-1555597673-b21d5c935865"),
    u("photo-1518611012118-696072aa579a"),
    u("photo-1571019613454-1cb2f99b2d8b"),
  ],
  swimming: [
    u("photo-1530549387789-4c1017266635"),
    u("photo-1519315901367-f34ff9154487"),
    u("photo-1576013551627-0cc20b96c2a7"),
  ],
  diving: [
    u("photo-1530549387789-4c1017266635"),
    u("photo-1519315901367-f34ff9154487"),
    u("photo-1571019613454-1cb2f99b2d8b"),
  ],
  "water polo": [
    u("photo-1530549387789-4c1017266635"),
    u("photo-1519315901367-f34ff9154487"),
    u("photo-1574629810360-7efbbe195018"),
  ],
  golf: [
    u("photo-1535131749006-b7f58c99034b"),
    u("photo-1587174486073-ae5e5cff23aa"),
    u("photo-1592919505780-303950717480"),
  ],
  gymnastics: [
    u("photo-1518611012118-696072aa579a"),
    u("photo-1571019613454-1cb2f99b2d8b"),
    u("photo-1599058917212-d750089bc07e"),
  ],
  cricket: [
    u("photo-1531415074968-036ba1b575da"),
    u("photo-1624526267942-ab0ff8a3e972"),
    u("photo-1461896836934-ff607608d972"),
  ],
  "rugby league / rugby union": [
    u("photo-1517466787929-bc90951d0974"),
    u("photo-1431324155629-1a6deb1dec8d"),
    u("photo-1560272564-c83b66b1ad12"),
  ],
  rugby: [
    u("photo-1517466787929-bc90951d0974"),
    u("photo-1431324155629-1a6deb1dec8d"),
    u("photo-1560272564-c83b66b1ad12"),
  ],
  "gaelic football / hurling": [
    u("photo-1517466787929-bc90951d0974"),
    u("photo-1431324155629-1a6deb1dec8d"),
    u("photo-1461896836934-ff607608d972"),
  ],
  curling: [
    u("photo-1547036967-23d11aacaee0"),
    u("photo-1515703407324-5f753afd8be8"),
    u("photo-1461896836934-ff607608d972"),
  ],
  bandy: [
    u("photo-1547036967-23d11aacaee0"),
    u("photo-1515703407324-5f753afd8be8"),
    u("photo-1461896836934-ff607608d972"),
  ],
  "figure skating": [
    u("photo-1547036967-23d11aacaee0"),
    u("photo-1515703407324-5f753afd8be8"),
    u("photo-1518611012118-696072aa579a"),
  ],
  archery: [
    u("photo-1461896836934-ff607608d972"),
    u("photo-1571019613454-1cb2f99b2d8b"),
    u("photo-1518611012118-696072aa579a"),
  ],
  fencing: [
    u("photo-1555597673-b21d5c935865"),
    u("photo-1518611012118-696072aa579a"),
    u("photo-1571019613454-1cb2f99b2d8b"),
  ],
  equestrian: [
    u("photo-1553284965-83fd3e82fa5a"),
    u("photo-1461896836934-ff607608d972"),
    u("photo-1571019613454-1cb2f99b2d8b"),
  ],
  rowing: [
    u("photo-1519315901367-f34ff9154487"),
    u("photo-1530549387789-4c1017266635"),
    u("photo-1461896836934-ff607608d972"),
  ],
  sailing: [
    u("photo-1500517081419-bd303ecd5653"),
    u("photo-1530549387789-4c1017266635"),
    u("photo-1461896836934-ff607608d972"),
  ],
  "handball (team)": [
    u("photo-1574629810360-7efbbe195018"),
    u("photo-1461896836934-ff607608d972"),
    u("photo-1431324155629-1a6deb1dec8d"),
  ],
  handball: [
    u("photo-1574629810360-7efbbe195018"),
    u("photo-1461896836934-ff607608d972"),
    u("photo-1431324155629-1a6deb1dec8d"),
  ],
  squash: [
    u("photo-1595435934249-5df7ca71e7e9"),
    u("photo-1622279457486-62dcc4a431d6"),
    u("photo-1554068865-24cecd4e34b8"),
  ],
  "table tennis": [
    u("photo-1534158914592-062992fbe900"),
    u("photo-1595435934249-5df7ca71e7e9"),
    u("photo-1612872087720-bb876e2e67d1"),
  ],
  polo: [
    u("photo-1553284965-83fd3e82fa5a"),
    u("photo-1461896836934-ff607608d972"),
    u("photo-1517466787929-bc90951d0974"),
  ],
  weightlifting: [
    u("photo-1517836357463-d25dfeac3438"),
    u("photo-1571019613454-1cb2f99b2d8b"),
    u("photo-1599058917212-d750089bc07e"),
  ],
  "motorsports (f1 / nascar)": [
    u("photo-1568605114967-8130f3a36994"),
    u("photo-1492144534655-ae79c964c9d7"),
    u("photo-1461896836934-ff607608d972"),
  ],
  motorsports: [
    u("photo-1568605114967-8130f3a36994"),
    u("photo-1492144534655-ae79c964c9d7"),
    u("photo-1461896836934-ff607608d972"),
  ],
};

const DEFAULT_SPORT_PHOTOS = [u("photo-1461896836934-ff607608d972")];

/** One stable action/venue photo for the sport (no carousel). */
export function sportListingPhotos(sport: string): string[] {
  const key = sport.toLowerCase().trim();
  if (!key) return DEFAULT_SPORT_PHOTOS;

  const exact = SPORT_PHOTO_SETS[key];
  if (exact?.[0]) return [exact[0]];

  // Longest alias first so "field hockey" beats "hockey", etc.
  const aliases = Object.entries(SPORT_PHOTO_SETS).sort((a, b) => b[0].length - a[0].length);
  for (const [name, photos] of aliases) {
    if (key.includes(name) || name.includes(key)) {
      return photos[0] ? [photos[0]] : DEFAULT_SPORT_PHOTOS;
    }
  }
  return DEFAULT_SPORT_PHOTOS;
}

export function refListingPhotos(sport: string): string[] {
  return sportListingPhotos(sport);
}

/** Airbnb-style elevated shadow for search pill and cards */
export const marketplaceShadow =
  "shadow-[0_6px_16px_rgba(0,0,0,0.12)] hover:shadow-[0_8px_28px_rgba(0,0,0,0.16)]";

export const marketplaceCardShadow =
  "shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.12)]";
