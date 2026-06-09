import {
  DB, corsHeaders,
  queryDatabase, createPage, updatePage,
  getTitle, getText, getSelect, getCheckbox,
  titleProp, textProp, selectProp, checkboxProp, numberProp, relationProp,
} from "../_notion";

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

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

async function listSuppliers() {
  const pages = await queryDatabase(DB.FOURNISSEURS);
  return pages.map((page) => {
    const p = page.properties;
    return {
      id: page.id,
      nom: getTitle(p, "Fournisseur"),
      name: getTitle(p, "Fournisseur"),
      fournisseur: getTitle(p, "Fournisseur"),
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

export async function POST(request) {
  try {
    const { resource, action, id, data } = await request.json();

    // ── LIST ────────────────────────────────────────────────────────────────
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
        properties = {
          "Fournisseur":     titleProp(data?.nom || data?.name || ""),
          "Catégorie":       selectProp(data?.categorie),
          "Contact principal": textProp(data?.contact || ""),
          "Actif":           checkboxProp(data?.actif !== false),
        };
      } else if (resource === "staff") {
        dbId = DB.STAFF;
        properties = {
          "Prénom":  titleProp(data?.nom || data?.name || data?.prenom || ""),
          "Rôle":    selectProp(data?.role),
          "Actif":   checkboxProp(data?.actif !== false),
        };
      } else if (resource === "products") {
        dbId = DB.INGREDIENTS;
        properties = buildProductProperties(data);
        const supplierPageId = await resolveSupplier(data?.fournisseurDefaut);
        if (supplierPageId) properties["Fournisseur par defaut"] = { relation: [{ id: supplierPageId }] };
      } else {
        return Response.json({ error: `create not supported for ${resource}` }, { status: 400, headers: corsHeaders });
      }
      const page = await createPage(dbId, properties);
      return Response.json({ success: true, id: page.id }, { headers: corsHeaders });
    }

    // ── UPDATE ───────────────────────────────────────────────────────────────
    if (action === "update") {
      if (!id) return Response.json({ error: "id required" }, { status: 400, headers: corsHeaders });
      let properties;
      if (resource === "suppliers") {
        properties = {
          "Fournisseur":     titleProp(data?.nom || data?.name || ""),
          "Catégorie":       selectProp(data?.categorie),
          "Contact principal": textProp(data?.contact || ""),
          "Actif":           checkboxProp(data?.actif !== false),
        };
      } else if (resource === "staff") {
        properties = {
          "Prénom": titleProp(data?.nom || data?.name || data?.prenom || ""),
          "Rôle":   selectProp(data?.role),
          "Actif":  checkboxProp(data?.actif !== false),
        };
      } else if (resource === "products") {
        console.log("UPDATE products — id:", id, "| fournisseurDefaut reçu:", data?.fournisseurDefaut);
        properties = buildProductProperties(data);
        const supplierPageId = await resolveSupplier(data?.fournisseurDefaut);
        console.log("UPDATE products — supplierPageId résolu:", supplierPageId);
        if (supplierPageId) {
          properties["Fournisseur par defaut"] = { relation: [{ id: supplierPageId }] };
        } else if (data?.fournisseurDefaut === "") {
          properties["Fournisseur par defaut"] = { relation: [] };
        }
        console.log("UPDATE products — propriétés envoyées à Notion:", JSON.stringify(properties).slice(0, 300));
      } else {
        return Response.json({ error: `update not supported for ${resource}` }, { status: 400, headers: corsHeaders });
      }
      await updatePage(id, properties);
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    // ── ARCHIVE ──────────────────────────────────────────────────────────────
    if (action === "archive") {
      if (!id) return Response.json({ error: "id required" }, { status: 400, headers: corsHeaders });
      await updatePage(id, { "Actif": checkboxProp(false) });
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400, headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
