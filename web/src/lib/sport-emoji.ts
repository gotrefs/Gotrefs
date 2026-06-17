/** Sport icon shown next to ref / roster names. */
export function sportEmoji(sport: string): string {
  const key = sport.toLowerCase();
  if (key.includes("basketball") && key.includes("5v5")) return "🏀";
  if (key.includes("basketball")) return "🏀";
  if (key.includes("flag football")) return "🚩";
  if (key.includes("7v7")) return "🏈";
  if (key.includes("football")) return "🏈";
  if (key.includes("soccer")) return "⚽";
  if (key.includes("baseball")) return "⚾";
  if (key.includes("softball")) return "🥎";
  if (key.includes("volleyball")) return "🏐";
  if (key.includes("hockey")) return "🏒";
  if (key.includes("field hockey")) return "🏑";
  if (key.includes("lacrosse")) return "🥍";
  if (key.includes("wrestling")) return "🤼";
  if (key.includes("tennis")) return "🎾";
  if (key.includes("pickleball")) return "🏓";
  if (key.includes("badminton")) return "🏸";
  if (key.includes("cricket")) return "🏏";
  if (key.includes("ultimate") || key.includes("frisbee")) return "🥏";
  if (key.includes("water polo")) return "🤽";
  if (key.includes("gymnastics")) return "🤸";
  if (key.includes("golf")) return "⛳";
  if (key.includes("cross country")) return "🏃";
  if (key.includes("cheer")) return "📣";
  if (key.includes("dance")) return "💃";
  if (key.includes("martial")) return "🥋";
  if (key.includes("esports") || key.includes("gaming")) return "🎮";
  if (key.includes("futsal") || key.includes("indoor soccer")) return "⚽";
  if (key.includes("roller hockey")) return "🏒";
  if (key.includes("cornhole") || key.includes("bocce")) return "🎯";
  if (key.includes("swim")) return "🏊";
  if (key.includes("track")) return "🏃";
  if (key.includes("rugby")) return "🏉";
  return "🏅";
}
