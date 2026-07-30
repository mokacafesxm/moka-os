import {
  DB, corsHeaders,
  queryDatabase, withNotionCache, updatePage,
  getTitle, getText, getSelect, getCheckbox, getMultiSelect,
  titleProp, textProp, selectProp, checkboxProp, multiSelectProp,
} from "../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

function normalizeStaff(page) {
  const p = page.properties;
  return {
    id: page.id,
    name: getTitle(p, "Prénom", "prenom", "Nom", "nom", "Name", "name", "Staff"),
    // "Rôle" is rich_text in Notion, not select (lib/ops/staff-service.js
    // already documents this — this read path had never been fixed to match).
    role: getText(p, "Rôle") || getSelect(p, "Role", "role"),
    // "Poste" (Sprint 12) — real select, distinct from the free-text
    // "Rôle" above: drives SplashScreen/StaffContext station filtering.
    poste: getSelect(p, "Poste"),
    // "Access" (Sprint 13) — multi_select gating Admin/OrderPad/Commandes/Livraisons.
    access: getMultiSelect(p, "Access"),
    telephone: getText(p, "Téléphone", "telephone", "Phone"),
    email: getText(p, "Email", "email"),
    // Statut seulement — jamais le hash lui-même (voir /api/staff/verify-pin,
    // seule route autorisée à le comparer côté serveur). L'exposer ici
    // permettrait à n'importe quel appareil chargeant le roster de le
    // récupérer et de le bruteforcer côté client.
    hasPin: Boolean(getText(p, "PIN_Hash")),
    actif: getCheckbox(p, "Actif", "actif", "Active"),
  };
}

export async function GET(request) {
  try {
    // Sprint 15 — /equipe (admin) needs the full roster including staff
    // disabled since (Actif=false), never true for the splash/ClockBar
    // pickers this route also feeds — so the default stays filtered and
    // only ?includeInactive=true opts into the unfiltered list.
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";
    const cacheKey = includeInactive ? "staff:all" : "staff";

    // Sprint 18 — Guillaume était exclu ici pour forcer son accès admin à
    // passer par le PIN admin de la SplashScreen, désormais supprimé (le
    // "Mode Admin →" liste directement les staff avec Access="Admin", donc
    // Guillaume doit apparaître dans cette liste comme n'importe quel autre
    // admin — Valérie, Thibaut).
    const staff = await withNotionCache(cacheKey, 60000, async () => {
      const pages = await queryDatabase(
        DB.STAFF,
        includeInactive ? null : { property: "Actif", checkbox: { equals: true } }
      );
      return pages.map(normalizeStaff);
    });

    return Response.json(staff, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function PATCH(req) {
  try {
    const { id, ...data } = await req.json();
    if (!id) return Response.json({ error: "id required" }, { status: 400, headers: corsHeaders });

    const properties = {};
    if ("nom" in data || "name" in data) {
      const val = data.nom ?? data.name ?? "";
      properties.Nom = titleProp(val);
      properties["Prénom"] = textProp(val);
    }
    if ("poste" in data) properties.Poste = selectProp(data.poste);
    if ("access" in data) properties.Access = multiSelectProp(data.access);
    if ("actif" in data) properties.Actif = checkboxProp(data.actif);
    // PIN de session staff (Sprint 18 — migré depuis localStorage pour
    // fonctionner sur tout appareil). Écrit uniquement, jamais lu ici — voir
    // /api/staff/verify-pin, qui compare côté serveur sans jamais renvoyer
    // le hash au client (normalizeStaff, ci-dessus, ne l'expose pas non plus).
    if ("pinHash" in data) properties.PIN_Hash = textProp(data.pinHash);

    await updatePage(id, properties);
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("[PATCH staff] Exception:", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
