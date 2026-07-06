// Mirrors REWARD/SLICES in app/api/wheel/_shared.js — kept as a small,
// separate client-side copy rather than importing across the API boundary
// (that file also pulls in server-only Notion access).
export const REWARD = {
  ICED_COFFEE_BOGO: "1 Iced Coffee acheté = 1 offert",
  PERCENT_5: "-5%",
  PERCENT_10: "-10%",
  PERCENT_15: "-15%",
  PERCENT_20: "-20%",
  BRUNCH_FREE: "1 Brunch offert",
  BIG_SMALL_JUICE: "1 Big Bites + 1 Small Bites achetés = 1 jus offert",
  COFFEE_FREE: "1 café offert",
  PASTRY_FREE: "1 pâtisserie offerte",
  SMOOTHIE_FREE: "1 smoothie offert",
  REPLAY_TOMORROW: "Rejoue demain",
  DESSERT_FREE: "1 dessert offert",
};

// One reward per slice, fixed order — must match SLICES in _shared.js exactly.
export const SLICES = [
  REWARD.ICED_COFFEE_BOGO,
  REWARD.PERCENT_5,
  REWARD.PERCENT_10,
  REWARD.PERCENT_15,
  REWARD.PERCENT_20,
  REWARD.BRUNCH_FREE,
  REWARD.BIG_SMALL_JUICE,
  REWARD.COFFEE_FREE,
  REWARD.PASTRY_FREE,
  REWARD.SMOOTHIE_FREE,
  REWARD.REPLAY_TOMORROW,
  REWARD.DESSERT_FREE,
];

// Short, wheel-safe labels — kept to 1-2 short lines so they read at a
// 30°-slice scale. The full reward text (above) is what's shown in the
// result panel, Notion, and checkout messaging.
export const REWARD_LINES = {
  [REWARD.ICED_COFFEE_BOGO]: ["1+1 Iced", "Coffee"],
  [REWARD.PERCENT_5]: ["-5%"],
  [REWARD.PERCENT_10]: ["-10%"],
  [REWARD.PERCENT_15]: ["-15%"],
  [REWARD.PERCENT_20]: ["-20%"],
  [REWARD.BRUNCH_FREE]: ["Brunch", "offert"],
  [REWARD.BIG_SMALL_JUICE]: ["Jus", "offert"],
  [REWARD.COFFEE_FREE]: ["Café", "offert"],
  [REWARD.PASTRY_FREE]: ["Pâtisserie", "offerte"],
  [REWARD.SMOOTHIE_FREE]: ["Smoothie", "offert"],
  [REWARD.REPLAY_TOMORROW]: ["Rejoue", "demain"],
  [REWARD.DESSERT_FREE]: ["Dessert", "offert"],
};

// Only the 4 non-cream MOKA brand colors, repeating in a fixed 4-tone
// sequence around the 12 slices (3 full cycles) — no off-brand hues.
// All four are dark/saturated enough for white slice text + icons.
const PALETTE_CYCLE = ["#976146", "#8C4F2F", "#587F25", "#C24755"]; // brownLight, brown, green, coral
export const REWARD_COLOR = Object.fromEntries(SLICES.map((reward, i) => [reward, PALETTE_CYCLE[i % PALETTE_CYCLE.length]]));
