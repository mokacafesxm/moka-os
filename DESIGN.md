---
name: MÖKA Drive — Commander
description: Warm café ordering UI for MÖKA Café Saint-Martin — Uber Eats structure, MÖKA warmth.
colors:
  coral: "#C24755"
  brown: "#8C4F2F"
  brown-light: "#976146"
  cream: "#FBF9EE"
  page-bg: "#F5EDE0"
  nav-glass-bg: "#FAF3EB"
  green: "#587F25"
  promo-green: "#A3B987"
  placeholder-tan: "#F0E4D4"
  surface-white: "#FFFFFF"
typography:
  heading:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontWeight: 900
    lineHeight: 1.15
    letterSpacing: "normal"
  body:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontWeight: 400
    fontSize: "0.875rem"
    lineHeight: 1.4
  label:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontWeight: 700
    fontSize: "0.625rem"
    letterSpacing: "0.05em"
rounded:
  pill: "9999px"
  lg: "24px"
  md: "16px"
  sm: "12px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
components:
  button-primary:
    backgroundColor: "{colors.coral}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
    padding: "14px 24px"
  button-primary-disabled:
    backgroundColor: "{colors.brown-light}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
    padding: "14px 24px"
  chip-variant-selected:
    backgroundColor: "{colors.coral}"
    textColor: "#FFFFFF"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  chip-variant:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.brown}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  card-product:
    backgroundColor: "{colors.surface-white}"
    rounded: "{rounded.lg}"
    width: "144px"
    height: "144px"
  card-cart-line:
    backgroundColor: "{colors.surface-white}"
    rounded: "{rounded.md}"
    padding: "12px"
---

# Design System: MÖKA Drive — Commander

## 1. Overview

**Creative North Star: "The Neighborhood Café, Ordered Like Uber Eats"**

MÖKA Drive borrows the *structure* of a modern food-ordering app — sticky category strip, tappable product cards, a bottom sheet for variants, a floating nav with a live cart badge — and refuses its cold, corporate palette. Every surface stays in the café's own register: warm cream and tan backgrounds, cocoa-brown ink, a single coral accent reserved for the one action that matters (add to cart, checkout). Nothing here should read as a white-label delivery platform; it should read as a family café that happens to have a very well-organized menu.

The system is deliberately calm at rest and expressive only at the moment of feedback: a heart pops, a cart badge bumps, a bottom sheet slides up. Motion is small, fast (250–350ms), and always tied to a user action — never ambient or decorative.

**Key Characteristics:**
- Warm, tinted-neutral surfaces (cream/tan) — never stark white as a page background.
- One accent color (coral) doing all of the "act now" work; everything else is ink, brown, or green.
- Pill shapes everywhere interaction happens (buttons, nav, chips, search); generous 24px rounding on photographic tiles and sheets.
- Micro-feedback (bump, pop, slide-up, fade) confirms every tap without slowing the tap down.

## 2. Colors

Warm, low-saturation neutrals carry the page; coral is the only saturated color, and it appears in exactly one role.

### Primary
- **Coral** (#C24755): the single call-to-action color. "Add to cart," the cart badge, the checkout CTA, selected variant chips. Never used decoratively — its scarcity is what makes it register as "go."

### Secondary
- **Café Green** (#587F25): status and orientation, not action. The top announcement strip, the "Back Soon" unavailable badge, the active-category focus ring. Reads as "informational," distinct from coral's "actionable."
- **Promo Green** (#A3B987): the muted tint used only inside the promo carousel band.

### Neutral
- **Cocoa Brown** (#8C4F2F): all headings, product names, and primary ink on cream surfaces.
- **Brown Light** (#976146): secondary text — category labels, prices, descriptions, borders on inputs and chips.
- **Cream** (#FBF9EE): the card and sheet surface color (nav strip, popup sheet, main content backdrop).
- **Page Background** (#F5EDE0): the outermost `html`/`body` background, one shade warmer/deeper than Cream — gives the cream cards and sheets something to sit on top of.
- **Nav Glass Base** (#FAF3EB at 70% opacity): the floating bottom nav's frosted-glass tint, combined with backdrop blur.
- **Placeholder Tan** (#F0E4D4): fallback background behind a product's initial letter when no photo exists.
- **Surface White** (#FFFFFF): reserved for small elements that need to pop off the cream — product image tiles, cart line cards, stepper buttons, favorite-heart circles.

### Named Rules
**The Coral Reserve Rule.** Coral is the app's only saturated color and it is spent on exactly one thing per screen: the primary action. It never appears on a badge, a label, or a decorative accent — if it's coral, it's tappable and it matters.

**The No-Stark-White-Page Rule.** Page backgrounds are always Cream or Page Background, never pure white. White is a foreground material (cards, buttons, stepper pills) that sits *on* the warm backdrop, not the backdrop itself.

## 3. Typography

**Body/Heading Font:** Arial, Helvetica, sans-serif (system stack; no custom body webfont loaded)
**Reserved Accent Font:** Dancing Script (loaded via `next/font/google` in `app/commander/layout.js` as `--font-script`) — currently wired into the layout but not yet applied to any visible element. Treat as available brand-script capital for a future signature moment (e.g. a hero greeting), not as an active token.

**Character:** A single confident sans stack carries the whole interface — hierarchy comes from weight (black for names and prices, bold for labels) and color (brown vs. brown-light), not from font-pairing. This keeps the dense, tappable menu grid legible at small sizes.

### Hierarchy
- **Headline** (font-black/900, 1.25rem, tight line-height): product-popup title, section headers.
- **Title** (font-bold/700, 0.875rem–1rem): product-card names, cart-line names.
- **Body** (regular/400, 0.875rem): descriptions, search input text.
- **Label** (bold/700, 0.625rem–0.6875rem, uppercase, tracked): category labels under nav icons, "Back Soon" badges, variant group headers.

### Named Rules
**The Weight-Over-Family Rule.** Never introduce a second font family for emphasis. Move up the weight ramp (400 → 700 → 900) and switch brown → brown-light for de-emphasis instead.

## 4. Elevation

Mostly flat: cream surfaces sit directly on the page background with no shadow. Elevation is reserved for elements that must visually "float" above scrolling content — the bottom nav and the product-popup sheet.

### Shadow Vocabulary
- **card-lift** (`box-shadow: 0 1px 3px rgba(0,0,0,0.1)` / Tailwind `shadow-sm`/`shadow-md`): product-card image tiles, cart-line cards, stepper buttons — just enough to separate white foreground elements from the cream backdrop.
- **toast-float** (Tailwind `shadow-lg`): the toast confirmation, floating free of any container.
- **nav-glass** (`box-shadow: 0 8px 30px rgba(44,26,16,0.16)` + `backdrop-filter: blur(20px) saturate(180%)` + `border: 1px solid rgba(255,255,255,0.35)`): the floating bottom nav only. This is the system's one deliberate glassmorphism moment — used because the nav must stay legible over scrolling photos beneath it, not for decoration.

### Named Rules
**The One Glass Rule.** Backdrop-blur glass is reserved for the bottom nav alone. It exists to keep icons legible over content scrolling underneath it, not as a stylistic default — no other card, sheet, or panel uses blur.

## 5. Components

### Buttons
- **Shape:** Full pill (`rounded-full`, {rounded.pill}) for every primary and stepper button; 24px (`rounded-3xl`) for variant-selection chips.
- **Primary:** Coral fill, white text, `font-bold`, min-height 44px (`button-primary`). Disabled state swaps fill to Brown Light at 60% opacity with a `cursor-not-allowed` state, never coral-at-low-opacity.
- **Stepper (quantity ±):** White circle, `shadow-sm`, brown icon, 44×44px minimum tap target.
- **Icon-only (favorite, close):** White circle on `shadow`, brown or coral icon depending on state; a "pop" scale animation on toggle.

### Chips (Variant Tiles)
- **Style:** `rounded-3xl` pill-ish tile, white background with brown-light border by default.
- **State:** Selected swaps to solid Coral fill with Coral border and white text (`chip-variant-selected`) — same coral-reserve logic as buttons.

### Cards / Containers
- **Product Card:** 144×144px white image tile, `rounded-3xl` (24px), `shadow-md`, `active:scale-[0.97]` tap feedback. Category label (brown-light) → name (brown, bold) → price (brown-light, semibold) stacked below, no card chrome around the text.
- **Cart Line:** White `rounded-2xl` (16px) row card, `shadow-sm`, 12px internal padding, thumbnail + name/variant + quantity stepper pill.
- **Product Popup (bottom sheet):** Cream `rounded-t-3xl` sheet sliding up from the bottom (`animate-sheet-up`, 280ms ease-out), full-bleed photo header, scrollable body, sticky footer bar with stepper + full-width coral CTA.

### Inputs / Fields
- **Search Bar:** White `rounded-full` pill, brown-light border, brown text, brown-light placeholder, `focus-within` ring in Café Green offset 2px.
- **Focus treatment:** Green focus ring (`ring-[#587F25]`) is the one consistent focus indicator across search, category icons, and card tap targets — never a color other than green, to keep it distinct from the coral action color.

### Navigation
- **Category Nav:** Sticky top strip, translucent cream backdrop-blur, horizontal-scroll snap on mobile / centered grid on desktop (`md:grid`). Active category shown via a Café Green ring around the icon, never a background fill.
- **Bottom Nav:** Floating glass pill, fixed to the bottom center, home/favorites/cart/account icons. Cart badge is Coral with a white number and a 350ms "bump" animation on increment. The pill itself contracts (less gap/padding) while the page is scrolling, expanding back at rest.

### Top Bar
- Café Green full-width strip above the header: social icons, "ORDER TAKEAWAY ONLINE!" announcement, and the current pickup location — the one place a solid color block, rather than cream, is the background.

## 6. Do's and Don'ts

### Do:
- **Do** keep coral to exactly one actionable element per screen (primary CTA, selected chip, cart badge) — its rarity is what signals "tap me."
- **Do** use Café Green only for status/orientation (badges, focus rings, active-category indicator, top strip) — never for a primary action.
- **Do** keep every page background in the Cream/Page-Background family; white is a foreground-only material for cards and controls.
- **Do** reach for the Uber Eats-grade structure (sticky category strip, tappable card grid, bottom-sheet variant picker) when it improves clarity and speed — that reference is explicitly about information hierarchy, not visual style.
- **Do** give every tap 44px+ touch targets and pair it with a small, fast (≤350ms) feedback animation (bump, pop, scale, slide).
- **Do** respect `prefers-reduced-motion` — swap bump/pop/slide animations for instant or crossfade equivalents.

### Don't:
- **Don't** let the interface read as a generic delivery-platform white-label (Uber Eats / Deliveroo / McDo's actual palette and chrome) — MÖKA's warmth (cream, brown, coral) must stay dominant even where the layout borrows platform-grade structure.
- **Don't** introduce a second saturated accent color competing with coral. If something new needs emphasis, use weight or the existing green, not a new hue.
- **Don't** apply backdrop-blur glass anywhere except the bottom nav — it's a functional exception (legibility over scrolling content), not a stylistic default.
- **Don't** use a stark pure-white page background — Cream/Page-Background only.
- **Don't** add gradient text, side-stripe borders, or decorative card chrome — this system's texture comes from color and weight, not from ornamental borders or gradients.
- **Don't** use Dancing Script anywhere yet without a deliberate decision — it's loaded but unassigned; wire it up intentionally for one signature moment, not as a default heading font.
