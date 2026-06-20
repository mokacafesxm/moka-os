import {
  DB, corsHeaders,
  notionFetch, queryDatabase, createPage, updatePage,
  getTitle, getText, getSelect, getCheckbox,
  titleProp, textProp, selectProp, checkboxProp, numberProp, relationProp,
} from "../_notion";

// ── Shared property builders ─────────────────────────────────────────────────

function buildSupplierProperties(data) {
  const props = {
    "Fournisseur":       titleProp(data?.nom || data?.name || ""),
    "Catégorie":         selectProp(data?.categorie),
    "Contact principal": textProp(data?.contact || data?.methodeContact || ""),
    "Actif":             checkboxProp(data?.actif !== false),
  };
  // WhatsApp / Email : included only when non-empty to avoid Notion type errors
  // if these Notion columns are phone_number or email type rather than rich_text,
  // replace textProp with { phone_number: v } or { email: v } respectively.
  const tel = data?.telephone || data?.whatsapp || "";
  const email = data?.email || "";
  if (tel)   props["WhatsApp"] = textProp(tel);
  if (email) props["Email"]    = textProp(email);
  return props;
}

function buildStaffProperties(data) {
  const props = {
    "Prénom": titleProp(data?.nom || data?.name || data?.prenom || ""),
    "Rôle":   selectProp(data?.categorie || data?.role),
    "Actif":  checkboxProp(data?.actif !== false),
  };
  const tel   = data?.telephone || "";
  const email = data?.email || "";
  if (tel)   props["Téléphone"] = textProp(tel);
  if (email) props["Email"]     = textProp(email);
  return props;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function resolveSupplier(name) {
  if (!name) return null;
  try {
    const pages = await queryDatabase(DB.FOURNISSEURS);
    const clean = name.trim().toLowerCase();
    const found = pages.find((p) => {
      const t = String(
        p.properties?.Fournisseur?.title?.[0]?.plain_text ||
        p.properties?.Nom?.title?.[0]?.plain_text ||
        ""
      ).trim().toLowerCase();
      return t === clean;
    });
    const supplierId = found?.id || null;
    console.log("resolveSupplier:", name, "→", supplierId);
    return supplierId;
  } catch { return null; }
}

function buildProductProperties(data) {
  return {
    "Ingredient":                 titleProp(data?.ingredient || data?.name || ""),
    "Categorie":                  selectProp(data?.categorie),
    "Sous-categorie":             selectProp(data?.sousCategorie),
    "Visible_OrderPad":           checkboxProp(data?.visibleOrderPad),
    "Zone_stockage":              selectProp(data?.zoneStockage),
    "Quantite_commande_suggeree": numberProp(data?.quantiteCommandeSuggeree ?? data?.quantiteCommandee ?? null),
    "Unite_stock":                selectProp(data?.uniteStock),
    "Unite_commande":             selectProp(data?.uniteCommande),
    "1 Portion (g)":              numberProp(data?.portionGrammes ?? data?.portion ?? null),
    "Seuil_alerte":               numberProp(data?.seuilAlerte ?? null),
    "Seuil_critique":             numberProp(data?.seuilCritique ?? null),
  };
}

// ── List helpers ─────────────────────────────────────────────────────────────

async function listSuppliers() {
  const pages = await queryDatabase(DB.FOURNISSEURS);
  return pages.map((page) => {
    const p = page.properties;
    const nom = getTitle(p, "Fournisseur", "Nom", "nom");
    return {
      id: page.id,
      nom,
      name: nom,
      fournisseur: nom,
      categorie: getSelect(p, "Catégorie"),
      contact: getText(p, "Contact principal"),
      telephone: getText(p, "WhatsApp"),
      whatsapp: getText(p, "WhatsApp"),
      email: getText(p, "Email"),
      actif: getCheckbox(p, "Actif"),
    };
  });
}

async function listStaff() {
  const pages = await queryDatabase(DB.STAFF);
  return pages.map((page) => {
    const p = page.properties;
    return {
      id: page.id,
      nom: getTitle(p, "Prénom", "Nom", "Name", "name"),
      name: getTitle(p, "Prénom", "Nom", "Name", "name"),
      prenom: getTitle(p, "Prénom", "Nom", "Name", "name"),
      role: getSelect(p, "Rôle", "Role", "role"),
      categorie: getSelect(p, "Rôle", "Role", "role"),
      telephone: getText(p, "Téléphone", "telephone"),
      email: getText(p, "Email", "email"),
      actif: getCheckbox(p, "Actif", "actif"),
    };
  });
}

async function listFromIngredients(prop) {
  const pages = await queryDatabase(DB.INGREDIENTS, null, null, 200);
  const values = new Set();
  for (const page of pages) {
    const v = getSelect(page.properties, prop);
    if (v) values.add(v);
  }
  return [...values].sort().map((v) => ({ id: v, name: v }));
}

// ── Route handlers ───────────────────────────────────────────────────────────

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request) {
  let resource, action, id, data;
  try {
    ({ resource, action, id, data } = await request.json());
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: corsHeaders });
  }

  console.log("[api/settings]", action, resource, id ? `id:${id}` : "");

  try {
    // ── LIST ─────────────────────────────────────────────────────────────────
    if (action === "list") {
      if (resource === "suppliers")     return Response.json(await listSuppliers(), { headers: corsHeaders });
      if (resource === "staff")         return Response.json(await listStaff(), { headers: corsHeaders });
      if (resource === "categories")    return Response.json(await listFromIngredients("Categorie"), { headers: corsHeaders });
      if (resource === "subcategories") return Response.json(await listFromIngredients("Sous-categorie"), { headers: corsHeaders });
      if (resource === "units")         return Response.json(await listFromIngredients("Unite_stock"), { headers: corsHeaders });
      if (resource === "zones")         return Response.json(await listFromIngredients("Zone_stockage"), { headers: corsHeaders });
      return Response.json({ error: `Unknown resource: ${resource}` }, { status: 400, headers: corsHeaders });
    }

    // ── CREATE ───────────────────────────────────────────────────────────────
    if (action === "create") {
      let dbId, properties;

      if (resource === "suppliers") {
        dbId = DB.FOURNISSEURS;
        properties = buildSupplierProperties(data);
      } else if (resource === "staff") {
        dbId = DB.STAFF;
        properties = buildStaffProperties(data);
      } else if (resource === "products") {
        dbId = DB.INGREDIENTS;
        properties = buildProductProperties(data);
        const supplierPageId = data?.fournisseurId || await resolveSupplier(data?.fournisseurDefaut);
        if (supplierPageId) properties["Fournisseur par defaut"] = { relation: [{ id: supplierPageId }] };
      } else {
        return Response.json({ error: `create not supported for ${resource}` }, { status: 400, headers: corsHeaders });
      }

      console.log("[api/settings create] dbId:", dbId, "properties:", JSON.stringify(properties));

      const page = await createPage(dbId, properties);

      if (resource === "products") {
        const supplierPageId = data?.fournisseurId || await resolveSupplier(data?.fournisseurDefaut);
        if (supplierPageId) {
          await notionFetch(`/pages/${page.id}`, {
            method: "PATCH",
            body: JSON.stringify({ properties: { "Fournisseur par defaut": { relation: [{ id: supplierPageId }] } } }),
          });
        }
      }

      return Response.json({ success: true, id: page.id }, { headers: corsHeaders });
    }

    // ── UPDATE ───────────────────────────────────────────────────────────────
    if (action === "update") {
      if (!id) return Response.json({ error: "id required" }, { status: 400, headers: corsHeaders });

      let properties;
      if (resource === "suppliers") {
        properties = buildSupplierProperties(data);
      } else if (resource === "staff") {
        properties = buildStaffProperties(data);
      } else if (resource === "products") {
        properties = buildProductProperties(data);
        const supplierPageId = data?.fournisseurId || await resolveSupplier(data?.fournisseurDefaut);
        console.log("UPDATE products — fournisseurId:", data?.fournisseurId, "| résolu:", supplierPageId);
        if (supplierPageId) properties["Fournisseur par defaut"] = { relation: [{ id: supplierPageId }] };
      } else {
        return Response.json({ error: `update not supported for ${resource}` }, { status: 400, headers: corsHeaders });
      }

      console.log("[api/settings update] id:", id, "properties:", JSON.stringify(properties));

      await updatePage(id, properties);

      if (resource === "products") {
        const supplierPageId = data?.fournisseurId || await resolveSupplier(data?.fournisseurDefaut);
        if (supplierPageId) {
          await notionFetch(`/pages/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ properties: { "Fournisseur par defaut": { relation: [{ id: supplierPageId }] } } }),
          });
        }
      }

      return Response.json({ success: true }, { headers: corsHeaders });
    }

    // ── ARCHIVE ──────────────────────────────────────────────────────────────
    if (action === "archive") {
      if (!id) return Response.json({ error: "id required" }, { status: 400, headers: corsHeaders });

      let notionRes;
      if (resource === "suppliers") {
        // Real deletion — page removed from Notion
        notionRes = await notionFetch(`/pages/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ archived: true }),
        });
      } else if (resource === "staff") {
        // Soft disable — checkbox Actif = false, page stays in Notion
        notionRes = await notionFetch(`/pages/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ properties: { "Actif": { checkbox: false } } }),
        });
      } else {
        return Response.json({ error: `archive not supported for ${resource}` }, { status: 400, headers: corsHeaders });
      }

      console.log("[api/settings archive]", resource, id, "→ Notion status:", notionRes.status);

      if (!notionRes.ok) {
        const errBody = await notionRes.text().catch(() => "");
        console.error("[api/settings archive] Notion error:", errBody);
        return Response.json(
          { success: false, error: `Notion ${notionRes.status}: ${errBody.slice(0, 300)}` },
          { status: 500, headers: corsHeaders }
        );
      }

      return Response.json({ success: true }, { headers: corsHeaders });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400, headers: corsHeaders });

  } catch (err) {
    console.error("[api/settings] error:", action, resource, err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
