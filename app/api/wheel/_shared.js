import crypto from "crypto";
import { DB, queryDatabase, getPage, createPage, updatePage, getSelect, getTitle, getDate, titleProp, dateProp } from "../_notion";
import { clientHasActiveReward } from "../_clients";

// Reward catalogue — literal strings written verbatim into the Notion
// "Récompense" select (the API auto-creates any missing option on write).
// Order below === slice order on the wheel (index = MokaPrizeWheel petal).
export const REWARD = {
  COFFEE_FREE: "Café offert",
  PASTRY_FREE: "Pâtisserie offerte",
  SMOOTHIE_HALF: "Smoothie -50%",
  MILKSHAKE_HALF: "Milkshake -50%",
  BRUNCH_15: "-15% sur un brunch",
  DESSERT_FREE: "Dessert offert",
  MATCHA_FREE: "Upgrade matcha offert",
  GOLDEN_TICKET: "Golden Ticket — 1 article offert",
  PANCAKES_HALF: "Pancakes -50%",
  BAGEL_TOAST_HALF: "Bagel ou toast -50%",
  REPLAY_TOMORROW: "A other chance tomorrow",
  BREAKFAST_TWO: "Breakfast for two",
};

// index = slice position; MUST match MokaPrizeWheel's PRIZES order 1:1.
export const SLICES = [
  REWARD.COFFEE_FREE,
  REWARD.PASTRY_FREE,
  REWARD.SMOOTHIE_HALF,
  REWARD.MILKSHAKE_HALF,
  REWARD.BRUNCH_15,
  REWARD.DESSERT_FREE,
  REWARD.MATCHA_FREE,
  REWARD.GOLDEN_TICKET,
  REWARD.PANCAKES_HALF,
  REWARD.BAGEL_TOAST_HALF,
  REWARD.REPLAY_TOMORROW,
  REWARD.BREAKFAST_TWO,
];

// Weighted so the cheapest-for-the-business outcomes dominate; the two "big
// win" rewards are additionally hard-capped weekly below (see decideReward).
// Weights sum to 1000 for readable percentages.
const WEIGHT = {
  [REWARD.COFFEE_FREE]: 150, // 15%
  [REWARD.PASTRY_FREE]: 90, // 9%
  [REWARD.SMOOTHIE_HALF]: 90, // 9%
  [REWARD.MILKSHAKE_HALF]: 90, // 9%
  [REWARD.BRUNCH_15]: 60, // 6%
  [REWARD.DESSERT_FREE]: 70, // 7%
  [REWARD.MATCHA_FREE]: 90, // 9%
  [REWARD.GOLDEN_TICKET]: 15, // 1.5% — big win
  [REWARD.PANCAKES_HALF]: 90, // 9%
  [REWARD.BAGEL_TOAST_HALF]: 95, // 9.5%
  [REWARD.REPLAY_TOMORROW]: 150, // 15%
  [REWARD.BREAKFAST_TWO]: 10, // 1% — big win
};

// Both big-win rewards share ONE combined weekly quota. countBigWinsThisWeek
// counts wins across the whole list, so whichever one is drawn checks the same
// counter — the cap and the consolation fire for either, independently of
// which happened to be drawn first this week.
const BIG_WIN_REWARDS = [REWARD.GOLDEN_TICKET, REWARD.BREAKFAST_TWO];
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

// Pure decision (no Notion) so it's directly testable: given the drawn reward
// and how many big wins already happened this week, return the slice to land
// on. Any big-win reward downgrades to the consolation once the shared weekly
// quota is spent — same rule for both, never just the first one drawn.
export function decideReward(picked, bigWinsThisWeek) {
  if (BIG_WIN_REWARDS.includes(picked) && bigWinsThisWeek >= BIG_WIN_WEEKLY_CAP) {
    return { sliceIndex: sliceIndexForReward(BIG_WIN_CONSOLATION), reward: BIG_WIN_CONSOLATION, downgraded: true };
  }
  return { sliceIndex: sliceIndexForReward(picked), reward: picked, downgraded: false };
}

// The full spin decision: weighted pick, then downgrade to the consolation if
// the weekly big-win quota is already spent. Returns the *actual* slice to land
// on — never claims a big win and then swaps the prize.
export async function pickReward() {
  const picked = pickWeightedSlice();
  const bigWinsThisWeek = BIG_WIN_REWARDS.includes(picked) ? await countBigWinsThisWeek() : 0;
  const { sliceIndex, reward } = decideReward(picked, bigWinsThisWeek);
  return { sliceIndex, reward };
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
  // Filter by date, then count big wins in JS — do NOT filter by
  // `select: { equals: reward }`. Notion returns a 400 validation error when
  // the filtered select option doesn't exist yet, and a big-win option only
  // comes into being once one has been recorded. That chicken-and-egg would
  // 400 on the very first big-win spin (the count runs before the record is
  // written). A date filter has no such dependency.
  const pages = await queryDatabase(DB.ROUE_CHANCE, {
    property: "Gagné le",
    date: { on_or_after: weekStart.toISOString() },
  });
  const bigWins = new Set(BIG_WIN_REWARDS);
  return pages.filter((p) => bigWins.has(getSelect(p.properties, "Récompense"))).length;
}

export function spinCodeFromPageId(pageId) {
  const hex = pageId.replace(/-/g, "").slice(-5).toUpperCase();
  return `LUCKY-${hex}`;
}

// ── Checkout redemption ──────────────────────────────────────────────────────
//
// Exact Notion "Catégorie" select values (verified against the live
// website-products DB — note "ICED MATCHA &UBE" has no space before UBE).
const CAT_COFFEE = "COFFEEs & TEAs";
const CAT_SMOOTHIE = "SMOOTHIEs & JUICES";
const CAT_MILKSHAKE = "MILKSHAKEs";
const CAT_MATCHA = "ICED MATCHA &UBE";

// No Notion category cleanly isolates these, so — per product decision — they
// are targeted product-name allowlists (exact names verified in the live
// website-products DB, matched case-insensitively). Edit these lists to change
// which products a reward applies to.
//   • "SCRAMBLED EGG TOAST" also covers its "Truffe" variant (same product).
//   • PASTRY/DESSERT share one sweets list (Notion has no SWEETS category;
//     these sit inside FOOD). ADJUST if the café wants a different split.
const PANCAKES_PRODUCTS = ["RED BERRIES PANCAKES", "PEANUT BUTTER PANCAKES", "JUST LIKE HOME"];
const BAGEL_TOAST_PRODUCTS = ["LOX BAGEL", "SCRAMBLED EGG TOAST", "SMASHED AVOCADO", "SALMON TOAST"];
const PASTRY_DESSERT_PRODUCTS = ["BANANA BREAD", "PANNA COTTA PASSION", "TIRAMISU Coffee&Amaretto", "CLASSIC BUN"];

const BRUNCH_PERCENT = 0.15;
const BREAKFAST_TWO_CAP = 25;

const normName = (s) => (s || "").trim().toUpperCase().replace(/\s+/g, " ");
const byCategory = (category) => (info) => !!info && info.category === category;
const byProductName = (list) => {
  const set = new Set(list.map(normName));
  return (info) => !!info && set.has(normName(info.name));
};

// rate: 1 = cheapest matching item free, 0.5 = 50% off the cheapest matching
// item. match(info) decides which cart items qualify. hint fills the
// "add X to your cart" error when nothing qualifies.
const ITEM_REWARDS = {
  [REWARD.COFFEE_FREE]: { rate: 1, match: byCategory(CAT_COFFEE), hint: "un café" },
  [REWARD.PASTRY_FREE]: { rate: 1, match: byProductName(PASTRY_DESSERT_PRODUCTS), hint: "une pâtisserie" },
  [REWARD.DESSERT_FREE]: { rate: 1, match: byProductName(PASTRY_DESSERT_PRODUCTS), hint: "un dessert" },
  [REWARD.MATCHA_FREE]: { rate: 1, match: byCategory(CAT_MATCHA), hint: "un matcha glacé" },
  [REWARD.GOLDEN_TICKET]: { rate: 1, match: () => true, hint: "un article" },
  [REWARD.SMOOTHIE_HALF]: { rate: 0.5, match: byCategory(CAT_SMOOTHIE), hint: "un smoothie ou un jus" },
  [REWARD.MILKSHAKE_HALF]: { rate: 0.5, match: byCategory(CAT_MILKSHAKE), hint: "un milkshake" },
  [REWARD.PANCAKES_HALF]: { rate: 0.5, match: byProductName(PANCAKES_PRODUCTS), hint: "des pancakes" },
  [REWARD.BAGEL_TOAST_HALF]: { rate: 0.5, match: byProductName(BAGEL_TOAST_PRODUCTS), hint: "un bagel ou un toast" },
};

// items: [{ id, price, qty }], infoById: { [productId]: { category, name } }.
// Never trust a client-supplied discount — this always recomputes server-side
// from the live cart + a fresh Notion lookup (infoById is built from the same
// getPage() calls the checkout route already makes for availability).
export function computeRewardDiscount(reward, items, infoById) {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  if (reward === REWARD.REPLAY_TOMORROW) return { valid: true, discount: 0 };
  if (reward === REWARD.BRUNCH_15) return { valid: true, discount: round2(subtotal * BRUNCH_PERCENT) };
  if (reward === REWARD.BREAKFAST_TWO) return { valid: true, discount: round2(Math.min(subtotal, BREAKFAST_TWO_CAP)) };

  const cfg = ITEM_REWARDS[reward];
  if (!cfg) return { valid: false, discount: 0, error: "Récompense inconnue." };

  const qualifying = items.filter((i) => cfg.match(infoById[i.id]));
  if (!qualifying.length) {
    return { valid: false, discount: 0, error: `Ajoute ${cfg.hint} au panier pour utiliser cette récompense.` };
  }

  // Single-item benefit: the cheapest qualifying item is the one discounted.
  const cheapest = Math.min(...qualifying.map((i) => i.price));
  return { valid: true, discount: round2(cheapest * cfg.rate) };
}

export function round2(n) {
  return Math.round(n * 100) / 100;
}

async function resolveCartInfo(items) {
  const uniqueIds = [...new Set(items.map((i) => i.id))];
  const infoById = {};
  await Promise.all(
    uniqueIds.map(async (id) => {
      try {
        const page = await getPage(id);
        if (page?.parent?.database_id === DB.WEBSITE_PRODUCTS) {
          infoById[id] = { category: getSelect(page.properties, "Catégorie"), name: getTitle(page.properties, "Name") };
        }
      } catch {
        // Unavailable/deleted product — availability is already checked
        // separately in the checkout route; here it just won't match any
        // reward requirement.
      }
    })
  );
  return infoById;
}

// Validates the client's active reward (already fetched by the caller —
// checkout/confirm both need the Client record for other reasons anyway,
// so this never re-fetches it) against the live cart. Re-run independently
// by both the checkout route (to size the PaymentIntent) and the confirm
// route (to mark it used) — never trust a client-supplied discount amount.
export async function resolveActiveRewardForClient(client, items) {
  if (!clientHasActiveReward(client) || client.activeReward === REWARD.REPLAY_TOMORROW) return null;

  const infoById = await resolveCartInfo(items);
  const { valid, discount, error } = computeRewardDiscount(client.activeReward, items, infoById);

  return { spinId: client.activeSpinId, reward: client.activeReward, valid, discount, error: error || null };
}

// A random, non-guessable code for a spin that hasn't been persisted to
// Notion yet (anonymous spin, pending phone verification) — once verified,
// this same code is written as the spin record's title.
export function randomSpinCode() {
  return `LUCKY-${crypto.randomBytes(3).toString("hex").toUpperCase().slice(0, 5)}`;
}

// Anonymous anti-abuse: a coarse fingerprint (never a substitute for a real
// account — just enough friction to stop a casual "clear localStorage and
// spin again" retry) hashed from request signals the client can't easily
// fake without also faking their whole network/browser identity.
export function computeFingerprint(request, screenResolution) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const ua = request.headers.get("user-agent") || "unknown";
  return crypto.createHash("sha256").update(`${ip}|${ua}|${screenResolution || "unknown"}`).digest("hex");
}

export async function findAnonymousSpin(hash) {
  const pages = await queryDatabase(DB.SPINS_ANONYMES, { property: "Hash", title: { equals: hash } }, null, 1);
  if (!pages[0]) return null;
  return { id: pages[0].id, lastSpin: getDate(pages[0].properties, "Dernier spin") };
}

export async function recordAnonymousSpin(hash) {
  const existing = await findAnonymousSpin(hash);
  const now = dateProp(new Date().toISOString());
  if (existing) {
    await updatePage(existing.id, { "Dernier spin": now });
  } else {
    await createPage(DB.SPINS_ANONYMES, { "Hash": titleProp(hash), "Dernier spin": now });
  }
}
