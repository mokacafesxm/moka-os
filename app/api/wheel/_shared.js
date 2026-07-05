import { DB, queryDatabase, getPage, getTitle, getText, getSelect, getNumber, getCheckbox, getDate } from "../_notion";

// Reward catalogue — kept as literal strings matching the Notion "Récompense"
// select options exactly (see the DB created via the Notion API).
export const REWARD = {
  PERCENT_5: "-5%",
  ICED_COFFEE_BOGO: "Iced Coffee acheté = 1 offert",
  BIG_SMALL_JUICE: "Big Bites + Small Bites achetés = 1 jus offert",
  PERCENT_15: "-15%",
  BRUNCH_FREE: "Brunch offert (max 25€ / 1 pers.)",
};

// 12 slices, weighted so the cheapest-for-the-business reward is the most
// common and the priciest is the rarest: -5% x4, Iced Coffee BOGO x3,
// Big+Small->juice x2, -15% x2, free brunch x1. Interleaved so identical
// rewards never sit on adjacent slices.
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

export function pickRandomSlice() {
  const sliceIndex = Math.floor(Math.random() * SLICES.length);
  return { sliceIndex, reward: SLICES[sliceIndex] };
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

export function spinCodeFromPageId(pageId) {
  const hex = pageId.replace(/-/g, "").slice(-5).toUpperCase();
  return `LUCKY-${hex}`;
}

// Notion "Catégorie" values these combo rewards require. BIG BITES / SMALL
// BITES currently have zero real products tagged with these exact values —
// every food item is still lumped under the legacy "FOOD"/"SIDES" values
// (see categoryMatch.js). These rewards are correctly wired for once that
// Notion cleanup happens, but until then they'll validate as "missing item"
// for every cart, since no product actually carries these categories yet.
export const REWARD_CATEGORY_REQUIREMENTS = {
  [REWARD.ICED_COFFEE_BOGO]: { categories: ["ICED COFFEEs"], minQtyEach: 2 },
  [REWARD.BIG_SMALL_JUICE]: { categories: ["BIG BITES", "SMALL BITES", "SMOOTHIEs & JUICES"], minQtyEach: 1 },
};

const BRUNCH_CAP = 25;

// items: [{ id, price, qty }], categoryById: { [productId]: categorieString }.
// Never trust a client-supplied discount — this always recomputes server-side
// from the live cart + a fresh category lookup (categoryById is built from
// the same getPage() calls the checkout route already makes for availability).
export function computeRewardDiscount(reward, items, categoryById) {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  if (reward === REWARD.PERCENT_5) return { valid: true, discount: round2(subtotal * 0.05) };
  if (reward === REWARD.PERCENT_15) return { valid: true, discount: round2(subtotal * 0.15) };
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

  if (reward === REWARD.ICED_COFFEE_BOGO) {
    const coffeeItems = items.filter((i) => categoryById[i.id] === "ICED COFFEEs");
    const cheapest = Math.min(...coffeeItems.map((i) => i.price));
    return { valid: true, discount: round2(cheapest) };
  }

  if (reward === REWARD.BIG_SMALL_JUICE) {
    const juiceItems = items.filter((i) => categoryById[i.id] === "SMOOTHIEs & JUICES");
    const cheapest = Math.min(...juiceItems.map((i) => i.price));
    return { valid: true, discount: round2(cheapest) };
  }

  return { valid: false, discount: 0, error: "Récompense inconnue." };
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
  if (!active) return null;

  const categoryById = await resolveCartCategories(items);
  const { valid, discount, error } = computeRewardDiscount(active.reward, items, categoryById);

  return { spinId: active.id, reward: active.reward, valid, discount, error: error || null };
}
