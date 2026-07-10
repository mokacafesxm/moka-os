// Parses the "Extras" rich_text property — independent add-on groups (e.g.
// "Sirop" on hot coffees, "Choose Your Protein" on Small/Big Bites), separate
// from the "Variantes" cartesian dimensions (Lait, Taille). Extras are always
// optional and additively priced, and a group can allow zero, one, or several
// selections — none of which the mandatory single-choice Variantes model can
// represent. Shape: [{ name, type: "single"|"multi", options: [{ label,
// price, freeText?, freeTextLabel? }] }].
export function parseExtras(prop) {
  const raw = (prop?.rich_text || []).map((rt) => rt.plain_text ?? "").join("");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
