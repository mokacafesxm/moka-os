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

export const REWARD_COLOR = {
  [REWARD.ICED_COFFEE_BOGO]: "#976146",
  [REWARD.PERCENT_5]: "#A3B987",
  [REWARD.PERCENT_10]: "#587F25",
  [REWARD.PERCENT_15]: "#C24755",
  [REWARD.PERCENT_20]: "#8C2F2F",
  [REWARD.BRUNCH_FREE]: "#8C4F2F",
  [REWARD.BIG_SMALL_JUICE]: "#3F5C1C",
  [REWARD.COFFEE_FREE]: "#B98257",
  [REWARD.PASTRY_FREE]: "#D9A55C",
  [REWARD.SMOOTHIE_FREE]: "#8FA870",
  [REWARD.REPLAY_TOMORROW]: "#C9BBA8",
  [REWARD.DESSERT_FREE]: "#D97A85",
};

// Text color per slice — most slice fills are dark enough for white text;
// the two lightest fills (pastry gold, replay-tomorrow tan) need dark text
// to stay readable (contrast check done visually, see WheelModal screenshots).
export const REWARD_TEXT_COLOR = {
  [REWARD.PASTRY_FREE]: "#4A2F18",
  [REWARD.REPLAY_TOMORROW]: "#4A2F18",
};
