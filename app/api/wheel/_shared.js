import { DB, queryDatabase, getPage, getTitle, getText, getSelect, getNumber, getCheckbox, getDate } from "../_notion";

// Reward catalogue — kept as literal strings matching the Notion "Récompense"
// select options exactly (see the DB's schema, updated via the Notion API).
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

// One reward per slice now (12 unique labels, each printed on its own slice
// client-side) — fixed order, index = slice position on the wheel.
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

// Weighted so the cheapest-for-the-business outcomes are by far the most
// common; the two "big win" rewards are additionally hard-capped weekly
// below (see pickWeightedReward). Weights sum to 1000 for readable percentages.
const WEIGHT = {
  [REWARD.REPLAY_TOMORROW]: 200, // 20%
  [REWARD.PERCENT_5]: 180, // 18%
  [REWARD.COFFEE_FREE]: 150, // 15%
  [REWARD.PERCENT_10]: 120, // 12%
  [REWARD.PASTRY_FREE]: 90, // 9%
  [REWARD.SMOOTHIE_FREE]: 80, // 8%
  [REWARD.DESSERT_FREE]: 70, // 7%
  [REWARD.PERCENT_15]: 50, // 5%
  [REWARD.ICED_COFFEE_BOGO]: 30, // 3%
  [REWARD.BIG_SMALL_JUICE]: 20, // 2%
  [REWARD.PERCENT_20]: 6, // 0.6%
  [REWARD.BRUNCH_FREE]: 4, // 0.4%
};

const BIG_WIN_REWARDS = [REWARD.PERCENT_20, REWARD.BRUNCH_FREE];
const BIG_WIN_WEEKLY_CAP = 1; // combined, across both big-win rewards, all customers
const BIG_WIN_CONSOLATION = REWARD.DESSERT_FREE;

function sliceIndexForReward(reward) {
  return SLICES.indexOf(reward);
}

function pickWeightedSlice() {
  const total = Object.values(WEIGHT).reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * total;
  for (const reward of SLICES) {
    roll -= WEIGHT[reward];
    if (roll < 0) return reward;
  }
  return SLICES[SLICES.length - 1];
}

// The full spin decision: weighted pick, then downgrade to the consolation
// reward if the weekly big-win quota is already spent. Returns the *actual*
// slice to land on — never claims to land on -20%/Brunch and then swap the
// prize, since that would be visually dishonest.
export async function pickReward() {
  const picked = pickWeightedSlice();

  if (BIG_WIN_REWARDS.includes(picked)) {
    const bigWinsThisWeek = await countBigWinsThisWeek();
    if (bigWinsThisWeek >= BIG_WIN_WEEKLY_CAP) {
      return { sliceIndex: sliceIndexForReward(BIG_WIN_CONSOLATION), reward: BIG_WIN_CONSOLATION };
    }
  }

  return { sliceIndex: sliceIndexForReward(picked), reward: picked };
}

const RESET_HOUR_PR = 5;
const PR_UTC_OFFSET_HOURS = 4; // America/Puerto_Rico is fixed UTC-4, no DST.

// The start of the current "spin day" (last 5:00 AM Puerto Rico time that
// has already passed), as a real UTC Date.
export function currentPeriodStart(now = new Date()) {
  const prShifted = new Date(now.getTime() - PR_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  const periodShifted = new Date(prShifted);
  if (prShifted.getUTCHours() < RESET_HOUR_PR) {
    periodShifted.setUTCDate(periodShifted.getUTCDate() - 1);
  }
  periodShifted.setUTCHours(RESET_HOUR_PR, 0, 0, 0);
  return new Date(periodShifted.getTime() + PR_UTC_OFFSET_HOURS * 60 * 60 * 1000);
}

export function nextResetAt(now = new Date()) {
  return new Date(currentPeriodStart(now).getTime() + 24 * 60 * 60 * 1000);
}

// Same 5:00 AM Puerto Rico anchor, but weekly (Monday). Used only for the
// big-win quota, not the per-user spin limit.
export function currentWeekStart(now = new Date()) {
  const dayStart = currentPeriodStart(now);
  const prShifted = new Date(dayStart.getTime() - PR_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  const dayOfWeek = prShifted.getUTCDay(); // 0=Sun..6=Sat
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const weekShifted = new Date(prShifted);
  weekShifted.setUTCDate(weekShifted.getUTCDate() - daysSinceMonday);
  return new Date(weekShifted.getTime() + PR_UTC_OFFSET_HOURS * 60 * 60 * 1000);
}

export async function countBigWinsThisWeek() {
  const weekStart = currentWeekStart();
  const pages = await queryDatabase(DB.ROUE_CHANCE, {
    or: BIG_WIN_REWARDS.map((reward) => ({ property: "Récompense", select: { equals: reward } })),
  });
  return pages.filter((p) => new Date(getDate(p.properties, "Gagné le")) >= weekStart).length;
}

export function spinCodeFromPageId(pageId) {
  const hex = pageId.replace(/-/g, "").slice(-5).toUpperCase();
  return `LUCKY-${hex}`;
}

// Notion "Catégorie" values each reward requires in the cart to redeem.
// BIG BITES / SMALL BITES currently have zero real products tagged with
// these exact values — every food item is still lumped under the legacy
// "FOOD"/"SIDES" values (see categoryMatch.js). That reward is correctly
// wired for once that Notion cleanup happens, but until then it'll validate
// as "missing item" for every cart, since no product carries those
// categories yet. "Pâtisserie offerte" and "Dessert offert" both map to the
// same SWEETS category — there's no finer distinction in Notion today, so
// they're functionally identical until that category is split further.
export const REWARD_CATEGORY_REQUIREMENTS = {
  [REWARD.ICED_COFFEE_BOGO]: { categories: ["ICED COFFEEs"], minQtyEach: 2 },
  [REWARD.BIG_SMALL_JUICE]: { categories: ["BIG BITES", "SMALL BITES", "SMOOTHIEs & JUICES"], minQtyEach: 1 },
  [REWARD.COFFEE_FREE]: { categories: ["COFFEEs & TEAs"], minQtyEach: 1 },
  [REWARD.PASTRY_FREE]: { categories: ["SWEETS"], minQtyEach: 1 },
  [REWARD.SMOOTHIE_FREE]: { categories: ["SMOOTHIEs & JUICES"], minQtyEach: 1 },
  [REWARD.DESSERT_FREE]: { categories: ["SWEETS"], minQtyEach: 1 },
};

const BRUNCH_CAP = 25;

const PERCENT_BY_REWARD = {
  [REWARD.PERCENT_5]: 0.05,
  [REWARD.PERCENT_10]: 0.1,
  [REWARD.PERCENT_15]: 0.15,
  [REWARD.PERCENT_20]: 0.2,
};

// items: [{ id, price, qty }], categoryById: { [productId]: categorieString }.
// Never trust a client-supplied discount — this always recomputes server-side
// from the live cart + a fresh category lookup (categoryById is built from
// the same getPage() calls the checkout route already makes for availability).
export function computeRewardDiscount(reward, items, categoryById) {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  if (reward === REWARD.REPLAY_TOMORROW) return { valid: true, discount: 0 };

  const percent = PERCENT_BY_REWARD[reward];
  if (percent !== undefined) return { valid: true, discount: round2(subtotal * percent) };

  if (reward === REWARD.BRUNCH_FREE) return { valid: true, discount: round2(Math.min(subtotal, BRUNCH_CAP)) };

  const requirement = REWARD_CATEGORY_REQUIREMENTS[reward];
  if (!requirement) return { valid: false, discount: 0, error: "Récompense inconnue." };

  const qtyByCategory = {};
  for (const item of items) {
    const category = categoryById[item.id];
    qtyByCategory[category] = (qtyByCategory[category] || 0) + item.qty;
  }

  const missing = requirement.categories.filter((cat) => (qtyByCategory[cat] || 0) < requirement.minQtyEach);
  if (missing.length) {
    return { valid: false, discount: 0, error: `Ajoute ${missing.join(" + ")} au panier pour utiliser cette récompense.` };
  }

  // Single-category rewards: the cheapest matching item becomes free.
  // (Combo rewards like Iced Coffee BOGO / Big+Small->juice pick from their
  // own designated "free" category below.)
  const freeCategory =
    reward === REWARD.ICED_COFFEE_BOGO
      ? "ICED COFFEEs"
      : reward === REWARD.BIG_SMALL_JUICE
        ? "SMOOTHIEs & JUICES"
        : requirement.categories[0];

  const matchingItems = items.filter((i) => categoryById[i.id] === freeCategory);
  const cheapest = Math.min(...matchingItems.map((i) => i.price));
  return { valid: true, discount: round2(cheapest) };
}

export function round2(n) {
  return Math.round(n * 100) / 100;
}

function toSpin(page) {
  const props = page.properties;
  return {
    id: page.id,
    code: getTitle(props, "Code"),
    deviceId: getText(props, "Device ID"),
    prenom: getText(props, "Client"),
    reward: getSelect(props, "Récompense"),
    slice: getNumber(props, "Case"),
    wonAt: getDate(props, "Gagné le"),
    expiresAt: getDate(props, "Expire le"),
    claimed: getCheckbox(props, "Réclamée"),
    status: getSelect(props, "Statut"),
  };
}

export async function findSpinsByDevice(deviceId) {
  const pages = await queryDatabase(DB.ROUE_CHANCE, {
    property: "Device ID",
    rich_text: { equals: deviceId },
  });
  return pages.map(toSpin).sort((a, b) => new Date(b.wonAt) - new Date(a.wonAt));
}

async function resolveCartCategories(items) {
  const uniqueIds = [...new Set(items.map((i) => i.id))];
  const categoryById = {};
  await Promise.all(
    uniqueIds.map(async (id) => {
      try {
        const page = await getPage(id);
        if (page?.parent?.database_id === DB.WEBSITE_PRODUCTS) {
          categoryById[id] = getSelect(page.properties, "Catégorie");
        }
      } catch {
        // Unavailable/deleted product — availability is already checked
        // separately in the checkout route; here it just won't match any
        // reward category requirement.
      }
    })
  );
  return categoryById;
}

// Looks up this device's claimed, active, unexpired reward (if any) and
// validates it against the live cart. Re-run independently by both the
// checkout route (to size the PaymentIntent) and the confirm route (to
// mark it used) — never trust a client-supplied discount amount.
export async function resolveActiveReward(deviceId, items) {
  if (!deviceId) return null;

  const spins = await findSpinsByDevice(deviceId);
  const now = new Date();
  const active = spins.find((s) => s.claimed && s.status === "Active" && new Date(s.expiresAt) > now);
  if (!active || active.reward === REWARD.REPLAY_TOMORROW) return null;

  const categoryById = await resolveCartCategories(items);
  const { valid, discount, error } = computeRewardDiscount(active.reward, items, categoryById);

  return { spinId: active.id, reward: active.reward, valid, discount, error: error || null };
}
