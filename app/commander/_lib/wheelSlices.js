// Mirrors REWARD/SLICES in app/api/wheel/_shared.js — kept as a small,
// separate client-side copy rather than importing across the API boundary
// (that file also pulls in server-only Notion access).
export const REWARD = {
  PERCENT_5: "-5%",
  ICED_COFFEE_BOGO: "Iced Coffee acheté = 1 offert",
  BIG_SMALL_JUICE: "Big Bites + Small Bites achetés = 1 jus offert",
  PERCENT_15: "-15%",
  BRUNCH_FREE: "Brunch offert (max 25€ / 1 pers.)",
};

export const SLICES = [
  REWARD.PERCENT_5,
  REWARD.ICED_COFFEE_BOGO,
  REWARD.PERCENT_5,
  REWARD.BIG_SMALL_JUICE,
  REWARD.ICED_COFFEE_BOGO,
  REWARD.PERCENT_5,
  REWARD.PERCENT_15,
  REWARD.ICED_COFFEE_BOGO,
  REWARD.PERCENT_5,
  REWARD.BIG_SMALL_JUICE,
  REWARD.PERCENT_15,
  REWARD.BRUNCH_FREE,
];

export const REWARD_COLOR = {
  [REWARD.PERCENT_5]: "#A3B987",
  [REWARD.ICED_COFFEE_BOGO]: "#976146",
  [REWARD.BIG_SMALL_JUICE]: "#587F25",
  [REWARD.PERCENT_15]: "#C24755",
  [REWARD.BRUNCH_FREE]: "#8C4F2F",
};
